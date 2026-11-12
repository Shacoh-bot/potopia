import { listCards } from "@app/tcg";

type Admin = { discordId: string | null };

/** Adresse de création d'une carte depuis une idée, suivie de l'id de l'idée. */
export const NEW_CARD_HREF = "/admin/cartes/nouvelle?idee=";

/** Nombre de cartes du jeu (hors corbeille) tirées de chaque idée, par id d'idée. */
export async function cardCountsByIdea(admin: Admin): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const card of await listCards(admin)) {
    if (card.ideaId) counts.set(card.ideaId, (counts.get(card.ideaId) ?? 0) + 1);
  }
  return counts;
}
