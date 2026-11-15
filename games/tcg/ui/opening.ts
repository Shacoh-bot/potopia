/** Fond de l'écran d'ouverture d'un booster : celui de la vidéo MP4 (sans transparence). */
export const OPENING_BG = "#0b0b2a";

/** Déroulé de l'écran d'ouverture selon le réglage « réduire les animations » du navigateur. */
export type OpeningPlan = {
  /** Première étape : toujours le paquet 3D (on le découpe, la vidéo prend le relais). */
  startPhase: "pack";
  /** Les cartes partent de leur place sur la vidéo pour se ranger. */
  fromVideo: true;
  /** Léger flottement du paquet au repos (mouvement secondaire). */
  packFloat: boolean;
};

/**
 * L'ouverture n'est jamais sautée : paquet, découpe et relais vidéo se jouent toujours, c'est le
 * cœur de l'ouverture d'un booster. Avec « réduire les animations », seuls les mouvements
 * secondaires sont adoucis : pas de flottement du paquet ; côté CSS, cartes rangées et retournées
 * sans transition, consigne fixe (`tcg.css`).
 */
export function openingPlan(reducedMotion: boolean): OpeningPlan {
  return { startPhase: "pack", fromVideo: true, packFloat: !reducedMotion };
}
