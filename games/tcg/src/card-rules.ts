import type { EffectParams } from "./effects";

/*
 * Règles et types des cartes sans dépendance serveur : importables par l'éditeur côté navigateur.
 */

export const CARD_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "sr",
  "ssr",
] as const;
export type CardRarityId = (typeof CARD_RARITIES)[number];

export const CARD_RARITY_LABELS: Record<CardRarityId, string> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  sr: "Secrète (SR)",
  ssr: "Super secrète (SSR)",
};

export const CARD_LIMITS = {
  name: 60,
  type: 40,
  family: 40,
  effectText: 300,
  flavor: 300,
  adminNote: 120,
  // Jusqu'à 8, comme Skaar (7) et Death (8) dans Snap : des cartes qui coûtent moins en main.
  cost: { min: 0, max: 8 },
  power: { min: -20, max: 30 },
  imageBytes: 5 * 1024 * 1024,
} as const;

/**
 * Tailles des illustrations envoyées (côté le plus long, en px). `large` : l'illustration gardée,
 * nette en carte agrandie (×2,5) sur écran haute densité ; `small` : sa version réduite, chargée
 * par les petites cartes ; `sharp` : en dessous, l'admin est averti que l'image sera floue en grand
 * (sans bloquer l'envoi).
 */
export const CARD_IMAGE_SIZES = { large: 2400, small: 800, sharp: 1500 } as const;

/** Image trop petite pour rester nette en carte agrandie (`CARD_IMAGE_SIZES.sharp`). */
export function isBlurryWhenZoomed(size: { width: number; height: number }): boolean {
  return Math.max(size.width, size.height) < CARD_IMAGE_SIZES.sharp;
}

/** Illustrations de cartes : WebP uniquement (l'interface convertit avant l'envoi). */
export const CARD_IMAGE_TYPES = {
  "image/webp": "webp",
} as const;
export type CardImageType = keyof typeof CARD_IMAGE_TYPES;

export type CardSet = { id: string; code: string; name: string };

/**
 * Cadrage d'une illustration : le point de cadrage (en % de la largeur et de la hauteur) et le
 * zoom (1 = l'image remplit juste la fenêtre). Sous 1 (carte normale seulement), l'image rétrécit
 * jusqu'à tenir entière dans la fenêtre, et la même image floutée remplit le vide autour. Le
 * fichier n'est jamais rogné : on peut recadrer à tout moment.
 */
export type ImageFrame = { x: number; y: number; zoom: number };

export const DEFAULT_FRAME: ImageFrame = { x: 50, y: 50, zoom: 1 };
/**
 * Bornes du zoom. `min` vaut pour la carte normale (une image portrait pensée pour la full art
 * tient entière dans sa fenêtre vers 0,43) ; la full art, dont la fenêtre est toute la carte, ne
 * descend pas sous `fullMin`.
 */
export const FRAME_ZOOM = { min: 0.25, fullMin: 1, max: 4 } as const;

/**
 * Zoom qui fait tenir l'image entière dans la fenêtre (1 si elle la remplit déjà juste), borné à
 * `FRAME_ZOOM.min`. `box` : taille de la fenêtre ; `natural` : taille réelle de l'image.
 */
export function fitZoom(
  box: { width: number; height: number },
  natural: { width: number; height: number },
): number {
  if (natural.width <= 0 || natural.height <= 0) return 1;
  const sx = box.width / natural.width;
  const sy = box.height / natural.height;
  // object-fit: cover agrandit selon le plus grand rapport ; l'image entière, selon le plus petit.
  const fit = Math.min(sx, sy) / Math.max(sx, sy);
  return Math.max(FRAME_ZOOM.min, Math.floor(fit * 100) / 100);
}

/**
 * Étapes de préparation d'une carte, dans l'ordre : elle arrive « à traiter », puis son
 * illustration est faite, puis sa description et son effet ; à la dernière, elle attend d'être
 * rangée dans un set (ce rangement, `moveCards`, lui donne son numéro). Une carte déjà dans un set
 * garde aussi son étape. Repère d'admin seulement : sans effet en jeu.
 */
export const CARD_PREP_STAGES = ["todo", "illustrated", "described", "integration"] as const;
export type CardPrepStage = (typeof CARD_PREP_STAGES)[number];

export const CARD_PREP_STAGE_LABELS: Record<CardPrepStage, string> = {
  todo: "À traiter",
  illustrated: "Illustration ok",
  described: "Description et effet ok",
  integration: "À intégrer à un set",
};

/** Mise en page d'une carte : illustration dans une fenêtre (normale) ou sur toute la carte. */
export const CARD_LAYOUTS = ["normal", "fullart"] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];

export const CARD_LAYOUT_LABELS: Record<CardLayout, string> = {
  normal: "Normale",
  fullart: "Full art",
};

/**
 * Cadrage à appliquer selon la mise en page : la carte normale et la full art ont chacune le leur.
 * Une carte sans cadrage full art à elle (cadrée avant qu'ils soient séparés) garde celui de la
 * carte normale, sans son dézoom : la full art ne descend jamais sous `FRAME_ZOOM.fullMin`.
 */
export function frameFor(
  card: { imageFrame?: ImageFrame | null; imageFrameFull?: ImageFrame | null },
  layout: CardLayout,
): ImageFrame | null {
  const normal = card.imageFrame ?? null;
  if (layout !== "fullart") return normal;
  if (card.imageFrameFull) return card.imageFrameFull;
  return normal && normal.zoom < FRAME_ZOOM.fullMin
    ? { ...normal, zoom: FRAME_ZOOM.fullMin }
    : normal;
}

/**
 * Nom des versions d'une carte. La version full art est l'« Alt Art » (AA, idée reprise du One
 * Piece TCG) : une mention en plus de la rareté, possible pour toute rareté.
 */
export const CARD_VERSION_LABELS: Record<CardLayout, string> = {
  normal: "Normale",
  fullart: "Alt Art (AA)",
};

/**
 * Chance (sur 1) qu'une carte tirée qui a ses deux versions sorte en Alt Art (choix de
 * l'utilisateur, 15/11). Tirée après la rareté : ne change ni les taux ni les garanties.
 */
export const ALT_ART_CHANCE = 0.1;

/**
 * Version obtenue d'une carte tirée : l'Alt Art à `ALT_ART_CHANCE` si la carte a ses deux
 * versions, sinon sa seule version active (`rnd` dans [0, 1[).
 */
export function drawVersion(
  card: { hasNormal: boolean; hasFullArt: boolean },
  rnd: () => number = Math.random,
): CardLayout {
  if (card.hasNormal && card.hasFullArt) return rnd() < ALT_ART_CHANCE ? "fullart" : "normal";
  return card.hasFullArt ? "fullart" : "normal";
}

/**
 * Une carte montrée en full art est une Alt Art (mention « AA »), toujours : y compris une carte
 * qui n'existe qu'en full art (ex. Le vieux sage). Décision de l'utilisateur du 15/11. Passer à
 * `true` pour réserver la mention aux cartes qui ont aussi leur version normale.
 */
export const ALT_ART_NEEDS_NORMAL = false;

/**
 * La carte, montrée dans cette version, est-elle une Alt Art (mention « AA ») ? `hasNormal` ne
 * compte que si `ALT_ART_NEEDS_NORMAL` ; absent : la carte est comptée comme ayant sa normale.
 */
export function isAltArt(card: { hasNormal?: boolean }, version: CardLayout): boolean {
  return version === "fullart" && (!ALT_ART_NEEDS_NORMAL || card.hasNormal !== false);
}

/**
 * Rareté dont on joue le son à la révélation d'une carte : celle de la carte, mais toute Alt Art
 * (toute carte en full art) se révèle avec le son de la SSR, quelle que soit sa rareté (décision de
 * l'utilisateur, 15/11).
 * Seul le son change : le halo et les effets restent ceux de la rareté de la carte.
 */
export function revealRarity(card: {
  rarity: CardRarityId;
  hasNormal?: boolean;
  layout?: CardLayout;
}): CardRarityId {
  return isAltArt(card, card.layout ?? "normal") ? "ssr" : card.rarity;
}

/** Versions actives d'une carte, la normale d'abord. */
export function cardVersions(card: { hasNormal: boolean; hasFullArt: boolean }): CardLayout[] {
  return CARD_LAYOUTS.filter((v) => (v === "normal" ? card.hasNormal : card.hasFullArt));
}

/**
 * Note admin qui marque une carte en doublon : celle qu'écrit le bouton « Doublon » de la fiche
 * (« Doublon » ou « Doublon — gardée : … »), majuscules indifférentes.
 */
export function isDuplicateNote(note: string | null | undefined): boolean {
  return /^\s*doublon(?![\p{L}\p{N}])/iu.test(note ?? "");
}

/**
 * Note après un clic sur le bouton « Doublon » de l'éditeur : inchangée (sans les espaces autour)
 * si elle marque déjà la carte en doublon (même règle que `isDuplicateNote`), sinon préfixée par
 * « Doublon — », ou « Doublon » si elle est vide.
 */
export function markDuplicateNote(note: string): string {
  const trimmed = note.trim();
  if (isDuplicateNote(trimmed)) return trimmed;
  return trimmed ? `Doublon — ${trimmed}` : "Doublon";
}

/**
 * Note sans la marque « Doublon » (inverse de `markDuplicateNote`) : « Doublon — gardée : X »
 * devient « gardée : X », « Doublon » seul devient null. Une note sans marque est rendue telle quelle.
 */
export function unmarkDuplicateNote(note: string | null): string | null {
  if (!isDuplicateNote(note)) return note;
  const rest = (note ?? "").replace(/^\s*doublon(?![\p{L}\p{N}])\s*(?:[—–:-]\s*)?/iu, "").trim();
  return rest || null;
}

/**
 * État d'une idée d'après ses cartes : `cards`, les cartes du jeu (hors corbeille) qui ne sont pas
 * marquées doublon ; `duplicate`, l'idée n'a aucune de ces cartes et au moins une carte marquée
 * « Doublon », même à la corbeille ; `trashed`, toutes ses cartes sont à la corbeille, sans marque
 * « Doublon ». Dans ces deux cas elle ne compte plus comme idée à transformer en carte et suit ses
 * cartes (onglets « Doublon », « Corbeille » des idées) ; une carte qui en sort la ramène.
 */
export function ideaStateOf(cards: { adminNote: string | null; deletedAt: Date | null }[]): {
  cards: number;
  duplicate: boolean;
  trashed: boolean;
} {
  const kept = cards.filter((c) => !c.deletedAt && !isDuplicateNote(c.adminNote)).length;
  const duplicate = kept === 0 && cards.some((c) => isDuplicateNote(c.adminNote));
  return { cards: kept, duplicate, trashed: kept === 0 && !duplicate && cards.length > 0 };
}

/**
 * Effets visuels d'une version, dans l'ordre des calques. Sans liste propre à la full art (carte
 * fictive, vieux appel), la full art reprend ceux de la normale.
 */
export function visualEffectsFor(
  card: { visualEffectKeys?: string[]; visualEffectKeysFull?: string[] },
  version: CardLayout,
): string[] {
  const normal = card.visualEffectKeys ?? [];
  return version === "fullart" ? (card.visualEffectKeysFull ?? normal) : normal;
}

/**
 * Points lumineux d'une version. Sans liste propre à la full art (carte fictive, vieux appel), la
 * full art reprend ceux de la normale.
 */
export function glowPointsFor(
  card: { glowPoints?: GlowPoint[]; glowPointsFull?: GlowPoint[] },
  version: CardLayout,
): GlowPoint[] {
  const normal = card.glowPoints ?? [];
  return version === "fullart" ? (card.glowPointsFull ?? normal) : normal;
}

/** Clé de l'illustration d'une version : la full art reprend celle de la normale sans la sienne. */
export function imageKeyFor(
  card: { imageKey: string | null; imageKeyFull?: string | null },
  version: CardLayout,
): string | null {
  return version === "fullart" ? (card.imageKeyFull ?? card.imageKey) : card.imageKey;
}

/**
 * Clé de la version réduite de l'illustration d'une version (celle de l'illustration que montre
 * `imageKeyFor`) ; null : pas de version réduite, la petite carte montre l'illustration elle-même.
 */
export function smallImageKeyFor(
  card: {
    imageKey: string | null;
    imageKeyFull?: string | null;
    imageKeySmall?: string | null;
    imageKeyFullSmall?: string | null;
  },
  version: CardLayout,
): string | null {
  const ownFull = version === "fullart" && !!card.imageKeyFull;
  return (ownFull ? card.imageKeyFullSmall : card.imageKeySmall) ?? null;
}

/** Types de lumière à placer sur l'illustration. */
export const GLOW_KINDS = ["glow", "sparks", "rays", "line"] as const;
export type GlowKind = (typeof GLOW_KINDS)[number];

/** Noms affichés : le type, puis ce que règlent sa taille et sa vitesse. */
export const GLOW_KIND_LABELS: Record<GlowKind, { name: string; size: string; speed: string }> = {
  glow: { name: "Point lumineux", size: "Taille", speed: "Clignotement" },
  sparks: { name: "Arc électrique", size: "Portée", speed: "Débit" },
  rays: { name: "Rayons", size: "Longueur", speed: "Rotation" },
  line: { name: "Trait lumineux", size: "Épaisseur", speed: "Clignotement" },
};

/**
 * Lumière posée sur l'illustration (des yeux qui brillent, une lame électrifiée…) : son type
 * (absent : point lumineux), sa position en % de l'image (accrochée à elle, elle suit le cadrage
 * et le zoom), pour un trait sa seconde extrémité (`x2`, `y2`), sa taille en % de la largeur de
 * l'image, sa couleur (#rrggbb) et sa vitesse (0 : immobile, 10 : le plus rapide).
 */
export type GlowPoint = {
  kind?: GlowKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  size: number;
  color: string;
  speed: number;
};

/** Type d'une lumière (les premiers points n'en ont pas : points lumineux). */
export const glowKind = (p: Pick<GlowPoint, "kind">): GlowKind => p.kind ?? "glow";

export const GLOW_LIMITS = {
  points: 12,
  size: { min: 1, max: 30, default: 6 },
  speed: { min: 0, max: 10 },
} as const;

/** Durée d'un clignotement (s) pour une vitesse ; 0 : fixe (null). */
export function glowPeriod(speed: number): number | null {
  return speed > 0 ? 6 / speed : null;
}

export type Card = {
  id: string;
  /** null : la carte attend dans la réserve (hors set, sans numéro). */
  setId: string | null;
  setCode: string | null;
  number: number | null;
  name: string;
  rarity: CardRarityId;
  type: string;
  family: string | null;
  cost: number;
  power: number;
  /** Coût et puissance saisis à la main ; sinon, ceux de la carte Snap de l'effet. */
  statsManual: boolean;
  effectKey: string | null;
  effectParams: EffectParams | null;
  effectText: string;
  flavor: string | null;
  /** Note de l'admin (« Doublon de … ») : jamais montrée aux joueurs, sans effet en jeu. */
  adminNote: string | null;
  /** Étape de préparation (réserve) : repère d'admin, gardé quand la carte change de place. */
  prepStage: CardPrepStage;
  imageKey: string | null;
  /** Illustration de la version full art ; null : celle de la normale (`imageKey`). */
  imageKeyFull: string | null;
  /** Versions réduites (`CARD_IMAGE_SIZES.small`) ; null : aucune, envoyée avant leur arrivée. */
  imageKeySmall: string | null;
  imageKeyFullSmall: string | null;
  imageFrame: ImageFrame | null;
  /** Cadrage en full art ; null : celui de la carte normale (voir `frameFor`). */
  imageFrameFull: ImageFrame | null;
  /** Mise en page choisie pour afficher la carte. */
  layout: CardLayout;
  /** Versions qui existent (au moins une), tirées et collectionnées séparément. */
  hasNormal: boolean;
  hasFullArt: boolean;
  /** Points lumineux de la version normale sur l'illustration (vide : aucun). */
  glowPoints: GlowPoint[];
  /** Points lumineux de la version full art, réglés à part de ceux de la normale. */
  glowPointsFull: GlowPoint[];
  ideaId: string | null;
  baseCardId: string | null;
  /** Carte dont celle-ci est le doublon (choisie au passage au « Doublon ») ; null : aucune. */
  duplicateOfId: string | null;
  /**
   * Effets visuels de la version normale (clés du catalogue `visual_effects`), dans l'ordre des
   * calques.
   */
  visualEffectKeys: string[];
  /** Effets visuels de la version full art, réglés à part de ceux de la normale. */
  visualEffectKeysFull: string[];
  /** Mise à la corbeille (hors set, hors des listes) ; null : carte active. */
  deletedAt: Date | null;
  updatedAt: Date;
};

/** Effet visuel du catalogue : la clé (même clé que son rendu dans le code) et son nom. */
export type VisualEffect = { key: string; name: string };
