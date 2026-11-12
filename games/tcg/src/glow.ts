import type { GlowPoint, ImageFrame } from "./card-rules";

/*
 * Placement d'un point lumineux accroché à l'illustration. L'image est affichée en
 * `object-fit: cover` dans sa fenêtre, cadrée par `object-position: x% y%` puis zoomée par
 * `scale(zoom)` autour de ce même point (`frameStyle`). On refait ce calcul pour savoir où tombe,
 * dans la fenêtre, un point donné en % de l'image. Sans dépendance : importable partout et testé.
 */

export type Size = { width: number; height: number };

/**
 * Position du point dans la fenêtre (en % de sa largeur et de sa hauteur) et rayon du halo (en
 * px de la fenêtre). `natural` : taille réelle de l'image ; `box` : taille de la fenêtre.
 */
export function glowPlacement(
  point: Pick<GlowPoint, "x" | "y" | "size">,
  frame: ImageFrame | null | undefined,
  box: Size,
  natural: Size,
): { left: number; top: number; radius: number } {
  const fx = frame?.x ?? 50;
  const fy = frame?.y ?? 50;
  const zoom = frame?.zoom ?? 1;
  // object-fit: cover : l'image remplit la fenêtre, le surplus dépasse d'un côté.
  const scale = Math.max(box.width / natural.width, box.height / natural.height);
  const shownW = natural.width * scale;
  const shownH = natural.height * scale;
  // object-position : le surplus est réparti selon le cadrage.
  const offsetX = (box.width - shownW) * (fx / 100);
  const offsetY = (box.height - shownH) * (fy / 100);
  const px = offsetX + (shownW * point.x) / 100;
  const py = offsetY + (shownH * point.y) / 100;
  // scale(zoom) autour du point de cadrage.
  const originX = (box.width * fx) / 100;
  const originY = (box.height * fy) / 100;
  const x = originX + (px - originX) * zoom;
  const y = originY + (py - originY) * zoom;
  return {
    left: (x / box.width) * 100,
    top: (y / box.height) * 100,
    // Taille en % de la largeur de l'image : le halo grandit avec elle (zoom compris).
    radius: (shownW * zoom * point.size) / 100,
  };
}
