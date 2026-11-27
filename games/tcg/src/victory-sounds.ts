import { db, type DbTx, withTx } from "@app/db";
import { deleteObject, headObject, presignGetStable, presignPut } from "@app/storage";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CARD_SOUND_TYPE } from "./card-rules";
import { type Admin, assertAdmin, CardInputError } from "./cards";

/*
 * Sons de victoire : au retournement d'une SR ou d'une SSR dans un booster, un son de victoire joue
 * (à la place des bruitages de rareté ; le son propre d'une carte reste prioritaire). Tirage PAR
 * JOUEUR, sans répétition : un son jamais entendu, au hasard, jusqu'à les avoir tous découverts ;
 * ensuite vrai hasard. Les sons découverts se réécoutent dans le Potodex (onglet « Sons »).
 *
 * La liste n'est PAS dans le dépôt (vrais sons) : la page admin « Sons de victoire » synchronise un
 * dossier (`liste.json` + mp3, voir `syncVictorySounds`). Un son retiré ou écarté devient inactif :
 * plus tiré ni montré, mais ses découvertes sont gardées s'il revient.
 */

/** Joueur : son id (sons découverts) et son id Discord (droits). */
type Player = Admin & { id: string };

/** Sons entiers (certains durent plus de 3 min) : 6 Mo au plus. */
export const VICTORY_SOUND_BYTES = 6 * 1024 * 1024;

/** Raretés qui déclenchent un son de victoire. */
export const VICTORY_RARITIES: readonly string[] = ["sr", "ssr"];

/**
 * Choisit un son : au hasard parmi ceux que le joueur n'a jamais entendus ; tous entendus, au
 * hasard parmi tous. `null` : aucun son actif.
 */
export function pickVictorySound(
  ids: readonly string[],
  heard: ReadonlySet<string>,
  rnd: () => number = Math.random,
): string | null {
  const fresh = ids.filter((id) => !heard.has(id));
  const pool = fresh.length > 0 ? fresh : ids;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))] ?? null;
}

/**
 * Tire `count` sons de victoire pour le joueur (un par SR/SSR retournée, dans l'ordre du paquet),
 * sans répétition avant d'avoir tout découvert, et les note comme découverts. Renvoie leurs URL
 * de lecture (vides si aucun son n'est actif).
 */
export async function drawVictorySounds(
  player: Player,
  count: number,
  opts?: { tx?: DbTx; rnd?: () => number },
): Promise<{ id: string; url: string }[]> {
  if (count <= 0) return [];
  const drawn = await withTx(async (tx) => {
    const sounds = await tx.tcgVictorySound.findMany({
      where: { active: true },
      select: { id: true, soundKey: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });
    if (sounds.length === 0) return [];
    const heardRows = await tx.tcgHeardVictorySound.findMany({
      where: { userId: player.id, sound: { active: true } },
      select: { soundId: true },
    });
    const heard = new Set(heardRows.map((h) => h.soundId));
    const ids = sounds.map((s) => s.id);
    const picks: string[] = [];
    for (let i = 0; i < count; i++) {
      // tout découvert : on repart sur un vrai hasard
      if (ids.every((id) => heard.has(id))) heard.clear();
      const id = pickVictorySound(ids, heard, opts?.rnd);
      if (!id) break;
      heard.add(id);
      picks.push(id);
    }
    for (const soundId of picks) {
      await tx.tcgHeardVictorySound.upsert({
        where: { userId_soundId: { userId: player.id, soundId } },
        create: { userId: player.id, soundId },
        update: { count: { increment: 1 } },
      });
    }
    const keys = new Map(sounds.map((s) => [s.id, s.soundKey]));
    return picks.map((id) => ({ id, key: keys.get(id) ?? "" }));
  }, opts);
  return Promise.all(drawn.map(async ({ id, key }) => ({ id, url: await presignGetStable(key) })));
}

/** Son de victoire tel que le Potodex le montre. */
export type VictorySound = { id: string; title: string; url: string };

/**
 * Onglet « Sons » du Potodex : les sons actifs découverts par le joueur (dans l'ordre de la liste)
 * et le total, sans rien dire des autres. `all` (aperçu admin « Potodex complet ») : tous les sons
 * actifs, sans lire ni toucher aux découvertes du joueur.
 */
export async function getVictorySoundsDex(
  player: Player,
  opts?: { all?: boolean },
): Promise<{ total: number; sounds: VictorySound[] }> {
  assertAdmin(player);
  const where = { active: true };
  const [total, rows] = await Promise.all([
    db.tcgVictorySound.count({ where }),
    db.tcgVictorySound.findMany({
      where: opts?.all ? where : { ...where, heard: { some: { userId: player.id } } },
      select: { id: true, title: true, soundKey: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
  ]);
  const sounds = await Promise.all(
    rows.map(async (r) => ({ id: r.id, title: r.title, url: await presignGetStable(r.soundKey) })),
  );
  return { total, sounds };
}

/** L'onglet « Sons » ne se montre qu'à partir du premier son découvert (pas de divulgation). */
export function showVictorySoundsTab(dex: { sounds: readonly unknown[] }): boolean {
  return dex.sounds.length > 0;
}

/* ── Administration : synchronisation de la liste ── */

/** Sons enregistrés, pour la page admin (actifs et inactifs). */
export async function listVictorySounds(admin: Admin) {
  assertAdmin(admin);
  return db.tcgVictorySound.findMany({
    select: { id: true, title: true, bytes: true, active: true, position: true },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });
}

const uploadInput = z.object({
  contentType: z.literal(CARD_SOUND_TYPE, "Format de son refusé : MP3 uniquement."),
  size: z
    .number()
    .int()
    .positive("Son vide.")
    .max(VICTORY_SOUND_BYTES, "Son trop lourd (6 Mo maximum)."),
});

/** URL d'envoi présignée (5 min) d'un son de victoire ; la clé est générée ici. */
export async function createVictorySoundUpload(
  admin: Admin,
  input: { contentType: string; size: number },
): Promise<{ key: string; url: string }> {
  assertAdmin(admin);
  const { contentType, size } = uploadInput.parse(input);
  const key = `sounds/victory/${randomUUID()}.mp3`;
  const url = await presignPut({ key, contentType, contentLength: size, expiresIn: 300 });
  return { key, url };
}

const syncInput = z
  .array(
    z.object({
      id: z
        .string()
        .trim()
        .regex(/^[a-z0-9-]{1,40}$/, "Identifiant de son invalide."),
      title: z.string().trim().min(1, "Titre vide.").max(200, "Titre trop long."),
      // clé du fichier envoyé ; absente : le son est déjà là, inchangé
      key: z
        .string()
        .regex(/^sounds\/victory\/[0-9a-f-]{36}\.mp3$/, "Clé de son invalide.")
        .nullish(),
    }),
  )
  .max(500, "500 sons maximum.");

/**
 * Applique la liste (sons NON écartés, dans l'ordre) : ajoute les nouveaux, renvoie le fichier et
 * le titre des existants, et rend inactifs ceux qui n'y sont plus (jamais supprimés : les
 * découvertes des joueurs restent). Un son nouveau doit venir avec son fichier (`key`, vérifié dans
 * le stockage) ; l'ancien fichier d'un son renvoyé est supprimé.
 */
export async function syncVictorySounds(
  admin: Admin,
  input: { id: string; title: string; key?: string | null }[],
  opts?: { tx?: DbTx },
): Promise<{ added: number; updated: number; disabled: number; active: number }> {
  assertAdmin(admin);
  const list = syncInput.parse(input);
  if (new Set(list.map((s) => s.id)).size !== list.length) {
    throw new CardInputError("Identifiant de son en double dans la liste.");
  }
  const sizes = new Map<string, number>();
  for (const s of list) {
    if (!s.key) continue;
    const info = await headObject(s.key);
    if (!info) throw new CardInputError(`Son ${s.id} introuvable : l'envoi a échoué.`);
    if (info.contentLength > VICTORY_SOUND_BYTES) {
      throw new CardInputError(`Son ${s.id} trop lourd (6 Mo maximum).`);
    }
    sizes.set(s.id, info.contentLength);
  }
  const oldKeys: string[] = [];
  const result = await withTx(async (tx) => {
    const existing = new Map(
      (await tx.tcgVictorySound.findMany({ select: { id: true, soundKey: true } })).map((s) => [
        s.id,
        s.soundKey,
      ]),
    );
    let added = 0;
    let updated = 0;
    for (const [position, s] of list.entries()) {
      const before = existing.get(s.id);
      if (before === undefined) {
        if (!s.key) throw new CardInputError(`Son ${s.id} nouveau : fichier manquant.`);
        await tx.tcgVictorySound.create({
          data: {
            id: s.id,
            title: s.title,
            soundKey: s.key,
            bytes: sizes.get(s.id) ?? 0,
            position,
          },
        });
        added++;
      } else {
        await tx.tcgVictorySound.update({
          where: { id: s.id },
          data: {
            title: s.title,
            position,
            active: true,
            ...(s.key ? { soundKey: s.key, bytes: sizes.get(s.id) ?? 0 } : {}),
          },
        });
        if (s.key && before !== s.key) {
          oldKeys.push(before);
          updated++;
        }
      }
    }
    const kept = list.map((s) => s.id);
    const { count: disabled } = await tx.tcgVictorySound.updateMany({
      where: { id: { notIn: kept }, active: true },
      data: { active: false },
    });
    return { added, updated, disabled, active: list.length };
  }, opts);
  if (!opts?.tx) await Promise.allSettled(oldKeys.map((k) => deleteObject(k)));
  return result;
}

/** Vide les sons découverts du joueur (remise à zéro de sa collection de test). */
export async function resetHeardVictorySounds(player: Player, tx: DbTx): Promise<void> {
  await tx.tcgHeardVictorySound.deleteMany({ where: { userId: player.id } });
}
