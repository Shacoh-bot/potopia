"use client";

import {
  type ComponentType,
  type CSSProperties,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { CardData } from "./cards";
import { faction, PremiumArt } from "./premium";
import { ExtraArt, type ExtraStyle } from "./snap-styles";
import { watchStillHover } from "./still-hover";

/*
 * Effets visuels des cartes : le rendu (CSS de tcg.css, section « Effets visuels », et JS ici) de
 * chaque effet du catalogue `tcg.visual_effects`, sous la même clé. La base ne garde que la clé et
 * le nom affiché dans la fiche.
 *
 * Ajouter un effet :
 * 1. une migration qui insère sa ligne (`INSERT INTO "tcg"."visual_effects" ("key", "name")`) ;
 * 2. son composant ci-dessous, ajouté à `VISUAL_EFFECTS` sous la même clé, et sa place dans
 *    `effect-places.ts` si ce n'est pas l'illustration ;
 * 3. ses styles dans tcg.css (classes `tcg-vfx-…`), coupés avec `prefers-reduced-motion`.
 *
 * Un effet est un calque rogné qui ne capte jamais le pointeur. En full art, il couvre toute la
 * carte, au-dessus des encadrés et sous le coût et la puissance. En carte normale, sa place
 * dépend de l'effet (`effect-places.ts`, hors de ce module client : `FinalCard` la lit côté
 * serveur) :
 * - `art` (par défaut) : sur l'illustration seule ;
 * - `card` : sur toute la carte, sous le bandeau du titre, la bordure et les encadrés ;
 * - `frame` : sur toute la carte, au-dessus de la bordure mais sous les encadrés (effets de cadre).
 * Un effet `image` redessine l'illustration (or, pop art, aquarelle…) : il se pose juste sur elle,
 * sous tout le reste, dans les deux mises en page, et sous les autres effets de l'illustration.
 * Sur les planches (`still`), tcg.css coupe toutes les animations : l'effet doit rester joli à
 * l'arrêt. La carte survolée les reprend (CSS, et `still` passé à faux aux effets JS).
 *
 * Plusieurs effets reprennent tels quels les styles des anciennes propositions de design
 * (éclat, liserés, prisme, halo, néon, aurore : classes `tcg-…` de
 * tcg.css) et les styles d'illustration « Snap » (`ExtraArt` de snap-styles.tsx).
 */

type EffectProps = {
  /** Carte figée (planches) : pas d'animation, l'effet doit tenir en image fixe. */
  still: boolean;
  /** La carte affichée (illustration et son cadrage), pour les effets qui la redessinent. */
  card: CardData;
  /** Mise en page : les effets qui redessinent l'illustration s'y règlent. */
  full: boolean;
};

type EffectDef = {
  render: ComponentType<EffectProps>;
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

/** Un éclair tiré : ses tracés (le tronc d'abord), son point de départ et son point d'impact. */
type Strike = { paths: string[]; start: Point; end: Point };

/**
 * Un éclair : il part d'un bord de la carte (haut, gauche ou droite), la traverse en zigzag vers
 * l'intérieur ou le bord opposé ; deux ou trois ramifications plus fines partent du tronc.
 */
function strike(rnd: () => number): Strike {
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
  return { paths: [pathOf(trunk), ...branches], start, end };
}

/** Éclair au repos (caché ; montré fixe au survol avec le mouvement réduit) : toujours le même. */
const REST_BOLT = strike(seeded(11));

/**
 * Éclair : seulement quand le pointeur est sur la carte (`data-active` posé par `Tilt`). Un éclair
 * part d'un bord et frappe la carte tout de suite, puis par intermittence (toutes les 1 à 3,5 s),
 * scintille et l'illumine d'un flash ; chaque coup est tiré au hasard en JS. Sans pointeur sur la
 * carte (et sur les planches figées) : aucun éclair. Mouvement réduit : un éclair fixe au survol.
 */
function Lightning({ still }: EffectProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [bolt, setBolt] = useState<({ id: number } & Strike) | null>(null);
  // Ids des filtres SVG, uniques par carte (sans les « : » de useId).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    if (still || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tilt = ref.current?.closest<HTMLElement>(".tcg-tilt");
    if (!tilt) return;
    let id = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      setBolt({ id: ++id, ...strike(Math.random) });
      timer = setTimeout(fire, 1000 + Math.random() * 2500);
    };
    // Le pointeur arrive : premier coup presque tout de suite ; il part : plus de coups (celui en
    // cours finit de s'éteindre).
    const sync = () => {
      const active = "active" in tilt.dataset;
      if (active && timer === undefined) timer = setTimeout(fire, 120);
      if (!active && timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(tilt, { attributes: true, attributeFilter: ["data-active"] });
    sync();
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [still]);

  // Figée à nouveau (fin du survol d'une carte de planche) : plus d'éclair.
  const shown = still ? null : bolt;
  const { paths, start, end } = shown ?? REST_BOLT;
  const bloom = `tcg-bolt-bloom-${uid}`;
  const glow = `tcg-bolt-glow-${uid}`;
  const flash = {
    "--fx": `${(start[0] / CW) * 100}%`,
    "--fy": `${(start[1] / CH) * 100}%`,
  } as CSSProperties;
  return (
    <>
      {shown && <div key={`flash-${shown.id}`} className="tcg-vfx-flash" style={flash} />}
      <svg
        ref={ref}
        // Une nouvelle clé à chaque coup relance l'animation.
        key={shown?.id ?? "rest"}
        // Avant le premier coup : caché (montré fixe au survol avec le mouvement réduit, tcg.css).
        className={shown ? "tcg-vfx-bolt" : "tcg-vfx-bolt tcg-vfx-bolt-rest"}
        viewBox={`0 0 ${CW} ${CH}`}
      >
        <defs>
          {/* Bloom : grand flou autour du tronc ; lueur : flou serré autour du cœur. */}
          <filter id={bloom} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <radialGradient id={`${bloom}-impact`}>
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#a5f3fc" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Halo large (violet puis cyan), sous tout le reste. */}
        <g filter={`url(#${bloom})`} className="tcg-vfx-bolt-bloom">
          {paths.map((d, i) => (
            <path key={i} d={d} stroke="#8b5cf6" strokeWidth={i ? 12 : 24} />
          ))}
          {paths.map((d, i) => (
            <path key={`c${i}`} d={d} stroke="#67e8f9" strokeWidth={i ? 5 : 10} />
          ))}
        </g>
        {/* Point d'impact et départ qui brillent. */}
        <circle
          cx={end[0]}
          cy={end[1]}
          r={30}
          fill={`url(#${bloom}-impact)`}
          filter={`url(#${glow})`}
        />
        <circle cx={start[0]} cy={start[1]} r={18} fill={`url(#${bloom}-impact)`} opacity={0.7} />
        {/* Lueur cyan serrée, puis le cœur blanc net. */}
        <g filter={`url(#${glow})`}>
          {paths.map((d, i) => (
            <path key={i} d={d} className="tcg-vfx-bolt-glow" strokeWidth={i ? 3.5 : 6} />
          ))}
        </g>
        {paths.map((d, i) => (
          <path key={i} d={d} className="tcg-vfx-bolt-core" strokeWidth={i ? 1.1 : 2.2} />
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

/** Fondu en ellipse : `#000` jusqu'à `solid` %, transparent à `fade` %. */
const ellipse = (w: number, h: number, y: number, solid: number, fade: number) => {
  const m = `radial-gradient(ellipse ${w}% ${h}% at 50% ${y}%, #000 ${solid}%, transparent ${fade}%)`;
  return { WebkitMaskImage: m, maskImage: m } as CSSProperties;
};

/**
 * Aquarelle (style Snap repris et resserré) : l'illustration peinte sur papier, fondue sur les
 * bords. Marges et fondu plus petits que dans la proposition, pensée pour une carte entière ;
 * en carte normale, l'image remplit presque toute la fenêtre.
 */
function Watercolor({ card, full }: EffectProps) {
  const f = faction(card.tag);
  return (
    <div style={{ ...fillAbs, background: "#f6f0e4" }}>
      <div className="tcg-grain" style={{ opacity: 0.45 }} />
      <div
        style={{
          position: "absolute",
          inset: full ? "10px 8px 34px" : "3px 4px",
          filter: "url(#tcg-watercolor) saturate(1.25) contrast(0.92) brightness(1.06)",
          ...(full ? ellipse(80, 78, 46, 70, 92) : ellipse(86, 84, 50, 74, 98)),
        }}
      >
        <PremiumArt card={card} />
      </div>
      <div
        aria-hidden
        style={{
          ...fillAbs,
          background: `radial-gradient(ellipse at 30% 25%, ${f.light}55, transparent 50%), radial-gradient(ellipse at 75% 70%, ${f.base}33, transparent 55%)`,
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}

/** Ciel étoilé du style cosmique. */
const STAR_SKY =
  "radial-gradient(1px 1px at 12% 18%, #fff, transparent), radial-gradient(1px 1px at 72% 12%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 76%, #fff, transparent), radial-gradient(1px 1px at 88% 64%, #fff, transparent), radial-gradient(1px 1px at 22% 58%, #cfe, transparent), radial-gradient(1.5px 1.5px at 62% 40%, #fff, transparent), radial-gradient(1px 1px at 8% 88%, #fff, transparent), radial-gradient(1px 1px at 92% 90%, #fde, transparent), radial-gradient(1px 1px at 50% 8%, #fff, transparent), radial-gradient(1px 1px at 30% 30%, #fff, transparent)";

/**
 * Ciel cosmique (style Snap repris et resserré) : l'illustration fondue dans un ciel étoilé.
 * Le ciel ne fait plus qu'une bordure : l'image en garde la plus grande part.
 */
function Cosmic({ card, full }: EffectProps) {
  return (
    <div
      style={{
        ...fillAbs,
        background: `${STAR_SKY}, radial-gradient(ellipse at 20% 15%, #5b2a9e 0%, transparent 50%), radial-gradient(ellipse at 85% 80%, #0e6f7a 0%, transparent 55%), #070516`,
      }}
    >
      <div
        style={{
          ...fillAbs,
          ...(full ? ellipse(78, 66, 44, 62, 94) : ellipse(84, 82, 50, 66, 100)),
        }}
      >
        <PremiumArt card={card} />
      </div>
      <div
        aria-hidden
        style={{
          ...fillAbs,
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 55%, rgb(140 80 255 / 0.3) 85%)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}

const fillAbs: CSSProperties = { position: "absolute", inset: 0 };

/** Un style d'illustration des propositions « Snap » : l'illustration redessinée. */
const snapStyle = (style: ExtraStyle) =>
  function SnapStyle({ card }: EffectProps) {
    return <ExtraArt card={card} style={style} />;
  };

/* ── Effets d'ambiance ── */

/** Mouvement réduit demandé par le système (lu après le premier rendu, faux côté serveur). */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return reduced;
}

/**
 * Parallaxe : l'illustration, un peu agrandie, glisse à l'opposé du pointeur et une poussière de
 * lumière au premier plan glisse avec lui, d'où une impression de profondeur (CSS seul).
 */
function Parallax({ card }: EffectProps) {
  return (
    <div style={{ ...fillAbs, overflow: "hidden" }}>
      <div className="tcg-vfx-plx-back">
        <PremiumArt card={card} />
      </div>
      <div className="tcg-vfx-plx-front" />
    </div>
  );
}

/** Lampe torche : la carte est dans le noir, un rond de lumière suit le pointeur. */
const Flashlight = () => <div className="tcg-vfx-lamp" />;

/** Métal brossé : fines stries et reflet net qui suit l'inclinaison de la carte. */
const BrushedMetal = () => (
  <>
    <div className="tcg-vfx-metal" />
    <div className="tcg-vfx-metal-shine" />
  </>
);

const RAIN_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789";
/** Colonnes de la pluie de données : position, vitesse, décalage et texte, tirés une fois pour toutes. */
const RAIN = (() => {
  const rnd = seeded(23);
  return Array.from({ length: 15 }, (_, i) => ({
    left: 2 + i * 6.6 + rnd() * 3,
    top: -40 + rnd() * 260,
    duration: 4 + rnd() * 5,
    delay: -rnd() * 9,
    text: Array.from(
      { length: 12 + Math.floor(rnd() * 8) },
      () => RAIN_CHARS[Math.floor(rnd() * RAIN_CHARS.length)],
    ).join(""),
  }));
})();

/** Pluie de données : colonnes de caractères cyan qui tombent, la tête plus claire. */
const DataRain = () => (
  <>
    {RAIN.map((c, i) => (
      <div
        key={i}
        className="tcg-vfx-rain"
        style={{
          left: `${c.left}%`,
          top: c.top,
          animationDuration: `${c.duration}s`,
          animationDelay: `${c.delay}s`,
        }}
      >
        {c.text}
      </div>
    ))}
  </>
);

const MOTE_COLORS = ["#67e8f9", "#ff2d7a", "#ffffff", "#a855f7"];
/** Particules : position, taille, couleur, dérive et rythme, tirés une fois pour toutes. */
const MOTES = (() => {
  const rnd = seeded(37);
  return Array.from({ length: 22 }, () => ({
    left: 4 + rnd() * 92,
    top: 30 + rnd() * 68,
    size: 2 + rnd() * 2.5,
    color: MOTE_COLORS[Math.floor(rnd() * MOTE_COLORS.length)],
    dx: (rnd() - 0.5) * 40,
    duration: 5 + rnd() * 6,
    delay: -rnd() * 11,
  }));
})();

/** Particules flottantes : des lucioles cyan, magenta et blanches montent lentement. */
const Motes = () => (
  <>
    {MOTES.map((m, i) => (
      <div
        key={i}
        className="tcg-vfx-mote"
        style={
          {
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            background: m.color,
            boxShadow: `0 0 6px 1px ${m.color}`,
            "--dx": `${m.dx}px`,
            animationDuration: `${m.duration}s`,
            animationDelay: `${m.delay}s`,
          } as CSSProperties
        }
      />
    ))}
  </>
);

/**
 * Distorsion de chaleur : l'illustration ondule comme un mirage (filtre SVG de turbulence dont la
 * fréquence varie en boucle). Carte figée ou mouvement réduit : ondulation fixe, plus légère.
 */
function HeatHaze({ card, still }: EffectProps) {
  const reduced = useReducedMotion();
  const moving = !still && !reduced;
  // Un id par variante : deux définitions identiques sous le même id ne gênent pas.
  const id = moving ? "tcg-vfx-mirage" : "tcg-vfx-mirage-still";
  return (
    <div style={fillAbs}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves="2" seed="4">
            {moving && (
              <animate
                attributeName="baseFrequency"
                dur="6s"
                values="0.012 0.06;0.016 0.09;0.012 0.06"
                repeatCount="indefinite"
              />
            )}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale={moving ? 9 : 5} />
        </filter>
      </svg>
      <div style={{ ...fillAbs, transform: "scale(1.04)", filter: `url(#${id})` }}>
        <PremiumArt card={card} />
      </div>
      <div className="tcg-vfx-haze" />
    </div>
  );
}

/** Cristaux de givre d'un coin : branches qui partent du coin vers l'intérieur, avec des aiguilles. */
const FROST = (() => {
  const rnd = seeded(53);
  const corners: { at: Point; dir: Point }[] = [
    { at: [0, 0], dir: [1, 1] },
    { at: [CW, 0], dir: [-1, 1] },
    { at: [0, CH], dir: [1, -1] },
    { at: [CW, CH], dir: [-1, -1] },
  ];
  return corners.map(({ at, dir }) => {
    const paths: string[] = [];
    for (let k = 0; k < 6; k++) {
      const angle = (0.08 + (k / 5) * 0.84 + (rnd() - 0.5) * 0.1) * (Math.PI / 2);
      const len = 35 + rnd() * 55;
      const [ux, uy] = [Math.cos(angle) * dir[0], Math.sin(angle) * dir[1]];
      const end: Point = [at[0] + ux * len, at[1] + uy * len];
      paths.push(pathOf([at, end]));
      // Aiguilles à 60° de part et d'autre, de plus en plus courtes vers le bout.
      for (let t = 0.3; t < 0.95; t += 0.18) {
        const p: Point = [at[0] + ux * len * t, at[1] + uy * len * t];
        const n = (1 - t) * 18 + rnd() * 5;
        for (const s of [-1, 1]) {
          const a = Math.atan2(uy, ux) + (s * Math.PI) / 3;
          paths.push(pathOf([p, [p[0] + Math.cos(a) * n, p[1] + Math.sin(a) * n]]));
        }
      }
    }
    return { origin: `${at[0]}px ${at[1]}px`, d: paths.join(" ") };
  });
})();

/** Givre : des cristaux poussent depuis les quatre coins puis reculent, en boucle. */
const Frost = () => (
  <>
    <div className="tcg-vfx-frost-fog" />
    <svg className="tcg-vfx-frost" viewBox={`0 0 ${CW} ${CH}`}>
      {FROST.map((c, i) => (
        <path
          key={i}
          d={c.d}
          className="tcg-vfx-frost-c"
          style={{ transformOrigin: c.origin, animationDelay: `${-i * 1.7}s` }}
        />
      ))}
    </svg>
  </>
);

/** Brume : deux voiles qui dérivent lentement en sens contraire, dans le bas de la carte. */
const Mist = () => (
  <>
    <div className="tcg-vfx-mist" />
    <div className="tcg-vfx-mist tcg-vfx-mist-2" />
  </>
);

/** Rendu de chaque effet, par clé du catalogue. */
export const VISUAL_EFFECTS: Record<string, EffectDef> = {
  holo: { render: Holo },
  eclair: { render: Lightning },
  eclat: { render: Shine },
  orbite: { render: Orbit },
  prisme: { render: Prism },
  flux: { render: Flow },
  halo: { render: Breathe },
  neon: { render: Neon },
  aurore: { render: Aurora },
  lenticulaire: { render: Lenticular },
  glitch: { render: snapStyle("glitch") },
  or: { render: snapStyle("gold") },
  aquarelle: { render: Watercolor },
  cosmos: { render: Cosmic },
  parallaxe: { render: Parallax },
  lampe: { render: Flashlight },
  metal: { render: BrushedMetal },
  donnees: { render: DataRain },
  particules: { render: Motes },
  mirage: { render: HeatHaze },
  givre: { render: Frost },
  brume: { render: Mist },
};

/**
 * Carte figée survolée (`watchStillHover`) : les effets animés en JS (éclair, mirage) y reçoivent
 * `still` à faux ; tcg.css y relance les animations CSS. Toujours faux hors carte figée.
 */
function useHovered(ref: RefObject<HTMLElement | null>, still: boolean) {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!still || !el) return;
    const stop = watchStillHover(el, {
      enter: () => setHovered(true),
      leave: () => setHovered(false),
    });
    return () => {
      stop?.();
      setHovered(false);
    };
  }, [ref, still]);
  return hovered;
}

/** L'effet visuel d'une carte ; rien si la clé est vide ou que son rendu n'est pas (encore) codé. */
export function VisualEffectLayer({
  effectKey,
  card,
  full = false,
  still = false,
}: {
  effectKey: string | null | undefined;
  card: CardData;
  /** Full art (sinon carte normale). */
  full?: boolean;
  still?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hovered = useHovered(ref, still);
  const def = effectKey ? VISUAL_EFFECTS[effectKey] : undefined;
  if (!def) return null;
  const Effect = def.render;
  return (
    <div ref={ref} className="tcg-vfx" aria-hidden data-effect={effectKey}>
      <Effect still={still && !hovered} card={card} full={full} />
    </div>
  );
}
