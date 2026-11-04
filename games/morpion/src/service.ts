import { randomUUID } from "node:crypto";
import { getUser, getUsersByIds, listUsers, notify } from "@app/core";
import { db, withTx, type DbTx } from "@app/db";
import { z } from "zod";
import { place, type GameView, type ThemeId } from "./game";

export class MorpionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const identity = z.string().min(1).max(200);
const themes = z.enum(["mario", "sw", "simpson", "got", "ghibli"]);
const createInput = z.object({ userId: identity, partnerId: identity, theme: themes });
const actionInput = z.object({
  userId: identity,
  id: z.uuid(),
  version: z.number().int().nonnegative(),
  action: z.enum(["accept", "cancel", "move"]),
  cell: z.number().int().min(0).max(8).optional(),
});

async function load(id: string, client: DbTx = db) {
  const game = await client.morpionGame.findUnique({ where: { id } });
  if (!game) throw new MorpionError(404, "Partie introuvable.");
  return game;
}
function seat(game: { userA: string; userB: string }, userId: string): 0 | 1 {
  if (userId === game.userA) return 0;
  if (userId === game.userB) return 1;
  throw new MorpionError(403, "Cette partie est réservée à ses deux joueurs.");
}

export async function getGame(userId: string, id: string): Promise<GameView> {
  identity.parse(userId);
  z.uuid().parse(id);
  const game = await load(id);
  const mySeat = seat(game, userId);
  const users = await getUsersByIds([game.userA, game.userB]);
  const player = (id: string) => {
    const user = users.find((u) => u.id === id);
    return { id, name: user?.name ?? "Membre", image: user?.image ?? null };
  };
  const won = await db.morpionGame.findMany({
    where: {
      status: "WON",
      OR: [
        { userA: game.userA, userB: game.userB },
        { userA: game.userB, userB: game.userA },
      ],
    },
    select: { userA: true, userB: true, winner: true },
  });
  const score: [number, number] = [0, 0];
  for (const round of won) {
    const winner = round.winner === 0 ? round.userA : round.userB;
    score[winner === game.userA ? 0 : 1]++;
  }
  return {
    id: game.id,
    players: [player(game.userA), player(game.userB)],
    mySeat,
    theme: game.theme as ThemeId,
    board: game.board,
    status: game.status,
    turn: game.turn,
    winner: game.winner,
    version: game.version,
    updatedAt: game.updatedAt.toISOString(),
    score,
  };
}

export async function listGames(userId: string) {
  identity.parse(userId);
  const rows = await db.morpionGame.findMany({
    where: { OR: [{ userA: userId }, { userB: userId }] },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  const users = await getUsersByIds(rows.flatMap((g) => [g.userA, g.userB]));
  return rows.map((g) => ({
    id: g.id,
    theme: g.theme as ThemeId,
    status: g.status,
    incoming: g.userB === userId,
    myTurn: g.status === "PLAYING" && (g.userA === userId ? 0 : 1) === g.turn,
    partner: users.find((u) => u.id === (g.userA === userId ? g.userB : g.userA))?.name ?? "Membre",
  }));
}
export async function listPartners(userId: string) {
  identity.parse(userId);
  return (await listUsers())
    .filter((u) => u.id !== userId)
    .map((u) => ({ id: u.id, name: u.name, image: u.image }));
}

export async function createGame(input: unknown, opts?: { tx?: DbTx }): Promise<{ id: string }> {
  const data = createInput.parse(input);
  if (data.userId === data.partnerId) throw new MorpionError(400, "Choisis un autre membre.");
  if (!(await getUser(data.partnerId))) throw new MorpionError(404, "Membre introuvable.");
  const activePair = JSON.stringify([data.userId, data.partnerId].sort());
  return withTx(async (tx) => {
    // L'upsert et l'unicité du duo rendent les invitations croisées idempotentes.
    const previous = await tx.morpionGame.findUnique({ where: { activePair } });
    if (previous) return { id: previous.id };
    const pending = await tx.morpionGame.count({
      where: { userA: data.userId, status: "WAITING" },
    });
    if (pending >= 10) throw new MorpionError(429, "Tu as déjà dix invitations en attente.");
    const candidateId = randomUUID();
    const game = await tx.morpionGame.upsert({
      where: { activePair },
      update: {},
      create: {
        id: candidateId,
        userA: data.userId,
        userB: data.partnerId,
        theme: data.theme,
        activePair,
      },
    });
    if (game.id === candidateId)
      await notify(
        {
          userId: data.partnerId,
          title: "Un membre te propose un duel de Morpion !",
          link: `/morpion/${game.id}`,
        },
        { tx },
      );
    return { id: game.id };
  }, opts);
}

export async function act(input: unknown, opts?: { tx?: DbTx }): Promise<{ id: string }> {
  const data = actionInput.parse(input);
  return withTx(async (tx) => {
    const game = await load(data.id, tx);
    const mySeat = seat(game, data.userId);
    if (game.version !== data.version)
      throw new MorpionError(409, "La partie a changé. Réessaie après actualisation.");
    const update: {
      status?: "PLAYING" | "ABANDONED" | "WON" | "DRAW";
      board?: string;
      turn?: number;
      winner?: number;
      activePair?: null;
    } = {};
    if (data.action === "accept") {
      if (game.status !== "WAITING" || mySeat !== 1)
        throw new MorpionError(403, "Seul le membre invité peut accepter ce duel.");
      update.status = "PLAYING";
    } else if (data.action === "cancel") {
      if (game.status !== "WAITING" && game.status !== "PLAYING")
        throw new MorpionError(409, "Cette partie est terminée.");
      update.status = "ABANDONED";
      update.activePair = null;
    } else {
      if (game.status !== "PLAYING" || game.turn !== mySeat)
        throw new MorpionError(409, "Ce n’est pas ton tour.");
      if (data.cell === undefined || game.board[data.cell] !== ".")
        throw new MorpionError(400, "Cette case n’est pas disponible.");
      const result = place(game.board, data.cell, mySeat);
      update.board = result.board;
      update.status = result.status;
      update.turn = 1 - mySeat;
      if (result.status !== "PLAYING") update.activePair = null;
      if (result.status === "WON") update.winner = mySeat;
    }
    const saved = await tx.morpionGame.updateMany({
      where: { id: game.id, version: data.version },
      data: { ...update, version: { increment: 1 } },
    });
    if (saved.count !== 1)
      throw new MorpionError(409, "Un autre coup vient d’être joué. Actualise la partie.");
    if (data.action === "accept")
      await notify(
        {
          userId: game.userA,
          title: "Ton duel de Morpion est accepté. À toi de jouer !",
          link: `/morpion/${game.id}`,
        },
        { tx },
      );
    if (update.status === "WON" || update.status === "DRAW")
      await notify(
        {
          userId: mySeat === 0 ? game.userB : game.userA,
          title:
            update.status === "DRAW" ? "Égalité au Morpion !" : "Ton duel de Morpion est terminé.",
          link: `/morpion/${game.id}`,
        },
        { tx },
      );
    return { id: game.id };
  }, opts);
}
