/*
 * Choix de la taille d'une illustration selon sa taille à l'écran, sans « use client » (testé).
 */

type Size = { width: number; height: number };

/**
 * La version chargée est trop petite pour l'endroit où elle s'affiche : plus d'un pixel écran par
 * pixel d'image (avec une marge de 10 %). `shown` : taille de l'image à l'écran (px CSS, zooms et
 * agrandissements compris) ; l'image couvre sa fenêtre (`object-fit: cover`), donc c'est le plus
 * grand des deux rapports qui compte. `dpr` : pixels écran par px CSS.
 */
export function needsLarger(shown: Size, natural: Size, dpr: number): boolean {
  if (natural.width <= 0 || natural.height <= 0) return false;
  const scale = Math.max(shown.width / natural.width, shown.height / natural.height);
  return scale * dpr > 1.1;
}
