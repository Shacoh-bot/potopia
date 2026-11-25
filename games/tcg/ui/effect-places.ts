/*
 * Place de chaque effet visuel en carte normale (voir `visual-effects.tsx`). Module à part, sans
 * « use client » : `FinalCard` (v5.tsx) est rendu côté serveur et choisit la place des effets
 * avant de poser leurs calques. Une fonction importée d'un module client n'y est qu'une référence
 * client : l'appeler côté serveur lève une erreur.
 */

/**
 * - `art` (par défaut) : sur l'illustration seule ;
 * - `card` : sur toute la carte, sous le bandeau du titre, la bordure et les encadrés ;
 * - `frame` : sur toute la carte, au-dessus de la bordure mais sous les encadrés (effets de cadre) ;
 * - `image` : l'effet redessine l'illustration, posé juste sur elle, sous tout le reste.
 */
export type EffectPlace = "art" | "card" | "frame" | "image";

/** Place des effets qui ne vont pas sur l'illustration seule, par clé du catalogue. */
const EFFECT_PLACES: Record<string, EffectPlace> = {
  eclair: "card",
  orbite: "frame",
  prisme: "frame",
  flux: "frame",
  halo: "frame",
  neon: "frame",
  aurore: "card",
  lenticulaire: "image",
  glitch: "image",
  or: "image",
  aquarelle: "image",
  cosmos: "image",
  vitrail: "image",
  energie: "image",
  parallaxe: "image",
  lampe: "card",
  donnees: "card",
  particules: "card",
  mirage: "image",
  givre: "frame",
  brume: "card",
  fumeeverte: "card",
  fumeeblanche: "card",
  braises: "card",
  rayons: "card",
  petales: "card",
  feuilles: "card",
  ombres: "card",
};

/**
 * Effets retirés (règle du 25/11/2026) : ils cachent le cadre de rareté, qui montre la rareté.
 * Ils ne se choisissent plus dans l'éditeur et ne s'affichent plus ; le réglage des cartes qui les
 * ont déjà reste enregistré (rien effacé). Halo, givre, orbite et néon restent permis.
 */
export const RETIRED_EFFECTS: readonly string[] = ["prisme", "flux"];

/** L'effet est-il retiré (ni choisi ni affiché) ? */
export function isRetiredEffect(effectKey: string): boolean {
  return RETIRED_EFFECTS.includes(effectKey);
}

/** Place de l'effet : illustration, toute la carte, par-dessus la bordure, ou l'image redessinée. */
export function effectPlace(effectKey: string): EffectPlace {
  return EFFECT_PLACES[effectKey] ?? "art";
}
