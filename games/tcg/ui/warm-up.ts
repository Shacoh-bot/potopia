import {
  type Card,
  type CardLayout,
  type CardRarityId,
  cardVersions,
  type GlowKind,
  type GlowPoint,
  glowKind,
} from "../src/card-rules";
import type { GameCardFields } from "./GameCard";

/*
 * Préchauffage de l'ouverture d'un booster. Chrome (Skia Graphite) compile un programme GPU la
 * première fois qu'il dessine chaque sorte de calque (dos de carte, face d'une rareté, effet
 * visuel, aura, image de la vidéo) : 0,3 à 1,2 s d'arrêt à l'arrivée des cartes et aux
 * retournements de la première ouverture, puis plus rien jusqu'à la fermeture du navigateur.
 * La page des boosters dessine donc d'avance, invisible (`BoosterWarmUp`), une carte de chaque
 * allure du set : rareté × mise en page, chaque effet visuel et chaque sorte de lumière y passent
 * au moins une fois. Les cartes sont fictives : on ne montre rien des cartes pas encore trouvées
 * (ni nom, ni illustration), seulement leur allure.
 */

/** Allure d'une carte : ce qui change les programmes GPU, pas son contenu. */
export type WarmUpLook = {
  rarity: CardRarityId;
  layout: CardLayout;
  /** Effets visuels, dans l'ordre de la carte (le premier en dessous). */
  effects: string[];
  /** Sortes de lumières posées sur l'illustration. */
  glow: GlowKind[];
};

/** Ce que le préchauffage couvre d'une allure : chaque élément doit passer au moins une fois. */
function features(look: WarmUpLook): string[] {
  return [
    `${look.rarity}|${look.layout}`,
    ...look.effects.map((e) => `effet:${e}`),
    ...look.glow.map((g) => `lumière:${g}`),
  ];
}

/**
 * Les allures à préchauffer pour les cartes d'un set : le moins de cartes possible pour que chaque
 * rareté × mise en page, chaque effet visuel et chaque sorte de lumière passent au moins une fois
 * (à chaque tour, l'allure qui couvre le plus de nouveautés ; à égalité, la première du set).
 */
export function warmUpLooks(
  cards: Pick<Card, "rarity" | "hasNormal" | "hasFullArt" | "visualEffectKeys" | "glowPoints">[],
): WarmUpLook[] {
  const looks = new Map<string, WarmUpLook>();
  for (const card of cards) {
    for (const layout of cardVersions(card)) {
      const look: WarmUpLook = {
        rarity: card.rarity,
        layout,
        effects: [...card.visualEffectKeys],
        glow: [...new Set(card.glowPoints.map(glowKind))].sort(),
      };
      const key = JSON.stringify(look);
      if (!looks.has(key)) looks.set(key, look);
    }
  }
  const covered = new Set<string>();
  const chosen: WarmUpLook[] = [];
  let rest = [...looks.values()];
  for (;;) {
    let best: WarmUpLook | undefined;
    let bestNew = 0;
    for (const look of rest) {
      const fresh = features(look).filter((f) => !covered.has(f)).length;
      if (fresh > bestNew) {
        best = look;
        bestNew = fresh;
      }
    }
    if (!best) return chosen;
    chosen.push(best);
    for (const f of features(best)) covered.add(f);
    rest = rest.filter((look) => look !== best);
  }
}

/** Une lumière de chaque sorte, au milieu de l'illustration. */
function warmUpGlow(kind: GlowKind, i: number): GlowPoint {
  const x = 30 + 12 * i;
  return kind === "line"
    ? { kind, x, y: 40, x2: x + 20, y2: 55, size: 2, color: "#ffd166", speed: 5 }
    : { kind, x, y: 40, size: 6, color: "#ffd166", speed: 5 };
}

/** Carte fictive d'une allure : textes neutres, mêmes rareté, mise en page, effets et lumières. */
export function warmUpCard(look: WarmUpLook): GameCardFields {
  return {
    name: "Préchauffage",
    rarity: look.rarity,
    type: "Carte",
    family: "Potopia",
    cost: 3,
    power: 4,
    effectText: "Révélée : +1 Puissance à une autre carte ici.",
    flavor: "Une carte d'essai, jamais affichée.",
    number: 1,
    setCode: "S1",
    layout: look.layout,
    hasNormal: true,
    glowPoints: look.glow.map(warmUpGlow),
    visualEffectKeys: look.effects,
  };
}

/*
 * Étapes et barre du préchauffage. Le préchauffage avance par étapes (la vidéo et les cartes de dos,
 * puis les allures par paquets, puis la pose) ; le bouton « Ouvrir un paquet » montre une barre
 * qui avance d'un cran par étape et reste désactivé jusqu'à la fin, ou jusqu'au délai de garde.
 */

/**
 * Étapes du préchauffage pour `looks` allures : la vidéo et les dos, les allures par paquets de
 * `perStep` (une par place de carte, comme un vrai paquet : Chrome compile alors leurs programmes en
 * même temps), puis la pose.
 */
export function warmUpSteps(looks: number, perStep: number): number {
  return Math.ceil(looks / Math.max(1, perStep)) + 2;
}

/**
 * Attente (ms) entre la dernière allure montée et la fin, `elapsedMs` après le début : le temps
 * que la dernière carte se pose avec son aura (`settleMs`) et que la vidéo s'efface (`videoGoneAt`,
 * depuis le début). Rien de plus : ce sont les animations à dessiner, pas une pause.
 */
export function warmUpRest(
  elapsedMs: number,
  { videoGoneAt, settleMs }: { videoGoneAt: number; settleMs: number },
): number {
  return Math.max(settleMs, videoGoneAt - elapsedMs);
}

/** Délai de garde (ms) : passé ce temps, le bouton redevient cliquable même si rien n'a fini. */
export const WARM_UP_GUARD_MS = 12_000;

/**
 * Part de la barre (0 à 1) : les étapes du préchauffage des cartes (`done` sur `total`), plus un
 * cran pour le rebond de la boule de l'en-tête (`orbDone`). 1 seulement quand tout est fini.
 */
export function warmUpProgress(
  { done, total }: { done: number; total: number },
  orbDone: boolean,
): number {
  const steps = Math.min(Math.max(done, 0), total) + (orbDone ? 1 : 0);
  return total + 1 > 0 ? steps / (total + 1) : 1;
}
