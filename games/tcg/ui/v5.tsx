import type { CSSProperties, ReactNode } from "react";
import { type CardData, font } from "./cards";
import { PremiumArt } from "./premium";
import { ImageCost, ImagePower, Ring, SNAP_FINISH_LABELS, type SnapFinish } from "./snap";
import { GlowPoints } from "./GlowPoints";
import { Art, fill, Layer, R, Shell } from "./v2";
import { effectPlace } from "./effect-places";
import { VisualEffectLayer } from "./visual-effects";
import {
  BADGE,
  cardBackground,
  FRAME_THIN,
  panelStyle,
  SIDE,
  TEXT,
  TITLE,
  type TopLayout,
  type TopStyle,
  TYPE,
  windowBox,
  windowRelief,
} from "./v4";

/*
 * Cinquième vague : on affine le gagnant de la quatrième, le 65 (titre en bandeau, encadrés
 * ardoise, puissance en bas), avec le cadre fin du 66. Une carte normale et une full art.
 *
 * Changements par rapport au 65 :
 * - le bandeau du titre est au même plan que la bordure et glisse dessous : il épouse le cadre
 *   au pixel près, coins compris ;
 * - l'effet en haut de l'encadré, la description en italique, un peu plus petite, en bas ;
 * - pas de symbole d'édition : la rareté se verra à la bordure et aux effets ;
 * - en pied de carte, le numéro et la rareté, avec des étoiles à partir de la légendaire
 *   (1 pour la légendaire, 2 pour la SR, 3 pour la SSR) ;
 * - le cadre prend la couleur de la rareté (`RARITY_FRAME`), uni et sans effet de lumière d'un
 *   côté, pour une épaisseur égale tout autour ;
 * - bandeau court (n°70) : titre à la hauteur du mana, centré sur toute la largeur de la carte.
 *
 * Le 65 et le 66 gardent leur rendu (`ui/v4.tsx`) : seules des exportations y ont été ajoutées.
 */

/**
 * Raretés des cartes du jeu : celles des anciennes planches (`SnapFinish`), plus l'épique, entre
 * la rare et la légendaire.
 */
export type CardFinish = SnapFinish | "epic";
const FINISH_LABELS: Record<CardFinish, string> = { ...SNAP_FINISH_LABELS, epic: "Épique" };
/** Rareté abrégée du pied des vraies cartes. */
const FINISH_SHORT: Record<CardFinish, string> = {
  common: "C",
  uncommon: "PC",
  rare: "R",
  epic: "E",
  legendary: "L",
  sr: "SR",
  ssr: "SSR",
};

const STYLE: TopStyle = { window: "creusee", panel: "ardoise", title: "bandeau", thin: true };
const FRAME = FRAME_THIN;
/**
 * Couleur du cadre selon la rareté : c'est elle qui montre la rareté. Teintes unies (ou dégradé
 * conique centré, pour la SR et la SSR) : le cadre a la même épaisseur apparente sur ses quatre
 * côtés, là où un dégradé en biais assombrissait le bord droit.
 */
export const RARITY_FRAME: Record<CardFinish, string> = {
  common: "#a7aebb",
  uncommon: "#3dbb78",
  rare: "#4688f0",
  epic: "#9b55ec",
  legendary: "#e0ac34",
  sr: "conic-gradient(from 0deg at 50% 50%, #ffe0f0, #dccfff, #c9f1ff, #fff1d2, #ffe0f0)",
  ssr: "conic-gradient(from 0deg at 50% 50%, #ff6ab5, #ffd36a, #7dffb0, #6ad5ff, #b88bff, #ff6ab5)",
};
/** Liseré clair, le même tout autour du cadre (aucun effet de lumière venant d'un côté). */
const FRAME_EDGE = "inset 0 0 0 1px rgb(255 255 255 / 0.45)";

/** Étoiles de rareté : aucune jusqu'à la rare, puis une par palier. */
export const RARITY_STARS: Record<CardFinish, number> = {
  common: 0,
  uncommon: 0,
  rare: 0,
  epic: 0,
  legendary: 1,
  sr: 2,
  ssr: 3,
};

/**
 * Forme du bandeau du titre autour du mana (le n°67 est « plein ») :
 * - plein : tout le haut de la carte ; un coin du bandeau dépasse sous le mana, à gauche ;
 * - echancre : creusé en arc autour du mana, avec un liseré ; rien à gauche du mana ;
 * - serti : le mana est serti dans un anneau du métal de la bordure, qui recouvre le coin ;
 * - court : bandeau moins haut, le mana déborde en dessous ;
 * - aucun : pas de bandeau, le titre est posé sur la carte.
 */
export type BandShape = "plein" | "echancre" | "serti" | "court" | "aucun";

/** Centre et rayon du rond du mana (`Cost` réduit de `BADGE`, posé à -2 px du coin). */
const MANA = { x: -2 + 34 * BADGE, y: -2 + 33 * BADGE, r: 29.75 * BADGE };
/**
 * Fenêtre d'illustration de la carte normale avec le bandeau court (cartes du jeu) : collée au
 * trait sous le titre et pleine largeur contre la bordure ; en bas au même endroit qu'avant
 * (y = 232). Coins droits.
 */
export const FINAL_ART = {
  top: 46,
  height: 186,
  inset: FRAME_THIN,
  width: 300 - 2 * FRAME_THIN,
} as const;

/**
 * Encadrés de la carte retenue (bandeau du titre, ligne de type, effet) : l'ardoise, plus
 * transparente en full art pour laisser voir l'illustration.
 */
/**
 * Contour du texte posé directement sur l'illustration (full art sans encadrés, refonte) : lisible
 * sur n'importe quel fond, clair ou sombre.
 */
const TEXT_OUTLINE =
  "1px 0 0 #05060c, -1px 0 0 #05060c, 0 1px 0 #05060c, 0 -1px 0 #05060c, 1px 1px 0 #05060c, -1px -1px 0 #05060c, 1px -1px 0 #05060c, -1px 1px 0 #05060c, 0 2px 6px rgb(0 0 0 / 0.9)";

function finalPanel(card: CardData, layout: TopLayout, bare = false): CSSProperties {
  const style = panelStyle(card, STYLE.panel, layout);
  if (bare && layout === "fullart") {
    return {
      ...style,
      background: "transparent",
      boxShadow: "none",
      backdropFilter: "none",
      color: "#fff",
      textShadow: TEXT_OUTLINE,
    };
  }
  return layout === "fullart"
    ? { ...style, background: "rgb(30 34 44 / 0.35)", backdropFilter: "blur(3px)" }
    : style;
}

/** Rayon de l'échancrure (4 px d'écart autour du mana) et de l'anneau serti. */
const NOTCH = MANA.r + 4.5;
const SOCKET = 34.5;

/**
 * Bandeau du titre : au plan de la bordure, dessiné juste avant elle, et prolongé de 2 px sous le
 * métal. Le bord visible est donc celui de la bordure elle-même.
 */
function Band({
  card,
  layout,
  shape,
  bare = false,
}: {
  card: CardData;
  layout: TopLayout;
  shape: BandShape;
  /** Full art de la refonte : pas de bandeau, le titre seul avec son contour. */
  bare?: boolean;
}) {
  const under = 2;
  const left = FRAME - under;
  const top = FRAME - under;
  if (shape === "aucun") {
    return (
      <Layer
        z={30}
        style={{
          left: TITLE.inset,
          right: TITLE.inset,
          top: TITLE.top,
          height: TITLE.height,
          display: "grid",
          placeItems: "center",
          color: "#f4f1ea",
          textShadow: "0 1px 3px rgb(0 0 0 / 0.9), 0 0 10px rgb(0 0 0 / 0.6)",
        }}
      >
        <FitTitle title={card.title} width={300 - 2 * TITLE.inset} />
      </Layer>
    );
  }
  const cut = shape === "echancre" ? NOTCH : shape === "serti" ? SOCKET : 0;
  // Centre du mana dans le repère du bandeau.
  const cx = MANA.x - left;
  const cy = MANA.y - top;
  const mask = cut
    ? `radial-gradient(circle at ${cx}px ${cy}px, transparent ${cut}px, #000 ${cut + 0.5}px)`
    : undefined;
  const short = shape === "court";
  const height = (short ? 46 : TITLE.top + TITLE.height) - top;
  return (
    <Layer
      z={10}
      style={{
        left,
        right: left,
        top,
        height,
        display: "grid",
        placeItems: "center",
        // Bandeau court : le titre se centre sur toute la largeur de la carte, avec la même marge
        // des deux côtés pour ne jamais passer sous le mana, à la hauteur du centre du mana.
        padding: short
          ? `${FRAME - top}px ${Math.round(MANA.x + MANA.r) + 2 - left}px 0`
          : `0 ${TITLE.inset - left}px`,
        overflow: "hidden",
        ...finalPanel(card, layout, bare),
        // Titre en dégradé : une ombre de texte le noircirait ; le contour passe par un filtre.
        ...(bare && layout === "fullart"
          ? {
              textShadow: "none",
              filter:
                "drop-shadow(1px 0 0 #05060c) drop-shadow(-1px 0 0 #05060c) drop-shadow(0 1px 0 #05060c) drop-shadow(0 -1px 0 #05060c) drop-shadow(0 2px 4px rgb(0 0 0 / 0.8))",
            }
          : null),
        border: 0,
        borderBottom: bare && layout === "fullart" ? 0 : "1px solid rgb(255 255 255 / 0.14)",
        borderRadius: `${R - left}px ${R - left}px 0 0`,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {shape === "echancre" && (
        // Liseré le long de l'arc, comme le bord bas du bandeau.
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: cx - cut - 1,
            top: cy - cut - 1,
            width: 2 * (cut + 1),
            height: 2 * (cut + 1),
            borderRadius: "50%",
            border: "1px solid rgb(255 255 255 / 0.22)",
          }}
        />
      )}
      <FitTitle
        title={card.title}
        width={300 - 2 * (short ? Math.round(MANA.x + MANA.r) + 2 : TITLE.inset)}
      />
    </Layer>
  );
}

/** Anneau de métal autour du mana, du métal de la bordure, rogné à la forme de la carte. */
function Socket({ finish }: { finish: CardFinish }) {
  return (
    <Layer z={10} style={{ ...fill, borderRadius: R, overflow: "hidden", pointerEvents: "none" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: MANA.x - SOCKET,
          top: MANA.y - SOCKET,
          width: 2 * SOCKET,
          height: 2 * SOCKET,
          borderRadius: "50%",
          background: RARITY_FRAME[finish],
          boxShadow: `${FRAME_EDGE}, 0 0 0 1.5px rgb(0 0 0 / 0.7)`,
        }}
      />
    </Layer>
  );
}

/**
 * Largeur moyenne d'un caractère du titre (Rajdhani gras en majuscules, espacement compris), en
 * fraction de sa taille.
 */
const TITLE_CHAR = 0.6;
const TITLE_SIZE = { max: 17, min: 13, twoLines: 12 } as const;

/**
 * Titre qui tient dans sa place : la taille baisse avec la longueur (jusqu'à 13 px), puis le titre
 * passe sur deux lignes, un peu plus petit. Estimé d'après le nombre de caractères, pour que le
 * rendu serveur soit déjà le bon.
 */
function FitTitle({ title, width }: { title: string; width: number }) {
  const fits = (size: number) => title.length * TITLE_CHAR * size <= width;
  let size: number = TITLE_SIZE.max;
  while (!fits(size) && size > TITLE_SIZE.min) size -= 0.5;
  const twoLines = !fits(size);
  if (twoLines) {
    // Sur deux lignes : la taille qui fait tenir le titre en deux largeurs, bornée.
    size = Math.max(
      TITLE_SIZE.twoLines,
      Math.min(15, Math.floor(((2 * width) / (title.length * TITLE_CHAR)) * 2) / 2),
    );
  }
  return (
    <span
      style={{
        // Même police que « POTOMON » au dos de la carte, en majuscules.
        fontFamily: font("rajdhani", "Rajdhani, sans-serif"),
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        // Effet de « POTOMON » au dos : italique, dégradé blanc → cyan, halo cyan.
        fontStyle: "italic",
        backgroundImage: "linear-gradient(180deg, #ffffff 30%, #67e8f9 100%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        filter: "drop-shadow(0 0 2.5px rgb(103 232 249 / 0.75))",
        // L'italique penche à droite : un peu d'air pour ne pas couper la dernière lettre.
        paddingInline: "0.15em",
        fontSize: size,
        lineHeight: twoLines ? 1.1 : 1.2,
        textAlign: "center",
        maxWidth: "100%",
        overflow: "hidden",
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: twoLines ? 2 : 1,
        wordBreak: "break-word",
      }}
    >
      {title}
    </span>
  );
}

/** Pied de carte : numéro, puis rareté et ses étoiles. */
function Footer({
  card,
  finish,
  game,
}: {
  card: CardData;
  finish: CardFinish;
  /** Pied des vraies cartes : rareté abrégée, puis « idée de … ». */
  game: boolean;
}) {
  const stars = RARITY_STARS[finish];
  return (
    <Layer
      z={20}
      style={{
        left: SIDE + 4,
        right: 70,
        bottom: 15,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: font("franklin", "sans-serif"),
        fontSize: 9,
        letterSpacing: 0.6,
        color: "#d8d2c4",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{card.serial ?? "—"}</span>
      <span aria-hidden style={{ opacity: 0.5 }}>
        ·
      </span>
      <span title={game ? FINISH_LABELS[finish] : undefined}>
        {game ? FINISH_SHORT[finish] : FINISH_LABELS[finish]}
      </span>
      {stars > 0 && (
        <span
          role="img"
          aria-label={`${stars} étoile${stars > 1 ? "s" : ""}`}
          style={{
            color: "#ffd66b",
            fontSize: 11,
            letterSpacing: 1,
            textShadow: "0 0 4px rgb(255 190 60 / 0.7)",
          }}
        >
          {"★".repeat(stars)}
        </span>
      )}
      {game && card.author && (
        <>
          <span aria-hidden style={{ opacity: 0.5 }}>
            ·
          </span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            idée de {card.author}
          </span>
        </>
      )}
    </Layer>
  );
}

/**
 * Carte de la cinquième vague, en carte normale ou full art. `finish` ne change que le pied de
 * carte : les effets de rareté se votent à part.
 */
/** Facettes d'une gemme octogonale, comme au dos (`CardBack`). */
const GEM_OUTER = "-3.1,-7.5 3.1,-7.5 7.5,-3.1 7.5,3.1 3.1,7.5 -3.1,7.5 -7.5,3.1 -7.5,-3.1";
const GEM_TABLE = "-1.5,-3.6 1.5,-3.6 3.6,-1.5 3.6,1.5 1.5,3.6 -1.5,3.6 -3.6,1.5 -3.6,-1.5";

function Gem({ x, y, color }: { x: number; y: number; color: "c" | "p" }) {
  return (
    <g transform={`translate(${x} ${y}) scale(0.62)`}>
      <polygon
        points={GEM_OUTER}
        fill={`url(#tcg-back-gem-${color})`}
        stroke="url(#tcg-back-gold)"
        strokeWidth={1.4}
      />
      <polygon points={GEM_TABLE} fill="#fff" fillOpacity={0.3} />
    </g>
  );
}

/** Plaque d'angle dorée du dos, dans le coin haut gauche (les autres en miroir). */
const CORNER = "0,48 0,22 22,0 48,0 40,7 24,7 7,24 7,40";
const W = 300;
const H = 420;

/**
 * Cadre repris du dos de la carte, posé sur la bordure de rareté : polissage en diagonale,
 * plaques d'angle dorées, gemmes cyan (haut) et magenta (bas) dans les coins libres (le coût et
 * la puissance couvrent les deux autres). La plaque du haut et son losange restent au dos.
 */
function BackStyleFrame({ corners = true }: { corners?: boolean }) {
  // Refonte (sans `corners`) : ni plaques d'angle dorées, ni gemmes dans les coins.
  const band = `M${R} 0 H${W - R} A${R} ${R} 0 0 1 ${W} ${R} V${H - R} A${R} ${R} 0 0 1 ${W - R} ${H} H${R} A${R} ${R} 0 0 1 0 ${H - R} V${R} A${R} ${R} 0 0 1 ${R} 0 Z M${R} ${FRAME} H${W - R} A${R - FRAME} ${R - FRAME} 0 0 1 ${W - FRAME} ${R} V${H - R} A${R - FRAME} ${R - FRAME} 0 0 1 ${W - R} ${H - FRAME} H${R} A${R - FRAME} ${R - FRAME} 0 0 1 ${FRAME} ${H - R} V${R} A${R - FRAME} ${R - FRAME} 0 0 1 ${R} ${FRAME} Z`;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      style={{ ...fill, width: "100%", height: "100%", overflow: "visible" }}
    >
      <path
        d={band}
        fillRule="evenodd"
        fill="url(#tcg-back-polish)"
        style={{ mixBlendMode: "soft-light" }}
      />
      {/* Filet doré le long du bord intérieur. */}
      <rect
        x={FRAME + 0.75}
        y={FRAME + 0.75}
        width={W - 2 * FRAME - 1.5}
        height={H - 2 * FRAME - 1.5}
        rx={R - FRAME - 0.75}
        fill="none"
        stroke="url(#tcg-back-gold)"
        strokeWidth={1.5}
      />
      {corners && (
        <g fill="url(#tcg-back-gold)" stroke="rgb(0 0 0 / 0.45)" strokeWidth={0.6}>
          <polygon points={CORNER} />
          <polygon points={CORNER} transform={`translate(${W} 0) scale(-1 1)`} />
          <polygon points={CORNER} transform={`translate(0 ${H}) scale(1 -1)`} />
          <polygon points={CORNER} transform={`translate(${W} ${H}) scale(-1 -1)`} />
        </g>
      )}
      {corners && (
        <g filter="url(#tcg-back-glow)">
          <Gem x={W - 13} y={13} color="c" />
          <Gem x={13} y={H - 13} color="p" />
        </g>
      )}
    </svg>
  );
}

/** Or des filets des encadrés : reflets le long du bord, comme le cadre du dos. */
const PANEL_GOLD =
  "linear-gradient(100deg, #8a5a14 0%, #fde68a 22%, #e0a93a 45%, #fff3c4 68%, #9a6418 100%)";

/**
 * Filets très fins des encadrés (ligne de type, effet) dans le style du dos : un filet doré de
 * 1 px à la place de la bordure, doublé à l'intérieur d'un liseré cyan à peine visible.
 */
function PanelTrim() {
  return (
    <>
      <Ring background={PANEL_GOLD} width={1} style={{ inset: 0, borderRadius: 8 }} />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 1.5,
          borderRadius: 6.5,
          border: "0.5px solid rgb(103 232 249 / 0.3)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}

export function FinalCard({
  card,
  layout,
  finish = "common",
  band = "plein",
  typeLine,
  gameFooter = false,
  visualEffects = [],
  still = false,
  look,
}: {
  card: CardData;
  layout: TopLayout;
  finish?: CardFinish;
  band?: BandShape;
  /** Ligne de type des vraies cartes (« Instrument — Grenouilles ») ; par défaut « Créature — tag ». */
  typeLine?: string;
  /** Pied des vraies cartes (rareté abrégée, auteur de l'idée) ; les propositions notées gardent le leur. */
  gameFooter?: boolean;
  /** Effets visuels (clés du catalogue, voir `visual-effects.tsx`), le premier en dessous. */
  visualEffects?: string[];
  /** Carte figée (planches) : l'effet visuel reste à l'arrêt. */
  still?: boolean;
  /**
   * Propositions de refonte (`ui/v6.tsx`) : sans plaques d'angle dorées, bordure, puissance et
   * effets de rareté à elles. Absent : la carte en service, inchangée.
   */
  look?: FinalLook;
}) {
  const full = layout === "fullart";
  // Carte normale : chaque effet à sa place (`effectPlace`) : illustration, carte, ou bordure.
  const placed = (place: string) => visualEffects.filter((k) => effectPlace(k) === place);
  // Les effets qui redessinent l'illustration passent sous ceux posés dessus.
  const imageEffects = placed("image");
  const artEffects = [...imageEffects, ...placed("art")];
  const cardEffects = placed("card");
  const frameEffects = placed("frame");
  const effects = (keys: string[]) =>
    keys.map((k) => (
      <VisualEffectLayer key={k} effectKey={k} card={card} full={full} still={still} />
    ));
  // La bordure grise des encadrés laisse la place au filet doré (`PanelTrim`), posé à
  // l'intérieur : l'encadré de l'effet rogne ce qui dépasse.
  const bare = !!look?.bare && full;
  const panel: CSSProperties = {
    ...finalPanel(card, layout, bare),
    border: 0,
    position: "relative",
  };
  const relief = windowRelief(STYLE);
  const glow = card.imageUrl && card.glowPoints?.length ? card.glowPoints : null;
  // Points lumineux sur une fenêtre donnée. Avec la parallaxe, ils suivent le même mouvement que
  // l'illustration (agrandie, glissant à l'opposé du pointeur) pour rester à leur place sur elle.
  const glowLayer = (width: number, height: number) => {
    if (!glow) return null;
    const points = (
      <GlowPoints
        points={glow}
        imageUrl={card.imageUrl}
        frame={card.imageFrame}
        box={{ width, height }}
      />
    );
    return visualEffects.includes("parallaxe") ? (
      <div className="tcg-vfx-plx-back">{points}</div>
    ) : (
      points
    );
  };

  return (
    <Shell card={card}>
      {/* Refonte : ce qui rayonne derrière la carte et déborde de son bord. */}
      {look?.behind}
      {full ? (
        <>
          <Art card={card} />
          {/* Full art : l'illustration redessinée (or, aquarelle…) reste sous le texte. */}
          {imageEffects.length > 0 && (
            <div style={{ ...fill, borderRadius: R, overflow: "hidden" }}>
              {effects(imageEffects)}
            </div>
          )}
          {/* Points lumineux : accrochés à l'image, qui couvre toute la carte. */}
          {glow && (
            <div style={{ ...fill, borderRadius: R, overflow: "hidden" }}>{glowLayer(W, H)}</div>
          )}
          {/* Assombrit le bas de l'image, pour la lisibilité des encadrés transparents. */}
          <div
            aria-hidden
            style={{
              ...fill,
              borderRadius: R,
              background:
                "linear-gradient(to top, rgb(6 7 18 / 0.6) 0%, rgb(6 7 18 / 0.1) 45%, transparent 60%), linear-gradient(to bottom, rgb(6 7 18 / 0.45) 0%, transparent 18%)",
            }}
          />
        </>
      ) : (
        <>
          <div
            aria-hidden
            style={{ ...fill, borderRadius: R, background: cardBackground(STYLE.panel) }}
          />
          <div
            style={{
              ...windowBox(STYLE),
              ...(band === "court"
                ? {
                    top: FINAL_ART.top,
                    height: FINAL_ART.height,
                    left: FINAL_ART.inset,
                    right: FINAL_ART.inset,
                    borderRadius: 0,
                  }
                : null),
              background: "#0b0d18",
            }}
          >
            <PremiumArt card={card} />
            {/* Carte normale : les effets « art » ne couvrent que l'illustration. */}
            {effects(artEffects)}
            {/* Points lumineux, accrochés à l'image (fenêtre du bandeau court seulement). */}
            {band === "court" && glowLayer(FINAL_ART.width, FINAL_ART.height)}
            {relief && <div aria-hidden style={{ ...fill, ...relief, borderRadius: "inherit" }} />}
            {band === "court" && (
              // Même trait que sous le titre, pour fermer l'illustration en bas.
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 1,
                  background: "rgb(255 255 255 / 0.14)",
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Carte normale, effets de toute la carte (éclair) : sur toute la carte mais sous le bandeau
          du titre, la bordure et les encadrés (profondeur 5, sous leurs 10 et 30). */}
      {!full && cardEffects.length > 0 && (
        <Layer z={5} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
          {effects(cardEffects)}
        </Layer>
      )}

      <Band card={card} layout={layout} shape={band} bare={bare} />

      {/* Bordure de la carte, après le bandeau : elle en recouvre le bord. */}
      <Layer z={10} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
        <Ring background={look?.frame ?? RARITY_FRAME[finish]} width={FRAME} />
        <div
          style={{
            ...fill,
            borderRadius: R,
            boxShadow: FRAME_EDGE,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: FRAME,
            borderRadius: R - FRAME,
            boxShadow: "0 0 0 1.5px rgb(0 0 0 / 0.7), inset 0 0 16px rgb(0 0 0 / 0.45)",
          }}
        />
        <BackStyleFrame corners={!look} />
      </Layer>
      {/* Refonte : liserés et lumières posés sur la bordure. */}
      {look?.edge && (
        <Layer z={25} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
          {look.edge}
        </Layer>
      )}
      {band === "serti" && <Socket finish={finish} />}

      {/* Carte normale, effets de cadre (liserés, prisme, halo) : par-dessus la bordure et le
          bandeau du titre (profondeur 20, au-dessus de leurs 10), sous les encadrés (30). */}
      {!full && frameEffects.length > 0 && (
        <Layer z={20} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
          {effects(frameEffects)}
        </Layer>
      )}

      <Layer z={30} style={{ left: SIDE, right: SIDE, top: TYPE.top, height: TYPE.height }}>
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 10px",
            ...panel,
          }}
        >
          <span style={{ fontFamily: font("magic", "serif"), fontWeight: 700, fontSize: 12.5 }}>
            {typeLine ?? `Créature — ${card.tag}`}
          </span>
          {!bare && <PanelTrim />}
        </div>
      </Layer>

      <Layer z={30} style={{ left: SIDE, right: SIDE, top: TEXT.top, bottom: TEXT.bottom }}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "8px 40px 8px 12px",
            fontFamily: font("fantasy-text", "serif"),
            fontSize: 13.5,
            lineHeight: "16px",
            overflow: "hidden",
            ...panel,
          }}
        >
          {!bare && <PanelTrim />}
          <div>{card.effect}</div>
          {card.flavor && (
            <div
              style={{
                marginTop: "auto",
                paddingTop: 6,
                fontStyle: "italic",
                fontSize: 11.5,
                lineHeight: "14px",
                opacity: 0.8,
              }}
            >
              {card.flavor}
            </div>
          )}
        </div>
      </Layer>

      {/* Full art : les effets visuels couvrent toute la carte, encadrés compris, sous le coût et la
          puissance. En carte normale, il est plus haut, sous les encadrés : dans la fenêtre
          d'illustration, ou selon la place de l'effet (`effectPlace`). */}
      {full && visualEffects.length > imageEffects.length && (
        <Layer z={60} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
          {effects(visualEffects.filter((k) => !imageEffects.includes(k)))}
        </Layer>
      )}

      <Footer card={card} finish={finish} game={gameFooter} />

      {/* Coût et puissance en dernier : toujours au-dessus du reste, sans sertissage. */}
      <Layer
        z={80}
        style={{ left: -2, top: -2, zIndex: 5, scale: String(BADGE), transformOrigin: "0 0" }}
      >
        <ImageCost value={card.cost} />
      </Layer>
      <Layer
        z={80}
        style={{
          right: -2,
          bottom: -2,
          zIndex: 5,
          scale: String(BADGE),
          transformOrigin: "100% 100%",
        }}
      >
        {look?.power ?? <ImagePower value={card.power} />}
      </Layer>
    </Shell>
  );
}

/** Habillage d'une proposition de refonte (`ui/v6.tsx`). */
export type FinalLook = {
  /** Fond de la bordure (couleur, dégradé). */
  frame: string;
  /** Badge de puissance. */
  power: ReactNode;
  /** Derrière la carte, peut déborder (lueur, rayons). */
  behind?: ReactNode;
  /** Par-dessus la bordure (liseré, reflets). */
  edge?: ReactNode;
  /** Full art : textes posés sur l'illustration, sans encadrés, avec un contour. */
  bare?: boolean;
};

/** La planche du n°67 : normale et full art, puis la carte dans chaque rareté. */
export const FINAL_VARIANTS: { layout: TopLayout; finish: CardFinish; label: string }[] = [
  { layout: "normal", finish: "common", label: "Normale · commune" },
  { layout: "fullart", finish: "common", label: "Full art · commune" },
  { layout: "normal", finish: "uncommon", label: "Peu commune" },
  { layout: "normal", finish: "rare", label: "Rare" },
  { layout: "normal", finish: "epic", label: "Épique" },
  { layout: "normal", finish: "legendary", label: "Légendaire ★" },
  { layout: "normal", finish: "sr", label: "SR ★★" },
  { layout: "normal", finish: "ssr", label: "SSR ★★★" },
];

/** Les variantes du bandeau autour du mana, par id de design (n°68 à 71). */
export const BAND_DESIGNS = {
  "final-echancre": "echancre",
  "final-serti": "serti",
  "final-court": "court",
  "final-sans-bandeau": "aucun",
} as const satisfies Record<string, BandShape>;
