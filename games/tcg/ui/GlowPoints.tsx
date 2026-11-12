"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { type GlowPoint, glowPeriod, type ImageFrame } from "../src/card-rules";
import { glowPlacement, type Size } from "../src/glow";

/** Tailles réelles des images déjà lues (par URL), pour ne pas les recharger à chaque carte. */
const naturalSizes = new Map<string, Size>();

/** Taille réelle d'une image (null tant qu'elle n'est pas chargée). */
export function useNaturalSize(url: string | null): Size | null {
  // Relu dans le cache à chaque rendu ; l'effet ne fait que charger une image inconnue.
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (!url || naturalSizes.has(url)) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      naturalSizes.set(url, { width: img.naturalWidth, height: img.naturalHeight });
      if (live) setLoaded((n) => n + 1);
    };
    img.src = url;
    return () => {
      live = false;
    };
  }, [url]);
  return url ? (naturalSizes.get(url) ?? null) : null;
}

/**
 * Points lumineux d'une carte, sur son illustration : chacun est un bloom (cœur blanc-coloré net,
 * halo flou de sa couleur) ajouté comme de la lumière, qui clignote à sa vitesse. Posé sur la
 * fenêtre d'illustration (`box` : sa taille en px de la carte), accroché à l'image : il suit le
 * cadrage et le zoom.
 */
export function GlowPoints({
  points,
  imageUrl,
  frame,
  box,
}: {
  points: GlowPoint[];
  imageUrl: string | null;
  frame: ImageFrame | null | undefined;
  box: Size;
}) {
  const natural = useNaturalSize(points.length > 0 ? imageUrl : null);
  if (!natural || points.length === 0) return null;
  return (
    <div aria-hidden className="tcg-glow-layer">
      {points.map((p, i) => {
        const { left, top, radius } = glowPlacement(p, frame, box, natural);
        const period = glowPeriod(p.speed);
        return (
          <div
            key={i}
            className="tcg-glow"
            data-blink={period ? "" : undefined}
            style={
              {
                left: `${left}%`,
                top: `${top}%`,
                "--glow": p.color,
                "--r": `${radius}px`,
                "--blink": period ? `${period}s` : undefined,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
