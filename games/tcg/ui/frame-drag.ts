/**
 * Déplacement du point de cadrage (en %) qui suit la souris d'un écart `delta` (px) sur un axe.
 * Avec `object-position: p%` puis `scale(zoom)` autour du même point (`frameStyle`), le bord de
 * l'image affichée est à `p/100 × (fenêtre − image × zoom)` : on inverse ce rapport.
 * Image plus grande que la fenêtre : glisser à droite montre sa partie gauche (le point recule) ;
 * plus petite (dézoom) : le point avance avec elle. Image juste à la taille : rien ne bouge.
 * `shown` : taille de l'image dans la fenêtre avant le zoom (`object-fit: cover`). Sans dépendance :
 * importable partout et testé.
 */
export function framePointShift(delta: number, box: number, shown: number, zoom: number): number {
  const span = box - shown * zoom;
  return Math.abs(span) < 0.5 ? 0 : (delta * 100) / span;
}
