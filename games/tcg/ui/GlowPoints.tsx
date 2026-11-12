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

/** Tirage pseudo-aléatoire à graine fixe : même rendu au serveur et au navigateur. */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Arcs électriques d'une source d'étincelles, tirés une fois pour toutes : de courts éclairs en
 * zigzag (coordonnées sur un rayon de 1), chacun avec son moment de flash dans le cycle.
 */
const ARCS = (() => {
  const rnd = seededRandom(71);
  return Array.from({ length: 9 }, (_, i) => {
    const angle = (i / 9) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
    const reach = 0.55 + rnd() * 0.45;
    const steps = 5;
    const pts: string[] = ["0 0"];
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      // Écart de côté qui diminue vers le bout : l'arc part net du point et se tord.
      const side = k === steps ? 0 : (rnd() - 0.5) * 0.35 * (1 - t * 0.5);
      const x = Math.cos(angle) * reach * t - Math.sin(angle) * side;
      const y = Math.sin(angle) * reach * t + Math.cos(angle) * side;
      pts.push(`${x.toFixed(3)} ${y.toFixed(3)}`);
    }
    // Une petite ramification sur certains arcs.
    const fork =
      rnd() < 0.5
        ? (() => {
            const from = pts[2] ?? "0 0";
            const [fx, fy] = from.split(" ").map(Number) as [number, number];
            const fa = angle + (rnd() < 0.5 ? -0.7 : 0.7);
            const fl = 0.25 + rnd() * 0.2;
            return `M${from} L${(fx + Math.cos(fa) * fl * 0.5).toFixed(3)} ${(fy + Math.sin(fa) * fl * 0.5 + 0.05).toFixed(3)} L${(fx + Math.cos(fa) * fl).toFixed(3)} ${(fy + Math.sin(fa) * fl).toFixed(3)}`;
          })()
        : "";
    return { d: `M${pts.join(" L")}${fork ? ` ${fork}` : ""}`, delay: rnd() };
  });
})();

type Place = { left: number; top: number; radius: number };

/**
 * Étincelles électriques : de courts arcs en zigzag partent du point et crépitent, chacun par
 * flashs saccadés à son moment (pas de halo rond : seulement les arcs, avec leur lueur). Portée :
 * `radius` ; débit : `period` (durée d'un cycle de crépitement). Au calme, deux arcs restent
 * allumés faiblement.
 */
function Sparks({ place, color, period }: { place: Place; color: string; period: number | null }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = place.radius * 1.6;
  const cycle = (period ?? 1) * 2;
  const glow = `tcg-arc-glow-${uid}`;
  return (
    <svg
      className="tcg-arcs"
      viewBox="-1.2 -1.2 2.4 2.4"
      style={{
        left: `${place.left}%`,
        top: `${place.top}%`,
        width: r * 2.4,
        height: r * 2.4,
        margin: `${-r * 1.2}px 0 0 ${-r * 1.2}px`,
      }}
    >
      <defs>
        <filter id={glow} filterUnits="userSpaceOnUse" x={-1.2} y={-1.2} width={2.4} height={2.4}>
          <feGaussianBlur stdDeviation="0.05" />
        </filter>
      </defs>
      {ARCS.map((arc, i) => (
        <g
          key={i}
          className="tcg-arc tcg-lt-anim"
          data-rest={i < 2 ? "" : undefined}
          data-still={period ? undefined : ""}
          style={{ animationDuration: `${cycle}s`, animationDelay: `${-arc.delay * cycle}s` }}
        >
          <path
            d={arc.d}
            stroke={color}
            strokeWidth={0.14}
            filter={`url(#${glow})`}
            opacity={0.8}
          />
          <path d={arc.d} stroke="#fff" strokeWidth={0.035} />
        </g>
      ))}
    </svg>
  );
}

/**
 * Rayons depuis un point : faisceaux de sa couleur au fondu doux (chacun s'estompe sur ses bords),
 * en deux couches qui tournent en sens contraire, et une lueur douce au centre.
 */
function Rays({ place, color, speed }: { place: Place; color: string; speed: number }) {
  const r = place.radius * 2.2;
  // Vitesse 10 : un tour en 6 s ; 1 : en 60 s ; 0 : immobile.
  const turn = speed > 0 ? `${60 / speed}s` : undefined;
  const layer = (reverse: boolean, scale: number) => (
    <div
      className={`tcg-rays-pt tcg-lt-anim${reverse ? "tcg-rays-pt-2" : ""}`}
      style={
        {
          left: `${place.left}%`,
          top: `${place.top}%`,
          width: r * 2 * scale,
          height: r * 2 * scale,
          margin: `${-r * scale}px 0 0 ${-r * scale}px`,
          "--glow": color,
          "--blur": `${Math.max(3, r * 0.08)}px`,
          animationDuration: turn,
          animationName: turn ? undefined : "none",
        } as CSSProperties
      }
    />
  );
  return (
    <>
      {layer(false, 1)}
      {layer(true, 1.25)}
      <div
        className="tcg-rays-core"
        style={
          {
            left: `${place.left}%`,
            top: `${place.top}%`,
            "--glow": color,
            "--r": `${r * 0.35}px`,
          } as CSSProperties
        }
      />
    </>
  );
}

/**
 * Traits lumineux : un même SVG à la taille de la fenêtre. Chaque trait est un bloom diffus en
 * quatre couches, proportionnées à son épaisseur : grand halo très flou, halo moyen, lueur de sa
 * couleur, cœur fin blanc teinté ; plus une impulsion qui le parcourt (SMIL). Les filtres couvrent toute la fenêtre
 * (`userSpaceOnUse`) : calés sur le trait, ils seraient rognés à sa hauteur (nulle s'il est
 * horizontal) et le flou disparaîtrait.
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
  const region = {
    filterUnits: "userSpaceOnUse" as const,
    x: -box.width,
    y: -box.height,
    width: box.width * 3,
    height: box.height * 3,
  };
  return (
    <svg className="tcg-lines" viewBox={`0 0 ${box.width} ${box.height}`}>
      {lines.map(({ a, b, color, period }, i) => {
        const x1 = (a.left / 100) * box.width;
        const y1 = (a.top / 100) * box.height;
        const x2 = (b.left / 100) * box.width;
        const y2 = (b.top / 100) * box.height;
        // Épaisseur du cœur lumineux, d'après la taille réglée (en % de la largeur de l'image).
        const t = Math.max(1, a.radius * 0.5);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const line = { x1, y1, x2, y2, strokeLinecap: "round" as const };
        const id = (name: string) => `tcg-line-${name}-${uid}-${i}`;
        return (
          <g key={i}>
            <defs>
              <filter id={id("wide")} {...region}>
                <feGaussianBlur stdDeviation={t * 4.5} />
              </filter>
              <filter id={id("mid")} {...region}>
                <feGaussianBlur stdDeviation={t * 2} />
              </filter>
              <filter id={id("glow")} {...region}>
                <feGaussianBlur stdDeviation={t * 0.7} />
              </filter>
              <filter id={id("core")} {...region}>
                <feGaussianBlur stdDeviation={t * 0.15} />
              </filter>
            </defs>
            {/* Bloom diffus : halos larges et doux, cœur fin teinté. */}
            <line
              {...line}
              stroke={color}
              strokeWidth={t * 8}
              opacity={0.3}
              filter={`url(#${id("wide")})`}
            />
            <line
              {...line}
              stroke={color}
              strokeWidth={t * 4}
              opacity={0.4}
              filter={`url(#${id("mid")})`}
            />
            <line
              {...line}
              stroke={color}
              strokeWidth={t * 1.8}
              opacity={0.55}
              filter={`url(#${id("glow")})`}
            />
            <line
              {...line}
              style={{ stroke: `color-mix(in srgb, ${color} 35%, #fff)` }}
              strokeWidth={t * 0.5}
              opacity={0.75}
              filter={`url(#${id("core")})`}
            />
            {period && (
              // Impulsion qui parcourt le trait : animation SVG (SMIL) de stroke-dashoffset, cachée
              // sans pointeur sur la carte (tcg.css).
              <line
                {...line}
                className="tcg-line-pulse"
                style={{ stroke: `color-mix(in srgb, ${color} 25%, #fff)` }}
                strokeWidth={t * 2.2}
                opacity={0.8}
                filter={`url(#${id("glow")})`}
                strokeDasharray={`${len * 0.16} ${len * 2}`}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from={len * 0.16}
                  to={-len}
                  dur={`${period}s`}
                  repeatCount="indefinite"
                />
              </line>
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
 * clignote), arcs électriques, rayons et traits ; ajoutés comme de la lumière (screen). Ils ne bougent
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
