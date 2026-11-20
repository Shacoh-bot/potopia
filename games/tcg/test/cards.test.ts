import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  CARD_LIMITS,
  CardInputError,
  createCard,
  createSet,
  createCardImageUpload,
  deleteCards,
  EFFECTS,
  effectStats,
  effectText,
  ensureSet,
  fitZoom,
  frameFor,
  getCard,
  GLOW_LIMITS,
  ideaCardStates,
  ideaStateOf,
  isDuplicateNote,
  markDuplicateNote,
  importCards,
  listCards,
  listVisualEffects,
  moveCards,
  paramsSchema,
  setCardStage,
  setCardImage,
  smallImageKeyFor,
  isBlurryWhenZoomed,
  SNAP_CARDS,
  trashCards,
  unmarkDuplicateNote,
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

  it("chaque effet a le coût et la puissance de sa carte Snap, dans les bornes d'une carte", () => {
    for (const effect of EFFECTS) {
      const stats = effectStats(effect.key);
      expect(stats, `${effect.key} (${effect.snap}) : stats Snap manquantes`).not.toBeNull();
      if (!stats) continue;
      expect(stats.cost).toBeGreaterThanOrEqual(CARD_LIMITS.cost.min);
      expect(stats.cost).toBeLessThanOrEqual(CARD_LIMITS.cost.max);
      expect(stats.power).toBeGreaterThanOrEqual(CARD_LIMITS.power.min);
      expect(stats.power).toBeLessThanOrEqual(CARD_LIMITS.power.max);
      expect(SNAP_CARDS[effect.snap]?.url).toMatch(/^https:\/\/snap\.fan\/cards\//);
    }
    // valeurs vérifiées à la main sur snap.fan le 13/11/2026
    expect(SNAP_CARDS["Spider-Woman"]).toMatchObject({ cost: 5, power: 8 });
    expect(SNAP_CARDS["Colossus"]).toMatchObject({ cost: 2, power: 4 });
    expect(SNAP_CARDS["Mother Askani"]).toMatchObject({ cost: 4, power: 4 });
    expect(effectStats(null)).toBeNull();
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

  it("dézoome la version normale seulement, sans toucher la full art", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    // carte normale : l'image peut rétrécir jusqu'à tenir entière dans sa fenêtre
    const whole = { x: 50, y: 20, zoom: 0.43 };
    const framed = await updateCard(ADMIN, card.id, { ...BASE, imageFrame: whole });
    expect(frameFor(framed, "normal")).toEqual(whole);
    // full art sans cadrage à elle : celui de la normale, mais jamais dézoomée
    expect(frameFor(framed, "fullart")).toEqual({ ...whole, zoom: 1 });
    // la full art reste à 1 au moins ; sous le minimum, refusé partout
    await expect(
      updateCard(ADMIN, card.id, { ...BASE, imageFrameFull: { x: 50, y: 50, zoom: 0.5 } }),
    ).rejects.toThrow(ZodError);
    await expect(
      updateCard(ADMIN, card.id, { ...BASE, imageFrame: { x: 50, y: 50, zoom: 0.1 } }),
    ).rejects.toThrow(ZodError);
    // full art cadrée à part (ce qu'enregistre la fiche) : le dézoom de la normale ne la change pas
    const full = { x: 40, y: 60, zoom: 1.2 };
    const both = await updateCard(ADMIN, card.id, {
      ...BASE,
      imageFrame: { ...whole, x: 10 },
      imageFrameFull: full,
    });
    expect(frameFor(both, "fullart")).toEqual(full);
  });

  it("fitZoom : le zoom qui fait tenir l'image entière dans la fenêtre", () => {
    const normalBox = { width: 286, height: 186 };
    // image portrait 2:3 (pensée pour la full art) : 186 / (286 × 1,5) ≈ 0,43
    expect(fitZoom(normalBox, { width: 800, height: 1200 })).toBe(0.43);
    // image aux proportions de la fenêtre : rien à dézoomer
    expect(fitZoom(normalBox, { width: 286, height: 186 })).toBe(1);
    // image très étroite : bornée au zoom minimum
    expect(fitZoom(normalBox, { width: 100, height: 2000 })).toBe(0.25);
    expect(fitZoom(normalBox, { width: 0, height: 0 })).toBe(1);
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

  it("garde les lumières (points, étincelles, rayons, traits), bornées, et les laisse quand on ne les envoie pas", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    expect(card.glowPoints).toEqual([]);
    const eyes = [
      { x: 40, y: 30, size: 6, color: "#7cff6b", speed: 0 },
      { x: 60, y: 30, size: 6, color: "#ff2d7a", speed: 4 },
    ];
    expect((await updateCard(ADMIN, card.id, { ...BASE, glowPoints: eyes })).glowPoints).toEqual(
      eyes,
    );
    // absents (mise à jour en masse, anciens appels) : ceux enregistrés restent
    expect((await updateCard(ADMIN, card.id, { ...BASE })).glowPoints).toEqual(eyes);
    expect((await updateCard(ADMIN, card.id, { ...BASE, glowPoints: [] })).glowPoints).toEqual([]);
    for (const bad of [
      { ...eyes[0], x: 120 },
      { ...eyes[0], size: 50 },
      { ...eyes[0], color: "vert" },
      { ...eyes[0], speed: 11 },
    ]) {
      await expect(
        updateCard(ADMIN, card.id, { ...BASE, glowPoints: [bad as (typeof eyes)[0]] }),
      ).rejects.toThrow(ZodError);
    }
    await expect(
      updateCard(ADMIN, card.id, {
        ...BASE,
        glowPoints: Array(GLOW_LIMITS.points + 1).fill(eyes[0]),
      }),
    ).rejects.toThrow(ZodError);

    // autres lumières : étincelles, rayons, trait (avec sa seconde extrémité)
    const lights = [
      { kind: "sparks" as const, x: 10, y: 10, size: 8, color: "#ffaa00", speed: 5 },
      { kind: "rays" as const, x: 20, y: 20, size: 10, color: "#ffffff", speed: 2 },
      {
        kind: "line" as const,
        x: 30,
        y: 30,
        x2: 60,
        y2: 35,
        size: 1.5,
        color: "#67e8f9",
        speed: 3,
      },
    ];
    expect((await updateCard(ADMIN, card.id, { ...BASE, glowPoints: lights })).glowPoints).toEqual(
      lights,
    );
    await expect(
      updateCard(ADMIN, card.id, {
        ...BASE,
        glowPoints: [{ kind: "line", x: 30, y: 30, size: 1.5, color: "#67e8f9", speed: 3 }],
      }),
    ).rejects.toThrow("Trait lumineux : seconde extrémité attendue.");
    await expect(
      updateCard(ADMIN, card.id, {
        ...BASE,
        glowPoints: [
          {
            kind: "laser" as "line",
            x: 1,
            y: 1,
            x2: 2,
            y2: 2,
            size: 2,
            color: "#ffffff",
            speed: 0,
          },
        ],
      }),
    ).rejects.toThrow(ZodError);
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
    // stats manuelles : la base garde les stats saisies malgré son effet
    const base = await createCard(ADMIN, {
      ...BASE,
      setId,
      effectKey: "end_of_turn_grow",
      effectParams: { amount: 1 },
      statsManual: true,
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
    // la même image posée sur l'Alt Art : la normale garde la sienne
    const alt = await setCardImage(ADMIN, card.id, key, { version: "fullart" });
    expect(alt).toMatchObject({ imageKey: key, imageKeyFull: key });
  });

  it("garde la version réduite de chaque illustration, et la retire avec une image sans elle", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    const send = async () => {
      const { key, url } = await createCardImageUpload(ADMIN, {
        contentType: "image/webp",
        size: webp.length,
      });
      await fetch(url, { method: "PUT", headers: { "content-type": "image/webp" }, body: webp });
      return key;
    };
    const [large, small, fullLarge, fullSmall] = [
      await send(),
      await send(),
      await send(),
      await send(),
    ];
    const normal = await setCardImage(ADMIN, card.id, large, { smallKey: small });
    expect(normal).toMatchObject({ imageKey: large, imageKeySmall: small });
    // la full art sans image à elle : la version réduite de la normale
    expect(smallImageKeyFor(normal, "fullart")).toBe(small);
    const both = await setCardImage(ADMIN, card.id, fullLarge, {
      version: "fullart",
      smallKey: fullSmall,
    });
    expect(both).toMatchObject({ imageKeyFull: fullLarge, imageKeyFullSmall: fullSmall });
    expect(smallImageKeyFor(both, "normal")).toBe(small);
    expect(smallImageKeyFor(both, "fullart")).toBe(fullSmall);
    // image envoyée sans version réduite (petite image, ancien envoi) : plus de version réduite
    const plain = await setCardImage(ADMIN, card.id, large);
    expect(plain.imageKeySmall).toBeNull();
    expect(smallImageKeyFor(plain, "normal")).toBeNull();
    // version réduite jamais envoyée : refusée
    const { key: missing } = await createCardImageUpload(ADMIN, {
      contentType: "image/webp",
      size: 10,
    });
    await expect(setCardImage(ADMIN, card.id, large, { smallKey: missing })).rejects.toThrow(
      CardInputError,
    );
  });

  it("avertit sous 1 500 px de côté long (floue en carte agrandie)", () => {
    expect(isBlurryWhenZoomed({ width: 418, height: 627 })).toBe(true);
    expect(isBlurryWhenZoomed({ width: 800, height: 1200 })).toBe(true);
    expect(isBlurryWhenZoomed({ width: 849, height: 1200 })).toBe(true);
    expect(isBlurryWhenZoomed({ width: 999, height: 1499 })).toBe(true);
    expect(isBlurryWhenZoomed({ width: 1000, height: 1500 })).toBe(false);
    // plein format 2:3 de ChatGPT : on ne peut pas faire mieux, plus signalé
    expect(isBlurryWhenZoomed({ width: 1024, height: 1536 })).toBe(false);
    expect(isBlurryWhenZoomed({ width: 1536, height: 1024 })).toBe(false);
    expect(isBlurryWhenZoomed({ width: 2000, height: 1333 })).toBe(false);
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

describe("idée en doublon", () => {
  it("reconnaît la note écrite par le bouton « Doublon »", () => {
    expect(isDuplicateNote("Doublon")).toBe(true);
    expect(isDuplicateNote("Doublon — gardée : « Nae the Hutt »")).toBe(true);
    expect(isDuplicateNote("  doublon de « … »")).toBe(true);
    expect(isDuplicateNote("Doublons à revoir plus tard")).toBe(false);
    expect(isDuplicateNote("Pas un doublon")).toBe(false);
    expect(isDuplicateNote(null)).toBe(false);
  });

  it("le bouton « Doublon » de l'éditeur suit la même règle que la liste des idées", () => {
    expect(markDuplicateNote("")).toBe("Doublon");
    expect(markDuplicateNote("  ")).toBe("Doublon");
    expect(markDuplicateNote("Doublon")).toBe("Doublon");
    expect(markDuplicateNote(" doublon de « Nae » ")).toBe("doublon de « Nae »");
    expect(markDuplicateNote("Image à revoir")).toBe("Doublon — Image à revoir");
    // Pas une marque de doublon pour la liste des idées : le bouton la préfixe.
    expect(markDuplicateNote("Doublonnage à vérifier")).toBe("Doublon — Doublonnage à vérifier");
    for (const note of ["", "Doublon", "Doublonnage à vérifier", "Pas un doublon"]) {
      expect(isDuplicateNote(markDuplicateNote(note))).toBe(true);
    }
  });

  it("une carte gardée l'emporte : l'idée n'est doublon que sans carte gardée", () => {
    const trashedAt = new Date();
    const none = { cards: 0, duplicate: false, trashed: false };
    expect(ideaStateOf([])).toEqual(none);
    expect(ideaStateOf([{ adminNote: "Doublon", deletedAt: trashedAt }])).toEqual({
      ...none,
      duplicate: true,
    });
    expect(
      ideaStateOf([
        { adminNote: "Doublon", deletedAt: trashedAt },
        { adminNote: null, deletedAt: null },
      ]),
    ).toEqual({ ...none, cards: 1 });
    // à la corbeille sans la marque (essai) : l'idée suit sa carte à la corbeille
    expect(ideaStateOf([{ adminNote: null, deletedAt: trashedAt }])).toEqual({
      ...none,
      trashed: true,
    });
  });

  it("retire la marque « Doublon » d'une note et garde le reste", () => {
    expect(unmarkDuplicateNote("Doublon")).toBeNull();
    expect(unmarkDuplicateNote("Doublon — gardée : « X »")).toBe("gardée : « X »");
    expect(unmarkDuplicateNote("Essai")).toBe("Essai");
    expect(unmarkDuplicateNote(null)).toBeNull();
  });

  it("suit la marque « Doublon » de la carte, à la corbeille ou non, et la retire avec elle", async () => {
    const kept = await createCard(ADMIN, { ...BASE, name: "Gardée", setId, ideaId: "idea-kept" });
    const dup = await createCard(ADMIN, { ...BASE, name: "Doublon", setId, ideaId: "idea-dup" });
    await createCard(ADMIN, { ...BASE, name: "Sans idée", setId });
    const live = { cards: 1, duplicate: false, trashed: false };
    expect(await ideaCardStates(ADMIN)).toEqual(
      new Map([
        ["idea-kept", live],
        ["idea-dup", live],
      ]),
    );

    // marquée « Doublon » (encore dans le set) : l'idée est doublon, elle n'a plus de carte gardée
    const marked = { ...BASE, adminNote: `Doublon — gardée : « Gardée » (${kept.id})` };
    await updateCard(ADMIN, dup.id, marked);
    const dupState = { cards: 0, duplicate: true, trashed: false };
    expect((await ideaCardStates(ADMIN)).get("idea-dup")).toEqual(dupState);

    // puis à la corbeille : toujours doublon ; l'idée gardée ne bouge pas
    await trashCards(ADMIN, [dup.id]);
    const states = await ideaCardStates(ADMIN);
    expect(states.get("idea-dup")).toEqual(dupState);
    expect(states.get("idea-kept")).toEqual(live);

    // marque retirée : l'idée suit sa seule carte, à la corbeille
    await updateCard(ADMIN, dup.id, { ...BASE, adminNote: null });
    expect((await ideaCardStates(ADMIN)).get("idea-dup")).toEqual({
      cards: 0,
      duplicate: false,
      trashed: true,
    });

    await expect(ideaCardStates(MEMBER)).rejects.toThrow("Réservé aux admins.");
  });

  it("« Doublon » : la carte va à la corbeille marquée ; Corbeille ou sortie retirent la marque", async () => {
    const card = await createCard(ADMIN, { ...BASE, name: "Copie", setId, ideaId: "idea-copy" });
    await updateCard(ADMIN, card.id, { ...BASE, name: "Copie", adminNote: "vue en double" });
    const state = async () => (await ideaCardStates(ADMIN)).get("idea-copy");
    const note = async () => (await getCard(ADMIN, card.id))?.adminNote;

    await trashCards(ADMIN, [card.id], { duplicate: true });
    expect(await note()).toBe("Doublon — vue en double");
    expect((await getCard(ADMIN, card.id))?.deletedAt).not.toBeNull();
    expect(await state()).toEqual({ cards: 0, duplicate: true, trashed: false });

    // du Doublon à la Corbeille : la marque part, l'idée suit à la corbeille
    await trashCards(ADMIN, [card.id]);
    expect(await note()).toBe("vue en double");
    expect(await state()).toEqual({ cards: 0, duplicate: false, trashed: true });

    // retour au Doublon, puis sortie dans la réserve : l'idée revient
    await trashCards(ADMIN, [card.id], { duplicate: true });
    await moveCards(ADMIN, [card.id], null);
    expect(await note()).toBe("vue en double");
    expect(await state()).toEqual({ cards: 1, duplicate: false, trashed: false });
  });
});

describe("étapes de préparation", () => {
  it("commence « à traiter » ; changer d'étape ne touche ni à la place ni au numéro", async () => {
    const a = await createCard(ADMIN, { ...BASE, name: "A" });
    const b = await createCard(ADMIN, { ...BASE, name: "B", setId });
    expect(a.prepStage).toBe("todo");
    expect(await setCardStage(ADMIN, [a.id, b.id], "described")).toEqual({ staged: 2 });
    expect(await setCardStage(ADMIN, [a.id], "described")).toEqual({ staged: 0 });
    expect(await getCard(ADMIN, a.id)).toMatchObject({ prepStage: "described", setId: null });
    expect(await getCard(ADMIN, b.id)).toMatchObject({ prepStage: "described", setId, number: 1 });
  });

  it("garde l'étape quand la carte est rangée dans un set, puis en revient", async () => {
    const a = await createCard(ADMIN, { ...BASE });
    await setCardStage(ADMIN, [a.id], "integration");
    await moveCards(ADMIN, [a.id], setId);
    expect(await getCard(ADMIN, a.id)).toMatchObject({ prepStage: "integration", number: 1 });
    await moveCards(ADMIN, [a.id], null);
    expect(await getCard(ADMIN, a.id)).toMatchObject({ prepStage: "integration", setId: null });
  });

  it("refuse une étape inconnue", async () => {
    const a = await createCard(ADMIN, { ...BASE });
    await expect(setCardStage(ADMIN, [a.id], "finie")).rejects.toThrow(CardInputError);
    expect((await getCard(ADMIN, a.id))?.prepStage).toBe("todo");
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

describe("stats de l'effet", () => {
  // Spider-Woman (5/8) et Laufey (4/5) dans Marvel Snap
  const SPIDER = "reveal_debuff_enemies_here";
  const LAUFEY = "reveal_steal_power_all_here";
  const AMOUNT = { amount: 1 };
  const statsOf = (key: string) => {
    const stats = effectStats(key);
    if (!stats) throw new Error(`stats manquantes : ${key}`);
    return stats;
  };
  const found = <T>(value: T | null | undefined): T => {
    if (!value) throw new Error("carte introuvable");
    return value;
  };
  const pick = (card: { cost: number; power: number; statsManual: boolean }) => ({
    cost: card.cost,
    power: card.power,
    statsManual: card.statsManual,
  });

  it("une carte avec effet prend le coût et la puissance de sa carte Snap", async () => {
    const card = await createCard(ADMIN, {
      ...BASE,
      setId,
      effectKey: SPIDER,
      effectParams: AMOUNT,
    });
    expect(pick(card)).toEqual({ ...statsOf(SPIDER), statsManual: false });
    expect(statsOf(SPIDER)).not.toMatchObject({ cost: BASE.cost, power: BASE.power });
    // sans effet, les stats saisies restent
    expect(pick(await createCard(ADMIN, { ...BASE, setId }))).toEqual({
      cost: BASE.cost,
      power: BASE.power,
      statsManual: false,
    });
  });

  it("stats manuelles : les valeurs saisies sont gardées, et l'état est enregistré", async () => {
    const card = await createCard(ADMIN, {
      ...BASE,
      setId,
      effectKey: SPIDER,
      effectParams: AMOUNT,
      statsManual: true,
    });
    expect(pick(card)).toEqual({ cost: BASE.cost, power: BASE.power, statsManual: true });
    // une modification sans la case garde l'état enregistré (et les stats saisies)
    const kept = await updateCard(ADMIN, card.id, {
      ...BASE,
      effectKey: LAUFEY,
      effectParams: AMOUNT,
      cost: 7,
    });
    expect(pick(kept)).toEqual({ cost: 7, power: BASE.power, statsManual: true });
    // décochée : retour aux stats de l'effet
    const follows = await updateCard(ADMIN, card.id, {
      ...BASE,
      effectKey: LAUFEY,
      effectParams: AMOUNT,
      statsManual: false,
    });
    expect(pick(follows)).toEqual({ ...statsOf(LAUFEY), statsManual: false });
  });

  it("changer d'effet change les stats, côté serveur quelles que soient celles envoyées", async () => {
    const card = await createCard(ADMIN, {
      ...BASE,
      setId,
      effectKey: SPIDER,
      effectParams: AMOUNT,
    });
    const next = await updateCard(ADMIN, card.id, {
      ...BASE,
      effectKey: LAUFEY,
      effectParams: AMOUNT,
      cost: 0,
      power: 30,
    });
    expect(pick(next)).toEqual({ ...statsOf(LAUFEY), statsManual: false });
  });

  it("une carte existante n'est pas réécrite tant qu'on ne l'enregistre pas", async () => {
    const card = await createCard(ADMIN, {
      ...BASE,
      setId,
      effectKey: SPIDER,
      effectParams: AMOUNT,
    });
    // stats d'avant la règle, écrites directement en base
    await db.tcgCard.update({ where: { id: card.id }, data: { cost: 1, power: 1 } });
    expect(pick(found(await getCard(ADMIN, card.id)))).toEqual({
      cost: 1,
      power: 1,
      statsManual: false,
    });
  });

  it("les variantes suivent leur carte de base, case comprise", async () => {
    const base = await createCard(ADMIN, {
      ...BASE,
      setId,
      effectKey: SPIDER,
      effectParams: AMOUNT,
    });
    const variant = await createCard(ADMIN, { ...BASE, setId, baseCardId: base.id });
    expect(pick(variant)).toEqual(pick(base));
    await updateCard(ADMIN, base.id, {
      ...BASE,
      effectKey: SPIDER,
      effectParams: AMOUNT,
      statsManual: true,
      cost: 6,
    });
    expect(pick(found(await getCard(ADMIN, variant.id)))).toEqual({
      cost: 6,
      power: BASE.power,
      statsManual: true,
    });
  });

  it("import et mise à jour en masse suivent la même règle", async () => {
    await importCards(ADMIN, {
      cards: [
        { ...BASE, name: "Suit", ideaId: "idea-s", effectKey: SPIDER, effectParams: AMOUNT },
        {
          ...BASE,
          name: "Libre",
          ideaId: "idea-l",
          effectKey: SPIDER,
          effectParams: AMOUNT,
          statsManual: true,
        },
      ],
    });
    const byName = async (name: string) =>
      found((await listCards(ADMIN)).find((c) => c.name === name));
    expect(pick(await byName("Suit"))).toEqual({ ...statsOf(SPIDER), statsManual: false });
    expect(pick(await byName("Libre"))).toEqual({
      cost: BASE.cost,
      power: BASE.power,
      statsManual: true,
    });
    await updateCards(ADMIN, {
      updates: [
        { ideaId: "idea-s", effectKey: LAUFEY, effectParams: AMOUNT, cost: 0 },
        { ideaId: "idea-l", cost: 4 },
      ],
    });
    expect(pick(await byName("Suit"))).toEqual({ ...statsOf(LAUFEY), statsManual: false });
    expect(pick(await byName("Libre"))).toMatchObject({ cost: 4, statsManual: true });
  });
});

describe("note admin", () => {
  it("posée à la création, gardée si absente, effacée si vide, bornée", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId, adminNote: "  Doublon de Nae  " });
    expect(card.adminNote).toBe("Doublon de Nae");
    // une modification sans le champ (mise à jour en masse, anciens appels) garde la note
    expect((await updateCard(ADMIN, card.id, { ...BASE })).adminNote).toBe("Doublon de Nae");
    expect((await updateCard(ADMIN, card.id, { ...BASE, adminNote: "" })).adminNote).toBeNull();
    await expect(
      updateCard(ADMIN, card.id, { ...BASE, adminNote: "x".repeat(121) }),
    ).rejects.toThrow(ZodError);
    expect((await createCard(ADMIN, { ...BASE, setId })).adminNote).toBeNull();
  });

  it("sur une variante aussi, et toujours là à la corbeille", async () => {
    const base = await createCard(ADMIN, { ...BASE, setId });
    const variant = await createCard(ADMIN, { ...BASE, setId, baseCardId: base.id });
    expect((await updateCard(ADMIN, variant.id, { ...BASE, adminNote: "Doublon" })).adminNote).toBe(
      "Doublon",
    );
    const dup = await createCard(ADMIN, { ...BASE, setId, name: "Doublon", adminNote: "Doublon" });
    await trashCards(ADMIN, [dup.id]);
    const [trashed] = await listCards(ADMIN, { trashed: true });
    expect(trashed).toMatchObject({ id: dup.id, adminNote: "Doublon" });
  });
});
