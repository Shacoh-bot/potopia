import { db, withTx } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { LINES, place } from "../src/game";
import { act, createGame, getGame, listGames, listPartners } from "../src/service";

const A = "morpion-test-a",
  B = "morpion-test-b",
  C = "morpion-test-c";
beforeEach(async () => {
  await truncateTestDb();
  await db.user.createMany({
    data: [A, B, C].map((id) => ({ id, name: id, email: `${id}@example.test` })),
  });
});
async function start() {
  const { id } = await createGame({ userId: A, partnerId: B, theme: "mario" });
  await act({ userId: B, id, version: 0, action: "accept" });
  return id;
}
async function move(id: string, userId: string, cell: number) {
  const game = await getGame(userId, id);
  return act({ userId, id, version: game.version, action: "move", cell });
}
describe("règles", () => {
  it("reconnaît chacune des huit lignes gagnantes", () => {
    for (const line of LINES) {
      let board = ".........";
      for (const cell of line.slice(0, 2)) board = place(board, cell, 0).board;
      expect(place(board, line[2], 0).status).toBe("WON");
    }
  });
  it("refuse une case occupée ou hors grille", () => {
    expect(() => place("X........", 0, 1)).toThrow();
    expect(() => place(".........", 9, 0)).toThrow();
  });
});
describe("duels en ligne", () => {
  it("réserve le duel aux deux joueurs et son acceptation à l’invité", async () => {
    const { id } = await createGame({ userId: A, partnerId: B, theme: "sw" });
    await expect(getGame(C, id)).rejects.toMatchObject({ status: 403 });
    await expect(act({ userId: A, id, version: 0, action: "accept" })).rejects.toMatchObject({
      status: 403,
    });
    await expect(act({ userId: C, id, version: 0, action: "cancel" })).rejects.toMatchObject({
      status: 403,
    });
    await expect(act({ userId: A, id, version: 0, action: "move", cell: 0 })).rejects.toMatchObject(
      { status: 409 },
    );
    await act({ userId: B, id, version: 0, action: "accept" });
    expect(await getGame(A, id)).toMatchObject({ status: "PLAYING", theme: "sw", mySeat: 0 });
    expect(await listGames(B)).toHaveLength(1);
    expect((await listPartners(A)).map((p) => p.id)).toEqual(expect.arrayContaining([B, C]));
  });
  it("garde une seule invitation pour les invitations croisées et simultanées", async () => {
    const ids = await Promise.all([
      createGame({ userId: A, partnerId: B, theme: "mario" }),
      createGame({ userId: B, partnerId: A, theme: "got" }),
    ]);
    expect(ids[0]?.id).toBe(ids[1]?.id);
    expect(await db.morpionGame.count()).toBe(1);
    expect(await db.notification.count()).toBe(1);
  });
  it("refuse de s’inviter, un thème inconnu et un partenaire absent", async () => {
    await expect(createGame({ userId: A, partnerId: A, theme: "mario" })).rejects.toMatchObject({
      status: 400,
    });
    await expect(createGame({ userId: A, partnerId: B, theme: "inconnu" })).rejects.toThrow();
    await expect(
      createGame({ userId: A, partnerId: "absent", theme: "mario" }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("ne valide qu’un seul des coups concurrents et protège le tour adverse", async () => {
    const id = await start();
    await expect(move(id, B, 0)).rejects.toMatchObject({ status: 409 });
    const results = await Promise.allSettled([
      act({ userId: A, id, version: 1, action: "move", cell: 0 }),
      act({ userId: A, id, version: 1, action: "move", cell: 1 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const game = await getGame(A, id);
    expect(game.board.replaceAll(".", "")).toHaveLength(1);
    expect(game.turn).toBe(1);
    const cell = game.board.indexOf("X");
    await expect(move(id, B, cell)).rejects.toMatchObject({ status: 400 });
  });
  it("termine une victoire, compte le score et permet une revanche", async () => {
    const id = await start();
    for (const [who, cell] of [
      [A, 0],
      [B, 3],
      [A, 1],
      [B, 4],
      [A, 2],
    ] as const)
      await move(id, who, cell);
    expect(await getGame(A, id)).toMatchObject({ status: "WON", winner: 0, score: [1, 0] });
    await expect(move(id, B, 8)).rejects.toMatchObject({ status: 409 });
    const next = await createGame({ userId: B, partnerId: A, theme: "ghibli" });
    expect(next.id).not.toBe(id);
    expect(await getGame(B, next.id)).toMatchObject({
      status: "WAITING",
      theme: "ghibli",
      score: [0, 1],
    });
  });
  it("détecte l’égalité et libère le duo après annulation", async () => {
    const id = await start();
    for (const [i, cell] of [0, 1, 2, 4, 3, 5, 7, 6, 8].entries())
      await move(id, i % 2 === 0 ? A : B, cell);
    expect(await getGame(A, id)).toMatchObject({ status: "DRAW", winner: null, score: [0, 0] });
    const next = await createGame({ userId: A, partnerId: B, theme: "simpson" });
    await act({ userId: B, id: next.id, version: 0, action: "cancel" });
    expect((await createGame({ userId: A, partnerId: B, theme: "got" })).id).not.toBe(next.id);
  });
  it("compose les écritures dans une transaction annulable", async () => {
    await expect(
      withTx(async (tx) => {
        await createGame({ userId: A, partnerId: B, theme: "mario" }, { tx });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await db.morpionGame.count()).toBe(0);
  });
});
