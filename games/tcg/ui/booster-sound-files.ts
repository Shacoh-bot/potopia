import { CARD_RARITIES } from "../src/card-rules";

/*
 * Fichiers des bruitages de l'ouverture d'un booster (`apps/web/public/audio/tcg/`), repris de
 * Pokémon TCG Pocket (sources : `TCG assets/sons/sources.csv`, hors dépôt).
 */

/** Dossier public des sons. */
export const BOOSTER_SOUNDS_BASE = "/audio/tcg/";

/** Révélation d'une carte : un son par rareté, du plus discret (commune) au plus fort (SSR). */
export const revealSound = (rarity: string) =>
  `reveal-${(CARD_RARITIES as readonly string[]).includes(rarity) ? rarity : "common"}`;

/** Tous les sons, sans extension (`.mp3`). */
export const BOOSTER_SOUNDS = [
  "grab", // prise en main du paquet
  "tear", // déchirure, jouée par petits grains tant que la découpe avance
  "open", // le paquet s'ouvre
  "land", // une carte se pose
  "flip", // une carte se retourne
  ...CARD_RARITIES.map(revealSound),
];
