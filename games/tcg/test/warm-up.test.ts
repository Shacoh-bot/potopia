import { describe, expect, it } from "vitest";
import type { Card } from "../src/card-rules";
import {
  WARM_UP_GUARD_MS,
  warmUpCard,
  warmUpLooks,
  warmUpProgress,
  warmUpRest,
  warmUpSteps,
} from "../ui/warm-up";

type Fields = Pick<
  Card,
  | "rarity"
  | "hasNormal"
  | "hasFullArt"
  | "visualEffectKeys"
  | "visualEffectKeysFull"
  | "glowPoints"
  | "glowPointsFull"
>;
// Sans liste full art donnée : la même que la normale (comme une carte recopiée par la migration).
const card = (over: Partial<Fields>): Fields => ({
  rarity: "common",
  hasNormal: true,
  hasFullArt: false,
  visualEffectKeys: [],
  glowPoints: [],
  ...over,
  visualEffectKeysFull: over.visualEffectKeysFull ?? over.visualEffectKeys ?? [],
  glowPointsFull: over.glowPointsFull ?? over.glowPoints ?? [],
});

describe("warmUpLooks et les effets par version", () => {
  it("prend les effets propres à chaque version", () => {
    const looks = warmUpLooks([
      card({
        rarity: "sr",
        hasFullArt: true,
        visualEffectKeys: ["holo"],
        visualEffectKeysFull: ["eclair"],
      }),
    ]);
    const byLayout = Object.fromEntries(looks.map((l) => [l.layout, l.effects]));
    expect(byLayout).toEqual({ normal: ["holo"], fullart: ["eclair"] });
  });
});

describe("préchauffage de l'ouverture d'un booster", () => {
  it("une carte par allure : les cartes de même allure ne comptent qu'une fois", () => {
    const looks = warmUpLooks([card({}), card({}), card({ rarity: "ssr" })]);
    expect(looks).toEqual([
      { rarity: "common", layout: "normal", effects: [], glow: [] },
      { rarity: "ssr", layout: "normal", effects: [], glow: [] },
    ]);
  });

  it("couvre chaque rareté × mise en page, chaque effet et chaque sorte de lumière, en peu de cartes", () => {
    const looks = warmUpLooks([
      card({ rarity: "rare", visualEffectKeys: ["holo"] }),
      card({ rarity: "rare", visualEffectKeys: ["holo", "eclair"] }),
      card({ rarity: "sr", hasFullArt: true, visualEffectKeys: ["eclair"] }),
      card({
        rarity: "rare",
        glowPoints: [{ kind: "sparks", x: 1, y: 1, size: 1, color: "#fff", speed: 1 }],
      }),
    ]);
    const covered = new Set(
      looks.flatMap((l) => [`${l.rarity}|${l.layout}`, ...l.effects, ...l.glow]),
    );
    expect(covered).toEqual(
      new Set(["rare|normal", "sr|normal", "sr|fullart", "holo", "eclair", "sparks"]),
    );
    // « holo » seul est couvert par « holo + éclair » : sa carte n'est pas dessinée en plus
    expect(looks).not.toContainEqual({
      rarity: "rare",
      layout: "normal",
      effects: ["holo"],
      glow: [],
    });
    expect(looks.length).toBeLessThanOrEqual(4);
  });

  it("set vide : rien à dessiner", () => {
    expect(warmUpLooks([])).toEqual([]);
  });

  it("carte fictive : l'allure demandée, rien d'une vraie carte", () => {
    const fake = warmUpCard({
      rarity: "ssr",
      layout: "fullart",
      effects: ["holo"],
      glow: ["line"],
    });
    expect(fake).toMatchObject({
      name: "Préchauffage",
      rarity: "ssr",
      layout: "fullart",
      visualEffectKeys: ["holo"],
    });
    expect(fake.glowPoints).toHaveLength(1);
    expect(fake.glowPoints?.[0]).toMatchObject({ kind: "line" });
  });
});

describe("barre du préchauffage sur le bouton", () => {
  it("une étape pour la vidéo et les dos, une par paquet d'allures, une pour la pose", () => {
    expect(warmUpSteps(0, 5)).toBe(2);
    expect(warmUpSteps(5, 5)).toBe(3);
    expect(warmUpSteps(9, 5)).toBe(4);
    expect(warmUpSteps(3, 1)).toBe(5);
  });

  it("la barre avance d'un cran par étape et n'est pleine que quand tout est fini", () => {
    const total = warmUpSteps(3, 1);
    const crans = [0, 1, 2, 3, 4, 5].map((done) => warmUpProgress({ done, total }, [false, false]));
    expect(crans[0]).toBe(0);
    for (let i = 1; i < crans.length; i++) expect(crans[i]).toBeGreaterThan(crans[i - 1] ?? 0);
    // cartes finies, boule ou images du prochain paquet pas encore : pas plein
    expect(warmUpProgress({ done: total, total }, [false, true])).toBeLessThan(1);
    expect(warmUpProgress({ done: total, total }, [true, false])).toBeLessThan(1);
    expect(warmUpProgress({ done: 0, total }, [true, true])).toBeLessThan(1);
    // chaque préparation à côté vaut un cran
    expect(warmUpProgress({ done: 0, total }, [true, false])).toBe(1 / (total + 2));
    expect(warmUpProgress({ done: total, total }, [true, true])).toBe(1);
  });

  it("après la dernière allure : juste le temps de la pose ou de l'effacement de la vidéo", () => {
    const timeline = { videoGoneAt: 1650, settleMs: 1320 };
    // allures montées vite : la vidéo n'a pas fini de s'effacer
    expect(warmUpRest(100, timeline)).toBe(1550);
    // allures montées tard : seulement la pose de la dernière carte
    expect(warmUpRest(4000, timeline)).toBe(1320);
  });

  it("délai de garde de l'ordre de 10 à 12 s", () => {
    expect(WARM_UP_GUARD_MS).toBeGreaterThanOrEqual(10_000);
    expect(WARM_UP_GUARD_MS).toBeLessThanOrEqual(12_000);
  });
});
