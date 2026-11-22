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
  ideaStateOf,
  type ImageFrame,
  type VisualEffect,
  CARD_PREP_STAGES,
  type CardPrepStage,
  markDuplicateNote,
  unmarkDuplicateNote,
} from "./card-rules";
import {
  EFFECT_KEYS,
  type EffectParams,
  effectStats,
  effectText,
  getEffect,
  paramsSchema,
} from "./effects";

/*
 * Cartes et sets : lus et modifiés par les admins seulement, pour l'instant. Une carte dans un set
 * a un numéro et ira en prod avec lui ; hors set, elle attend dans la réserve. Une variante full
 * art (`baseCardId`) reprend toujours les stats de sa carte de base : mana, puissance, type,
 * famille et effet. On ne les modifie que sur la carte de base, qui les recopie sur ses variantes.
 * Le lien avec une idée (`ideaId`) ne sert qu'à la gestion : une idée peut donner plusieurs cartes.
 */

export {
  CARD_IMAGE_SIZES,
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
  fitZoom,
  frameFor,
  GLOW_KIND_LABELS,
  GLOW_KINDS,
  GLOW_LIMITS,
  glowKind,
  glowPeriod,
  type GlowKind,
  type GlowPoint,
  ideaStateOf,
  type ImageFrame,
  isDuplicateNote,
  markDuplicateNote,
  unmarkDuplicateNote,
  type VisualEffect,
} from "./card-rules";

/** Utilisateur qui lit ou modifie : seuls les admins (ADMIN_DISCORD_IDS) y ont droit. */
export type Admin = { discordId: string | null };

export function assertAdmin(admin: Admin): void {
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

/** Cadrage d'une illustration (`ImageFrame`), zoom à partir de `minZoom`. */
const frameSchemaFrom = (minZoom: number) =>
  z.object({
    x: z.coerce.number().min(0).max(100),
    y: z.coerce.number().min(0).max(100),
    zoom: z.coerce
      .number()
      .min(minZoom, "Zoom trop petit.")
      .max(FRAME_ZOOM.max, "Zoom trop grand."),
  });
// Carte normale : dézoom permis (image entière) ; full art : jamais sous `fullMin`.
const frameSchema = frameSchemaFrom(FRAME_ZOOM.min);
const frameSchemaFull = frameSchemaFrom(FRAME_ZOOM.fullMin);

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

/** Liste d'effets visuels d'une version : clés du catalogue, 10 au plus, doublons retirés. */
const effectKeysField = (label: string) =>
  z
    .array(z.string().min(1).max(60), `${label} : liste attendue.`)
    .max(10, `${label} : 10 au plus.`)
    .optional()
    .transform((v) => (v === undefined ? undefined : [...new Set(v)]));

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
  // Stats saisies à la main. Absent : à la création non ; à la modification, l'état enregistré.
  statsManual: z.boolean("Stats manuelles : oui ou non.").optional(),
  effectKey: z
    .string()
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v === null || (EFFECT_KEYS as string[]).includes(v), "Effet inconnu."),
  effectParams: z.record(z.string(), z.union([z.string(), z.number()])).nullish(),
  effectText: optionalText(CARD_LIMITS.effectText, "Texte de l'effet"),
  flavor: optionalText(CARD_LIMITS.flavor, "Description"),
  // Note de l'admin. Absente : celle enregistrée ne change pas ; vide : plus de note.
  adminNote: z
    .string()
    .trim()
    .max(CARD_LIMITS.adminNote, `Note : ${CARD_LIMITS.adminNote} caractères maximum.`)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
  imageFrame: frameSchema.nullish().transform((v) => v ?? null),
  // Absent : le cadrage full art enregistré ne change pas (mise à jour en masse, anciens appels) ;
  // null : la full art reprend le cadrage de la carte normale.
  imageFrameFull: frameSchemaFull.nullish(),
  // Points lumineux. Absent : ceux enregistrés ne changent pas ; liste vide : aucun.
  glowPoints: z
    .array(glowPointSchema, "Lumières : liste attendue.")
    .max(GLOW_LIMITS.points, `Lumières : ${GLOW_LIMITS.points} au plus.`)
    .optional(),
  // Points lumineux de la full art, réglés à part de la normale. Absent : ceux enregistrés ne
  // changent pas (à la création : une copie de ceux de la normale) ; liste vide : aucun.
  glowPointsFull: z
    .array(glowPointSchema, "Lumières (full art) : liste attendue.")
    .max(GLOW_LIMITS.points, `Lumières (full art) : ${GLOW_LIMITS.points} au plus.`)
    .optional(),
  // Mise en page affichée. Absent : celle enregistrée ne change pas ; à la création, normale (full
  // art pour une variante).
  layout: z.enum(CARD_LAYOUTS, "Mise en page inconnue.").optional(),
  // Versions actives. Absentes : celles enregistrées ; à la création, celle de la mise en page.
  hasNormal: z.boolean("Version normale : oui ou non.").optional(),
  hasFullArt: z.boolean("Version full art : oui ou non.").optional(),
  // Effets visuels de la version normale, dans l'ordre des calques (le premier en dessous).
  // Absent : ceux enregistrés ne changent pas (à la création : aucun) ; liste vide : aucun. Les
  // doublons sont retirés.
  visualEffectKeys: effectKeysField("Effets visuels"),
  // Effets visuels de la version full art, réglés à part de la normale. Absent : ceux enregistrés
  // ne changent pas (à la création : une copie de ceux de la normale).
  visualEffectKeysFull: effectKeysField("Effets visuels (full art)"),
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

/**
 * Coût et puissance à enregistrer : ceux de la carte Snap de l'effet (`effectStats`), sauf stats
 * manuelles ou sans effet, où ceux saisis restent.
 */
function followEffect<T extends { cost: number; power: number; effectKey: string | null }>(
  fields: T,
  manual: boolean,
): T & { statsManual: boolean } {
  const stats = manual ? null : effectStats(fields.effectKey);
  return { ...fields, ...stats, statsManual: manual };
}

/**
 * Versions actives et mise en page montrée par défaut : celles envoyées, sinon celles enregistrées
 * (`current`), sinon la version de la mise en page. Une mise en page envoyée seule active sa
 * version. Au moins une version ; la mise en page montrée est toujours une version active.
 */
function resolveVersions(
  fields: { layout?: CardLayout; hasNormal?: boolean; hasFullArt?: boolean },
  current: { layout: CardLayout; hasNormal: boolean; hasFullArt: boolean } | null,
  fallbackLayout: CardLayout,
): { layout: CardLayout; hasNormal: boolean; hasFullArt: boolean } {
  const layout = fields.layout ?? current?.layout ?? fallbackLayout;
  const asked = (v: CardLayout) => fields.layout === v || (!current && layout === v);
  const hasNormal = fields.hasNormal ?? ((current?.hasNormal ?? false) || asked("normal"));
  const hasFullArt = fields.hasFullArt ?? ((current?.hasFullArt ?? false) || asked("fullart"));
  if (!hasNormal && !hasFullArt) {
    throw new CardInputError("Une carte garde au moins une version : normale ou full art.");
  }
  const shown = layout === "fullart" ? hasFullArt : hasNormal;
  return { hasNormal, hasFullArt, layout: shown ? layout : hasNormal ? "normal" : "fullart" };
}

type CardRow = Omit<
  Card,
  | "setCode"
  | "effectParams"
  | "rarity"
  | "layout"
  | "glowPoints"
  | "glowPointsFull"
  | "imageFrame"
  | "imageFrameFull"
  | "visualEffectKeys"
  | "visualEffectKeysFull"
  | "prepStage"
> & {
  rarity: string;
  prepStage: string;
  layout: string;
  glowPoints: unknown;
  glowPointsFull: unknown;
  visualEffects: { effectKey: string; version: string }[];
  effectParams: unknown;
  imageFrame: unknown;
  imageFrameFull: unknown;
  set: { code: string } | null;
};

export function toCard(row: CardRow): Card {
  const { set, visualEffects, ...rest } = row;
  return {
    ...rest,
    visualEffectKeys: visualEffects.filter((e) => e.version === "normal").map((e) => e.effectKey),
    visualEffectKeysFull: visualEffects
      .filter((e) => e.version === "fullart")
      .map((e) => e.effectKey),
    rarity: row.rarity as CardRarityId,
    layout: row.layout as CardLayout,
    prepStage: row.prepStage as CardPrepStage,
    glowPoints: (row.glowPoints as GlowPoint[] | null) ?? [],
    glowPointsFull: (row.glowPointsFull as GlowPoint[] | null) ?? [],
    effectParams: (row.effectParams as EffectParams | null) ?? null,
    imageFrame: (row.imageFrame as ImageFrame | null) ?? null,
    imageFrameFull: (row.imageFrameFull as ImageFrame | null) ?? null,
    setCode: set?.code ?? null,
  };
}

/** Ce qu'il faut lire avec une carte : le code de son set et ses effets visuels, dans l'ordre. */
export const withSet = {
  set: { select: { code: true } },
  visualEffects: { select: { effectKey: true, version: true }, orderBy: { position: "asc" } },
} as const;

/** Refuse un effet visuel absent du catalogue (message clair plutôt qu'une erreur de clé). */
async function checkVisualEffects(tx: DbTx, ...lists: (string[] | undefined)[]): Promise<void> {
  const keys = [...new Set(lists.flatMap((l) => l ?? []))];
  if (!keys.length) return;
  const found = await tx.tcgVisualEffect.findMany({
    where: { key: { in: keys } },
    select: { key: true },
  });
  const missing = keys.filter((k) => !found.some((f) => f.key === k));
  if (missing.length) throw new CardInputError(`Effet visuel inconnu : ${missing.join(", ")}.`);
}

/** Lignes d'effets visuels d'une version, dans l'ordre des calques. */
const versionRows = (keys: string[], version: CardLayout) =>
  keys.map((effectKey, position) => ({ effectKey, position, version }));

/**
 * Effets visuels d'une carte neuve, une liste par version ; la full art absente reprend une copie
 * de ceux de la normale (ensuite, chacune se règle à part).
 */
const effectRows = (normal: string[] | undefined, full: string[] | undefined) => ({
  create: [...versionRows(normal ?? [], "normal"), ...versionRows(full ?? normal ?? [], "fullart")],
});

/**
 * Remplace les effets visuels d'une carte, version par version ; une liste `undefined` : on ne
 * touche pas à cette version ; les deux : on n'écrit rien.
 */
function replaceEffects(normal: string[] | undefined, full: string[] | undefined) {
  const lists = [
    ["normal", normal],
    ["fullart", full],
  ] as const;
  const changed = lists.filter((l): l is readonly [CardLayout, string[]] => l[1] !== undefined);
  if (!changed.length) return undefined;
  return {
    deleteMany: changed.map(([version]) => ({ version })),
    create: changed.flatMap(([version, keys]) => versionRows(keys, version)),
  };
}

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
  statsManual: boolean;
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
    statsManual: card.statsManual,
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

/**
 * Nombre de cartes de chacun de ces sets, par id de set : le « 44 » de « 07/44 ». Une carte à la
 * corbeille n'est dans aucun set. Un set sans carte : 0.
 */
export async function countSetCards(admin: Admin, setIds: string[]): Promise<Map<string, number>> {
  assertAdmin(admin);
  const ids = [...new Set(setIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.tcgCard.groupBy({
    by: ["setId"],
    where: { setId: { in: ids } },
    _count: { _all: true },
  });
  const counts = new Map(ids.map((id) => [id, 0]));
  for (const row of rows) if (row.setId) counts.set(row.setId, row._count._all);
  return counts;
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

/**
 * État de chaque idée qui a donné au moins une carte, corbeille comprise, par id d'idée (voir
 * `ideaStateOf`) : nombre de cartes gardées, idée en doublon. Une idée absente n'a aucune carte.
 */
export async function ideaCardStates(
  admin: Admin,
): Promise<Map<string, { cards: number; duplicate: boolean; trashed: boolean }>> {
  assertAdmin(admin);
  const rows = await db.tcgCard.findMany({
    where: { ideaId: { not: null } },
    select: { ideaId: true, adminNote: true, deletedAt: true },
  });
  const byIdea = new Map<string, typeof rows>();
  for (const row of rows) {
    const id = row.ideaId ?? "";
    byIdea.set(id, [...(byIdea.get(id) ?? []), row]);
  }
  return new Map([...byIdea].map(([id, cards]) => [id, ideaStateOf(cards)]));
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
 * Crée une carte, à la fin de son set ou dans la réserve. Avec un effet, elle prend le coût et la
 * puissance de sa carte Snap, sauf `statsManual`. Une variante (`baseCardId`) prend les stats de
 * sa carte de base, quelles que soient celles envoyées.
 */
export async function createCard(
  admin: Admin,
  input: CardInput & z.input<typeof createInput>,
  opts?: { tx?: DbTx },
): Promise<Card> {
  assertAdmin(admin);
  const { setId, ideaId, baseCardId } = createInput.parse(input);
  const { visualEffectKeys, visualEffectKeysFull, ...parsed } = parseCard(input);
  const fields = followEffect(parsed, parsed.statsManual ?? false);
  return withTx(async (tx) => {
    const base = baseCardId ? await tx.tcgCard.findUnique({ where: { id: baseCardId } }) : null;
    if (baseCardId && !base) throw new CardInputError("Carte de base introuvable.");
    if (base?.baseCardId) throw new CardInputError("Une variante ne peut pas avoir de variante.");
    if (base?.deletedAt) throw new CardInputError("Carte de base à la corbeille.");
    await checkVisualEffects(tx, visualEffectKeys, visualEffectKeysFull);
    const number = setId ? await nextNumber(tx, setId) : null;
    const row = await tx.tcgCard.create({
      data: {
        ...fields,
        ...shared(base ?? fields),
        ...resolveVersions(fields, null, base ? "fullart" : "normal"),
        setId,
        number,
        ideaId: ideaId ?? null,
        baseCardId: base?.id ?? null,
        glowPointsFull: fields.glowPointsFull ?? fields.glowPoints,
        visualEffects: effectRows(visualEffectKeys, visualEffectKeysFull),
      },
      include: withSet,
    });
    return toCard(row);
  }, opts);
}

/**
 * Modifie une carte. Sur une variante, seuls le nom, la rareté et la description changent ; sur une
 * carte de base, les stats sont recopiées sur ses variantes. Avec un effet, coût et puissance
 * prennent ceux de sa carte Snap, sauf stats manuelles (`statsManual` envoyé, sinon celui
 * enregistré). Les parties en cours n'en voient
 * rien : elles ont figé les decks à leur début.
 */
export async function updateCard(
  admin: Admin,
  id: string,
  input: CardInput,
  opts?: { tx?: DbTx },
): Promise<Card> {
  assertAdmin(admin);
  const { visualEffectKeys, visualEffectKeysFull, ...fields } = parseCard(input);
  const visualEffects = replaceEffects(visualEffectKeys, visualEffectKeysFull);
  return withTx(async (tx) => {
    const current = await tx.tcgCard.findUnique({ where: { id } });
    if (!current) throw new CardInputError("Carte introuvable.");
    await checkVisualEffects(tx, visualEffectKeys, visualEffectKeysFull);
    if (current.baseCardId) {
      const row = await tx.tcgCard.update({
        where: { id },
        data: {
          name: fields.name,
          rarity: fields.rarity,
          flavor: fields.flavor,
          adminNote: fields.adminNote,
          imageFrame: fields.imageFrame,
          imageFrameFull: fields.imageFrameFull,
          ...resolveVersions(fields, current, current.layout),
          glowPoints: fields.glowPoints,
          glowPointsFull: fields.glowPointsFull,
          visualEffects,
        },
        include: withSet,
      });
      return toCard(row);
    }
    const stats = shared(followEffect(fields, fields.statsManual ?? current.statsManual));
    const row = await tx.tcgCard.update({
      where: { id },
      data: {
        ...stats,
        name: fields.name,
        rarity: fields.rarity,
        flavor: fields.flavor,
        adminNote: fields.adminNote,
        imageFrame: fields.imageFrame,
        imageFrameFull: fields.imageFrameFull,
        ...resolveVersions(fields, current, current.layout),
        glowPoints: fields.glowPoints,
        glowPointsFull: fields.glowPointsFull,
        visualEffects,
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
    select: {
      id: true,
      name: true,
      setId: true,
      baseCardId: true,
      deletedAt: true,
      adminNote: true,
    },
  });
  if (cards.length !== ids.length) throw new CardInputError("Carte introuvable.");
  return cards;
}

/** Réécrit la note admin des cartes dont `note` la change (marque « Doublon » posée ou retirée). */
async function rewriteNotes(
  tx: DbTx,
  cards: { id: string; adminNote: string | null }[],
  note: (current: string | null) => string | null,
): Promise<void> {
  for (const card of cards) {
    const next = note(card.adminNote);
    if (next !== card.adminNote) {
      await tx.tcgCard.update({ where: { id: card.id }, data: { adminNote: next } });
    }
  }
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
    // Une carte qui sort du « Doublon » perd sa marque (son idée redevient normale).
    await rewriteNotes(
      tx,
      moving.filter((c) => c.deletedAt),
      unmarkDuplicateNote,
    );
    await tx.tcgCard.updateMany({
      where: { id: { in: moving.map((c) => c.id) }, deletedAt: { not: null } },
      data: { deletedAt: null, duplicateOfId: null },
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
 * Classe des cartes à une étape de préparation (`CARD_PREP_STAGES`), sans toucher à leur place
 * (set, réserve, corbeille) ni à leur numéro. Renvoie le nombre de cartes qui changent d'étape.
 */
export async function setCardStage(
  admin: Admin,
  ids: string[],
  stage: string,
  opts?: { tx?: DbTx },
): Promise<{ staged: number }> {
  assertAdmin(admin);
  const unique = [...new Set(idsInput.parse(ids))];
  if (!(CARD_PREP_STAGES as readonly string[]).includes(stage)) {
    throw new CardInputError("Étape de préparation inconnue.");
  }
  return withTx(async (tx) => {
    const { count } = await tx.tcgCard.updateMany({
      where: { id: { in: unique }, prepStage: { not: stage } },
      data: { prepStage: stage },
    });
    return { staged: count };
  }, opts);
}

/**
 * Met des cartes à la corbeille (doublons, essais…) : elles sortent de leur set (renuméroté) et
 * des listes, mais restent en base ; `moveCards` les en sort. Une carte de base n'y va qu'avec
 * ses variantes. Avec `duplicate`, les cartes vont au « Doublon » : la corbeille, avec la marque
 * « Doublon » dans leur note (`markDuplicateNote`), et `duplicateOf` (obligatoire avec
 * `duplicate`) est la carte dont elles sont le doublon : une carte hors corbeille qui n'est pas
 * l'une d'elles. Sans, une carte déjà à la corbeille perd cette marque et ce lien (du « Doublon » à
 * la « Corbeille ») ; une carte qui arrive garde sa note.
 */
export async function trashCards(
  admin: Admin,
  ids: string[],
  opts?: { tx?: DbTx; duplicate?: boolean; duplicateOf?: string },
): Promise<{ trashed: number }> {
  assertAdmin(admin);
  const unique = [...new Set(idsInput.parse(ids))];
  return withTx(async (tx) => {
    const found = await findCards(tx, unique);
    if (opts?.duplicate) {
      const ofId = z.string().min(1).safeParse(opts.duplicateOf).data;
      if (!ofId) throw new CardInputError("Choisis la carte dont c'est le doublon.");
      if (unique.includes(ofId)) {
        throw new CardInputError("Une carte ne peut pas être le doublon d'elle-même.");
      }
      const original = await tx.tcgCard.findUnique({
        where: { id: ofId },
        select: { deletedAt: true },
      });
      if (!original) throw new CardInputError("Carte d'origine introuvable.");
      if (original.deletedAt) {
        throw new CardInputError(
          "La carte d'origine est à la corbeille : choisis une carte gardée.",
        );
      }
      await rewriteNotes(tx, found, (n) => markDuplicateNote(n ?? ""));
      await tx.tcgCard.updateMany({
        where: { id: { in: found.map((c) => c.id) } },
        data: { duplicateOfId: ofId },
      });
    } else {
      await rewriteNotes(
        tx,
        found.filter((c) => c.deletedAt),
        unmarkDuplicateNote,
      );
      await tx.tcgCard.updateMany({
        where: { id: { in: found.map((c) => c.id) } },
        data: { duplicateOfId: null },
      });
    }
    const fresh = found.filter((c) => !c.deletedAt);
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
      where: { id: { in: unique } },
      select: { imageKey: true, imageKeyFull: true, imageKeySmall: true, imageKeyFullSmall: true },
    });
    const { count } = await tx.tcgCard.deleteMany({ where: { id: { in: unique } } });
    // les deux illustrations (normale et full art) et leurs versions réduites
    const imageKeys = keys.flatMap((k) =>
      [k.imageKey, k.imageKeyFull, k.imageKeySmall, k.imageKeyFullSmall].filter(
        (x): x is string => x !== null,
      ),
    );
    return { deleted: count, imageKeys };
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

/** Vérifie dans le stockage une illustration envoyée (présente, pas trop lourde). */
async function checkUploaded(key: string): Promise<string> {
  const checked = imageKey.parse(key);
  const info = await headObject(checked);
  if (!info) throw new CardInputError("Image introuvable : l'envoi a échoué.");
  if (info.contentLength > CARD_LIMITS.imageBytes) {
    throw new CardInputError("Image trop lourde (5 Mo maximum).");
  }
  return checked;
}

/**
 * Pose l'illustration envoyée (vérifiée dans le stockage) sur une version de la carte : la normale
 * (`imageKey`, par défaut) ou la full art (`imageKeyFull`), avec sa version réduite (`smallKey`,
 * pour les petites cartes). Sans version réduite, l'ancienne est retirée : la petite carte montre
 * alors l'illustration elle-même.
 */
export async function setCardImage(
  admin: Admin,
  id: string,
  key: string,
  opts?: { tx?: DbTx; version?: CardLayout; smallKey?: string | null },
): Promise<Card> {
  assertAdmin(admin);
  const checked = await checkUploaded(key);
  const small = opts?.smallKey ? await checkUploaded(opts.smallKey) : null;
  if (small === checked) throw new CardInputError("Version réduite : même fichier que l'image.");
  const row = await (opts?.tx ?? db).tcgCard.update({
    where: { id },
    data:
      opts?.version === "fullart"
        ? { imageKeyFull: checked, imageKeyFullSmall: small }
        : { imageKey: checked, imageKeySmall: small },
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
      const fields = parseCard(card as CardInput);
      return { ...followEffect(fields, fields.statsManual ?? false), ideaId: card.ideaId ?? null };
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
    await checkVisualEffects(
      tx,
      ...fresh.flatMap((c) => [c.visualEffectKeys, c.visualEffectKeysFull]),
    );
    let number = setId ? await nextNumber(tx, setId) : null;
    for (const { visualEffectKeys, visualEffectKeysFull, ...card } of fresh) {
      await tx.tcgCard.create({
        data: {
          ...card,
          ...shared(card),
          ...resolveVersions(card, null, "normal"),
          setId,
          number: number === null ? null : number++,
          glowPointsFull: card.glowPointsFull ?? card.glowPoints,
          visualEffects: effectRows(visualEffectKeys, visualEffectKeysFull),
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
  Pick<CardInput, "cost" | "power" | "statsManual" | "effectKey" | "effectParams" | "effectText">
>;

export type CardUpdates = { updates: CardUpdate[] };

/**
 * Change le coût, la puissance et l'effet de cartes existantes, retrouvées par leur idée (et par leur
 * nom quand l'idée a plusieurs cartes). Comme dans la fiche, une carte avec effet prend les stats
 * de sa carte Snap, sauf stats manuelles (`statsManual`, sinon l'état enregistré). Le reste est gardé : nom, illustration, cadrage, set et
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
            statsManual: update.statsManual,
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
