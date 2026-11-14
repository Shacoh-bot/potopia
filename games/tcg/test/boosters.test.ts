import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import {
  boosterPity,
  CHANCE_RATES,
  type CardRarityId,
  createCard,
  drawBooster,
  ensureSet,
  forcedChance,
  getPotodex,
  openBooster,
  resetCollection,
  simulateChance,
  SR_PITY,
  SSR_PITY,
  TEST_PACK_RARITIES,
} from "../src/index";

const ADMIN = { id: "user-admin", discordId: "100000000000000001" };
const MEMBER = { id: "user-member", discordId: "100000000000000002" };

const BASE = { type: "Créature", family: "Test", cost: 1, power: 1 } as const;

/** Suite de tirages fixée à l'avance (puis 0), pour des paquets prévisibles. */
const sequence =
  (...values: number[]) =>
  () =>
    values.shift() ?? 0;

let setId = "";

async function addCards(rarity: CardRarityId, count: number) {
  for (let i = 0; i < count; i++) {
    await createCard(ADMIN, { ...BASE, name: `${rarity} ${i + 1}`, rarity, setId });
  }
}

beforeEach(async () => {
  await truncateTestDb();
  setId = (await ensureSet(ADMIN, { code: "S1", name: "Set de test" })).id;
});

describe("drawBooster", () => {
  const pool = [
    { id: "c", rarity: "common" },
    { id: "u", rarity: "uncommon" },
    { id: "r", rarity: "rare" },
    { id: "s", rarity: "ssr" },
  ] as const;

  it("donne 5 cartes : 3 de base, 1 peu commune ou mieux, 1 rare ou mieux", () => {
    // 0 : la première rareté de chaque emplacement (commune, peu commune, rare).
    const cards = drawBooster([...pool], {}, sequence());
    expect(cards.map((c) => c.id)).toEqual(["c", "c", "c", "u", "r"]);
  });

  it("garantie SSR : la carte chance devient une SSR", () => {
    const cards = drawBooster([...pool], { forced: "ssr" }, sequence());
    expect(cards[4]?.id).toBe("s");
  });

  it("garantie SR ou mieux : la carte chance est une SR ou une SSR, selon leurs poids", () => {
    const withSr = [...pool, { id: "sr", rarity: "sr" } as const];
    // 0 : la première des deux (SR) ; 0.9999 : la seconde (SSR)
    expect(drawBooster(withSr, { forced: "sr" }, sequence())[4]?.id).toBe("sr");
    const rolls = [0, 0, 0, 0, 0, 0, 0, 0, 0.9999, 0];
    expect(drawBooster(withSr, { forced: "sr" }, sequence(...rolls))[4]?.id).toBe("s");
  });

  it("rareté absente du set : celle juste en dessous", () => {
    // 0.99 sur la carte chance : SSR... qui existe ; sans SSR ni SR ni légendaire, on descend.
    const noTop = pool.filter((c) => c.rarity !== "ssr");
    const rolls = [0, 0, 0, 0, 0, 0, 0, 0, 0.999, 0];
    expect(drawBooster([...noTop], {}, sequence(...rolls))[4]?.id).toBe("r");
  });

  it("refuse un set vide", () => {
    expect(() => drawBooster([])).toThrow("Ce set n'a aucune carte à tirer.");
  });
});

describe("garanties", () => {
  it(`SR ou mieux au ${SR_PITY}e paquet sans SR ni SSR, SSR au ${SSR_PITY}e sans SSR, la SSR d'abord`, () => {
    expect(forcedChance(SR_PITY - 2, SR_PITY - 2)).toBeNull();
    expect(forcedChance(SR_PITY - 1, SR_PITY - 1)).toBe("sr");
    if (SSR_PITY !== null) {
      expect(forcedChance(0, SSR_PITY - 2)).toBeNull();
      expect(forcedChance(0, SSR_PITY - 1)).toBe("ssr");
      expect(forcedChance(SR_PITY - 1, SSR_PITY - 1)).toBe("ssr");
    }
  });

  it("n'avantagent pas : taux moyens réels = taux annoncés (1 million de paquets, ±0,1 point)", () => {
    const rates = simulateChance(1_000_000, undefined, 2026);
    for (const [rarity, announced] of Object.entries(CHANCE_RATES)) {
      expect(Math.abs(rates[rarity as keyof typeof rates] - announced), rarity).toBeLessThan(0.1);
    }
  });
});

describe("openBooster", () => {
  it("réservé aux admins", async () => {
    await addCards("common", 1);
    await expect(openBooster(MEMBER, { setCode: "S1" })).rejects.toThrow("Réservé aux admins.");
  });

  it("ajoute les cartes à la collection et note le paquet", async () => {
    await addCards("common", 1);
    await addCards("rare", 1);
    const { cards } = await openBooster(ADMIN, { setCode: "S1" }, { rnd: sequence() });
    // Pas de peu commune dans le set : la 4e carte descend à commune.
    expect(cards.map((c) => c.rarity)).toEqual(["common", "common", "common", "common", "rare"]);
    const owned = await db.tcgOwnedCard.findMany({ orderBy: { count: "desc" } });
    expect(owned.map((o) => o.count)).toEqual([4, 1]);
    expect(await db.tcgBoosterOpening.count()).toBe(1);
  });

  /** Paquets déjà ouverts dans le set S1, avec ou sans SR / SSR. */
  async function opened(count: number, marks: { hasSsr?: boolean; hasSrPlus?: boolean } = {}) {
    const set = await db.tcgSet.findUniqueOrThrow({ where: { code: "S1" } });
    for (let i = 0; i < count; i++) {
      await db.tcgBoosterOpening.create({
        data: {
          userId: ADMIN.id,
          setId: set.id,
          cardIds: [],
          hasSsr: marks.hasSsr ?? false,
          hasSrPlus: marks.hasSrPlus ?? false,
        },
      });
    }
  }

  it(`garantit une SR ou mieux au plus tard au ${SR_PITY}e paquet, et note le paquet`, async () => {
    await addCards("rare", 1);
    await addCards("sr", 1);
    await opened(SR_PITY - 1);
    expect(await boosterPity(ADMIN, { setCode: "S1" })).toMatchObject({ untilSr: 1 });
    const { cards } = await openBooster(ADMIN, { setCode: "S1" }, { rnd: sequence() });
    expect(cards[4]?.rarity).toBe("sr");
    const last = await db.tcgBoosterOpening.findFirst({ orderBy: { createdAt: "desc" } });
    expect(last).toMatchObject({ hasSrPlus: true, hasSsr: false });
    // compteur remis à zéro : le paquet suivant n'est plus garanti
    expect(await boosterPity(ADMIN, { setCode: "S1" })).toMatchObject({ untilSr: SR_PITY });
    const next = await openBooster(ADMIN, { setCode: "S1" }, { rnd: sequence() });
    expect(next.cards[4]?.rarity).toBe("rare");
  });

  it("une SR remet la garantie SR à zéro, pas celle de la SSR", async () => {
    await addCards("rare", 1);
    await opened(5);
    await opened(1, { hasSrPlus: true });
    await opened(3);
    const pity = await boosterPity(ADMIN, { setCode: "S1" });
    expect(pity.untilSr).toBe(SR_PITY - 3);
    if (SSR_PITY !== null) expect(pity.untilSsr).toBe(SSR_PITY - 9);
  });

  it("garantit une SSR au plus tard au paquet prévu, même quand la SR est garantie aussi", async () => {
    if (SSR_PITY === null) return;
    await addCards("rare", 1);
    await addCards("sr", 1);
    await addCards("ssr", 1);
    // assez de paquets sans SSR ; les SR+ à part, la garantie SR tombe en même temps
    await opened(SSR_PITY - SR_PITY, { hasSrPlus: true });
    await opened(SR_PITY - 1);
    expect(await boosterPity(ADMIN, { setCode: "S1" })).toEqual({ untilSr: 1, untilSsr: 1 });
    const { cards } = await openBooster(ADMIN, { setCode: "S1" }, { rnd: sequence() });
    expect(cards[4]?.rarity).toBe("ssr");
    expect(await boosterPity(ADMIN, { setCode: "S1" })).toEqual({
      untilSr: SR_PITY,
      untilSsr: SSR_PITY,
    });
  });
});

describe("paquets de test de l'admin", () => {
  it("une carte de chaque rareté haute, notés comme tests, sans toucher aux garanties", async () => {
    for (const rarity of TEST_PACK_RARITIES) await addCards(rarity, 1);
    await addCards("common", 1);
    const set = await db.tcgSet.findUniqueOrThrow({ where: { code: "S1" } });
    // 3 paquets normaux sans SR ni SSR déjà ouverts
    await db.tcgBoosterOpening.createMany({
      data: Array.from({ length: 3 }, () => ({
        userId: ADMIN.id,
        setId: set.id,
        cardIds: [],
        hasSsr: false,
        hasSrPlus: false,
      })),
    });
    const before = await boosterPity(ADMIN, { setCode: "S1" });
    for (let i = 0; i < 3; i++) {
      const { cards } = await openBooster(ADMIN, { setCode: "S1" }, { test: true });
      expect(cards.map((c) => c.rarity)).toEqual([...TEST_PACK_RARITIES]);
    }
    const tests = await db.tcgBoosterOpening.findMany({ where: { isTest: true } });
    expect(tests).toHaveLength(3);
    expect(tests.every((t) => t.hasSsr && t.hasSrPlus)).toBe(true);
    // les SR et SSR des paquets de test ne remettent pas les garanties à zéro
    expect(await boosterPity(ADMIN, { setCode: "S1" })).toEqual(before);
    expect(before.untilSr).toBe(SR_PITY - 3);
  });
});

describe("Potodex", () => {
  it("ne montre que le numéro des cartes pas encore trouvées", async () => {
    await addCards("common", 1);
    await addCards("legendary", 1);
    await openBooster(ADMIN, { setCode: "S1" }, { rnd: sequence() });
    const dex = await getPotodex(ADMIN, { setCode: "S1" });
    expect(dex).toMatchObject({ found: 1, total: 2, boosters: 1 });
    expect(dex.entries[0]).toMatchObject({ number: 1, found: true, count: 5 });
    expect(dex.entries[1]).toEqual({ number: 2, found: false });
  });

  it("remise à zéro : collection et paquets vidés", async () => {
    await addCards("common", 1);
    await openBooster(ADMIN, { setCode: "S1" });
    await resetCollection(ADMIN);
    expect(await getPotodex(ADMIN, { setCode: "S1" })).toMatchObject({ found: 0, boosters: 0 });
  });
});
