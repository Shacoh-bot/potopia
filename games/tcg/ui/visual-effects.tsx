"use client";

import { type ComponentType, useEffect, useState } from "react";

/*
 * Effets visuels des cartes : le rendu (CSS de tcg.css, section « Effets visuels », et JS ici) de
 * chaque effet du catalogue `tcg.visual_effects`, sous la même clé. La base ne garde que la clé et
 * le nom affiché dans la fiche.
 *
 * Ajouter un effet :
 * 1. une migration qui insère sa ligne (`INSERT INTO "tcg"."visual_effects" ("key", "name")`) ;
 * 2. son composant ci-dessous, ajouté à `VISUAL_EFFECTS` sous la même clé ;
 * 3. ses styles dans tcg.css (classes `tcg-vfx-…`), coupés avec `prefers-reduced-motion`.
 *
 * Un effet est un calque qui ne capte jamais le pointeur. Par défaut, il est rogné : sur
 * l'illustration seule en carte normale, sur toute la carte en full art (au-dessus des encadrés,
 * sous le coût et la puissance). Un effet `spill` est posé sur toute la carte quelle que soit la
 * mise en page, sans être rogné : il peut déborder. Sur les planches (`still`), tcg.css coupe
 * toutes les animations : l'effet doit rester joli à l'arrêt.
 */

type EffectProps = {
  /** Carte figée (planches) : pas d'animation, l'effet doit tenir en image fixe. */
  still: boolean;
};

type EffectDef = {
  render: ComponentType<EffectProps>;
  /** Posé sur toute la carte et libre de déborder (sinon rogné, sur l'illustration en normale). */
  spill?: boolean;
};

/**
 * Reflet holographique : des bandes arc-en-ciel qui glissent avec le pointeur quand on incline la
 * carte (CSS seul, d'après les variables posées par `Tilt`).
 */
function Holo() {
  return <div className="tcg-vfx-holo" />;
}

/* ── Éclair ── */

/** Tirage pseudo-aléatoire : déterministe avec une graine, pour un rendu serveur identique. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Point = [number, number];

/**
 * Zigzag d'éclair de `a` à `b` par déplacement du point milieu : chaque segment est coupé en deux
 * et son milieu poussé de côté, de moins en moins à chaque niveau.
 */
function zigzag(rnd: () => number, a: Point, b: Point, spread: number, depth: number): Point[] {
  if (depth === 0) return [a, b];
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy) || 1;
  const off = (rnd() - 0.5) * spread;
  const mid: Point = [(a[0] + b[0]) / 2 - (dy / len) * off, (a[1] + b[1]) / 2 + (dx / len) * off];
  return [
    ...zigzag(rnd, a, mid, spread / 2, depth - 1),
    ...zigzag(rnd, mid, b, spread / 2, depth - 1).slice(1),
  ];
}

const pathOf = (pts: Point[]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

/** Débord autour de la carte (300 × 420) où l'éclair peut aller. */
const BOLT_MARGIN = 70;

/**
 * Un éclair : il part d'au-dessus de la carte (souvent hors du cadre), la traverse en zigzag et
 * s'arrête dedans ou ressort en bas ; deux ou trois ramifications plus fines partent du tronc.
 */
function strike(rnd: () => number): string[] {
  const start: Point = [40 + rnd() * 220, -BOLT_MARGIN + rnd() * 50];
  const end: Point = [start[0] + (rnd() - 0.5) * 220, 260 + rnd() * 220];
  const trunk = zigzag(rnd, start, end, 120, 6);
  const branches = Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => {
    const from = trunk[4 + Math.floor(rnd() * (trunk.length - 12))] ?? start;
    const to: Point = [from[0] + (rnd() - 0.5) * 160, from[1] + 40 + rnd() * 90];
    return pathOf(zigzag(rnd, from, to, 50, 4));
  });
  return [pathOf(trunk), ...branches];
}

/** Éclair de la carte figée (et du premier rendu) : toujours le même. */
const STILL_BOLT = strike(seeded(11));

/**
 * Éclair : un éclair frappe la carte par intermittence (toutes les 1 à 3,5 s), scintille et
 * illumine la carte d'un flash ; chaque coup est tiré au hasard en JS. Il peut sortir du cadre.
 * Carte figée ou mouvement réduit : un seul éclair, immobile.
 */
function Lightning({ still }: EffectProps) {
  const [bolt, setBolt] = useState<{ id: number; paths: string[] } | null>(null);

  useEffect(() => {
    if (still || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let id = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(
        () => {
          setBolt({ id: ++id, paths: strike(Math.random) });
          next();
        },
        1000 + Math.random() * 2500,
      );
    };
    next();
    return () => clearTimeout(timer);
  }, [still]);

  const paths = bolt?.paths ?? STILL_BOLT;
  const W = 300 + 2 * BOLT_MARGIN;
  const H = 420 + 2 * BOLT_MARGIN;
  return (
    <>
      {bolt && <div key={`flash-${bolt.id}`} className="tcg-vfx-flash" />}
      <svg
        // Une nouvelle clé à chaque coup relance l'animation.
        key={bolt?.id ?? "still"}
        // Avant le premier coup : caché (montré seulement avec le mouvement réduit, voir tcg.css).
        className={
          bolt
            ? "tcg-vfx-bolt"
            : still
              ? "tcg-vfx-bolt tcg-vfx-bolt-still"
              : "tcg-vfx-bolt tcg-vfx-bolt-rest"
        }
        viewBox={`${-BOLT_MARGIN} ${-BOLT_MARGIN} ${W} ${H}`}
        style={{ left: -BOLT_MARGIN, top: -BOLT_MARGIN, width: W, height: H }}
      >
        {paths.map((d, i) => (
          <g key={i}>
            <path d={d} className="tcg-vfx-bolt-glow" strokeWidth={i ? 4 : 7} />
            <path d={d} className="tcg-vfx-bolt-core" strokeWidth={i ? 1 : 2} />
          </g>
        ))}
      </svg>
    </>
  );
}

/** Rendu de chaque effet, par clé du catalogue. */
export const VISUAL_EFFECTS: Record<string, EffectDef> = {
  holo: { render: Holo },
  eclair: { render: Lightning, spill: true },
};

/** L'effet déborde-t-il de la carte (calque posé sur toute la carte, sans être rogné) ? */
export function effectSpills(effectKey: string | null | undefined): boolean {
  return !!(effectKey && VISUAL_EFFECTS[effectKey]?.spill);
}

/** L'effet visuel d'une carte ; rien si la clé est vide ou que son rendu n'est pas (encore) codé. */
export function VisualEffectLayer({
  effectKey,
  still = false,
}: {
  effectKey: string | null | undefined;
  still?: boolean;
}) {
  const def = effectKey ? VISUAL_EFFECTS[effectKey] : undefined;
  if (!def) return null;
  const Effect = def.render;
  return (
    <div
      className={def.spill ? "tcg-vfx tcg-vfx-spill" : "tcg-vfx"}
      aria-hidden
      data-effect={effectKey}
    >
      <Effect still={still} />
    </div>
  );
}
