import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  CardInputError,
  createCard,
  createSet,
  createCardImageUpload,
  deleteCards,
  EFFECTS,
  effectText,
  ensureSet,
  frameFor,
  getCard,
  importCards,
  listCards,
  listVisualEffects,
  moveCards,
  paramsSchema,
  setCardImage,
  trashCards,
  updateCard,
  updateCards,
} from "../src/index";

const ADMIN = { discordId: "100000000000000001" };
const MEMBER = { discordId: "100000000000000002" };

const BASE = {
  name: "Carte test",
  rarity: "common",
  type: "Créature",
  family: "Test",
  cost: 2,
  power: 3,
} as const;

let setId = "";

beforeEach(async () => {
  await truncateTestDb();
  setId = (await ensureSet(ADMIN, { code: "S1", name: "Set de test" })).id;
});

describe("catalogue d'effets", () => {
  it("a des clés uniques, une carte Snap et un texte pour les réglages par défaut", () => {
    const keys = EFFECTS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const effect of EFFECTS) {
      expect(effect.snap).not.toBe("");
      expect(effectText(effect.key, { family: "Test", name: "un jeton" })).toMatch(/\.$/);
    }
  });

  it("borne les réglages", () => {
    const effect = EFFECTS.find((e) => e.key === "reveal_buff_two_allies");
    if (!effect) throw new Error("effet manquant");
    expect(paramsSchema(effect).parse({ amount: "3", count: 2 })).toEqual({ amount: 3, count: 2 });
    expect(() => paramsSchema(effect).parse({ amount: 3, count: 9 })).toThrow(ZodError);
    expect(() => paramsSchema(effect).parse({ amount: 3, count: 1, autre: 2 })).toThrow(ZodError);
  });
});

describe("createCard", () => {
  it("réservé aux admins", async () => {
    await expect(createCard(MEMBER, { ...BASE, setId })).rejects.toThrow("Réservé aux admins.");
  });

  it("numérote à la suite et propose le texte de l'effet", async () => {
    const first = await createCard(ADMIN, { ...BASE, setId });
    const second = await createCard(ADMIN, {
      ...BASE,
      setId,
      name: "Avec effet",
      effectKey: "reveal_debuff_weakest_enemy_silence",
      effectParams: { amount: 2 },
    });
    expect([first.number, second.number]).toEqual([1, 2]);
    expect(first.effectText).toBe("");
    expect(second.effectText).toBe(
      "Révélation : −2 à la carte adverse la plus faible ici, et retire son texte.",
    );
    expect(second.setCode).toBe("S1");
  });

  it("accepte les sept raretés, épique comprise", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId, rarity: "epic" });
    expect(card.rarity).toBe("epic");
    await expect(
      createCard(ADMIN, { ...BASE, setId, rarity: "mythique" as "epic" }),
    ).rejects.toThrow(ZodError);
  });

  it("garde le cadrage de l'illustration, borné", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    expect(card.imageFrame).toBeNull();
    const framed = await updateCard(ADMIN, card.id, {
      ...BASE,
      imageFrame: { x: 30, y: 70, zoom: 1.5 },
    });
    expect(framed.imageFrame).toEqual({ x: 30, y: 70, zoom: 1.5 });
    expect((await updateCard(ADMIN, card.id, { ...BASE, imageFrame: null })).imageFrame).toBeNull();
    await expect(
      updateCard(ADMIN, card.id, { ...BASE, imageFrame: { x: 50, y: 50, zoom: 9 } }),
    ).rejects.toThrow(ZodError);
  });

  it("garde un cadrage à part pour la full art, sans perdre l'ancien", async () => {
    const normal = { x: 30, y: 70, zoom: 1.5 };
    const full = { x: 60, y: 40, zoom: 2.5 };
    // carte cadrée avant la séparation : la full art reprend le cadrage de la normale
    const card = await createCard(ADMIN, { ...BASE, setId, imageFrame: normal });
    expect(card.imageFrameFull).toBeNull();
    expect(frameFor(card, "fullart")).toEqual(normal);

    const split = await updateCard(ADMIN, card.id, {
      ...BASE,
      imageFrame: normal,
      imageFrameFull: full,
    });
    expect(frameFor(split, "normal")).toEqual(normal);
    expect(frameFor(split, "fullart")).toEqual(full);

    // une mise à jour sans cadrage full art (mise à jour en masse) le laisse tel quel
    const kept = await updateCard(ADMIN, card.id, { ...BASE, imageFrame: { ...normal, zoom: 2 } });
    expect(kept.imageFrameFull).toEqual(full);
    // null : la full art reprend le cadrage de la normale
    const reset = await updateCard(ADMIN, card.id, {
      ...BASE,
      imageFrame: normal,
      imageFrameFull: null,
    });
    expect(frameFor(reset, "fullart")).toEqual(normal);
    await expect(
      updateCard(ADMIN, card.id, { ...BASE, imageFrameFull: { x: 50, y: 50, zoom: 9 } }),
    ).rejects.toThrow(ZodError);
  });

  it("enregistre la mise en page affichée (normale par défaut, full art pour une variante)", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    expect(card.layout).toBe("normal");
    const full = await updateCard(ADMIN, card.id, { ...BASE, layout: "fullart" });
    expect(full.layout).toBe("fullart");
    // absente (mise à jour en masse, anciens appels) : celle enregistrée ne change pas
    expect((await updateCard(ADMIN, card.id, { ...BASE })).layout).toBe("fullart");
    await expect(
      updateCard(ADMIN, card.id, { ...BASE, layout: "geante" as "normal" }),
    ).rejects.toThrow(ZodError);

    const variant = await createCard(ADMIN, { ...BASE, setId, baseCardId: card.id });
    expect(variant.layout).toBe("fullart");
    const shown = await createCard(ADMIN, {
      ...BASE,
      setId,
      baseCardId: card.id,
      layout: "normal",
    });
    expect(shown.layout).toBe("normal");
  });

  it("refuse un effet inconnu ou mal réglé", async () => {
    await expect(createCard(ADMIN, { ...BASE, setId, effectKey: "inconnu" })).rejects.toThrow(
      ZodError,
    );
    await expect(
      createCard(ADMIN, {
        ...BASE,
        setId,
        effectKey: "reveal_buff_hand",
        effectParams: { amount: 0 },
      }),
    ).rejects.toThrow(ZodError);
  });
});

describe("variantes", () => {
  it("reprennent les stats de la carte de base, qui les leur recopie", async () => {
    const base = await createCard(ADMIN, {
      ...BASE,
      setId,
      effectKey: "end_of_turn_grow",
      effectParams: { amount: 1 },
    });
    const variant = await createCard(ADMIN, {
      ...BASE,
      setId,
      name: "Carte test (full art)",
      rarity: "sr",
      cost: 6,
      power: 1,
      baseCardId: base.id,
    });
    expect(variant).toMatchObject({
      cost: 2,
      power: 3,
      effectKey: "end_of_turn_grow",
      rarity: "sr",
    });

    await updateCard(ADMIN, base.id, { ...BASE, cost: 4, power: 7, effectKey: null });
    const [, after] = await listCards(ADMIN, { setId });
    expect(after).toMatchObject({ cost: 4, power: 7, effectKey: null, effectText: "" });

    // Sur la variante, les stats envoyées sont ignorées.
    const edited = await updateCard(ADMIN, variant.id, {
      ...BASE,
      name: "Renommée",
      rarity: "ssr",
      cost: 0,
    });
    expect(edited).toMatchObject({ name: "Renommée", rarity: "ssr", cost: 4 });
  });

  it("pas de variante d'une variante", async () => {
    const base = await createCard(ADMIN, { ...BASE, setId });
    const variant = await createCard(ADMIN, { ...BASE, setId, baseCardId: base.id });
    await expect(createCard(ADMIN, { ...BASE, setId, baseCardId: variant.id })).rejects.toThrow(
      CardInputError,
    );
  });
});

describe("importCards", () => {
  const file = {
    set: { code: "S1", name: "Set de test" },
    cards: [
      { ...BASE, name: "Idée A", ideaId: "idea-a" },
      {
        ...BASE,
        name: "Idée B",
        ideaId: "idea-b",
        effectKey: "reveal_draw",
      },
    ],
  };

  it("crée les cartes à la suite, puis ignore les idées déjà importées", async () => {
    await createCard(ADMIN, { ...BASE, setId });
    expect(await importCards(ADMIN, file)).toEqual({ created: 2, skipped: 0 });
    expect(await importCards(ADMIN, file)).toEqual({ created: 0, skipped: 2 });
    const cards = await listCards(ADMIN, { setId });
    expect(cards.map((c) => [c.number, c.name])).toEqual([
      [1, "Carte test"],
      [2, "Idée A"],
      [3, "Idée B"],
    ]);
    expect(cards[2]?.effectText).toBe("Révélation : chaque joueur pioche une carte.");
  });

  it("tout ou rien, avec la carte fautive dans le message", async () => {
    const bad = { ...file, cards: [...file.cards, { ...BASE, name: "Trop chère", cost: 9 }] };
    await expect(importCards(ADMIN, bad)).rejects.toThrow(
      "Carte 3 (Trop chère) : Mana : 8 maximum.",
    );
    expect(await db.tcgCard.count()).toBe(0);
  });
});

describe("updateCards", () => {
  it("change coût, puissance et effet, retrouve la carte par son idée, garde le reste", async () => {
    await importCards(ADMIN, {
      set: { code: "S1", name: "Set de test" },
      cards: [{ ...BASE, name: "Idée A", ideaId: "idea-a", flavor: "Garde-moi." }],
    });
    const [base] = await listCards(ADMIN, { setId });
    await createCard(ADMIN, { ...BASE, setId, name: "Idée A (full art)", baseCardId: base?.id });
    const done = await updateCards(ADMIN, {
      updates: [
        {
          ideaId: "idea-a",
          cost: 6,
          power: 10,
          effectKey: "reveal_move_allies_left",
          effectText: "Révélation : ÇA TOURNE !",
        },
      ],
    });
    expect(done).toEqual({ updated: 1 });
    const [card, variant] = await listCards(ADMIN, { setId });
    expect(card).toMatchObject({
      name: "Idée A",
      flavor: "Garde-moi.",
      number: 1,
      cost: 6,
      power: 10,
      effectKey: "reveal_move_allies_left",
      effectText: "Révélation : ÇA TOURNE !",
    });
    expect(variant).toMatchObject({ cost: 6, power: 10, effectKey: "reveal_move_allies_left" });

    // Nouvel effet sans texte : le texte proposé par le catalogue.
    await updateCards(ADMIN, { updates: [{ ideaId: "idea-a", effectKey: "reveal_draw" }] });
    expect((await getCard(ADMIN, card?.id ?? ""))?.effectText).toBe(
      "Révélation : chaque joueur pioche une carte.",
    );
  });

  it("départage par le nom, tout ou rien, admins seulement", async () => {
    await createCard(ADMIN, { ...BASE, setId, name: "Un", ideaId: "idea-x" });
    await createCard(ADMIN, { ...BASE, setId, name: "Deux", ideaId: "idea-x" });
    await expect(updateCards(ADMIN, { updates: [{ ideaId: "idea-x", cost: 1 }] })).rejects.toThrow(
      "Carte 1 (idea-x) : plusieurs cartes possibles, précise son nom.",
    );
    await expect(
      updateCards(ADMIN, {
        updates: [
          { ideaId: "idea-x", name: "Deux", cost: 1 },
          { ideaId: "idea-y", name: "Absente", cost: 1 },
        ],
      }),
    ).rejects.toThrow("Carte 2 (Absente) : aucune carte pour cette idée.");
    await expect(
      updateCards(ADMIN, { updates: [{ ideaId: "idea-x", name: "Un", effectKey: "inconnu" }] }),
    ).rejects.toThrow("Carte 1 (Un) : Effet inconnu.");
    expect((await listCards(ADMIN, { setId })).map((c) => c.cost)).toEqual([2, 2]);
    await expect(
      updateCards(MEMBER, { updates: [{ ideaId: "idea-x", name: "Un", cost: 1 }] }),
    ).rejects.toThrow("Réservé aux admins.");
  });
});

describe("illustration", () => {
  // en-tête RIFF….WEBP
  const webp = new Uint8Array([82, 73, 70, 70, 2, 0, 0, 0, 87, 69, 66, 80]);

  it("s'envoie par URL présignée, puis se pose sur la carte", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    const { key, url } = await createCardImageUpload(ADMIN, {
      contentType: "image/webp",
      size: webp.length,
    });
    expect(key).toMatch(/^cards\/[0-9a-f-]{36}\.webp$/);
    const res = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "image/webp" },
      body: webp,
    });
    expect(res.status).toBe(200);
    expect((await setCardImage(ADMIN, card.id, key)).imageKey).toBe(key);
  });

  it("refuse une clé jamais envoyée, inventée, ou un format autre que WebP", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    const { key } = await createCardImageUpload(ADMIN, { contentType: "image/webp", size: 10 });
    await expect(setCardImage(ADMIN, card.id, key)).rejects.toThrow(CardInputError);
    await expect(setCardImage(ADMIN, card.id, "ideas/autre.png")).rejects.toThrow(ZodError);
    await expect(setCardImage(ADMIN, card.id, `cards/${crypto.randomUUID()}.png`)).rejects.toThrow(
      ZodError,
    );
    for (const contentType of ["image/gif", "image/png", "image/jpeg"]) {
      await expect(createCardImageUpload(ADMIN, { contentType, size: 10 })).rejects.toThrow(
        ZodError,
      );
    }
    await expect(
      createCardImageUpload(MEMBER, { contentType: "image/webp", size: 10 }),
    ).rejects.toThrow("Réservé aux admins.");
  });
});

describe("réserve et sets", () => {
  it("crée une carte dans la réserve, sans numéro", async () => {
    const card = await createCard(ADMIN, { ...BASE });
    expect(card).toMatchObject({ setId: null, setCode: null, number: null });
    expect(await listCards(ADMIN, { setId: null })).toHaveLength(1);
  });

  it("range des cartes dans un set, puis renumérote ce qui en sort", async () => {
    const a = await createCard(ADMIN, { ...BASE, name: "A", setId });
    await createCard(ADMIN, { ...BASE, name: "B", setId });
    await createCard(ADMIN, { ...BASE, name: "C", setId });
    const r = await createCard(ADMIN, { ...BASE, name: "R" });
    expect(await moveCards(ADMIN, [a.id, r.id], null)).toEqual({ moved: 1 });
    const left = await listCards(ADMIN, { setId });
    expect(left.map((x) => [x.name, x.number])).toEqual([
      ["B", 1],
      ["C", 2],
    ]);
    await moveCards(ADMIN, [r.id, a.id], setId);
    const after = await listCards(ADMIN, { setId });
    expect(after.map((x) => [x.name, x.number])).toEqual([
      ["B", 1],
      ["C", 2],
      ["R", 3],
      ["A", 4],
    ]);
  });

  it("refuse un set inconnu, une carte inconnue, un code de set déjà pris", async () => {
    const card = await createCard(ADMIN, { ...BASE });
    await expect(moveCards(ADMIN, [card.id], "inconnu")).rejects.toThrow(CardInputError);
    await expect(moveCards(ADMIN, ["inconnue"], setId)).rejects.toThrow(CardInputError);
    await expect(createSet(ADMIN, { code: "S1", name: "Doublon" })).rejects.toThrow(
      "Le set S1 existe déjà.",
    );
    await expect(moveCards(MEMBER, [card.id], setId)).rejects.toThrow("Réservé aux admins.");
  });

  it("une idée peut donner plusieurs cartes", async () => {
    await createCard(ADMIN, { ...BASE, ideaId: "idea-x" });
    await createCard(ADMIN, { ...BASE, name: "Autre version", ideaId: "idea-x", setId });
    expect(await listCards(ADMIN, { ideaId: "idea-x" })).toHaveLength(2);
  });

  it("importe dans la réserve un fichier sans set", async () => {
    expect(await importCards(ADMIN, { cards: [{ ...BASE, ideaId: "idea-y" }] })).toEqual({
      created: 1,
      skipped: 0,
    });
    expect(await listCards(ADMIN, { setId: null })).toHaveLength(1);
  });
});

describe("corbeille", () => {
  it("sort la carte de son set et des listes, puis l'en ressort en la rangeant", async () => {
    const a = await createCard(ADMIN, { ...BASE, name: "A", setId });
    await createCard(ADMIN, { ...BASE, name: "B", setId });
    expect(await trashCards(ADMIN, [a.id])).toEqual({ trashed: 1 });
    // déjà à la corbeille : laissée telle quelle
    expect(await trashCards(ADMIN, [a.id])).toEqual({ trashed: 0 });
    expect((await listCards(ADMIN, { setId })).map((c) => [c.name, c.number])).toEqual([["B", 1]]);
    expect(await listCards(ADMIN, { setId: null })).toHaveLength(0);
    const [trashed] = await listCards(ADMIN, { trashed: true });
    expect(trashed).toMatchObject({ id: a.id, setId: null, number: null });
    expect(trashed?.deletedAt).toBeInstanceOf(Date);

    // ranger dans la réserve la restaure
    expect(await moveCards(ADMIN, [a.id], null)).toEqual({ moved: 1 });
    expect((await getCard(ADMIN, a.id))?.deletedAt).toBeNull();
    expect(await listCards(ADMIN, { setId: null })).toHaveLength(1);
    await expect(trashCards(MEMBER, [a.id])).rejects.toThrow("Réservé aux admins.");
  });

  it("une carte de base n'y va et n'en sort qu'avec ses variantes", async () => {
    const base = await createCard(ADMIN, { ...BASE, setId });
    const variant = await createCard(ADMIN, { ...BASE, setId, baseCardId: base.id });
    await expect(trashCards(ADMIN, [base.id])).rejects.toThrow(CardInputError);
    await trashCards(ADMIN, [base.id, variant.id]);
    await expect(createCard(ADMIN, { ...BASE, baseCardId: base.id })).rejects.toThrow(
      "Carte de base à la corbeille.",
    );
    await expect(moveCards(ADMIN, [variant.id], setId)).rejects.toThrow(CardInputError);
    expect(await moveCards(ADMIN, [base.id, variant.id], setId)).toEqual({ moved: 2 });
  });

  it("une mise à jour en masse ignore les cartes de la corbeille", async () => {
    const card = await createCard(ADMIN, { ...BASE, ideaId: "idea-t" });
    await trashCards(ADMIN, [card.id]);
    await expect(updateCards(ADMIN, { updates: [{ ideaId: "idea-t", cost: 5 }] })).rejects.toThrow(
      "aucune carte pour cette idée",
    );
  });

  it("supprime pour de bon les seules cartes de la corbeille, variantes comprises", async () => {
    const base = await createCard(ADMIN, { ...BASE, setId });
    const variant = await createCard(ADMIN, { ...BASE, setId, baseCardId: base.id });
    await expect(deleteCards(ADMIN, [base.id])).rejects.toThrow(CardInputError);
    await trashCards(ADMIN, [base.id, variant.id]);
    await expect(deleteCards(ADMIN, [base.id])).rejects.toThrow(CardInputError);
    expect(await deleteCards(ADMIN, [base.id, variant.id])).toEqual({ deleted: 2, imageKeys: [] });
    expect(await getCard(ADMIN, base.id)).toBeNull();
    await expect(deleteCards(MEMBER, [base.id])).rejects.toThrow("Réservé aux admins.");
  });
});

describe("effets visuels", () => {
  beforeEach(async () => {
    // Les tests vident toutes les tables : le catalogue rempli par la migration aussi.
    await db.tcgVisualEffect.createMany({
      data: [
        { key: "holo", name: "Reflet holographique" },
        { key: "eclair", name: "Éclair" },
      ],
    });
  });

  it("liste le catalogue par nom, pour les admins seulement", async () => {
    expect(await listVisualEffects(ADMIN)).toEqual([
      { key: "eclair", name: "Éclair" },
      { key: "holo", name: "Reflet holographique" },
    ]);
    await expect(listVisualEffects(MEMBER)).rejects.toThrow();
  });

  it("pose plusieurs effets dans l'ordre, les garde, les remplace et les retire", async () => {
    const card = await createCard(ADMIN, {
      ...BASE,
      setId,
      visualEffectKeys: ["eclair", "holo", "eclair"],
    });
    // Ordre gardé, doublon retiré.
    expect(card.visualEffectKeys).toEqual(["eclair", "holo"]);
    expect((await getCard(ADMIN, card.id))?.visualEffectKeys).toEqual(["eclair", "holo"]);
    // Absent : inchangé.
    const kept = await updateCard(ADMIN, card.id, { ...BASE, name: "Renommée" });
    expect(kept.visualEffectKeys).toEqual(["eclair", "holo"]);
    const swapped = await updateCard(ADMIN, card.id, { ...BASE, visualEffectKeys: ["holo"] });
    expect(swapped.visualEffectKeys).toEqual(["holo"]);
    // Liste vide : aucun effet.
    const cleared = await updateCard(ADMIN, card.id, { ...BASE, visualEffectKeys: [] });
    expect(cleared.visualEffectKeys).toEqual([]);
  });

  it("refuse un effet absent du catalogue, sans rien enregistrer", async () => {
    await expect(
      createCard(ADMIN, { ...BASE, setId, visualEffectKeys: ["holo", "inconnu"] }),
    ).rejects.toThrow(CardInputError);
    expect(await listCards(ADMIN)).toHaveLength(0);
  });

  it("une variante a ses propres effets", async () => {
    const base = await createCard(ADMIN, { ...BASE, setId });
    const variant = await createCard(ADMIN, {
      ...BASE,
      setId,
      baseCardId: base.id,
      visualEffectKeys: ["eclair"],
    });
    expect(variant.visualEffectKeys).toEqual(["eclair"]);
    expect((await getCard(ADMIN, base.id))?.visualEffectKeys).toEqual([]);
  });

  it("l'import pose les effets des cartes", async () => {
    await importCards(ADMIN, {
      cards: [{ ...BASE, name: "Importée", visualEffectKeys: ["holo"] }],
    });
    expect((await listCards(ADMIN))[0]?.visualEffectKeys).toEqual(["holo"]);
  });
});
