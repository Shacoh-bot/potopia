import { ForbiddenError, isAdmin } from "@app/core";
import { db, type DbTx, withTx } from "@app/db";
import { MAX_EXPIRES_IN, presignGet, presignGetStable } from "@app/storage";
import { z } from "zod";
import { RARITIES, type Rarity } from "./validation";

export type Idea = {
  id: string;
  authorId: string;
  title: string;
  description: string;
  concernedPeople: string | null;
  suggestedRarity: Rarity | null;
  effectIdea: string | null;
  imageKey: string | null;
  createdAt: Date;
  /** Idée d'origine quand un admin a marqué celle-ci « Doublon de… » ; sinon null. */
  duplicateOfId: string | null;
};

/** Utilisateur qui lit : seuls les admins (ADMIN_DISCORD_IDS) y ont droit. */
type Reader = { discordId: string | null };

function assertAdmin(reader: Reader): void {
  if (!isAdmin(reader.discordId)) throw new ForbiddenError("Réservé aux admins.");
}

const listFilters = z.object({
  authorId: z.string().min(1).optional(),
  rarity: z.enum(RARITIES).optional(),
  /** Seulement ces idées (`onlyIds`), ou toutes sauf celles-ci (`exceptIds`). */
  onlyIds: z.array(z.string()).optional(),
  exceptIds: z.array(z.string()).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

/** Idées de la plus récente à la plus ancienne. Lève ForbiddenError pour un non-admin. */
export async function listIdeas(
  reader: Reader,
  filters: z.input<typeof listFilters> = {},
): Promise<{ items: Idea[]; nextCursor: string | null }> {
  assertAdmin(reader);
  const { authorId, rarity, onlyIds, exceptIds, cursor, limit } = listFilters.parse(filters);
  const id = onlyIds ? { in: onlyIds } : exceptIds?.length ? { notIn: exceptIds } : undefined;
  const rows = await db.idea.findMany({
    where: { id, authorId, suggestedRarity: rarity },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
}

/** Lève ForbiddenError pour un non-admin. */
export async function getIdea(reader: Reader, id: string): Promise<Idea | null> {
  assertAdmin(reader);
  return db.idea.findUnique({ where: { id } });
}

/** URL GET présignée (5 min) de l'image d'une idée, ou null. Lève ForbiddenError pour un non-admin. */
export async function getIdeaImageUrl(reader: Reader, id: string): Promise<string | null> {
  const idea = await getIdea(reader, id);
  if (!idea?.imageKey) return null;
  return presignGet({ key: idea.imageKey, expiresIn: 300 });
}

/**
 * URL présignée stable (`presignGetStable`) de l'image de chacune de ces idées qui en a une, par
 * id : les cartes sans illustration propre empruntent celle de leur idée.
 * Lève ForbiddenError pour un non-admin.
 */
export async function listIdeaImageUrls(
  reader: Reader,
  ids: string[],
): Promise<Map<string, string>> {
  assertAdmin(reader);
  if (ids.length === 0) return new Map();
  const rows = await db.idea.findMany({
    where: { id: { in: ids }, imageKey: { not: null } },
    select: { id: true, imageKey: true },
  });
  return new Map(
    await Promise.all(
      rows.map(async (r) => [r.id, await presignGetStable(r.imageKey ?? "")] as const),
    ),
  );
}

/**
 * Auteur (id) de chacune de ces idées, par id d'idée : les cartes tirées d'une idée affichent
 * « idée de … ». Lève ForbiddenError pour un non-admin.
 */
export async function getIdeaAuthorIds(
  reader: Reader,
  ids: string[],
): Promise<Map<string, string>> {
  assertAdmin(reader);
  if (ids.length === 0) return new Map();
  const rows = await db.idea.findMany({
    where: { id: { in: ids } },
    select: { id: true, authorId: true },
  });
  return new Map(rows.map((r) => [r.id, r.authorId]));
}

/**
 * Titre et auteur (id) de chacune de ces idées, par id d'idée : la liste admin des cartes affiche
 * « Lié à l'idée : titre — auteur ». Lève ForbiddenError pour un non-admin.
 */
export async function getIdeaLabels(
  reader: Reader,
  ids: string[],
): Promise<Map<string, { title: string; authorId: string }>> {
  assertAdmin(reader);
  if (ids.length === 0) return new Map();
  const rows = await db.idea.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, authorId: true },
  });
  return new Map(rows.map((r) => [r.id, { title: r.title, authorId: r.authorId }]));
}

/** Ids de toutes les idées (compteurs de la liste admin). Lève ForbiddenError pour un non-admin. */
export async function listIdeaIds(reader: Reader): Promise<string[]> {
  assertAdmin(reader);
  const rows = await db.idea.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * Ids des idées marquées « Doublon de… » par un admin (onglet Doublon de la liste admin, avec
 * celles dont la carte est marquée « Doublon »). Lève ForbiddenError pour un non-admin.
 */
export async function listDuplicateIdeaIds(reader: Reader): Promise<Set<string>> {
  assertAdmin(reader);
  const rows = await db.idea.findMany({
    where: { duplicateOfId: { not: null } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Idées qu'on peut choisir comme original d'un doublon : toutes celles qui ne sont pas elles-mêmes
 * marquées « Doublon de… », de la plus récente à la plus ancienne. Lève ForbiddenError pour un
 * non-admin.
 */
export async function listDuplicateCandidates(
  reader: Reader,
): Promise<{ id: string; title: string; authorId: string }[]> {
  assertAdmin(reader);
  return db.idea.findMany({
    where: { duplicateOfId: null },
    select: { id: true, title: true, authorId: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

/** Choix d'un admin refusé (idée d'origine absente, elle-même, ou elle-même un doublon). */
export class IdeaDuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdeaDuplicateError";
  }
}

const duplicateInput = z.object({
  ideaId: z.string().min(1),
  /** Idée d'origine ; null retire la marque (« Ce n'est plus un doublon »). */
  ofId: z.string().min(1).nullable(),
});

/**
 * Marque une idée « Doublon de » une autre (`ofId`), ou retire la marque (`ofId: null`). L'origine
 * doit exister, être une autre idée, et ne pas être elle-même un doublon. Les doublons de l'idée
 * marquée passent sur la nouvelle origine (jamais de chaîne). Les cartes liées ne bougent pas.
 * Lève ForbiddenError pour un non-admin, IdeaDuplicateError pour un choix refusé.
 */
export async function setIdeaDuplicateOf(
  reader: Reader,
  input: z.input<typeof duplicateInput>,
  opts?: { tx?: DbTx },
): Promise<void> {
  assertAdmin(reader);
  const { ideaId, ofId } = duplicateInput.parse(input);
  await withTx(async (tx) => {
    const idea = await tx.idea.findUnique({ where: { id: ideaId }, select: { id: true } });
    if (!idea) throw new IdeaDuplicateError("Idée introuvable.");
    if (ofId === null) {
      await tx.idea.update({ where: { id: ideaId }, data: { duplicateOfId: null } });
      return;
    }
    if (ofId === ideaId) {
      throw new IdeaDuplicateError("Une idée ne peut pas être le doublon d'elle-même.");
    }
    const origin = await tx.idea.findUnique({
      where: { id: ofId },
      select: { duplicateOfId: true },
    });
    if (!origin) throw new IdeaDuplicateError("Idée d'origine introuvable.");
    if (origin.duplicateOfId) {
      throw new IdeaDuplicateError("Cette idée est elle-même un doublon : choisis l'originale.");
    }
    await tx.idea.updateMany({ where: { duplicateOfId: ideaId }, data: { duplicateOfId: ofId } });
    await tx.idea.update({ where: { id: ideaId }, data: { duplicateOfId: ofId } });
  }, opts);
}

/** Auteurs ayant envoyé au moins une idée, pour le filtre de la liste admin. */
export async function listIdeaAuthorIds(reader: Reader): Promise<string[]> {
  assertAdmin(reader);
  const rows = await db.idea.findMany({ distinct: ["authorId"], select: { authorId: true } });
  return rows.map((r) => r.authorId);
}

export type ExportedIdea = Idea & { imageUrl: string | null };

/**
 * Toutes les idées, pour l'export admin, avec une URL présignée de leur image (15 min, le maximum).
 * Lève ForbiddenError pour un non-admin.
 */
export async function exportIdeas(reader: Reader): Promise<ExportedIdea[]> {
  assertAdmin(reader);
  const rows = await db.idea.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return Promise.all(
    rows.map(async (idea) => ({
      ...idea,
      imageUrl: idea.imageKey
        ? await presignGet({ key: idea.imageKey, expiresIn: MAX_EXPIRES_IN })
        : null,
    })),
  );
}
