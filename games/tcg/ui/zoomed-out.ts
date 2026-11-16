import type { CSSProperties } from "react";
import type { ImageFrame } from "../src/card-rules";

/*
 * Styles d'une image dézoomée, sans « use client » : la carte rendue côté serveur (`Art`) les
 * importe aussi. Depuis un module client, un objet importé par le serveur arrive vide.
 */

/**
 * Placement d'une image dézoomée (zoom sous 1) dans sa fenêtre, image entière, sans rognage.
 * `object-fit: cover` rognerait l'image avant le zoom : on calcule donc sa taille « cover » à partir
 * de ses proportions (`ratio` = largeur / hauteur réelles) et de la fenêtre (unités `cq*`, le parent
 * est un conteneur de taille), multipliée par le zoom. Le bord est à `point × (fenêtre − image)`,
 * comme avec `object-position` puis `scale` autour du point (même calcul que `glowPlacement`).
 */
export function zoomedOutStyle(frame: ImageFrame, ratio: number): CSSProperties {
  const width = `max(100cqw, 100cqh * ${ratio}) * ${frame.zoom}`;
  const height = `max(100cqh, 100cqw / ${ratio}) * ${frame.zoom}`;
  return {
    position: "absolute",
    display: "block",
    maxWidth: "none",
    width: `calc(${width})`,
    height: `calc(${height})`,
    left: `calc((100cqw - ${width}) * ${frame.x / 100})`,
    top: `calc((100cqh - ${height}) * ${frame.y / 100})`,
  };
}

/** Le parent d'une image dézoomée : conteneur de taille (unités `cq*`), qui rogne ce qui dépasse. */
export const ZOOMED_OUT_BOX: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  containerType: "size",
};
