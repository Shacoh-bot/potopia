import { getUsersByIds } from "@app/core";
import { getIdeaLabels, type Idea, listDuplicateIdeaIds, listIdeaIds } from "@app/ideas";
import { ideaCardStates } from "@app/tcg";

type Admin = { discordId: string | null };

/** Adresse de création d'une carte depuis une idée, suivie de l'id de l'idée. */
export const NEW_CARD_HREF = "/admin/cartes/nouvelle?idee=";

export type IdeaCardState = { cards: number; duplicate: boolean; trashed: boolean };

const NONE: IdeaCardState = { cards: 0, duplicate: false, trashed: false };

/**
 * Onglets de la boîte à idées (`?onglet=`) : « a-creer », les idées gardées sans carte ; une idée
 * va au « Doublon » quand elle est marquée « Doublon de… » ou que sa carte l'est, et suit ses
 * cartes à la « Corbeille » (`ideaStateOf` du TCG) ; sans onglet, les idées gardées.
 */
export const IDEA_TABS = ["a-creer", "doublon", "corbeille"] as const;
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
  const [cardStates, marked, allIds] = await Promise.all([
    ideaCardStates(admin),
    listDuplicateIdeaIds(admin),
    tab === "a-creer" ? listIdeaIds(admin) : Promise.resolve([]),
  ]);
  const stateOf = (ideaId: string) => combineState(cardStates.get(ideaId), marked.has(ideaId));
  const known = [...new Set([...cardStates.keys(), ...marked])];
  const ids = (keep: (s: IdeaCardState) => boolean, from = known) =>
    from.filter((id) => keep(stateOf(id)));
  const filter =
    tab === "a-creer"
      ? { onlyIds: ids(needsCard, allIds) }
      : tab === "doublon"
        ? { onlyIds: ids((s) => s.duplicate) }
        : tab === "corbeille"
          ? { onlyIds: ids((s) => s.trashed) }
          : { exceptIds: ids((s) => s.duplicate || s.trashed) };
  return { stateOf, filter };
}

/**
 * État d'une idée : celui de ses cartes, sauf qu'une idée marquée « Doublon de… » est en doublon
 * (et non à la corbeille), quelles que soient ses cartes.
 */
export function combineState(cards: IdeaCardState | undefined, marked: boolean): IdeaCardState {
  const s = cards ?? NONE;
  return marked ? { ...s, duplicate: true, trashed: false } : s;
}

/** Onglet « Carte à créer » : idée gardée (ni doublon ni corbeille) sans carte gardée. */
export const needsCard = (s: IdeaCardState) => s.cards === 0 && !s.duplicate && !s.trashed;

/** « Doublon de : titre — auteur » des idées marquées « Doublon de… » de cette page, par id. */
export async function duplicateOfLabels(
  admin: Admin,
  items: Pick<Idea, "id" | "duplicateOfId">[],
): Promise<Map<string, { id: string; label: string }>> {
  const originIds = [...new Set(items.flatMap((i) => (i.duplicateOfId ? [i.duplicateOfId] : [])))];
  const labels = await getIdeaLabels(admin, originIds);
  const users = await getUsersByIds([...new Set([...labels.values()].map((l) => l.authorId))]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const out = new Map<string, { id: string; label: string }>();
  for (const i of items) {
    const l = i.duplicateOfId ? labels.get(i.duplicateOfId) : undefined;
    if (i.duplicateOfId && l) {
      const author = names.get(l.authorId) ?? "Membre inconnu";
      out.set(i.id, { id: i.duplicateOfId, label: `${l.title} — ${author}` });
    }
  }
  return out;
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
    const s = stateOf(id);
    if (s.duplicate) counts.duplicates++;
    else if (s.trashed) counts.trashed++;
    else {
      counts.active++;
      if (needsCard(s)) counts.toCreate++;
    }
  }
  return counts;
}
