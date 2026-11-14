import { db, type DbTx, withTx } from "@app/db";
import { z } from "zod";
import { CARD_RARITIES, type Card, type CardRarityId, type CardSet } from "./card-rules";
import { type Admin, assertAdmin, CardInputError, toCard, withSet } from "./cards";

/*
 * Boosters et Potodex, en test : seuls les admins ouvrent des paquets (gratuits, illimités) et
 * consultent leur Potodex. Un paquet donne 5 cartes d'un set, tirées selon la rareté de chaque
 * emplacement ; chaque carte tirée entre dans la collection du joueur (`owned_cards`), et le
 * paquet est noté dans le journal (`booster_openings`), qui sert aussi à la garantie de SSR.
 */

/** Joueur qui ouvre un paquet : son id (collection) et son id Discord (droits). */
type Player = Admin & { id: string };

/** Poids de tirage d'une rareté pour un emplacement du paquet (en %). */
type SlotWeights = Partial<Record<CardRarityId, number>>;

/**
 * Taux annoncés de la carte chance (en %), garanties comprises : ce sont les taux MOYENS RÉELS sur
 * la durée (décidé le 2026-11-13 : 2 % de SSR ; 2026-11-14 : les garanties n'avantagent pas, elles
 * ne changent pas ces taux). Vérifiés par simulation dans les tests.
 */
export const CHANCE_RATES = { rare: 55, epic: 25, legendary: 12, sr: 6, ssr: 2 } as const;

/**
 * Garanties et poids de base de la carte chance : tout le réglage tient ici. Au plus tard au
 * `srPity`-ième paquet d'un set sans SR ni SSR, la carte chance est une SR ou mieux (SR ou SSR
 * selon leurs poids) ; au plus tard au `ssrPity`-ième sans SSR, une SSR (null : pas de garantie
 * SSR à part). Les garanties ajoutant des SR et des SSR, leurs poids de base sont plus bas que les
 * taux annoncés, calibrés par `pnpm booster:rates` (simulation) pour retomber sur CHANCE_RATES.
 *
 * Option A (2026-11-14, provisoire, à confirmer par l'utilisateur) : SR ou mieux au 20e paquet,
 * SSR au 90e. Autres options chiffrées : B, sans garantie SSR à part (`ssrPity: null`, poids
 * 3,976 / 1,336) ; C, SSR au 30e comme avant, mais alors 2 % est impossible (au moins 1/30 =
 * 3,33 %) et il faut annoncer les vrais taux (SSR ~4,5 %).
 */
export const BOOSTER_ODDS: {
  srPity: number;
  ssrPity: number | null;
  baseSr: number;
  baseSsr: number;
} = { srPity: 20, ssrPity: 90, baseSr: 3.908, baseSsr: 0.994 };

/** Au plus tard à ce paquet d'un set sans SR ni SSR, la carte chance est une SR ou mieux. */
export const SR_PITY = BOOSTER_ODDS.srPity;
/** Au plus tard à ce paquet d'un set sans SSR, la carte chance est une SSR (null : aucune). */
export const SSR_PITY = BOOSTER_ODDS.ssrPity;

/**
 * Poids de la carte chance : SR et SSR à leur poids de base, le reste réparti entre rare, épique
 * et légendaire au prorata des taux annoncés.
 */
export function chanceWeights(sr: number, ssr: number): SlotWeights {
  const others = CHANCE_RATES.rare + CHANCE_RATES.epic + CHANCE_RATES.legendary;
  const left = 100 - sr - ssr;
  return {
    rare: (left * CHANCE_RATES.rare) / others,
    epic: (left * CHANCE_RATES.epic) / others,
    legendary: (left * CHANCE_RATES.legendary) / others,
    sr,
    ssr,
  };
}

/**
 * Les 5 emplacements d'un paquet : 3 cartes de base, 1 peu commune ou mieux, 1 carte chance (rare
 * ou mieux, avec les garanties).
 */
export const BOOSTER_SLOTS: readonly SlotWeights[] = [
  { common: 75, uncommon: 25 },
  { common: 75, uncommon: 25 },
  { common: 75, uncommon: 25 },
  { uncommon: 70, rare: 25, epic: 5 },
  chanceWeights(BOOSTER_ODDS.baseSr, BOOSTER_ODDS.baseSsr),
];

/** Garantie à appliquer à la carte chance du prochain paquet. */
export type Forced = "sr" | "ssr" | null;

/**
 * Garantie du prochain paquet : `sinceSr` paquets depuis la dernière SR ou mieux, `sinceSsr`
 * depuis la dernière SSR (dans ce set). La SSR passe avant.
 */
export function forcedChance(sinceSr: number, sinceSsr: number): Forced {
  if (SSR_PITY !== null && sinceSsr >= SSR_PITY - 1) return "ssr";
  if (sinceSr >= SR_PITY - 1) return "sr";
  return null;
}

const CHANCE_SLOT = BOOSTER_SLOTS[BOOSTER_SLOTS.length - 1] ?? {};

/** Rareté de la carte chance : tirée selon ses poids, ou imposée par une garantie. */
export function drawChance(
  forced: Forced,
  rnd: () => number,
  weights: SlotWeights = CHANCE_SLOT,
): CardRarityId {
  if (forced === "ssr") return "ssr";
  if (forced === "sr") return pickRarity({ sr: weights.sr ?? 0, ssr: weights.ssr ?? 0 }, rnd);
  return pickRarity(weights, rnd);
}

/** Générateur pseudo-aléatoire à graine (mulberry32) : même graine, mêmes tirages. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Taux moyens réels (en %) de la carte chance sur `packs` paquets d'affilée, garanties
 * comprises : simulation déterministe (graine `seed`), pour le calibrage et les tests.
 */
export function simulateChance(
  packs: number,
  weights: SlotWeights = CHANCE_SLOT,
  seed = 1,
): Record<"rare" | "epic" | "legendary" | "sr" | "ssr", number> {
  const rnd = seeded(seed);
  const counts = { rare: 0, epic: 0, legendary: 0, sr: 0, ssr: 0 };
  let sinceSr = 0;
  let sinceSsr = 0;
  for (let i = 0; i < packs; i++) {
    const rarity = drawChance(forcedChance(sinceSr, sinceSsr), rnd, weights);
    if (rarity in counts) counts[rarity as keyof typeof counts]++;
    sinceSr = rarity === "sr" || rarity === "ssr" ? 0 : sinceSr + 1;
    sinceSsr = rarity === "ssr" ? 0 : sinceSsr + 1;
  }
  const pct = (n: number) => (100 * n) / packs;
  return {
    rare: pct(counts.rare),
    epic: pct(counts.epic),
    legendary: pct(counts.legendary),
    sr: pct(counts.sr),
    ssr: pct(counts.ssr),
  };
}

/** Carte candidate au tirage : son id et sa rareté. */
type PoolCard = { id: string; rarity: CardRarityId };

/** Tire une rareté selon les poids de l'emplacement (`rnd` dans [0, 1[). */
function pickRarity(weights: SlotWeights, rnd: () => number): CardRarityId {
  const entries = Object.entries(weights) as [CardRarityId, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rnd() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll < 0) return rarity;
  }
  return entries.at(-1)?.[0] ?? "common";
}

/**
 * Cartes d'une rareté, ou, si le set n'en a aucune, de la rareté juste en dessous (puis encore en
 * dessous) ; à défaut, de la plus proche au-dessus.
 */
function candidates(pool: PoolCard[], rarity: CardRarityId): PoolCard[] {
  const rank = CARD_RARITIES.indexOf(rarity);
  const order = [...CARD_RARITIES.slice(0, rank + 1).reverse(), ...CARD_RARITIES.slice(rank + 1)];
  for (const r of order) {
    const found = pool.filter((c) => c.rarity === r);
    if (found.length) return found;
  }
  return [];
}

/**
 * Tire les 5 cartes d'un paquet parmi `pool` (doublons possibles, dans un paquet comme d'un paquet
 * à l'autre). `forced` : garantie appliquée à la carte chance (SR ou mieux, ou SSR). Fonction
 * pure, testable avec un `rnd` déterministe.
 */
export function drawBooster(
  pool: PoolCard[],
  { forced = null }: { forced?: Forced } = {},
  rnd: () => number = Math.random,
): PoolCard[] {
  if (pool.length === 0) throw new CardInputError("Ce set n'a aucune carte à tirer.");
  return BOOSTER_SLOTS.map((weights, i) => {
    const chance = i === BOOSTER_SLOTS.length - 1;
    const rarity = chance ? drawChance(forced, rnd, weights) : pickRarity(weights, rnd);
    const choices = candidates(pool, rarity);
    const card = choices[Math.floor(rnd() * choices.length)];
    if (!card) throw new CardInputError("Ce set n'a aucune carte à tirer.");
    return card;
  });
}

const setInput = z.object({ setCode: z.string().trim().min(1).max(12) });

async function findSet(tx: DbTx, setCode: string): Promise<CardSet> {
  const set = await tx.tcgSet.findUnique({
    where: { code: setCode },
    select: { id: true, code: true, name: true },
  });
  if (!set) throw new CardInputError(`Set ${setCode} introuvable.`);
  return set;
}

/** Paquets ouverts dans ce set depuis le dernier qui avait une SSR (`hasSsr`) ou une SR ou mieux. */
async function boostersSince(
  tx: DbTx,
  userId: string,
  setId: string,
  mark: "hasSsr" | "hasSrPlus",
): Promise<number> {
  const last = await tx.tcgBoosterOpening.findFirst({
    where: { userId, setId, [mark]: true },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return tx.tcgBoosterOpening.count({
    where: { userId, setId, ...(last && { createdAt: { gt: last.createdAt } }) },
  });
}

/** Paquets ouverts dans ce set depuis la dernière SR ou mieux, et depuis la dernière SSR. */
async function pityCounters(tx: DbTx, userId: string, setId: string) {
  const [sinceSr, sinceSsr] = await Promise.all([
    boostersSince(tx, userId, setId, "hasSrPlus"),
    boostersSince(tx, userId, setId, "hasSsr"),
  ]);
  return { sinceSr, sinceSsr };
}

/**
 * Où en sont les garanties du joueur dans un set : nombre de paquets au plus (le prochain compris)
 * avant la SR ou mieux garantie, et avant la SSR garantie (null : pas de garantie SSR).
 */
export async function boosterPity(
  player: Player,
  input: z.input<typeof setInput>,
): Promise<{ untilSr: number; untilSsr: number | null }> {
  assertAdmin(player);
  const { setCode } = setInput.parse(input);
  const set = await findSet(db, setCode);
  const { sinceSr, sinceSsr } = await pityCounters(db, player.id, set.id);
  return {
    untilSr: Math.max(1, SR_PITY - sinceSr),
    untilSsr: SSR_PITY === null ? null : Math.max(1, SSR_PITY - sinceSsr),
  };
}

/**
 * Ouvre un paquet du set : tire 5 cartes, les ajoute à la collection du joueur et note le paquet.
 * Renvoie les cartes dans l'ordre du paquet (la carte chance en dernier).
 */
export async function openBooster(
  player: Player,
  input: z.input<typeof setInput>,
  opts?: { tx?: DbTx; rnd?: () => number },
): Promise<{ set: CardSet; cards: Card[] }> {
  assertAdmin(player);
  const { setCode } = setInput.parse(input);
  return withTx(async (tx) => {
    // Un paquet à la fois par joueur : les garanties comptent les paquets précédents.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tcg-booster-${player.id}`}))`;
    const set = await findSet(tx, setCode);
    const pool = await tx.tcgCard.findMany({
      where: { setId: set.id, deletedAt: null },
      select: { id: true, rarity: true },
    });
    const { sinceSr, sinceSsr } = await pityCounters(tx, player.id, set.id);
    const drawn = drawBooster(
      pool as PoolCard[],
      { forced: forcedChance(sinceSr, sinceSsr) },
      opts?.rnd,
    );

    const counts = new Map<string, number>();
    for (const c of drawn) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    for (const [cardId, n] of counts) {
      await tx.tcgOwnedCard.upsert({
        where: { userId_cardId: { userId: player.id, cardId } },
        create: { userId: player.id, cardId, count: n },
        update: { count: { increment: n } },
      });
    }
    await tx.tcgBoosterOpening.create({
      data: {
        userId: player.id,
        setId: set.id,
        cardIds: drawn.map((c) => c.id),
        hasSsr: drawn.some((c) => c.rarity === "ssr"),
        hasSrPlus: drawn.some((c) => c.rarity === "sr" || c.rarity === "ssr"),
      },
    });

    const rows = await tx.tcgCard.findMany({
      where: { id: { in: [...counts.keys()] } },
      include: withSet,
    });
    const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
    return {
      set,
      cards: drawn.flatMap((c) => {
        const card = byId.get(c.id);
        return card ? [card] : [];
      }),
    };
  }, opts);
}

/** Case du Potodex : la carte si elle a été trouvée, sinon seulement son numéro (en noir). */
export type PotodexEntry =
  { number: number; found: true; count: number; card: Card } | { number: number; found: false };

/**
 * Potodex d'un joueur pour un set : toutes les cartes du set dans l'ordre des numéros. Une carte
 * pas encore trouvée ne révèle que son numéro (ni nom, ni rareté, ni illustration).
 */
export async function getPotodex(
  player: Player,
  input: z.input<typeof setInput>,
): Promise<{
  set: CardSet;
  entries: PotodexEntry[];
  found: number;
  total: number;
  boosters: number;
}> {
  assertAdmin(player);
  const { setCode } = setInput.parse(input);
  const set = await findSet(db, setCode);
  const [rows, owned, boosters] = await Promise.all([
    db.tcgCard.findMany({
      where: { setId: set.id, deletedAt: null, number: { not: null } },
      orderBy: { number: "asc" },
      include: withSet,
    }),
    db.tcgOwnedCard.findMany({
      where: { userId: player.id, card: { setId: set.id } },
      select: { cardId: true, count: true },
    }),
    db.tcgBoosterOpening.count({ where: { userId: player.id, setId: set.id } }),
  ]);
  const counts = new Map(owned.map((o) => [o.cardId, o.count]));
  const entries: PotodexEntry[] = rows.map((row) => {
    const count = counts.get(row.id);
    return count
      ? { number: row.number ?? 0, found: true, count, card: toCard(row) }
      : { number: row.number ?? 0, found: false };
  });
  return {
    set,
    entries,
    found: entries.filter((e) => e.found).length,
    total: entries.length,
    boosters,
  };
}

/** Vide la collection de test du joueur : cartes trouvées et paquets ouverts (garantie comprise). */
export async function resetCollection(player: Player, opts?: { tx?: DbTx }): Promise<void> {
  assertAdmin(player);
  await withTx(async (tx) => {
    await tx.tcgOwnedCard.deleteMany({ where: { userId: player.id } });
    await tx.tcgBoosterOpening.deleteMany({ where: { userId: player.id } });
  }, opts);
}
