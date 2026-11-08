"use client";

import { type ComponentType, type CSSProperties, useEffect, useState } from "react";
import type { CardData } from "./cards";
import { PremiumArt } from "./premium";
import { ExtraArt, type ExtraStyle } from "./snap-styles";

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
 * Un effet est un calque rogné qui ne capte jamais le pointeur. En full art, il couvre toute la
 * carte, au-dessus des encadrés et sous le coût et la puissance. En carte normale, sa place
 * (`place`) dépend de l'effet :
 * - `art` (par défaut) : sur l'illustration seule ;
 * - `card` : sur toute la carte, sous le bandeau du titre, la bordure et les encadrés ;
 * - `frame` : sur toute la carte, au-dessus de la bordure mais sous les encadrés (effets de cadre).
 * Un effet `image` redessine l'illustration (or, pop art, aquarelle…) : il se pose juste sur elle,
 * sous tout le reste, dans les deux mises en page, et sous les autres effets de l'illustration.
 * Sur les planches (`still`), tcg.css coupe toutes les animations : l'effet doit rester joli à
 * l'arrêt.
 *
 * Plusieurs effets reprennent tels quels les styles des anciennes propositions de design
 * (holo classique, éclat, liserés, prisme, halo, néon, torches, aurore : classes `tcg-…` de
 * tcg.css) et les styles d'illustration « Snap » (`ExtraArt` de snap-styles.tsx).
 */

type EffectProps = {
  /** Carte figée (planches) : pas d'animation, l'effet doit tenir en image fixe. */
  still: boolean;
  /** La carte affichée (illustration et son cadrage), pour les effets qui la redessinent. */
  card: CardData;
};

/** Place d'un effet (voir plus haut). */
export type EffectPlace = "art" | "card" | "frame" | "image";

type EffectDef = {
  render: ComponentType<EffectProps>;
  place?: EffectPlace;
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

/** Taille de la carte, repère de l'éclair. */
const CW = 300;
const CH = 420;

/**
 * Un éclair : il part d'un bord de la carte (haut, gauche ou droite), la traverse en zigzag vers
 * l'intérieur ou le bord opposé ; deux ou trois ramifications plus fines partent du tronc.
 */
function strike(rnd: () => number): string[] {
  const side = rnd();
  const start: Point =
    side < 0.5
      ? [30 + rnd() * 240, 0]
      : side < 0.75
        ? [0, 20 + rnd() * 200]
        : [CW, 20 + rnd() * 200];
  const end: Point =
    side < 0.5
      ? [start[0] + (rnd() - 0.5) * 200, 220 + rnd() * 200]
      : [side < 0.75 ? 140 + rnd() * 160 : rnd() * 160, start[1] + 80 + rnd() * 200];
  const trunk = zigzag(rnd, start, end, 110, 6);
  const branches = Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => {
    const from = trunk[4 + Math.floor(rnd() * (trunk.length - 12))] ?? start;
    const to: Point = [from[0] + (rnd() - 0.5) * 150, from[1] + 30 + rnd() * 80];
    return pathOf(zigzag(rnd, from, to, 45, 4));
  });
  return [pathOf(trunk), ...branches];
}

/** Éclair de la carte figée (et du premier rendu) : toujours le même. */
const STILL_BOLT = strike(seeded(11));

/**
 * Éclair : un éclair part d'un bord et frappe la carte par intermittence (toutes les 1 à 3,5 s),
 * scintille et l'illumine d'un flash ; chaque coup est tiré au hasard en JS.
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
        viewBox={`0 0 ${CW} ${CH}`}
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

/* ── Effets repris des propositions de design (styles de tcg.css) ── */

/** Éclat de lumière : un reflet balaie la carte de temps en temps. */
const Shine = () => <div className="tcg-shine" />;
/** Liseré lumineux : un trait de lumière cyan fait le tour du cadre. */
const Orbit = () => <div className="tcg-orbit" style={{ "--orbit": "#67e8f9" } as CSSProperties} />;
/** Cadre prismatique : un arc-en-ciel tourne lentement dans la bordure. */
const Prism = () => <div className="tcg-prism" style={{ "--prism-w": "7px" } as CSSProperties} />;
/** Liseré d'énergie : un courant cyan et magenta court sans fin autour de la carte. */
const Flow = () => (
  <div
    className="tcg-flow"
    style={{ "--flow": "#67e8f9, #ffffff, #ff2d7a, #a855f7, #67e8f9" } as CSSProperties}
  />
);
/** Halo qui respire : une lueur cyan intérieure, le long du cadre, qui s'allume et s'éteint. */
const Breathe = () => (
  <div
    className="tcg-breathe"
    style={{
      position: "absolute",
      inset: 7,
      borderRadius: 15,
      boxShadow: "inset 0 0 26px rgb(103 232 249 / 0.6)",
    }}
  />
);

/** Holo classique : l'holo des premières propositions, bandes irisées fines et reflet blanc. */
const HoloClassic = () => <div className="tcg-holo" />;

/** Néon qui grésille : un tube magenta le long du cadre, qui clignote par moments. */
const Neon = () => (
  <div
    className="tcg-flicker"
    style={{
      position: "absolute",
      inset: 8,
      borderRadius: 14,
      boxShadow:
        "inset 0 0 0 1.5px #ffd1e6, inset 0 0 10px #ff2d7a, 0 0 0 1px #ff2d7a, 0 0 12px #ff2d7a",
    }}
  />
);

/** Torches : deux lueurs orange qui vacillent de chaque côté, en haut de la carte. */
const torch: CSSProperties = {
  position: "absolute",
  top: 30,
  width: 90,
  height: 90,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgb(255 170 60 / 0.55), transparent 70%)",
};
const Torches = () => (
  <>
    <div className="tcg-torch" style={{ ...torch, left: -10 }} />
    <div className="tcg-torch" style={{ ...torch, right: -10, animationDelay: "0.7s" }} />
  </>
);

/** Aurore cosmique : aurore violette et cyan qui ondule, étoiles qui dérivent (dans la carte). */
const Aurora = () => (
  <>
    <div className="tcg-aurora" style={{ position: "absolute", inset: 0, opacity: 0.7 }} />
    <div className="tcg-stars" style={{ position: "absolute", inset: 0 }} />
  </>
);

/**
 * Lenticulaire : quand la carte penche à droite, l'illustration bascule sur une seconde version
 * (ici l'illustration aux couleurs inversées, faute de seconde image), avec les fines lignes du
 * plastique lenticulaire. Sans pointeur, elle bascule toute seule.
 */
function Lenticular({ card, still }: EffectProps) {
  return (
    <>
      <div
        className={still ? "tcg-lenti" : "tcg-lenti tcg-lenti-auto"}
        style={{ position: "absolute", inset: 0, filter: "hue-rotate(180deg) saturate(1.4)" }}
      >
        <PremiumArt card={card} />
      </div>
      <div className="tcg-lenti-lines" />
    </>
  );
}

/** Un style d'illustration des propositions « Snap » : l'illustration redessinée. */
const snapStyle = (style: ExtraStyle) =>
  function SnapStyle({ card }: EffectProps) {
    return <ExtraArt card={card} style={style} />;
  };

/** Rendu de chaque effet, par clé du catalogue. */
export const VISUAL_EFFECTS: Record<string, EffectDef> = {
  holo: { render: Holo },
  eclair: { render: Lightning, place: "card" },
  eclat: { render: Shine },
  orbite: { render: Orbit, place: "frame" },
  prisme: { render: Prism, place: "frame" },
  flux: { render: Flow, place: "frame" },
  halo: { render: Breathe, place: "frame" },
  holoclassique: { render: HoloClassic },
  neon: { render: Neon, place: "frame" },
  torches: { render: Torches, place: "frame" },
  aurore: { render: Aurora, place: "card" },
  lenticulaire: { render: Lenticular, place: "image" },
  glitch: { render: snapStyle("glitch"), place: "image" },
  or: { render: snapStyle("gold"), place: "image" },
  orcentre: { render: snapStyle("goldspot"), place: "image" },
  kawaii: { render: snapStyle("kawaii"), place: "image" },
  popart: { render: snapStyle("popart"), place: "image" },
  aquarelle: { render: snapStyle("watercolor"), place: "image" },
  croquis: { render: snapStyle("sketch"), place: "image" },
  cosmos: { render: snapStyle("cosmic"), place: "image" },
  vitrail: { render: snapStyle("stained"), place: "image" },
  theme: { render: snapStyle("theme"), place: "image" },
};

/** Place de l'effet : illustration, toute la carte, par-dessus la bordure, ou l'image redessinée. */
export function effectPlace(effectKey: string): EffectPlace {
  return VISUAL_EFFECTS[effectKey]?.place ?? "art";
}

/** L'effet visuel d'une carte ; rien si la clé est vide ou que son rendu n'est pas (encore) codé. */
export function VisualEffectLayer({
  effectKey,
  card,
  still = false,
}: {
  effectKey: string | null | undefined;
  card: CardData;
  still?: boolean;
}) {
  const def = effectKey ? VISUAL_EFFECTS[effectKey] : undefined;
  if (!def) return null;
  const Effect = def.render;
  return (
    <div className="tcg-vfx" aria-hidden data-effect={effectKey}>
      <Effect still={still} card={card} />
    </div>
  );
}
