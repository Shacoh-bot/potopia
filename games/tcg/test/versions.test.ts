import { readFileSync } from "node:fs";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ALT_ART_CHANCE,
  CardInputError,
  cardVersions,
  createCard,
  drawBooster,
  drawVersion,
  ensureSet,
  getPotodex,
  imageKeyFor,
  openBooster,
  updateCard,
} from "../src/index";

/*
 * Cartes en deux versions : normale et Alt Art (full art), chacune active ou non, tirées et
 * collectionnées séparément.
 */

const ADMIN = { id: "user-admin", discordId: "100000000000000001" };
const BASE = {
  name: "Carte",
  type: "Créature",
  family: "Test",
  cost: 1,
  power: 1,
  rarity: "common",
} as const;

/** Générateur pseudo-aléatoire déterministe (LCG), dans [0, 1[. */
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

let setId = "";

beforeEach(async () => {
  await truncateTestDb();
  setId = (await ensureSet(ADMIN, { code: "S1", name: "Set de test" })).id;
});

describe("versions d'une carte", () => {
  it("à la création : seule la version de la mise en page est active", async () => {
    const normal = await createCard(ADMIN, { ...BASE, name: "Normale", setId });
    expect(normal).toMatchObject({ layout: "normal", hasNormal: true, hasFullArt: false });
    const full = await createCard(ADMIN, { ...BASE, name: "Full", setId, layout: "fullart" });
    expect(full).toMatchObject({ layout: "fullart", hasNormal: false, hasFullArt: true });
    expect(cardVersions(normal)).toEqual(["normal"]);
    expect(cardVersions(full)).toEqual(["fullart"]);
  });

  it("active l'Alt Art, désactive la normale (la carte se montre alors en full art)", async () => {
    const card = await createCard(ADMIN, { ...BASE, name: "Deux", setId });
    const both = await updateCard(ADMIN, card.id, { ...BASE, hasFullArt: true });
    expect(both).toMatchObject({ layout: "normal", hasNormal: true, hasFullArt: true });
    expect(cardVersions(both)).toEqual(["normal", "fullart"]);
    const altOnly = await updateCard(ADMIN, card.id, { ...BASE, hasNormal: false });
    expect(altOnly).toMatchObject({ layout: "fullart", hasNormal: false, hasFullArt: true });
  });

  it("une mise en page envoyée seule (fichier de mises à jour) active sa version", async () => {
    const card = await createCard(ADMIN, { ...BASE, name: "Montrée", setId });
    expect(await updateCard(ADMIN, card.id, { ...BASE, layout: "fullart" })).toMatchObject({
      layout: "fullart",
      hasNormal: true,
      hasFullArt: true,
    });
  });

  it("garde au moins une version", async () => {
    const card = await createCard(ADMIN, { ...BASE, name: "Seule", setId });
    await expect(updateCard(ADMIN, card.id, { ...BASE, hasNormal: false })).rejects.toThrow(
      new CardInputError("Une carte garde au moins une version : normale ou full art."),
    );
  });

  it("l'Alt Art reprend l'illustration de la normale tant qu'elle n'a pas la sienne", () => {
    expect(imageKeyFor({ imageKey: "a", imageKeyFull: null }, "fullart")).toBe("a");
    expect(imageKeyFor({ imageKey: "a", imageKeyFull: "b" }, "fullart")).toBe("b");
    expect(imageKeyFor({ imageKey: "a", imageKeyFull: "b" }, "normal")).toBe("a");
  });
});

describe("tirage de la version", () => {
  const both = { hasNormal: true, hasFullArt: true };

  it(`Alt Art sous ${ALT_ART_CHANCE} quand la carte a ses deux versions, sinon sa seule version`, () => {
    expect(ALT_ART_CHANCE).toBe(0.1);
    expect(drawVersion(both, () => ALT_ART_CHANCE - 0.001)).toBe("fullart");
    expect(drawVersion(both, () => ALT_ART_CHANCE)).toBe("normal");
    expect(drawVersion({ hasNormal: true, hasFullArt: false }, () => 0)).toBe("normal");
    expect(drawVersion({ hasNormal: false, hasFullArt: true }, () => 0.99)).toBe("fullart");
  });

  it("10 % d'Alt Art en moyenne (200 000 tirages, ±0,3 point)", () => {
    const rnd = lcg(2026);
    let alt = 0;
    for (let i = 0; i < 200_000; i++) if (drawVersion(both, rnd) === "fullart") alt++;
    expect(Math.abs((alt / 200_000) * 100 - ALT_ART_CHANCE * 100)).toBeLessThan(0.3);
  });

  it("ne change pas les raretés tirées : mêmes cartes, garanties comprises, que sans versions", async () => {
    for (const rarity of ["common", "uncommon", "rare", "epic", "sr", "ssr"] as const) {
      await createCard(ADMIN, { ...BASE, name: rarity, rarity, setId });
      await createCard(ADMIN, { ...BASE, name: `${rarity} AA`, rarity, setId, layout: "fullart" });
    }
    // toutes les cartes du set en deux versions
    await db.tcgCard.updateMany({ data: { hasNormal: true, hasFullArt: true } });
    const pool = (
      await db.tcgCard.findMany({
        where: { setId },
        select: { id: true, rarity: true },
        orderBy: { id: "asc" },
      })
    ).map((c) => ({ id: c.id, rarity: c.rarity as "common" }));
    for (const seed of [1, 2, 3, 4, 5]) {
      const expected = drawBooster(pool, {}, lcg(seed)).map((c) => c.id);
      const { cards } = await openBooster(ADMIN, { setCode: "S1" }, { rnd: lcg(seed) });
      expect(cards.map((c) => c.id)).toEqual(expected);
    }
  });
});

describe("collection par version", () => {
  it("la normale et l'Alt Art se collectionnent séparément dans le Potodex", async () => {
    const card = await createCard(ADMIN, { ...BASE, name: "Deux", setId });
    await updateCard(ADMIN, card.id, { ...BASE, hasFullArt: true });

    // 0.5 : jamais d'Alt Art ; les 5 cartes sortent en normale
    const normal = await openBooster(ADMIN, { setCode: "S1" }, { rnd: () => 0.5 });
    expect(normal.cards.map((c) => [c.id, c.layout])).toEqual(
      Array.from({ length: 5 }, () => [card.id, "normal"]),
    );
    await createCard(ADMIN, { ...BASE, name: "Normale seule", setId });
    let dex = await getPotodex(ADMIN, { setCode: "S1" });
    // 3 versions : Deux (normale, Alt Art) et Normale seule
    expect(dex).toMatchObject({ total: 3, size: 2 });
    expect(dex.entries.map((e) => [e.number, e.version])).toEqual([
      [1, "normal"],
      [1, "fullart"],
      [2, "normal"],
    ]);
    expect(dex.entries[1]).toEqual({ number: 1, version: "fullart", found: false });

    // 0 : Alt Art à chaque tirage (la carte qui a ses deux versions)
    const alt = await openBooster(ADMIN, { setCode: "S1" }, { rnd: () => 0 });
    expect(alt.cards.filter((c) => c.id === card.id).every((c) => c.layout === "fullart")).toBe(
      true,
    );
    dex = await getPotodex(ADMIN, { setCode: "S1" });
    const altCount = alt.cards.filter((c) => c.id === card.id).length;
    expect(altCount).toBeGreaterThan(0);
    expect(dex.entries[1]).toMatchObject({ version: "fullart", found: true, count: altCount });
    expect(dex.entries[1]?.found && dex.entries[1].card.layout).toBe("fullart");
    const owned = await db.tcgOwnedCard.findMany({ where: { cardId: card.id } });
    expect(owned.find((o) => o.version === "fullart")?.count).toBe(altCount);
  });
});

describe("migration des cartes existantes", () => {
  // Calculs de la migration, rejoués sur des données d'avant (colonnes à leur valeur par défaut).
  const sql = readFileSync(
    new URL(
      "../../../packages/db/prisma/migrations/20261115120000_tcg_card_versions/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const updates = sql.match(/UPDATE[\s\S]+?;/g) ?? [];

  it("coche la version de la mise en page et range les cartes possédées dans cette version", async () => {
    expect(updates).toHaveLength(2);
    const normal = await createCard(ADMIN, { ...BASE, name: "Le rat", setId });
    const full = await createCard(ADMIN, {
      ...BASE,
      name: "Le vieux sage",
      setId,
      layout: "fullart",
    });
    // état d'avant la migration : valeurs par défaut des nouvelles colonnes
    await db.tcgCard.updateMany({ data: { hasNormal: true, hasFullArt: false } });
    await db.tcgOwnedCard.createMany({
      data: [
        { userId: ADMIN.id, cardId: normal.id, count: 2 },
        { userId: ADMIN.id, cardId: full.id, count: 3 },
      ],
    });

    for (const update of updates) await db.$executeRawUnsafe(update);

    const cards = await db.tcgCard.findMany({ orderBy: { name: "asc" } });
    expect(cards.map((c) => [c.name, c.hasNormal, c.hasFullArt])).toEqual([
      ["Le rat", true, false],
      ["Le vieux sage", false, true],
    ]);
    const owned = await db.tcgOwnedCard.findMany({ orderBy: { count: "asc" } });
    expect(owned.map((o) => [o.cardId, o.version, o.count])).toEqual([
      [normal.id, "normal", 2],
      [full.id, "fullart", 3],
    ]);
  });
});
