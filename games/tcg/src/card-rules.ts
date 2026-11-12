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
  // Jusqu'à 8, comme Skaar (7) et Death (8) dans Snap : des cartes qui coûtent moins en main.
  cost: { min: 0, max: 8 },
  power: { min: -20, max: 30 },
  imageBytes: 5 * 1024 * 1024,
} as const;

/** Illustrations de cartes : WebP uniquement (l'interface convertit avant l'envoi). */
export const CARD_IMAGE_TYPES = {
  "image/webp": "webp",
} as const;
export type CardImageType = keyof typeof CARD_IMAGE_TYPES;

export type CardSet = { id: string; code: string; name: string };

/**
 * Cadrage d'une illustration : le point de l'image placé au centre de la fenêtre (en % de la
 * largeur et de la hauteur) et le zoom (1 = l'image remplit juste la fenêtre). Le fichier n'est
 * jamais rogné : on peut recadrer à tout moment.
 */
export type ImageFrame = { x: number; y: number; zoom: number };

export const DEFAULT_FRAME: ImageFrame = { x: 50, y: 50, zoom: 1 };
export const FRAME_ZOOM = { min: 1, max: 4 } as const;

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
 * carte normale.
 */
export function frameFor(
  card: { imageFrame?: ImageFrame | null; imageFrameFull?: ImageFrame | null },
  layout: CardLayout,
): ImageFrame | null {
  const normal = card.imageFrame ?? null;
  return layout === "fullart" ? (card.imageFrameFull ?? normal) : normal;
}

/**
 * Point lumineux posé sur l'illustration (des yeux qui brillent…) : position en % de l'image
 * (accroché à elle, il suit le cadrage et le zoom), taille du halo en % de la largeur de l'image,
 * couleur (#rrggbb) et vitesse de clignotement (0 : fixe, 10 : le plus rapide).
 */
export type GlowPoint = { x: number; y: number; size: number; color: string; speed: number };

export const GLOW_LIMITS = {
  points: 8,
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
  effectKey: string | null;
  effectParams: EffectParams | null;
  effectText: string;
  flavor: string | null;
  imageKey: string | null;
  imageFrame: ImageFrame | null;
  /** Cadrage en full art ; null : celui de la carte normale (voir `frameFor`). */
  imageFrameFull: ImageFrame | null;
  /** Mise en page choisie pour afficher la carte. */
  layout: CardLayout;
  /** Points lumineux sur l'illustration (vide : aucun). */
  glowPoints: GlowPoint[];
  ideaId: string | null;
  baseCardId: string | null;
  /** Effets visuels (clés du catalogue `visual_effects`), dans l'ordre des calques. */
  visualEffectKeys: string[];
  /** Mise à la corbeille (hors set, hors des listes) ; null : carte active. */
  deletedAt: Date | null;
  updatedAt: Date;
};

/** Effet visuel du catalogue : la clé (même clé que son rendu dans le code) et son nom. */
export type VisualEffect = { key: string; name: string };
