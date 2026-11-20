"use server";

import { getUsersByIds } from "@app/core";
import { listIdeas, RARITIES } from "@app/ideas";
import type { IdeaPage } from "@app/ideas/ui";
import { z } from "zod";
import { actionAdmin } from "@/lib/session";
import { cardStatesByIdea, IDEA_TABS } from "./card-counts";

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
  const authors = await getUsersByIds([...new Set(items.map((i) => i.authorId))]);
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
    })),
    nextCursor,
  };
}
