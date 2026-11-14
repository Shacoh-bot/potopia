import { useId } from "react";
import type { CardData } from "./cards";
import { badgeNumSize, Num } from "./snap";
import { type CardFinish, FinalCard, type FinalLook, RARITY_FRAME } from "./v5";
import type { TopLayout } from "./v4";

/*
 * Sixième vague : refonte de la carte retenue (n°70, bandeau court). Trois propositions, chacune
 * avec sa propre façon de montrer la rareté ; la carte en service ne change pas tant que le
 * groupe n'a pas choisi.
 *
 * Commun aux trois :
 * - plus de plaques d'angle dorées ;
 * - le coût garde son losange bleu, la puissance prend la forme du portail rouge du logo : une
 *   arche en marches de pixels posée sur un petit escalier, néon rouge-magenta (inspirée, pas
 *   recopiée) ;
 * - la rareté se voit d'abord à une lumière qui déborde de la carte, de plus en plus forte ;
 *   la SR se démarque nettement (nacre irisée), la légendaire claque (or et éclats), la SSR a un
 *   liseré multicolore qui tourne autour de la carte.
 *
 * Les effets sont en CSS (`tcg.css`, classes `tcg-r6-*`) : `data-look` (proposition) et
 * `data-finish` (rareté) choisissent le rendu. Animations en transform, opacité ou angle de
 * dégradé seulement, pour qu'une planche de 20 cartes reste fluide.
 */

/** Les propositions, par id de design (`src/designs.ts`). */
export const REFONTE_LOOKS = {
  "refonte-aura": "aura",
  "refonte-neon": "neon",
  "refonte-rayons": "rayons",
} as const;
export type RefonteLook = (typeof REFONTE_LOOKS)[keyof typeof REFONTE_LOOKS];

/** Les raretés montrées sur chaque planche, de la commune à la SSR. */
export const REFONTE_FINISHES: { finish: CardFinish; label: string }[] = [
  { finish: "common", label: "Commune" },
  { finish: "uncommon", label: "Peu commune" },
  { finish: "rare", label: "Rare" },
  { finish: "epic", label: "Épique" },
  { finish: "legendary", label: "Légendaire ★" },
  { finish: "sr", label: "SR ★★" },
  { finish: "ssr", label: "SSR ★★★" },
];

/**
 * Arche du portail en marches de pixels (repère 70 × 70 du badge de puissance), symétrique autour
 * de x = 35 ; le bas est ouvert sur l'escalier.
 */
const ARCH = "M12 58 V31 H14 V25 H17 V20 H21 V16 H26 V13 H44 V16 H49 V20 H53 V25 H56 V31 H58 V58 Z";
/** Ouverture de la porte, en retrait de l'arche. */
const DOOR = "M18 58 V33 H20 V28 H23 V24 H27 V21 H31 V19 H39 V21 H43 V24 H47 V28 H50 V33 H52 V58 Z";

/** Puissance en forme de portail : arche néon, porte sombre où tourne la galaxie, escalier. */
export function PortalPower({ value }: { value: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width="70" height="70" viewBox="0 0 70 70" role="img" aria-label={`Puissance ${value}`}>
      <defs>
        <linearGradient id={`${id}-neon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7ac8" />
          <stop offset="0.55" stopColor="#ff2d6f" />
          <stop offset="1" stopColor="#d4144a" />
        </linearGradient>
        <radialGradient id={`${id}-door`} cx="0.5" cy="0.55" r="0.65">
          <stop offset="0" stopColor="#4a1660" />
          <stop offset="1" stopColor="#12061f" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <path d={DOOR} />
        </clipPath>
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Remonté de 4 px : l'escalier reste dans la carte. */}
      <g transform="translate(0 -4)">
        {/* Arche pleine (fond du néon), puis la porte et sa galaxie. */}
        <path d={ARCH} fill="#2a0718" />
        <path d={DOOR} fill={`url(#${id}-door)`} />
        <g clipPath={`url(#${id}-clip)`}>
          <image
            className="tcg-r6-galaxy"
            href="/tcg/portal-galaxy.webp"
            x="17"
            y="20"
            width="36"
            height="36"
            opacity={0.95}
          />
        </g>
        <g filter={`url(#${id}-glow)`}>
          <path d={ARCH} fill="none" stroke={`url(#${id}-neon)`} strokeWidth={3} />
          <path d={DOOR} fill="none" stroke="#ffb3d9" strokeWidth={1} strokeOpacity={0.8} />
          {/* Escalier : trois marches de plus en plus larges sous la porte. */}
          <rect x="14" y="58" width="42" height="3" fill={`url(#${id}-neon)`} />
          <rect x="10" y="61" width="50" height="3" fill="#ff2d6f" />
          <rect x="6" y="64" width="58" height="3" fill="#c0124a" />
        </g>
        <Num x={35} y={40} size={badgeNumSize(value, 24)} stroke="#4a0630">
          {value}
        </Num>
      </g>
    </svg>
  );
}

/** Couleur principale de chaque rareté (lueurs, néons, rayons). */
const HUE: Record<CardFinish, string> = {
  common: "#a7aebb",
  uncommon: "#3ddc84",
  rare: "#4f8ff7",
  epic: "#a45cff",
  legendary: "#ffc23d",
  sr: "#f4e9ff",
  ssr: "#ff6ab5",
};

/** Bordure de chaque proposition : métal uni (aura, rayons) ou tube sombre (néon). */
function frameOf(look: RefonteLook, finish: CardFinish): string {
  if (look === "neon") return "linear-gradient(160deg, #20243a, #0d0f1c)";
  if (finish === "sr") {
    // Nacre : blanc irisé qui change selon l'angle.
    return "linear-gradient(135deg, #fff6ff 0%, #d9ccff 22%, #c4f3ff 44%, #fff2d6 66%, #ffd6ef 88%, #fff6ff 100%)";
  }
  if (finish === "legendary") {
    return "linear-gradient(145deg, #fff1b8 0%, #f2b632 30%, #9a6512 55%, #ffd76a 78%, #b47a16 100%)";
  }
  return RARITY_FRAME[finish];
}

/** Habillage complet d'une rareté pour une proposition. */
function lookOf(look: RefonteLook, finish: CardFinish, power: number): FinalLook {
  const data = { "data-look": look, "data-finish": finish } as const;
  return {
    frame: frameOf(look, finish),
    // Full art : textes sans encadrés, avec un contour.
    bare: true,
    power: <PortalPower value={power} />,
    behind: (
      <div
        aria-hidden
        className="tcg-r6-behind"
        {...data}
        style={{ ["--r6" as string]: HUE[finish] }}
      >
        <i className="tcg-r6-glow" />
        <i className="tcg-r6-rays" />
        <i className="tcg-r6-burst" />
      </div>
    ),
    edge: (
      <div
        aria-hidden
        className="tcg-r6-edge"
        {...data}
        style={{ ["--r6" as string]: HUE[finish] }}
      >
        <i className="tcg-r6-tube" />
        <i className="tcg-r6-run" />
        <i className="tcg-r6-sheen" />
        <i className="tcg-r6-sparks" />
      </div>
    ),
  };
}

/** Une carte d'une proposition de refonte, dans une rareté. */
export function RefonteCard({
  card,
  look,
  layout,
  finish,
}: {
  card: CardData;
  look: RefonteLook;
  layout: TopLayout;
  finish: CardFinish;
}) {
  return (
    <FinalCard
      card={card}
      layout={layout}
      band="court"
      finish={finish}
      look={lookOf(look, finish, card.power)}
    />
  );
}
