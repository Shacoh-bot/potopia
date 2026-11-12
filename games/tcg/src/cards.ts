import { ForbiddenError, isAdmin } from "@app/core";
import { db, type DbTx, Prisma, withTx } from "@app/db";
import { deleteObject, headObject, presignPut } from "@app/storage";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  CARD_IMAGE_TYPES,
  CARD_LAYOUTS,
  CARD_LIMITS,
  CARD_RARITIES,
  FRAME_ZOOM,
  GLOW_KINDS,
  GLOW_LIMITS,
  type Card,
  type CardImageType,
  type CardLayout,
  type CardRarityId,
  type CardSet,
  type GlowPoint,
  type ImageFrame,
  type VisualEffect,
} from "./card-rules";
import { EFFECT_KEYS, type EffectParams, effectText, getEffect, paramsSchema } from "./effects";

/*
 * Cartes et sets : lus et modifiés par les admins seulement, pour l'instant. Une carte dans un set
 * a un numéro et ira en prod avec lui ; hors set, elle attend dans la réserve. Une variante full
 * art (`baseCardId`) reprend toujours les stats de sa carte de base : mana, puissance, type,
 * famille et effet. On ne les modifie que sur la carte de base, qui les recopie sur ses variantes.
 * Le lien avec une idée (`ideaId`) ne sert qu'à la gestion : une idée peut donner plusieurs cartes.
 */

export {
  CARD_IMAGE_TYPES,
  CARD_LAYOUT_LABELS,
  CARD_LAYOUTS,
  CARD_LIMITS,
  CARD_RARITIES,
  CARD_RARITY_LABELS,
  type Card,
  type CardLayout,
  type CardRarityId,
  type CardSet,
  DEFAULT_FRAME,
  FRAME_ZOOM,
  frameFor,
  GLOW_KIND_LABELS,
  GLOW_KINDS,
  GLOW_LIMITS,
  glowKind,
  glowPeriod,
  type GlowKind,
  type GlowPoint,
  type ImageFrame,
  type VisualEffect,
} from "./card-rules";

/** Utilisateur qui lit ou modifie : seuls les admins (ADMIN_DISCORD_IDS) y ont droit. */
type Admin = { discordId: string | null };

function assertAdmin(admin: Admin): void {
  if (!isAdmin(admin.discordId)) throw new ForbiddenError("Réservé aux admins.");
}

/** Erreur de saisie lisible (effet inconnu, réglage hors bornes, variante d'une variante…). */
export class CardInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardInputError";
  }
}

/** Champ texte facultatif : une chaîne vide (formulaire) vaut « absent ». */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères maximum.`)
    .nullish()
    .transform((v) => v || null);

const int = (label: string, min: number, max: number) =>
  z.coerce
    .number(`${label} : nombre attendu.`)
    .int(`${label} : nombre entier attendu.`)
    .min(min, `${label} : ${min} minimum.`)
    .max(max, `${label} : ${max} maximum.`);

/** Cadrage d'une illustration (`ImageFrame`). */
const frameSchema = z.object({
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  zoom: z.coerce
    .number()
    .min(FRAME_ZOOM.min, "Zoom trop petit.")
    .max(FRAME_ZOOM.max, "Zoom trop grand."),
});

/** Point lumineux (`GlowPoint`). */
const percent = z.coerce.number().min(0).max(100);
const glowPointSchema = z
  .object({
    kind: z.enum(GLOW_KINDS, "Lumière : type inconnu.").optional(),
    x: percent,
    y: percent,
    // Seconde extrémité d'un trait lumineux.
    x2: percent.optional(),
    y2: percent.optional(),
    size: z.coerce
      .number()
      .min(GLOW_LIMITS.size.min, "Lumière : trop petite.")
      .max(GLOW_LIMITS.size.max, "Lumière : trop grande."),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Lumière : couleur #rrggbb attendue."),
    speed: z.coerce.number().min(GLOW_LIMITS.speed.min).max(GLOW_LIMITS.speed.max),
  })
  .refine(
    (p) => p.kind !== "line" || (p.x2 !== undefined && p.y2 !== undefined),
    "Trait lumineux : seconde extrémité attendue.",
  );

const cardFields = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nom : à remplir.")
    .max(CARD_LIMITS.name, `Nom : ${CARD_LIMITS.name} caractères maximum.`),
  rarity: z.enum(CARD_RARITIES, "Rareté inconnue."),
  type: z
    .string()
    .trim()
    .min(1, "Type : à remplir.")
    .max(CARD_LIMITS.type, `Type : ${CARD_LIMITS.type} caractères maximum.`),
  family: optionalText(CARD_LIMITS.family, "Famille"),
  cost: int("Mana", CARD_LIMITS.cost.min, CARD_LIMITS.cost.max),
  power: int("Puissance", CARD_LIMITS.power.min, CARD_LIMITS.power.max),
  effectKey: z
    .string()
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v === null || (EFFECT_KEYS as string[]).includes(v), "Effet inconnu."),
  effectParams: z.record(z.string(), z.union([z.string(), z.number()])).nullish(),
  effectText: optionalText(CARD_LIMITS.effectText, "Texte de l'effet"),
  flavor: optionalText(CARD_LIMITS.flavor, "Description"),
  imageFrame: frameSchema.nullish().transform((v) => v ?? null),
  // Absent : le cadrage full art enregistré ne change pas (mise à jour en masse, anciens appels) ;
  // null : la full art reprend le cadrage de la carte normale.
  imageFrameFull: frameSchema.nullish(),
  // Points lumineux. Absent : ceux enregistrés ne changent pas ; liste vide : aucun.
  glowPoints: z
    .array(glowPointSchema, "Lumières : liste attendue.")
    .max(GLOW_LIMITS.points, `Lumières : ${GLOW_LIMITS.points} au plus.`)
    .optional(),
  // Mise en page affichée. Absent : celle enregistrée ne change pas ; à la création, normale (full
  // art pour une variante).
  layout: z.enum(CARD_LAYOUTS, "Mise en page inconnue.").optional(),
  // Effets visuels, dans l'ordre des calques (le premier en dessous). Absent : ceux enregistrés ne
  // changent pas ; liste vide : aucun. Les doublons sont retirés.
  visualEffectKeys: z
    .array(z.string().min(1).max(60), "Effets visuels : liste attendue.")
    .max(10, "Effets visuels : 10 au plus.")
    .optional()
    .transform((v) => (v === undefined ? undefined : [...new Set(v)])),
});

export type CardInput = z.input<typeof cardFields>;

/** Champs validés, effet compris : réglages contrôlés par le schéma de l'effet, texte proposé. */
function parseCard(input: CardInput) {
  const fields = cardFields.parse(input);
  const effect = fields.effectKey ? getEffect(fields.effectKey) : null;
  const params = effect ? paramsSchema(effect).parse(fields.effectParams ?? {}) : null;
  return {
    ...fields,
    effectParams: params,
    effectText: fields.effectText ?? effectText(fields.effectKey, params),
    // JSON null en base : Prisma attend DbNull.
    imageFrame: fields.imageFrame ?? Prisma.DbNull,
    // undefined : Prisma laisse la colonne telle quelle
    imageFrameFull:
      fields.imageFrameFull === undefined ? undefined : (fields.imageFrameFull ?? Prisma.DbNull),
  };
}

type CardRow = Omit<
  Card,
  | "setCode"
  | "effectParams"
  | "rarity"
  | "layout"
  | "glowPoints"
  | "imageFrame"
  | "imageFrameFull"
  | "visualEffectKeys"
> & {
  rarity: string;
  layout: string;
  glowPoints: unknown;
  visualEffects: { effectKey: string }[];
  effectParams: unknown;
  imageFrame: unknown;
  imageFrameFull: unknown;
  set: { code: string } | null;
};

function toCard(row: CardRow): Card {
  const { set, visualEffects, ...rest } = row;
  return {
    ...rest,
    visualEffectKeys: visualEffects.map((e) => e.effectKey),
    rarity: row.rarity as CardRarityId,
    layout: row.layout as CardLayout,
    glowPoints: (row.glowPoints as GlowPoint[] | null) ?? [],
    effectParams: (row.effectParams as EffectParams | null) ?? null,
    imageFrame: (row.imageFrame as ImageFrame | null) ?? null,
    imageFrameFull: (row.imageFrameFull as ImageFrame | null) ?? null,
    setCode: set?.code ?? null,
  };
}

/** Ce qu'il faut lire avec une carte : le code de son set et ses effets visuels, dans l'ordre. */
const withSet = {
  set: { select: { code: true } },
  visualEffects: { select: { effectKey: true }, orderBy: { position: "asc" } },
} as const;

/** Refuse un effet visuel absent du catalogue (message clair plutôt qu'une erreur de clé). */
async function checkVisualEffects(tx: DbTx, keys: string[] | undefined): Promise<void> {
  if (!keys?.length) return;
  const found = await tx.tcgVisualEffect.findMany({
    where: { key: { in: keys } },
    select: { key: true },
  });
  const missing = keys.filter((k) => !found.some((f) => f.key === k));
  if (missing.length) throw new CardInputError(`Effet visuel inconnu : ${missing.join(", ")}.`);
}

/** Effets visuels à créer, dans l'ordre des calques. */
const effectRows = (keys: string[]) => ({
  create: keys.map((effectKey, position) => ({ effectKey, position })),
});

/** Remplace les effets visuels d'une carte ; `undefined` : on n'y touche pas. */
const replaceEffects = (keys: string[] | undefined) =>
  keys === undefined ? undefined : { deleteMany: {}, ...effectRows(keys) };

/** Le catalogue des effets visuels, par nom (ordre alphabétique français). */
export async function listVisualEffects(admin: Admin): Promise<VisualEffect[]> {
  assertAdmin(admin);
  const effects = await db.tcgVisualEffect.findMany({ select: { key: true, name: true } });
  // Tri français (la base classerait « Éclair » après « Reflet »).
  return effects.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

type Stats = {
  type: string;
  family: string | null;
  cost: number;
  power: number;
  effectKey: string | null;
  effectParams: unknown;
  effectText: string;
};

/** Stats qu'une variante reprend de sa carte de base (réglages vides = JSON null en base). */
function shared(card: Stats) {
  return {
    type: card.type,
    family: card.family,
    cost: card.cost,
    power: card.power,
    effectKey: card.effectKey,
    effectParams: (card.effectParams ?? Prisma.DbNull) as
      Prisma.InputJsonValue | typeof Prisma.DbNull,
    effectText: card.effectText,
  };
}

/** Les sets, du plus ancien au plus récent. */
export async function listSets(admin: Admin): Promise<CardSet[]> {
  assertAdmin(admin);
  return db.tcgSet.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true, name: true },
  });
}

const setInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{1,12}$/, "Code du set : 1 à 12 lettres majuscules, chiffres ou tirets."),
  name: z.string().trim().min(1, "Nom du set : à remplir.").max(60),
});

/** Crée un set ; refuse un code déjà pris. */
export async function createSet(
  admin: Admin,
  input: z.input<typeof setInput>,
  opts?: { tx?: DbTx },
): Promise<CardSet> {
  assertAdmin(admin);
  const { code, name } = setInput.parse(input);
  const client = opts?.tx ?? db;
  if (await client.tcgSet.findUnique({ where: { code } })) {
    throw new CardInputError(`Le set ${code} existe déjà.`);
  }
  return client.tcgSet.create({
    data: { code, name },
    select: { id: true, code: true, name: true },
  });
}

/** Crée le set s'il n'existe pas (par son code), et le renvoie. */
export async function ensureSet(
  admin: Admin,
  input: z.input<typeof setInput>,
  opts?: { tx?: DbTx },
): Promise<CardSet> {
  assertAdmin(admin);
  const { code, name } = setInput.parse(input);
  return (opts?.tx ?? db).tcgSet.upsert({
    where: { code },
    create: { code, name },
    update: {},
    select: { id: true, code: true, name: true },
  });
}

/**
 * Les cartes d'un set (`setId`), de la réserve (`setId: null`) ou de tous, par set puis par numéro
 * (la réserve par ordre de création). `ideaId` : les cartes tirées d'une idée. Les cartes à la
 * corbeille n'y sont jamais, sauf avec `trashed: true` qui ne liste qu'elles.
 */
export async function listCards(
  admin: Admin,
  filters: { setId?: string | null; ideaId?: string; trashed?: boolean } = {},
): Promise<Card[]> {
  assertAdmin(admin);
  const rows = await db.tcgCard.findMany({
    where: {
      setId: filters.setId,
      ideaId: filters.ideaId,
      deletedAt: filters.trashed ? { not: null } : null,
    },
    orderBy: [{ set: { createdAt: "asc" } }, { number: "asc" }, { createdAt: "asc" }],
    include: withSet,
  });
  return rows.map(toCard);
}

export async function getCard(admin: Admin, id: string): Promise<Card | null> {
  assertAdmin(admin);
  const row = await db.tcgCard.findUnique({ where: { id }, include: withSet });
  return row ? toCard(row) : null;
}

/** Prochain numéro libre d'un set (verrouillé par la transaction appelante). */
async function nextNumber(tx: DbTx, setId: string): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tcg-set-${setId}`}))`;
  const last = await tx.tcgCard.aggregate({ where: { setId }, _max: { number: true } });
  return (last._max.number ?? 0) + 1;
}

const createInput = z.object({
  // Vide : la carte va dans la réserve.
  setId: z
    .string()
    .nullish()
    .transform((v) => v || null),
  ideaId: z.string().min(1).nullish(),
  baseCardId: z.string().min(1).nullish(),
});

/**
 * Crée une carte, à la fin de son set ou dans la réserve. Une variante (`baseCardId`) prend les
 * stats de sa carte de base, quelles que soient celles envoyées.
 */
export async function createCard(
  admin: Admin,
  input: CardInput & z.input<typeof createInput>,
  opts?: { tx?: DbTx },
): Promise<Card> {
  assertAdmin(admin);
  const { setId, ideaId, baseCardId } = createInput.parse(input);
  const { visualEffectKeys, ...fields } = parseCard(input);
  return withTx(async (tx) => {
    const base = baseCardId ? await tx.tcgCard.findUnique({ where: { id: baseCardId } }) : null;
    if (baseCardId && !base) throw new CardInputError("Carte de base introuvable.");
    if (base?.baseCardId) throw new CardInputError("Une variante ne peut pas avoir de variante.");
    if (base?.deletedAt) throw new CardInputError("Carte de base à la corbeille.");
    await checkVisualEffects(tx, visualEffectKeys);
    const number = setId ? await nextNumber(tx, setId) : null;
    const row = await tx.tcgCard.create({
      data: {
        ...fields,
        ...shared(base ?? fields),
        layout: fields.layout ?? (base ? "fullart" : "normal"),
        setId,
        number,
        ideaId: ideaId ?? null,
        baseCardId: base?.id ?? null,
        visualEffects: effectRows(visualEffectKeys ?? []),
      },
      include: withSet,
    });
    return toCard(row);
  }, opts);
}

/**
 * Modifie une carte. Sur une variante, seuls le nom, la rareté et la description changent ; sur une
 * carte de base, les stats sont recopiées sur ses variantes. Les parties en cours n'en voient
 * rien : elles ont figé les decks à leur début.
 */
export async function updateCard(
  admin: Admin,
  id: string,
  input: CardInput,
  opts?: { tx?: DbTx },
): Promise<Card> {
  assertAdmin(admin);
  const { visualEffectKeys, ...fields } = parseCard(input);
  return withTx(async (tx) => {
    const current = await tx.tcgCard.findUnique({ where: { id } });
    if (!current) throw new CardInputError("Carte introuvable.");
    await checkVisualEffects(tx, visualEffectKeys);
    if (current.baseCardId) {
      const row = await tx.tcgCard.update({
        where: { id },
        data: {
          name: fields.name,
          rarity: fields.rarity,
          flavor: fields.flavor,
          imageFrame: fields.imageFrame,
          imageFrameFull: fields.imageFrameFull,
          layout: fields.layout,
          glowPoints: fields.glowPoints,
          visualEffects: replaceEffects(visualEffectKeys),
        },
        include: withSet,
      });
      return toCard(row);
    }
    const stats = shared(fields);
    const row = await tx.tcgCard.update({
      where: { id },
      data: {
        ...stats,
        name: fields.name,
        rarity: fields.rarity,
        flavor: fields.flavor,
        imageFrame: fields.imageFrame,
        imageFrameFull: fields.imageFrameFull,
        layout: fields.layout,
        glowPoints: fields.glowPoints,
        visualEffects: replaceEffects(visualEffectKeys),
      },
      include: withSet,
    });
    await tx.tcgCard.updateMany({ where: { baseCardId: id }, data: stats });
    return toCard(row);
  }, opts);
}

/** Ids de cartes choisies, sans doublon. */
const idsInput = z.array(z.string().min(1)).min(1, "Aucune carte choisie.");

/** Les cartes choisies, toutes trouvées. */
async function findCards(tx: DbTx, ids: string[]) {
  const cards = await tx.tcgCard.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, setId: true, baseCardId: true, deletedAt: true },
  });
  if (cards.length !== ids.length) throw new CardInputError("Carte introuvable.");
  return cards;
}

/**
 * Sort des cartes de leur set (elles passent hors set, sans numéro) et renumérote les sets
 * quittés de 1 à N.
 */
async function leaveSets(tx: DbTx, cards: { id: string; setId: string | null }[]): Promise<void> {
  const leaving = cards.filter((c) => c.setId);
  const leftSets = [...new Set(leaving.map((c) => c.setId as string))];
  for (const left of leftSets)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tcg-set-${left}`}))`;
  await tx.tcgCard.updateMany({
    where: { id: { in: leaving.map((c) => c.id) } },
    data: { setId: null, number: null },
  });
  for (const left of leftSets) await renumber(tx, left);
}

/**
 * Range des cartes dans un set (à la suite, dans l'ordre donné) ou dans la réserve (`setId: null`).
 * Les cartes qui quittent un set laissent un trou : les suivantes sont renumérotées pour que le set
 * reste numéroté de 1 à N. Une carte déjà au bon endroit est laissée telle quelle. Une carte de la
 * corbeille qu'on range en sort (restaurée) ; une variante seulement si sa carte de base n'y est
 * plus, ou en sort avec elle.
 */
export async function moveCards(
  admin: Admin,
  ids: string[],
  setId: string | null,
  opts?: { tx?: DbTx },
): Promise<{ moved: number }> {
  assertAdmin(admin);
  const unique = [...new Set(idsInput.parse(ids))];
  return withTx(async (tx) => {
    if (setId && !(await tx.tcgSet.findUnique({ where: { id: setId } }))) {
      throw new CardInputError("Set introuvable.");
    }
    const cards = await findCards(tx, unique);
    const baseIds = cards.flatMap((c) =>
      c.deletedAt && c.baseCardId && !unique.includes(c.baseCardId) ? [c.baseCardId] : [],
    );
    const trashedBase = await tx.tcgCard.findFirst({
      where: { id: { in: baseIds }, deletedAt: { not: null } },
      select: { name: true },
    });
    if (trashedBase) {
      throw new CardInputError(
        `${trashedBase.name} est à la corbeille : restaure-la avec ses variantes.`,
      );
    }
    // Ordre demandé ; une carte de la corbeille bouge toujours (elle en sort).
    const moving = unique.flatMap((id) => {
      const card = cards.find((c) => c.id === id);
      return card && (card.deletedAt || card.setId !== setId) ? [card] : [];
    });
    await leaveSets(tx, moving);
    await tx.tcgCard.updateMany({
      where: { id: { in: moving.map((c) => c.id) }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (setId) {
      let number = await nextNumber(tx, setId);
      for (const { id } of moving) {
        await tx.tcgCard.update({ where: { id }, data: { setId, number: number++ } });
      }
    }
    return { moved: moving.length };
  }, opts);
}

/**
 * Met des cartes à la corbeille (doublons, essais…) : elles sortent de leur set (renuméroté) et
 * des listes, mais restent en base ; `moveCards` les en sort. Une carte de base n'y va qu'avec
 * ses variantes. Une carte déjà à la corbeille est laissée telle quelle.
 */
export async function trashCards(
  admin: Admin,
  ids: string[],
  opts?: { tx?: DbTx },
): Promise<{ trashed: number }> {
  assertAdmin(admin);
  const unique = [...new Set(idsInput.parse(ids))];
  return withTx(async (tx) => {
    const fresh = (await findCards(tx, unique)).filter((c) => !c.deletedAt);
    const left = await tx.tcgCard.findFirst({
      where: {
        baseCardId: { in: fresh.map((c) => c.id) },
        id: { notIn: unique },
        deletedAt: null,
      },
      select: { name: true },
    });
    if (left) {
      throw new CardInputError(
        `${left.name} est une variante d'une carte choisie : mets-la aussi à la corbeille.`,
      );
    }
    await leaveSets(tx, fresh);
    await tx.tcgCard.updateMany({
      where: { id: { in: fresh.map((c) => c.id) } },
      data: { deletedAt: new Date() },
    });
    return { trashed: fresh.length };
  }, opts);
}

/**
 * Supprime pour de bon des cartes de la corbeille (et leurs effets visuels). Une carte de base ne
 * part qu'avec ses variantes. Les illustrations sont retirées du stockage après la transaction,
 * sans bloquer si l'une échoue (dans une transaction appelante : c'est à elle de le faire, avec les
 * clés renvoyées).
 */
export async function deleteCards(
  admin: Admin,
  ids: string[],
  opts?: { tx?: DbTx },
): Promise<{ deleted: number; imageKeys: string[] }> {
  assertAdmin(admin);
  const unique = [...new Set(idsInput.parse(ids))];
  const result = await withTx(async (tx) => {
    const cards = await findCards(tx, unique);
    const active = cards.find((c) => !c.deletedAt);
    if (active) {
      throw new CardInputError(
        `${active.name} n'est pas à la corbeille : seules ses cartes se suppriment.`,
      );
    }
    const left = await tx.tcgCard.findFirst({
      where: { baseCardId: { in: unique }, id: { notIn: unique } },
      select: { name: true },
    });
    if (left) {
      throw new CardInputError(
        `${left.name} est une variante d'une carte choisie : supprime-la avec elle.`,
      );
    }
    const keys = await tx.tcgCard.findMany({
      where: { id: { in: unique }, imageKey: { not: null } },
      select: { imageKey: true },
    });
    const { count } = await tx.tcgCard.deleteMany({ where: { id: { in: unique } } });
    return { deleted: count, imageKeys: keys.map((k) => k.imageKey as string) };
  }, opts);
  if (!opts?.tx) await Promise.allSettled(result.imageKeys.map((key) => deleteObject(key)));
  return result;
}

/** Renumérote un set de 1 à N, dans l'ordre actuel (en deux temps, pour l'unicité set + numéro). */
async function renumber(tx: DbTx, setId: string): Promise<void> {
  const cards = await tx.tcgCard.findMany({
    where: { setId },
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });
  const changed = cards.filter((c, i) => c.number !== i + 1);
  for (const c of changed) {
    await tx.tcgCard.update({ where: { id: c.id }, data: { number: -(c.number ?? 0) - 1 } });
  }
  for (const c of changed) {
    await tx.tcgCard.update({ where: { id: c.id }, data: { number: cards.indexOf(c) + 1 } });
  }
}

const uploadInput = z.object({
  contentType: z.enum(
    Object.keys(CARD_IMAGE_TYPES) as [CardImageType, ...CardImageType[]],
    "Format d'image refusé : WebP uniquement.",
  ),
  size: z
    .number()
    .int()
    .positive("Image vide.")
    .max(CARD_LIMITS.imageBytes, "Image trop lourde (5 Mo maximum)."),
});

/** URL d'envoi présignée (5 min) pour l'illustration d'une carte ; la clé est générée ici. */
export async function createCardImageUpload(
  admin: Admin,
  input: { contentType: string; size: number },
): Promise<{ key: string; url: string }> {
  assertAdmin(admin);
  const { contentType, size } = uploadInput.parse(input);
  const key = `cards/${randomUUID()}.${CARD_IMAGE_TYPES[contentType]}`;
  const url = await presignPut({ key, contentType, contentLength: size, expiresIn: 300 });
  return { key, url };
}

const imageKey = z.string().regex(/^cards\/[0-9a-f-]{36}\.webp$/, "Clé d'image invalide.");

/** Pose l'illustration envoyée (vérifiée dans le stockage) sur la carte. */
export async function setCardImage(
  admin: Admin,
  id: string,
  key: string,
  opts?: { tx?: DbTx },
): Promise<Card> {
  assertAdmin(admin);
  const checked = imageKey.parse(key);
  const info = await headObject(checked);
  if (!info) throw new CardInputError("Image introuvable : l'envoi a échoué.");
  if (info.contentLength > CARD_LIMITS.imageBytes) {
    throw new CardInputError("Image trop lourde (5 Mo maximum).");
  }
  const row = await (opts?.tx ?? db).tcgCard.update({
    where: { id },
    data: { imageKey: checked },
    include: withSet,
  });
  return toCard(row);
}

/* ── Import en masse (cartes générées à partir des idées) ── */

const importInput = z.object({
  set: setInput.nullish(),
  // Chaque carte est validée à part, pour nommer la fautive dans le message.
  cards: z
    .array(z.looseObject({ name: z.string().optional(), ideaId: z.string().min(1).nullish() }))
    .min(1, "Aucune carte à importer.")
    .max(500, "500 cartes maximum par import."),
});

export type CardImport = {
  /** Sans set, les cartes vont dans la réserve. */
  set?: z.input<typeof setInput> | null;
  cards: (CardInput & { ideaId?: string | null })[];
};

/**
 * Importe des cartes dans un set (créé au besoin), à la suite des cartes existantes, ou dans la
 * réserve si le fichier ne donne pas de set. Une carte dont l'idée a déjà une carte est ignorée :
 * réimporter le même fichier ne crée pas de doublon et ne touche pas aux cartes déjà modifiées
 * dans l'admin. Tout ou rien.
 */
export async function importCards(
  admin: Admin,
  input: CardImport,
  opts?: { tx?: DbTx },
): Promise<{ created: number; skipped: number }> {
  assertAdmin(admin);
  const { set, cards } = importInput.parse(input);
  const parsed = cards.map((card, i) => {
    try {
      return { ...parseCard(card as CardInput), ideaId: card.ideaId ?? null };
    } catch (error) {
      const detail = error instanceof z.ZodError ? error.issues[0]?.message : String(error);
      throw new CardInputError(`Carte ${i + 1} (${card.name}) : ${detail}`);
    }
  });
  return withTx(async (tx) => {
    const setId = set ? (await ensureSet(admin, set, { tx })).id : null;
    const ideaIds = parsed.flatMap((c) => (c.ideaId ? [c.ideaId] : []));
    const existing = new Set(
      (
        await tx.tcgCard.findMany({
          where: { ideaId: { in: ideaIds } },
          select: { ideaId: true },
        })
      ).map((c) => c.ideaId),
    );
    const fresh = parsed.filter((c) => !c.ideaId || !existing.has(c.ideaId));
    await checkVisualEffects(tx, [...new Set(fresh.flatMap((c) => c.visualEffectKeys ?? []))]);
    let number = setId ? await nextNumber(tx, setId) : null;
    for (const { visualEffectKeys, ...card } of fresh) {
      await tx.tcgCard.create({
        data: {
          ...card,
          ...shared(card),
          setId,
          number: number === null ? null : number++,
          visualEffects: effectRows(visualEffectKeys ?? []),
        },
      });
    }
    return { created: fresh.length, skipped: parsed.length - fresh.length };
  }, opts);
}

/* ── Mise à jour en masse (coût, puissance, effet) ── */

const updatesInput = z.object({
  updates: z
    .array(z.looseObject({ ideaId: z.string().min(1), name: z.string().optional() }))
    .min(1, "Aucune carte à mettre à jour.")
    .max(500, "500 cartes maximum par mise à jour."),
});

type CardUpdate = { ideaId: string; name?: string } & Partial<
  Pick<CardInput, "cost" | "power" | "effectKey" | "effectParams" | "effectText">
>;

export type CardUpdates = { updates: CardUpdate[] };

/**
 * Change le coût, la puissance et l'effet de cartes existantes, retrouvées par leur idée (et par leur
 * nom quand l'idée a plusieurs cartes). Le reste est gardé : nom, illustration, cadrage, set et
 * numéro. Un nouvel effet sans texte prend le texte proposé par le catalogue. Les variantes suivent
 * leur carte de base. Tout ou rien.
 */
export async function updateCards(
  admin: Admin,
  input: CardUpdates,
  opts?: { tx?: DbTx },
): Promise<{ updated: number }> {
  assertAdmin(admin);
  const updates = updatesInput.parse(input).updates as CardUpdate[];
  return withTx(async (tx) => {
    const rows = await tx.tcgCard.findMany({
      where: { ideaId: { in: updates.map((u) => u.ideaId) }, baseCardId: null, deletedAt: null },
      include: withSet,
    });
    for (const [i, update] of updates.entries()) {
      const label = `Carte ${i + 1} (${update.name ?? update.ideaId})`;
      const ofIdea = rows.filter((r) => r.ideaId === update.ideaId);
      // Plusieurs cartes pour l'idée : le nom départage.
      const matches =
        ofIdea.length > 1 && update.name !== undefined
          ? ofIdea.filter((r) => r.name === update.name)
          : ofIdea;
      const [row] = matches;
      if (!row || matches.length > 1) {
        throw new CardInputError(
          `${label} : ${row ? "plusieurs cartes possibles, précise son nom" : "aucune carte pour cette idée"}.`,
        );
      }
      const card = toCard(row);
      const newEffect = update.effectKey !== undefined;
      try {
        await updateCard(
          admin,
          card.id,
          {
            name: card.name,
            rarity: card.rarity,
            type: card.type,
            family: card.family,
            flavor: card.flavor,
            imageFrame: card.imageFrame,
            cost: update.cost ?? card.cost,
            power: update.power ?? card.power,
            effectKey: newEffect ? update.effectKey : card.effectKey,
            effectParams: newEffect ? update.effectParams : card.effectParams,
            effectText: update.effectText ?? (newEffect ? null : card.effectText),
          },
          { tx },
        );
      } catch (error) {
        if (!(error instanceof z.ZodError)) throw error;
        throw new CardInputError(`${label} : ${error.issues[0]?.message}`);
      }
    }
    return { updated: updates.length };
  }, opts);
}
