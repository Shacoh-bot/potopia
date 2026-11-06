/**
 * Place d'un effet qui surgit pendant une partie : à côté de la fenêtre du jeu ouvert (l'élément
 * marqué `data-fx-anchor`, la fenêtre de TROIS), jamais dessus. À droite de la fenêtre quand il y
 * a la place, sinon à sa gauche (sur le podium) ; la largeur se réduit à la place disponible, sans
 * descendre sous `min`. `bleed` : ce qui dépasse de chaque côté de l'effet (les embouts du rouleau
 * de Mao Mao). `null` : pas de jeu ouvert, ou pas la place (petit écran), l'effet garde alors sa
 * place par défaut.
 */
const GAP = 24; // entre la fenêtre du jeu et l'effet
const EDGE = 12; // marge contre le bord de la fenêtre du navigateur

export function besideGame(
  want: number,
  min: number,
  bleed = 0,
): { left: number; width: number } | null {
  const game = document.querySelector("[data-fx-anchor]")?.getBoundingClientRect();
  if (!game) return null;
  const view = document.documentElement.clientWidth;
  const margin = GAP + EDGE + 2 * bleed;
  const right = view - game.right - margin;
  if (right >= min) return { left: game.right + GAP + bleed, width: Math.min(want, right) };
  const left = game.left - margin;
  if (left >= min) {
    const width = Math.min(want, left);
    return { left: game.left - GAP - bleed - width, width };
  }
  return null;
}
