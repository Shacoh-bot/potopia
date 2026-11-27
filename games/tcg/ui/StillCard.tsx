"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { watchFrozenSvg } from "./offscreen-pause";

/**
 * Délai avant l'arrêt sur image d'une carte figée : ses animations tournent d'abord un instant,
 * pour que l'image fixe montre ses effets en mouvement (grains répartis, lumière du cadre en
 * route) et pas leur pose de départ.
 */
export const REPOS_MS = 1200;

/**
 * Carte figée (`GameCard still`) : partout où il y a plusieurs cartes (Potodex, planches de l'admin,
 * banc d'essai), la carte au repos est une image fixe. Après `REPOS_MS`, `data-repos` est posé :
 * tcg.css met alors en pause toutes ses animations (cadre SR/SSR, effets, holo) là où elles en
 * sont, et `watchFrozenSvg` ses animations SVG. Survolée (`data-live`, posé par `Tilt`), elle
 * reprend tout ; quittée, elle se fige à nouveau sur l'instant courant. La carte ouverte en grand
 * (zoom) et la révélation du booster n'utilisent pas `still` : toujours vivantes.
 */
export function StillCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = watchFrozenSvg(el);
    const timer = setTimeout(() => {
      el.dataset.repos = "";
    }, REPOS_MS);
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, []);
  return (
    <div ref={ref} className="tcg-still">
      {children}
    </div>
  );
}
