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
 * Un point lumineux. Clignotement calé sur l'horloge : le délai (négatif) part du moment où son
 * animation a démarré (mémorisé une fois), si bien que sa phase vaut toujours « heure % durée » ;
 * les points de même vitesse clignotent ensemble, même apparus à des moments différents, et un
 * nouveau rendu ne les décale pas (changer le délai ne redémarre pas l'animation).
 */
function GlowDot({
  place,
  color,
  period,
}: {
  place: { left: number; top: number; radius: number };
  color: string;
  period: number | null;
}) {
  // Rendu côté client seulement (taille de l'image connue) : l'heure est celle du navigateur.
  const [started] = useState(() => performance.now());
  return (
    <div
      className="tcg-glow"
      data-blink={period ? "" : undefined}
      style={
        {
          left: `${place.left}%`,
          top: `${place.top}%`,
          "--glow": color,
          "--r": `${place.radius}px`,
          "--blink": period ? `${period}s` : undefined,
          animationDelay: period ? `${-((started / 1000) % period)}s` : undefined,
        } as CSSProperties
      }
    />
  );
}

/**
 * Points lumineux d'une carte, sur son illustration : chacun est un bloom (cœur blanc-coloré net,
 * halo flou de sa couleur) ajouté comme de la lumière, qui clignote à sa vitesse, en phase avec
 * les autres points de même vitesse. Posé sur la
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
        const period = glowPeriod(p.speed);
        return (
          <GlowDot
            // Passer de fixe à clignotant recrée le point : son animation démarre à ce moment.
            key={`${i}-${period ? "b" : "f"}`}
            place={glowPlacement(p, frame, box, natural)}
            color={p.color}
            period={period}
          />
        );
      })}
    </div>
  );
}
