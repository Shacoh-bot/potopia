import { type Card, frameFor, glowPointsFor, isAltArt, visualEffectsFor } from "../src/card-rules";
import { serialLabel } from "./card-fit";
import type { CardData } from "./cards";
import { PremiumDefs } from "./premium";
import { SnapDefs } from "./snap";
import { StillCard } from "./StillCard";
import type { TopLayout } from "./v4";
import { FinalCard } from "./v5";

/** Ce qu'il faut d'une carte pour l'afficher (la carte enregistrée, ou le formulaire en cours). */
export type GameCardFields = Pick<
  Card,
  "name" | "rarity" | "type" | "family" | "cost" | "power" | "effectText" | "flavor" | "number"
> & {
  /** Code du set, affiché devant le numéro (« S1 07/116 »). */
  setCode?: string | null;
  /** Cadrage de l'illustration en carte normale. */
  imageFrame?: Card["imageFrame"];
  /** Cadrage en full art ; absent ou null : celui de la carte normale. */
  imageFrameFull?: Card["imageFrameFull"];
  /** Mise en page enregistrée ; absente : normale. */
  layout?: Card["layout"];
  /** La carte a sa version normale ; absent : oui (sa full art est alors une Alt Art). */
  hasNormal?: Card["hasNormal"];
  /** Points lumineux sur l'illustration ; absents : aucun. */
  glowPoints?: Card["glowPoints"];
  /** Points lumineux de la full art ; absents : ceux de la normale (`glowPointsFor`). */
  glowPointsFull?: Card["glowPointsFull"];
  /** Effets visuels de la normale (clés du catalogue), le premier en dessous ; absent : aucun. */
  visualEffectKeys?: string[];
  /** Effets visuels de la full art ; absent : ceux de la normale (`visualEffectsFor`). */
  visualEffectKeysFull?: string[];
  /**
   * Auteur de l'idée d'origine, préparé avec la carte (`cardFaces` de l'app) : le pied « idée de … »
   * suit la carte sur tous les écrans, booster et Potodex compris.
   */
  author?: string | null;
  /**
   * Grande version de l'illustration, préparée avec la carte (`cardFaces`) : `imageUrl` est alors
   * la version réduite, et la grande se charge quand la carte s'affiche en grand.
   */
  imageUrlLarge?: string | null;
};

/** Ligne de type affichée : « Instrument — Grenouilles », ou le type seul sans famille. */
export function typeLine(card: Pick<Card, "type" | "family">): string {
  return card.family ? `${card.type} — ${card.family}` : card.type;
}

/** Définitions SVG (dégradés des badges) à poser une fois par page, avant les cartes. */
export function GameCardDefs() {
  return (
    <>
      <PremiumDefs />
      <SnapDefs />
    </>
  );
}

/**
 * Une carte du jeu, dans le design retenu (n°70 : le 65 affiné, bandeau court), en carte normale
 * ou full art (la mise en page enregistrée sur la carte, sauf `layout` donné), dans sa version
 * affinée (`refined`) : sans plaques d'angle dorées ni gemmes, filet doré collé au cadre, full art
 * avec les textes sans encadrés et un contour. La rareté se voit à la bordure et en pied de carte ;
 * en full art, la carte est dans sa version Alt Art : mention « AA » à côté de la rareté
 * (`isAltArt`).
 */
export function GameCard({
  card,
  imageUrl,
  layout: forced,
  setSize,
  still = false,
  author,
  hoverHalo = true,
  pacedEffects,
}: {
  card: GameCardFields;
  imageUrl: string | null;
  /** Force une mise en page ; absente : celle de la carte. */
  layout?: TopLayout;
  /** Nombre de cartes du set, pour le numéro « 07/44 ». */
  setSize?: number;
  /**
   * Carte figée, pour les planches de nombreuses cartes : sans 3D, image fixe au repos (toutes ses
   * animations en pause), vivante au survol (`StillCard`).
   */
  still?: boolean;
  /** Auteur de l'idée d'origine, en pied de carte (« idée de … ») ; absent : celui de `card`. */
  author?: string | null;
  /**
   * Halo doux de la couleur de la rareté au survol (par défaut). L'aura animée (`CardAura`) est
   * réservée à l'ouverture des boosters, qui coupe ce halo.
   */
  hoverHalo?: boolean;
  /** Mirage et énergie par paliers, pour le banc d'essai (étape 7) ; absent : le rendu du site. */
  pacedEffects?: boolean;
}) {
  const layout = forced ?? card.layout ?? "normal";
  const data: CardData = {
    title: card.name || "Sans nom",
    flavor: card.flavor,
    effect: card.effectText,
    tag: card.family ?? card.type,
    // Les designs ne connaissent que 4 raretés ; épique, SR et SSR passent par `finish`.
    rarity:
      card.rarity === "epic"
        ? "rare"
        : card.rarity === "sr" || card.rarity === "ssr"
          ? "legendary"
          : card.rarity,
    cost: card.cost,
    power: card.power,
    imageUrl,
    imageUrlLarge: card.imageUrlLarge,
    imageFrame: frameFor(card, layout),
    glowPoints: glowPointsFor(card, layout),
    altArt: isAltArt(card, layout),
    author: author ?? card.author ?? undefined,
    // « S1 1/100 » ; hors set (réserve) : « S? », sans numéro.
    serial: serialLabel(card.setCode, card.number, setSize),
  };
  const face = (
    <FinalCard
      card={data}
      layout={layout}
      finish={card.rarity}
      band="court"
      typeLine={typeLine(card)}
      gameFooter
      visualEffects={visualEffectsFor(card, layout)}
      refined
      hoverHalo={hoverHalo}
      pacedEffects={pacedEffects}
    />
  );
  if (still) return <StillCard>{face}</StillCard>;
  return face;
}
