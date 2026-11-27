import { CARD_RARITIES, type CardRarityId } from "../../src/card-rules";
import type { GameCardFields } from "../../ui/GameCard";

/**
 * Cartes du filet de sécurité (test de budget et banc de rendu) : chaque rareté, en carte normale
 * sans effet, puis en full art avec trois effets. Contenu fictif, aucune carte réelle.
 *
 * Les trois effets couvrent les familles de strates qui coûtent : fusion de couleurs (`holo`),
 * reflet animé (`eclat`) et anneau en variable CSS animée (`orbite`). `eclair` est exclu : il tire
 * au hasard (Math.random), une capture ne serait jamais la même.
 */
export const EFFETS_TEST = ["holo", "eclat", "orbite"];

/**
 * Effets qui suivent le pointeur par un calque déplacé (`translate`) au lieu d'un fond ou d'un
 * masque repeint (refonte, étape 3) : vitrail (soleil qui dérive), lampe et reflet du métal.
 */
export const EFFETS_POINTEUR = ["vitrail", "lampe", "metal"];

export type CarteTest = { id: string; card: GameCardFields; layout: "normal" | "fullart" };

export function carte(rarity: CardRarityId, effets: string[]): GameCardFields {
  return {
    name: "Grenouille d'essai",
    rarity,
    type: "Créature",
    family: "Grenouilles",
    cost: 3,
    power: 4,
    effectText: "Quand elle arrive, pioche une carte. Les autres grenouilles gagnent +1.",
    flavor: "Elle chante faux, mais fort.",
    number: 7,
    setCode: "S1",
    author: "Essai",
    visualEffectKeys: effets,
    visualEffectKeysFull: effets,
  };
}

export const CARTES_TEST: CarteTest[] = [
  ...CARD_RARITIES.flatMap((r) => [
    { id: `${r}-normale`, card: carte(r, []), layout: "normal" as const },
    { id: `${r}-effets`, card: carte(r, EFFETS_TEST), layout: "fullart" as const },
  ]),
  { id: "rare-pointeur", card: carte("rare", EFFETS_POINTEUR), layout: "normal" },
  { id: "legendary-pointeur", card: carte("legendary", EFFETS_POINTEUR), layout: "fullart" },
];
