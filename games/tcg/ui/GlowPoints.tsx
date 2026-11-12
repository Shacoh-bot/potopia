"use client";

import { type CSSProperties, useEffect, useId, useState } from "react";
import { glowKind, type GlowPoint, glowPeriod, type ImageFrame } from "../src/card-rules";
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

/** Étincelles d'une source : direction, portée et rythme, tirés une fois pour toutes. */
const SPARKS = (() => {
  let seed = 71;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: 14 }, (_, i) => {
    // Plutôt vers le haut : un éventail de -165° à -15°, quelques-unes partout.
    const angle = i < 11 ? -165 + rnd() * 150 : rnd() * 360;
    return { angle, reach: 0.55 + rnd() * 0.45, delay: rnd(), size: 1.5 + rnd() * 2 };
  });
})();

type Place = { left: number; top: number; radius: number };

/**
 * Source d'étincelles : de petites étincelles jaillissent du point en éventail, filent et
 * s'éteignent. Portée : `radius` ; débit : `period` (durée de vie d'une étincelle).
 */
function Sparks({ place, color, period }: { place: Place; color: string; period: number | null }) {
  const life = period ?? 1;
  return (
    <div
      className="tcg-sparks"
      style={{ left: `${place.left}%`, top: `${place.top}%`, "--glow": color } as CSSProperties}
    >
      <div
        className="tcg-sparks-core"
        style={{ "--r": `${place.radius * 0.35}px` } as CSSProperties}
      />
      {SPARKS.map((k, i) => {
        const rad = (k.angle * Math.PI) / 180;
        const d = place.radius * 1.6 * k.reach;
        return (
          <div
            key={i}
            className="tcg-spark tcg-lt-anim"
            data-still={period ? undefined : ""}
            style={
              {
                width: k.size,
                height: k.size,
                "--tx": `${Math.cos(rad) * d}px`,
                // Retombée : les étincelles finissent un peu plus bas que leur élan.
                "--ty": `${Math.sin(rad) * d + d * 0.35}px`,
                animationDuration: `${life}s`,
                animationDelay: `${-k.delay * life}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** Rayons depuis un point : faisceaux doux de sa couleur, qui tournent lentement. */
function Rays({ place, color, speed }: { place: Place; color: string; speed: number }) {
  const r = place.radius * 2;
  return (
    <div
      className="tcg-rays-pt tcg-lt-anim"
      style={
        {
          left: `${place.left}%`,
          top: `${place.top}%`,
          width: r * 2,
          height: r * 2,
          margin: `${-r}px 0 0 ${-r}px`,
          "--glow": color,
          // Vitesse 10 : un tour en 6 s ; 1 : en 60 s ; 0 : immobile.
          animationDuration: speed > 0 ? `${60 / speed}s` : undefined,
          animationName: speed > 0 ? undefined : "none",
        } as CSSProperties
      }
    />
  );
}

/**
 * Traits lumineux : un même SVG à la taille de la fenêtre ; chaque trait a un grand halo flou
 * (bloom), une lueur de sa couleur et un cœur blanc, plus une impulsion qui le parcourt.
 */
function Lines({
  lines,
  box,
}: {
  lines: { a: Place; b: Place; color: string; period: number | null }[];
  box: Size;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (lines.length === 0) return null;
  const bloom = `tcg-line-bloom-${uid}`;
  const glow = `tcg-line-glow-${uid}`;
  return (
    <svg className="tcg-lines" viewBox={`0 0 ${box.width} ${box.height}`}>
      <defs>
        <filter id={bloom} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>
      {lines.map(({ a, b, color, period }, i) => {
        const x1 = (a.left / 100) * box.width;
        const y1 = (a.top / 100) * box.height;
        const x2 = (b.left / 100) * box.width;
        const y2 = (b.top / 100) * box.height;
        const t = Math.max(1, a.radius * 0.6);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const line = { x1, y1, x2, y2, strokeLinecap: "round" as const };
        return (
          <g key={i}>
            <line
              {...line}
              stroke={color}
              strokeWidth={t * 4}
              opacity={0.6}
              filter={`url(#${bloom})`}
            />
            <line {...line} stroke={color} strokeWidth={t * 1.6} filter={`url(#${glow})`} />
            <line {...line} stroke="#fff" strokeWidth={Math.max(0.6, t * 0.5)} />
            {period && (
              <line
                {...line}
                className="tcg-line-pulse tcg-lt-anim"
                stroke="#fff"
                strokeWidth={t * 1.4}
                filter={`url(#${glow})`}
                strokeDasharray={`${len * 0.14} ${len * 2}`}
                style={
                  {
                    "--len": `${len}`,
                    animationDuration: `${period}s`,
                  } as CSSProperties
                }
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Lumières d'une carte, sur son illustration (`box` : taille de la fenêtre en px de la carte),
 * accrochées à l'image : elles suivent le cadrage et le zoom. Points lumineux (bloom qui
 * clignote), étincelles, rayons et traits ; ajoutés comme de la lumière (screen). Ils ne bougent
 * que sous le pointeur (tcg.css) ; sinon ils restent visibles, au calme.
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
  const placeOf = (x: number, y: number, size: number) =>
    glowPlacement({ x, y, size }, frame, box, natural);
  const lines = points.flatMap((p) =>
    glowKind(p) === "line"
      ? [
          {
            a: placeOf(p.x, p.y, p.size),
            b: placeOf(p.x2 ?? p.x, p.y2 ?? p.y, p.size),
            color: p.color,
            period: glowPeriod(p.speed),
          },
        ]
      : [],
  );
  return (
    <div aria-hidden className="tcg-glow-layer">
      <Lines lines={lines} box={box} />
      {points.map((p, i) => {
        const kind = glowKind(p);
        const place = placeOf(p.x, p.y, p.size);
        const period = glowPeriod(p.speed);
        if (kind === "sparks")
          return <Sparks key={`s${i}`} place={place} color={p.color} period={period} />;
        if (kind === "rays")
          return <Rays key={`r${i}`} place={place} color={p.color} speed={p.speed} />;
        if (kind !== "glow") return null;
        return (
          <GlowDot
            // Passer de fixe à clignotant recrée le point : son animation démarre à ce moment.
            key={`${i}-${period ? "b" : "f"}`}
            place={place}
            color={p.color}
            period={period}
          />
        );
      })}
    </div>
  );
}
