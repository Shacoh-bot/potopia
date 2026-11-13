import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type CardRarityId,
  createCard,
  drawBooster,
  ensureSet,
  getPotodex,
  openBooster,
  resetCollection,
  SSR_PITY,
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

  it("garantie : la carte chance devient une SSR", () => {
    const cards = drawBooster([...pool], { forceSsr: true }, sequence());
    expect(cards[4]?.id).toBe("s");
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

  it(`garantit une SSR au plus tard au ${SSR_PITY}e paquet`, async () => {
    await addCards("rare", 1);
    await addCards("ssr", 1);
    const set = await db.tcgSet.findUniqueOrThrow({ where: { code: "S1" } });
    // 29 paquets sans SSR déjà ouverts.
    await db.tcgBoosterOpening.createMany({
      data: Array.from({ length: SSR_PITY - 1 }, () => ({
        userId: ADMIN.id,
        setId: set.id,
        cardIds: [],
        hasSsr: false,
      })),
    });
    const { cards } = await openBooster(ADMIN, { setCode: "S1" }, { rnd: sequence() });
    expect(cards[4]?.rarity).toBe("ssr");
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
