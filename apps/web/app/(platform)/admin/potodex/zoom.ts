type Size = { width: number; height: number };

/** Marge autour de la carte ouverte en grand (px), et place gardée pour le bouton Fermer. */
const MARGIN = 16;
const CLOSE_ROOM = 56;
/** Au-delà, l'illustration (1 200 px au plus) commence à baver. */
const MAX_ZOOM = 2.5;

/**
 * Échelle d'une carte ouverte en grand (appliquée par `transform: scale()`, voir `Scaled`) : la
 * plus grande taille où elle tient entière dans l'écran,
 * marges et bouton Fermer compris, sans dépasser `MAX_ZOOM`.
 */
export function zoomToFit(viewport: Size, card: Size): number {
  const width = (viewport.width - 2 * MARGIN) / card.width;
  const height = (viewport.height - 2 * MARGIN - CLOSE_ROOM) / card.height;
  return Math.max(0.1, Math.min(width, height, MAX_ZOOM));
}
