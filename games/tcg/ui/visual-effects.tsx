"use client";

import { type ComponentType, type CSSProperties, useEffect, useId, useState } from "react";
import type { CardData } from "./cards";
import { faction, PremiumArt } from "./premium";
import { ExtraArt, type ExtraStyle } from "./snap-styles";

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
 * Sur les planches (cartes figées), l'effet tourne quand même, survolé ou non : tcg.css ne coupe
 * pas les animations du calque `.tcg-vfx`, et les effets JS reçoivent `still` à faux. Figé, il
 * restait dans une pose artificielle (pétales alignés). Le `still` des effets (image fixe) reste
 * prévu, mais le calque le passe toujours à faux.
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
  /**
   * Variante « par paliers » du banc d'essai (refonte, étape 7) : les filtres SVG animés (mirage,
   * énergie) ne changent que 2 fois par seconde (`calcMode="discrete"`) au lieu de chaque image.
   */
  paced?: boolean;
};

/** Boucle `values` d'une animation SVG (étapes séparées par « ; ») tirée en `n` paliers égaux. */
export function pacedValues(values: string, n: number): string {
  const keys = values.split(";").map((v) => v.trim().split(/\s+/).map(Number));
  const at = (t: number) => {
    const x = t * (keys.length - 1);
    const i = Math.min(Math.floor(x), keys.length - 2);
    const a = keys[i] ?? [];
    const b = keys[i + 1] ?? a;
    return a.map((v, j) => Math.round((v + ((b[j] ?? v) - v) * (x - i)) * 10000) / 10000).join(" ");
  };
  return Array.from({ length: n }, (_, k) => at(k / n)).join(";");
}

type EffectDef = {
  render: ComponentType<EffectProps>;
};

/**
 * Reflet holographique : des bandes arc-en-ciel qui glissent avec le pointeur quand on incline la
 * carte (CSS seul, d'après les variables posées par `Tilt`) ; invisible sans pointeur sur la carte.
 */
function Holo() {
  return (
    <div className="tcg-vfx-holo">
      <div className="tcg-vfx-holo-lens" />
    </div>
  );
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
 * Éclair : sur une carte vivante (la fiche, ou la carte survolée d'une planche), un éclair part
 * d'un bord et frappe la carte tout de suite, puis par intermittence (toutes les 1 à 3,5 s),
 * scintille et l'illumine d'un flash ; chaque coup est tiré au hasard en JS. Sur une planche, une
 * carte figée (non survolée) n'en a aucun. Mouvement réduit : un éclair fixe.
 */
function Lightning({ still }: EffectProps) {
  const [bolt, setBolt] = useState<({ id: number } & Strike) | null>(null);
  // Ids des filtres SVG, uniques par carte (sans les « : » de useId).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    if (still || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let id = 0;
    let timer: ReturnType<typeof setTimeout>;
    const fire = () => {
      setBolt({ id: ++id, ...strike(Math.random) });
      timer = setTimeout(fire, 1000 + Math.random() * 2500);
    };
    // Carte vivante : premier coup presque tout de suite, puis par intermittence.
    timer = setTimeout(fire, 120);
    return () => clearTimeout(timer);
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
export function useReducedMotion() {
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

/** Reflets du vitrail : petits éclats posés au hasard (graine fixe), chacun à son rythme. */
const GLINTS = (() => {
  const rnd = seeded(83);
  return Array.from({ length: 9 }, () => ({
    left: `${8 + rnd() * 84}%`,
    top: `${8 + rnd() * 80}%`,
    size: 10 + rnd() * 12,
    delay: `${(-rnd() * 7).toFixed(2)}s`,
    duration: `${(5 + rnd() * 4).toFixed(2)}s`,
  }));
})();

/**
 * Vitrail : la lumière traverse le verre. Un soleil, derrière la carte, éclaire les morceaux de
 * verre autour de lui (copie de l'illustration plus claire et plus saturée, rognée en rond : les
 * plombs, noirs, le restent) ; au repos, il dérive lentement, et il suit le pointeur au survol.
 * Un rayonnement (copie floutée en `screen`) fait briller les couleurs du verre, et de petits
 * éclats s'allument tour à tour sur les morceaux (CSS seul, classes `tcg-vfx-vitrail-…`).
 */
function StainedGlass({ card }: EffectProps) {
  return (
    <div style={{ ...fillAbs, overflow: "hidden" }}>
      <PremiumArt card={card} />
      <div className="tcg-vfx-vitrail-bloom">
        <PremiumArt card={card} />
      </div>
      <div className="tcg-vfx-vitrail-lit">
        <div className="tcg-vfx-vitrail-art">
          <PremiumArt card={card} />
        </div>
      </div>
      {GLINTS.map((g, i) => (
        <span
          key={i}
          className="tcg-vfx-vitrail-glint"
          style={{
            left: g.left,
            top: g.top,
            width: g.size,
            height: g.size,
            animationDelay: g.delay,
            animationDuration: g.duration,
          }}
        />
      ))}
    </div>
  );
}

/** Écart des couleurs, amplifié (`k`) : un canal moins un autre, la partie positive seule. */
const ENERGY_K = 1.2;
const diff = (sign: 1 | -1) => {
  const k = ENERGY_K * sign;
  // R' = k(R − G), G' = k(G − B), B' = k(B − R) ; opacité 1.
  return `${k} ${-k} 0 0 0  0 ${k} ${-k} 0 0  ${-k} 0 ${k} 0 0  0 0 0 0 1`;
};

/**
 * Énergie vivante : seules les zones vives et saturées de l'illustration (volutes d'énergie,
 * magie, flammes colorées) pulsent et changent lentement de teinte ; le reste (personnages, décor,
 * nuages blancs) ne bouge pas. Filtre SVG : la saturation est estimée par les écarts entre canaux
 * (les deux signes, additionnés), multipliée par la luminosité (au-dessus d'un seuil : les
 * vêtements sombres restent hors du masque) ; une copie de l'image, à la teinte tournée
 * (animée), n'est gardée que dans ce masque, avec un rayonnement flou en `screen`. Carte figée
 * ou mouvement réduit : teinte fixe, seulement un peu ravivée.
 */
function LivingEnergy({ card, still, paced }: EffectProps) {
  const reduced = useReducedMotion();
  const moving = !still && !reduced;
  const id = moving ? "tcg-vfx-energie" : "tcg-vfx-energie-still";
  return (
    <div style={{ ...fillAbs, overflow: "hidden" }}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values={diff(1)} result="d1" />
          <feColorMatrix in="SourceGraphic" type="matrix" values={diff(-1)} result="d2" />
          <feComposite in="d1" in2="d2" operator="arithmetic" k2="1" k3="1" result="spread" />
          {/* Opacité = saturation estimée, moins un seuil. */}
          <feColorMatrix
            in="spread"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0.6 0.6 0 -0.3"
            result="sat"
          />
          {/* Opacité = luminosité au-dessus de 40 %, amplifiée. */}
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 1.77 0.33 0 -1.2"
            result="lum"
          />
          <feComposite in="sat" in2="lum" operator="arithmetic" k1="1" result="mask" />
          <feColorMatrix in="SourceGraphic" type="hueRotate" values="0" result="hue">
            {moving && (
              <animate
                attributeName="values"
                dur="9s"
                values={paced ? pacedValues("0;70;0;-70;0", 18) : "0;70;0;-70;0"}
                {...(paced ? { calcMode: "discrete" } : null)}
                repeatCount="indefinite"
              />
            )}
          </feColorMatrix>
          <feComposite in="hue" in2="mask" operator="in" />
        </filter>
      </svg>
      <PremiumArt card={card} />
      <div className="tcg-vfx-energie" style={{ filter: `url(#${id})` }}>
        <PremiumArt card={card} />
      </div>
      <div className="tcg-vfx-energie tcg-vfx-energie-bloom">
        <div style={{ ...fillAbs, filter: `url(#${id})` }}>
          <PremiumArt card={card} />
        </div>
      </div>
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
function HeatHaze({ card, still, paced }: EffectProps) {
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
                values={
                  paced
                    ? pacedValues("0.012 0.06;0.016 0.09;0.012 0.06", 12)
                    : "0.012 0.06;0.016 0.09;0.012 0.06"
                }
                {...(paced ? { calcMode: "discrete" } : null)}
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

/* ── Fumée ── */

/**
 * Bouffées de fumée tirées une fois pour toutes (graine fixe : rendu serveur identique). Délais
 * négatifs : à l'affichage, elles sont déjà en train de monter, à des hauteurs différentes.
 */
const PUFFS = (() => {
  const rnd = seeded(23);
  return Array.from({ length: 9 }, (_, i) => ({
    left: 6 + rnd() * 88,
    size: 70 + rnd() * 70,
    dx: (rnd() - 0.5) * 90,
    duration: 6 + rnd() * 3,
    delay: -(i / 9) * 8 - rnd(),
  }));
})();

/**
 * Fumée d'une couleur (« r g b ») : un fond de fumée au pied de la carte, et des bouffées floues
 * qui montent, grossissent, dérivent sur le côté et s'estompent. Figée ou mouvement réduit : les
 * bouffées restent posées à mi-hauteur.
 */
const smoke = (rgb: string) => {
  const Smoke = () => (
    <div className="tcg-vfx-smoke" style={{ "--smoke": rgb } as CSSProperties}>
      <div className="tcg-vfx-smoke-base" />
      {PUFFS.map((p, i) => (
        <div
          key={i}
          className="tcg-vfx-puff"
          style={
            {
              left: `${p.left}%`,
              "--s": `${p.size}px`,
              "--dx": `${p.dx}px`,
              "--dx-mid": `${p.dx / 2}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
  return Smoke;
};

/* ── Ambiances : braises, caustiques, rayons, chutes, ombres ── */

/** Braises : position, taille, dérive et rythme, tirés une fois pour toutes. */
const EMBERS = (() => {
  const rnd = seeded(41);
  return Array.from({ length: 18 }, () => ({
    left: 4 + rnd() * 92,
    size: 2 + rnd() * 3,
    dx: (rnd() - 0.5) * 70,
    duration: 3.5 + rnd() * 3,
    delay: -rnd() * 6.5,
    hot: rnd() < 0.4,
  }));
})();

/** Braises : des étincelles orange montent en scintillant, lueur chaude au pied de la carte. */
const Embers = () => (
  <>
    <div className="tcg-vfx-ember-glow" />
    {EMBERS.map((e, i) => (
      <div
        key={i}
        className="tcg-vfx-ember"
        style={
          {
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            background: e.hot ? "#fff3b0" : "#ff8a2b",
            boxShadow: `0 0 ${e.size * 2}px ${e.hot ? "#ffd166" : "#ff5e00"}`,
            "--dx": `${e.dx}px`,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
          } as CSSProperties
        }
      />
    ))}
  </>
);

/** Bulles des caustiques : tirées une fois pour toutes. */
const BUBBLES = (() => {
  const rnd = seeded(53);
  return Array.from({ length: 7 }, () => ({
    left: 6 + rnd() * 88,
    size: 3 + rnd() * 5,
    duration: 4 + rnd() * 4,
    delay: -rnd() * 8,
  }));
})();

/**
 * Caustiques : les reflets de lumière d'un fond de piscine, deux réseaux d'anneaux clairs qui
 * glissent en sens contraire et se croisent, sur l'illustration ; quelques bulles montent.
 */
const Caustics = () => (
  <div style={{ ...fillAbs, overflow: "hidden" }}>
    <div className="tcg-vfx-caustic" />
    <div className="tcg-vfx-caustic tcg-vfx-caustic-2" />
    {BUBBLES.map((b, i) => (
      <div
        key={i}
        className="tcg-vfx-bubble"
        style={{
          left: `${b.left}%`,
          width: b.size,
          height: b.size,
          animationDuration: `${b.duration}s`,
          animationDelay: `${b.delay}s`,
        }}
      />
    ))}
  </div>
);

/** Rayons de lumière : de grands rayons doux tombent d'un coin et oscillent lentement. */
const GodRays = () => (
  <div style={{ ...fillAbs, overflow: "hidden" }}>
    <div className="tcg-vfx-rays" />
    <div className="tcg-vfx-rays tcg-vfx-rays-2" />
  </div>
);

/** Chute (pétales, feuilles) : position, taille, dérive, rotation et rythme, tirés une fois. */
const fallers = (seed: number, count: number) => {
  const rnd = seeded(seed);
  return Array.from({ length: count }, () => ({
    left: rnd() * 100,
    scale: 0.6 + rnd() * 0.7,
    dx: (rnd() - 0.3) * 120,
    spin: (rnd() < 0.5 ? -1 : 1) * (240 + rnd() * 360),
    duration: 6 + rnd() * 5,
    delay: -rnd() * 11,
    tint: rnd(),
  }));
};
const PETALS = fallers(61, 14);
const LEAVES = fallers(67, 11);
const LEAF_COLORS = ["#e2702a", "#c2410c", "#d99a1e", "#8a3b12"];

/** Pétales ou feuilles qui tombent en tournoyant (dans la carte). */
const falling = (kind: "petal" | "leaf") => {
  const items = kind === "petal" ? PETALS : LEAVES;
  const Falling = () => (
    <div style={{ ...fillAbs, overflow: "hidden" }}>
      {items.map((f, i) => (
        <div
          key={i}
          className={`tcg-vfx-fall tcg-vfx-${kind}`}
          style={
            {
              left: `${f.left}%`,
              "--k": f.scale,
              "--dx": `${f.dx}px`,
              "--spin": `${f.spin}deg`,
              background:
                kind === "petal"
                  ? `linear-gradient(135deg, #ffe4ef, ${f.tint < 0.5 ? "#f9a8d4" : "#fbcfe8"})`
                  : LEAF_COLORS[Math.floor(f.tint * LEAF_COLORS.length)],
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
  return Falling;
};

/**
 * Ombres possédées : des volutes noires rampent depuis les bords et refluent, en boucle ; sous le
 * pointeur, elles s'écartent de lui.
 */
const Shadows = () => (
  <div className="tcg-vfx-shadows">
    <div className="tcg-vfx-shade" />
    <div className="tcg-vfx-shade tcg-vfx-shade-2" />
  </div>
);

/* ── Vent ── */

/** Passages d'un coup de vent : à chacun, il repart d'ailleurs. */
export const WIND_HOPS = 4;
/** Rayon du cercle de référence des traînées, avant passage sur leur courbe guide. */
const WIND_R = 100;

/**
 * Une traînée de lumière, comme celles peintes dans le fond de la carte : un arc de cercle de rayon
 * `radius` autour de l'origine, tête à l'angle 0 et queue sur `sweep` degrés derrière elle (angles
 * négatifs : elle avance dans le sens des aiguilles d'une montre à l'écran). Forme pleine et
 * effilée : demi-largeur `width` à la tête (arrondie), qui fond jusqu'à 0 au bout de la queue ; le
 * rayon dérive un peu le long de la queue (`drift`, en unités). Rend un chemin SVG fermé.
 */
export function windStreak(sweep: number, width: number, radius: number, drift = 0): string {
  const f = (n: number) => n.toFixed(2);
  const STEPS = 12;
  const side = (sign: 1 | -1) =>
    Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = i / STEPS;
      const a = (-sweep * t * Math.PI) / 180;
      const r = radius + drift * t + sign * width * (1 - t) ** 1.4;
      return `${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`;
    });
  const outer = side(1);
  const inner = side(-1).reverse();
  // tête arrondie : un demi-cercle de l'intérieur vers l'extérieur
  return `M ${outer.join(" L ")} L ${inner.join(" L ")} A ${f(width)} ${f(width)} 0 0 1 ${outer[0]} Z`;
}

/**
 * Courbes guides relevées sur l'illustration de la full art « Spinning spinning » (repère -70…70
 * en largeur, -100…100 en hauteur) : le grand vortex peint autour de la boule, des bandes serrées
 * et très aplaties qui la traversent (montant vers la droite) aux remous larges et plus ronds du
 * fond. Ellipses autour du centre de la boule (`cx`, `cy`), demi-axes `rx`/`ry`, penchées de `tilt`
 * degrés. Les traînées glissent le long de ces courbes.
 */
export const WIND_GUIDES = [
  { cx: 3, cy: 12, rx: 58, ry: 24, tilt: -13 },
  { cx: 3, cy: 11, rx: 64, ry: 32, tilt: -12 },
  { cx: 2, cy: 10, rx: 71, ry: 42, tilt: -10 },
  { cx: 2, cy: 9, rx: 78, ry: 52, tilt: -9 },
  { cx: 1, cy: 8, rx: 86, ry: 62, tilt: -7 },
  { cx: 1, cy: 7, rx: 94, ry: 72, tilt: -6 },
  { cx: 0, cy: 6, rx: 103, ry: 82, tilt: -4 },
  { cx: 0, cy: 5, rx: 112, ry: 90, tilt: -3 },
] as const;

/** Couleurs prises dans l'illustration : violets, roses, cyan, or. */
const WIND_COLORS = ["#b36bff", "#ff5fcf", "#46d6ff", "#ffc84a", "#ff9ae3", "#8f7bff"];
/** Étincelle à quatre branches (rayon 1), comme les éclats de la fête foraine du fond. */
const SPARK = "M 0 -1 Q 0.16 -0.16 1 0 Q 0.16 0.16 0 1 Q -0.16 0.16 -1 0 Q -0.16 -0.16 0 -1 Z";

/** Bande d'un passage : haut de la courbe (gauche → droite) ou bas (droite → gauche). */
export type WindBand = "haut" | "bas";

/**
 * Coups de vent, tirés une fois pour toutes. À chaque passage (`hops`), un coup de vent prend une
 * courbe guide (`guide`, index de `WIND_GUIDES`) et en parcourt une portion (de `angle` à `end`,
 * angle sur l'ellipse : -90 en haut, 90 en bas ; un quart de tour au plus), dans le sens des
 * aiguilles d'une montre : en haut de la courbe il file de gauche à droite, en bas de droite à
 * gauche. `duration` : un passage (visible ≈ 0,32 × durée), `delay` négatif : tous décalés.
 * `kind` : traînée de lumière (`streak` : forme `d`, halo `halo`, cœur clair `core`), étincelle
 * (`spark`) ou confetti (`confetti`). Secondes, degrés.
 */
export const WIND_GUSTS = (() => {
  const rnd = seeded(89);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)] as T;
  const gust = (kind: "streak" | "spark" | "confetti") => {
    const streak = kind === "streak";
    const duration = streak ? 1.5 + rnd() * 1.4 : 0.9 + rnd() * 0.8;
    const sweep = 22 + rnd() * 22;
    const width = 2.4 + rnd() * 1.6;
    const drift = (rnd() - 0.5) * 6;
    return {
      kind,
      duration,
      delay: -rnd() * duration * WIND_HOPS,
      color: pick(WIND_COLORS),
      d: streak ? windStreak(sweep, width, WIND_R, drift) : null,
      halo: streak ? windStreak(sweep * 1.05, width * 2.6, WIND_R, drift) : null,
      core: streak ? windStreak(sweep * 0.8, width * 0.4, WIND_R, drift) : null,
      size: streak ? 0 : 1.8 + rnd() * 1.4,
      tilt: rnd() * 180,
      opacity: streak ? 0.75 + rnd() * 0.25 : 0.85 + rnd() * 0.15,
      hops: Array.from({ length: WIND_HOPS }, () => {
        const band: WindBand = rnd() < 0.5 ? "haut" : "bas";
        const guide = Math.floor(rnd() * WIND_GUIDES.length);
        const travel = streak ? 35 + rnd() * 40 : 55 + rnd() * 30;
        // milieu du parcours : autour du haut (-90°) ou du bas (90°) de la courbe
        const mid = (band === "haut" ? -90 : 90) + (rnd() - 0.5) * 70;
        return { band, guide, angle: mid - travel / 2, end: mid + travel / 2 };
      }),
    };
  };
  return [
    ...Array.from({ length: 36 }, () => gust("streak")),
    ...Array.from({ length: 12 }, () => gust("spark")),
    ...Array.from({ length: 10 }, () => gust("confetti")),
  ];
})();

/** Position de la tête d'un coup de vent à l'angle `angle` de sa courbe guide (repère de l'image). */
export function windHead(guide: number, angle: number): { x: number; y: number } {
  const g = WIND_GUIDES[guide] ?? WIND_GUIDES[0];
  const a = (angle * Math.PI) / 180;
  const t = (g.tilt * Math.PI) / 180;
  const ex = g.rx * Math.cos(a);
  const ey = g.ry * Math.sin(a);
  return {
    x: g.cx + ex * Math.cos(t) - ey * Math.sin(t),
    y: g.cy + ex * Math.sin(t) + ey * Math.cos(t),
  };
}

/**
 * Vent : des bourrasques de lumière dans le style de la carte « Spinning spinning ». Des traînées
 * effilées (épaisses à la tête, très fines au bout), halo de couleur de l'image (violet, rose,
 * cyan, or) et cœur clair, glissent le long des tourbillons peints (`WIND_GUIDES`) : de gauche à
 * droite en haut de chaque courbe, de droite à gauche en bas, un quart de tour au plus ; chacune
 * apparaît, file très vite puis s'efface et repart d'une autre courbe ; des étincelles et
 * confettis de fête foraine sont emportés plus vite encore. Tout est dessiné une fois ; seuls le
 * déplacement, la rotation, l'échelle et la transparence s'animent (`tcg-vfx-gust-fly`) : ni
 * filtre, ni fusion, ni masque, ni 3D. Le flou de mouvement est un halo plus large et plus
 * transparent sous chaque traînée.
 */
const Wind = ({ full }: EffectProps) => (
  <div style={{ ...fillAbs, overflow: "hidden" }}>
    <svg
      viewBox="-70 -100 140 200"
      preserveAspectRatio="xMidYMid slice"
      className="tcg-vfx-wind"
      aria-hidden
    >
      <g transform={`translate(0 ${full ? 0 : -6})`}>
        {WIND_GUSTS.map((g, i) => (
          <g
            key={i}
            className="tcg-vfx-gust"
            style={
              {
                "--w-dur": `${g.duration * WIND_HOPS}s`,
                "--w-delay": `${g.delay}s`,
                "--w-o": g.opacity,
                ...Object.fromEntries(
                  g.hops.flatMap((h, k) => {
                    const c = WIND_GUIDES[h.guide] ?? WIND_GUIDES[0];
                    return [
                      [`--w-x${k}`, `${c.cx}px`],
                      [`--w-y${k}`, `${c.cy}px`],
                      [`--w-t${k}`, `${c.tilt}deg`],
                      [`--w-sx${k}`, (c.rx / WIND_R).toFixed(3)],
                      [`--w-sy${k}`, (c.ry / WIND_R).toFixed(3)],
                      [`--w-a${k}`, `${h.angle.toFixed(1)}deg`],
                      [`--w-e${k}`, `${h.end.toFixed(1)}deg`],
                    ];
                  }),
                ),
              } as CSSProperties
            }
          >
            {g.d ? (
              <>
                <path d={g.halo ?? undefined} fill={g.color} opacity={0.28} />
                <path d={g.d} fill={g.color} opacity={0.8} />
                <path d={g.core ?? undefined} fill="#fff8e6" />
              </>
            ) : (
              <g
                transform={`translate(${WIND_R} 0) rotate(${g.tilt.toFixed(0)}) scale(${(g.size * 1.6).toFixed(2)})`}
              >
                {g.kind === "spark" ? (
                  <>
                    <circle r={1.1} fill={g.color} opacity={0.35} />
                    <path d={SPARK} fill="#fffaf0" />
                  </>
                ) : (
                  <rect x={-0.9} y={-0.5} width={1.8} height={1} rx={0.15} fill={g.color} />
                )}
              </g>
            )}
          </g>
        ))}
      </g>
    </svg>
  </div>
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
  vitrail: { render: StainedGlass },
  energie: { render: LivingEnergy },
  parallaxe: { render: Parallax },
  lampe: { render: Flashlight },
  metal: { render: BrushedMetal },
  donnees: { render: DataRain },
  particules: { render: Motes },
  mirage: { render: HeatHaze },
  givre: { render: Frost },
  brume: { render: Mist },
  fumeeverte: { render: smoke("110 255 130") },
  fumeeblanche: { render: smoke("235 240 245") },
  braises: { render: Embers },
  caustiques: { render: Caustics },
  rayons: { render: GodRays },
  petales: { render: falling("petal") },
  feuilles: { render: falling("leaf") },
  ombres: { render: Shadows },
  vent: { render: Wind },
};

/** L'effet visuel d'une carte ; rien si la clé est vide ou que son rendu n'est pas (encore) codé. */
export function VisualEffectLayer({
  effectKey,
  card,
  full = false,
  paced,
}: {
  effectKey: string | null | undefined;
  card: CardData;
  /** Full art (sinon carte normale). */
  full?: boolean;
  /** Filtres animés par paliers (banc d'essai, étape 7) ; absent : chaque image. */
  paced?: boolean;
}) {
  const def = effectKey ? VISUAL_EFFECTS[effectKey] : undefined;
  if (!def) return null;
  const Effect = def.render;
  return (
    <div className="tcg-vfx" aria-hidden data-effect={effectKey}>
      {/* Toujours animé, même sur une planche (carte figée) : voir l'en-tête du module. */}
      <Effect still={false} card={card} full={full} {...(paced ? { paced } : null)} />
    </div>
  );
}
