import { listIdeaIds } from "@app/ideas";
import { ideaCardStates } from "@app/tcg";

type Admin = { discordId: string | null };

/** Adresse de création d'une carte depuis une idée, suivie de l'id de l'idée. */
export const NEW_CARD_HREF = "/admin/cartes/nouvelle?idee=";

export type IdeaCardState = { cards: number; duplicate: boolean };

const NONE: IdeaCardState = { cards: 0, duplicate: false };

/**
 * État de chaque idée côté cartes (`ideaStateOf` du TCG) : cartes gardées (hors corbeille et hors
 * doublons) et idée en doublon. Une idée sans aucune carte : 0, pas doublon.
 */
export async function cardStatesByIdea(admin: Admin): Promise<(ideaId: string) => IdeaCardState> {
  const states = await ideaCardStates(admin);
  return (ideaId) => states.get(ideaId) ?? NONE;
}

/**
 * Compteurs de toute la boîte à idées : `toCreate`, les idées encore à transformer en carte (ni
 * carte gardée, ni doublon) ; `duplicates`, les idées en doublon.
 */
export async function ideaCounters(
  admin: Admin,
  stateOf: (ideaId: string) => IdeaCardState,
): Promise<{ toCreate: number; duplicates: number }> {
  let toCreate = 0;
  let duplicates = 0;
  for (const id of await listIdeaIds(admin)) {
    const { cards, duplicate } = stateOf(id);
    if (duplicate) duplicates++;
    else if (cards === 0) toCreate++;
  }
  return { toCreate, duplicates };
}
