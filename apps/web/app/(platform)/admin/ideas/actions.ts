"use server";

import { getUsersByIds } from "@app/core";
import { IdeaDuplicateError, listIdeas, RARITIES, setIdeaDuplicateOf } from "@app/ideas";
import type { IdeaPage } from "@app/ideas/ui";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionAdmin } from "@/lib/session";
import { cardStatesByIdea, duplicateOfLabels, IDEA_TABS } from "./card-counts";

const filtersInput = z.object({
  authorId: z.string().min(1).optional(),
  rarity: z.enum(RARITIES).optional(),
  tab: z.enum(IDEA_TABS).optional(),
});

/**
 * Page suivante de la liste admin des idées (chargement au défilement). La page lie les filtres
 * (`loadMoreIdeas.bind(null, filters)`) : le client ne passe que le curseur.
 */
export async function loadMoreIdeas(
  filters: z.input<typeof filtersInput>,
  cursor: string,
): Promise<IdeaPage> {
  const admin = await actionAdmin();
  const { authorId, rarity, tab } = filtersInput.parse(filters);
  z.string().min(1).parse(cursor);
  const { stateOf, filter } = await cardStatesByIdea(admin, tab);
  const { items, nextCursor } = await listIdeas(admin, { authorId, rarity, ...filter, cursor });
  const [authors, originOf] = await Promise.all([
    getUsersByIds([...new Set(items.map((i) => i.authorId))]),
    duplicateOfLabels(admin, items),
  ]);
  const names = new Map(authors.map((u) => [u.id, u.name]));
  return {
    items: items.map((idea) => ({
      id: idea.id,
      title: idea.title,
      authorName: names.get(idea.authorId) ?? "Membre inconnu",
      rarity: idea.suggestedRarity,
      hasImage: Boolean(idea.imageKey),
      createdAt: idea.createdAt,
      ...stateOf(idea.id),
      duplicateOf: originOf.get(idea.id),
    })),
    nextCursor,
  };
}

/**
 * Marque l'idée « Doublon de » une autre (`ofId`), ou retire la marque (`ofId: null`). Renvoie le
 * message d'un choix refusé ; les droits sont vérifiés côté serveur.
 */
export async function setIdeaDuplicateAction(
  ideaId: string,
  ofId: string | null,
): Promise<{ error?: string }> {
  const admin = await actionAdmin();
  const input = z.object({ ideaId: z.string().min(1), ofId: z.string().min(1).nullable() });
  const parsed = input.safeParse({ ideaId, ofId });
  if (!parsed.success) return { error: "Choix invalide." };
  try {
    await setIdeaDuplicateOf(admin, parsed.data);
  } catch (error) {
    if (error instanceof IdeaDuplicateError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/ideas", "layout");
  return {};
}
