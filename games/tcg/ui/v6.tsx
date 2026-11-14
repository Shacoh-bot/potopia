import type { CardData } from "./cards";
import { badgeNumSize, Num } from "./snap";
import { type CardFinish, FinalCard, type FinalLook, RARITY_FRAME } from "./v5";
import type { TopLayout } from "./v4";

/*
 * Sixième vague : refonte de la carte retenue (n°70, bandeau court). La carte en service ne change
 * pas tant que le groupe n'a pas choisi.
 *
 * Commun aux propositions :
 * - plus de plaques d'angle dorées ni de gemmes dans les coins ;
 * - le coût garde son losange bleu ; la puissance est un portail rouge-magenta en marches de
 *   pixels sur un petit escalier (inspiré du logo), dessiné avec ChatGPT (`/tcg/refonte`,
 *   quatre versions au choix) ;
 * - full art : textes posés sur l'illustration, sans encadrés, avec un contour ;
 * - la rareté se voit à une lumière qui déborde de la carte : halo discret en peu commune, puis de
 *   plus en plus fort ; de l'épique à la SSR, des lumières peintes (ChatGPT) ; SSR avec un liseré
 *   multicolore qui tourne.
 *
 * Effets en CSS (`tcg.css`, classes `tcg-r6-*`) : `data-look` (proposition) et `data-finish`
 * (rareté) choisissent le rendu. Animations en transform, opacité ou angle de dégradé seulement.
 */

/** Les propositions, par id de design (`src/designs.ts`). Néon (n°73) est aux Archives. */
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

const ASSETS = "/tcg/refonte";

/** Les quatre badges de puissance « portail » (1 et 2 : liseré doré ; 3 et 4 : sans or). */
export const PORTALS = [1, 2, 3, 4] as const;
export type Portal = (typeof PORTALS)[number];
/** Badge de chaque proposition ; la planche montre aussi les quatre au choix. */
const LOOK_PORTAL: Record<RefonteLook, Portal> = { aura: 2, neon: 3, rayons: 4 };

/** Puissance en forme de portail : le dessin, et le chiffre au centre de l'arche. */
export function PortalPower({ value, portal }: { value: number; portal: Portal }) {
  return (
    <svg width="70" height="70" viewBox="0 0 70 70" role="img" aria-label={`Puissance ${value}`}>
      <image href={`${ASSETS}/power-portal-${portal}.webp`} x="1" y="0" width="66" height="66" />
      <Num x={34} y={36} size={badgeNumSize(value, 24)} stroke="#4a0630">
        {value}
      </Num>
    </svg>
  );
}

/** Lumière peinte (ChatGPT) de chaque rareté haute. */
const PAINT: Partial<Record<CardFinish, string>> = {
  epic: "epique",
  legendary: "legendaire",
  sr: "sr",
  ssr: "ssr",
};

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
function lookOf(
  look: RefonteLook,
  finish: CardFinish,
  power: number,
  portal: Portal = LOOK_PORTAL[look],
): FinalLook {
  const paint = PAINT[finish];
  const data = { "data-look": look, "data-finish": finish } as const;
  return {
    frame: frameOf(look, finish),
    // Full art : textes sans encadrés, avec un contour.
    bare: true,
    power: <PortalPower value={power} portal={portal} />,
    behind: (
      <div
        aria-hidden
        className="tcg-r6-behind"
        {...data}
        style={{ ["--r6" as string]: HUE[finish] }}
      >
        <i className="tcg-r6-glow" />
        <i className="tcg-r6-burst" />
        {paint && (
          <i
            className="tcg-r6-paint"
            style={{ backgroundImage: `url(${ASSETS}/light-${paint}.webp)` }}
          />
        )}
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
  portal,
}: {
  card: CardData;
  look: RefonteLook;
  layout: TopLayout;
  finish: CardFinish;
  /** Badge de puissance à montrer (par défaut, celui de la proposition). */
  portal?: Portal;
}) {
  return (
    <FinalCard
      card={card}
      layout={layout}
      band="court"
      finish={finish}
      look={lookOf(look, finish, card.power, portal)}
    />
  );
}
