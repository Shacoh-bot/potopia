import { listIdeaIds } from "@app/ideas";
import { ideaCardStates } from "@app/tcg";

type Admin = { discordId: string | null };

/** Adresse de création d'une carte depuis une idée, suivie de l'id de l'idée. */
export const NEW_CARD_HREF = "/admin/cartes/nouvelle?idee=";

export type IdeaCardState = { cards: number; duplicate: boolean; trashed: boolean };

const NONE: IdeaCardState = { cards: 0, duplicate: false, trashed: false };

/**
 * Onglets de la boîte à idées (`?onglet=`) : une idée suit ses cartes au « Doublon » ou à la
 * « Corbeille » (`ideaStateOf` du TCG) ; sans onglet, les autres.
 */
export const IDEA_TABS = ["doublon", "corbeille"] as const;
export type IdeaTab = (typeof IDEA_TABS)[number];

export const asIdeaTab = (value: string | undefined): IdeaTab | undefined =>
  IDEA_TABS.find((t) => t === value);

/**
 * État de chaque idée côté cartes (`ideaStateOf` du TCG) : cartes gardées (hors corbeille et hors
 * doublons), idée en doublon, idée à la corbeille ; et le filtre de `listIdeas` pour un onglet.
 * Une idée sans aucune carte : 0, ni doublon ni corbeille.
 */
export async function cardStatesByIdea(
  admin: Admin,
  tab?: IdeaTab,
): Promise<{
  stateOf: (ideaId: string) => IdeaCardState;
  filter: { onlyIds?: string[]; exceptIds?: string[] };
}> {
  const states = await ideaCardStates(admin);
  const ids = (keep: (s: IdeaCardState) => boolean) =>
    [...states].flatMap(([id, s]) => (keep(s) ? [id] : []));
  const filter =
    tab === "doublon"
      ? { onlyIds: ids((s) => s.duplicate) }
      : tab === "corbeille"
        ? { onlyIds: ids((s) => s.trashed) }
        : { exceptIds: ids((s) => s.duplicate || s.trashed) };
  return { stateOf: (ideaId) => states.get(ideaId) ?? NONE, filter };
}

/**
 * Compteurs de toute la boîte à idées : `toCreate`, les idées encore à transformer en carte (ni
 * carte gardée, ni doublon, ni corbeille) ; `active`, les idées hors doublon et corbeille ;
 * `duplicates`, les idées en doublon ; `trashed`, celles à la corbeille.
 */
export async function ideaCounters(
  admin: Admin,
  stateOf: (ideaId: string) => IdeaCardState,
): Promise<{ toCreate: number; active: number; duplicates: number; trashed: number }> {
  const counts = { toCreate: 0, active: 0, duplicates: 0, trashed: 0 };
  for (const id of await listIdeaIds(admin)) {
    const { cards, duplicate, trashed } = stateOf(id);
    if (duplicate) counts.duplicates++;
    else if (trashed) counts.trashed++;
    else {
      counts.active++;
      if (cards === 0) counts.toCreate++;
    }
  }
  return counts;
}
