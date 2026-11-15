import { getUsersByIds } from "@app/core";
import { getIdeaAuthorIds, listIdeaImageUrls } from "@app/ideas";
import { presignGetStable } from "@app/storage";
import { type Card, imageKeyFor } from "@app/tcg";

type Admin = { discordId: string | null };

/** Clé des URL d'illustration : la carte et sa version (`layout`), qui a son illustration. */
export const imageId = (card: Pick<Card, "id" | "layout">) => `${card.id}:${card.layout}`;

/**
 * URL d'illustration de chaque carte dans sa version (`layout`), par `imageId` : celle de la
 * version (la full art reprend celle de la normale sans la sienne), ou celle de son idée quand
 * l'idée a une image. URLs présignées directement (pas de redirection par carte) et stables 5 min, pour que le
 * navigateur garde les images en cache ; une nouvelle illustration a une nouvelle clé, donc une
 * nouvelle URL.
 */
export async function cardImageUrls(
  admin: Admin,
  cards: Card[],
): Promise<Map<string, string | null>> {
  const borrowed = await listIdeaImageUrls(
    admin,
    cards.flatMap((c) => (!imageKeyFor(c, c.layout) && c.ideaId ? [c.ideaId] : [])),
  );
  return new Map(
    await Promise.all(
      cards.map(async (c) => {
        const key = imageKeyFor(c, c.layout);
        return [
          imageId(c),
          key ? await presignGetStable(key) : ((c.ideaId && borrowed.get(c.ideaId)) ?? null),
        ] as const;
      }),
    ),
  );
}

/** Nom de l'auteur de l'idée de chaque carte (par id de carte), pour « idée de … ». */
export async function cardAuthors(admin: Admin, cards: Card[]): Promise<Map<string, string>> {
  const ideaAuthors = await getIdeaAuthorIds(
    admin,
    cards.flatMap((c) => (c.ideaId ? [c.ideaId] : [])),
  );
  const users = await getUsersByIds([...new Set(ideaAuthors.values())]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  return new Map(
    cards.flatMap((c) => {
      const name = c.ideaId && names.get(ideaAuthors.get(c.ideaId) ?? "");
      return name ? [[c.id, name] as const] : [];
    }),
  );
}

/** Familles déjà utilisées, proposées dans l'éditeur. */
export function familiesOf(cards: Card[]): string[] {
  return [...new Set(cards.flatMap((c) => (c.family ? [c.family] : [])))].sort((a, b) =>
    a.localeCompare(b),
  );
}
