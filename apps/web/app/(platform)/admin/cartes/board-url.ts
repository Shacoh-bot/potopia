/**
 * Retour à la planche depuis la fiche d'une carte : la planche passe sa requête (place, étape, vue,
 * page, recherche) à la fiche dans `?retour=`, et le lien « retour » de la fiche la reprend, avec
 * une ancre sur la carte. Seuls ces paramètres sont gardés : le lien reste dans /admin/cartes.
 */
const BOARD_KEYS = ["set", "etape", "vue", "page", "q"] as const;
const MAX_VALUE = 80;

/** Requête de la planche nettoyée (paramètres connus, valeurs courtes) ; "" sans rien à garder. */
export function boardQuery(raw: string | null | undefined): string {
  const from = new URLSearchParams(raw ?? "");
  const kept = new URLSearchParams();
  for (const key of BOARD_KEYS) {
    const value = from.get(key);
    if (value) kept.set(key, value.slice(0, MAX_VALUE));
  }
  return kept.toString();
}

/** Adresse de la fiche d'une carte, qui se souvient de la planche d'où on vient. */
export function cardHref(cardId: string, board: string): string {
  const query = boardQuery(board);
  return `/admin/cartes/${cardId}${query ? `?retour=${encodeURIComponent(query)}` : ""}`;
}

/** Adresse de la planche d'où on vient, défilée jusqu'à la carte quand elle est donnée. */
export function boardHref(board: string, cardId?: string): string {
  const query = boardQuery(board);
  return `/admin/cartes${query ? `?${query}` : ""}${cardId ? `#${cardAnchor(cardId)}` : ""}`;
}

/** Identifiant HTML d'une carte dans la planche (cible de l'ancre du retour). */
export const cardAnchor = (cardId: string): string => `carte-${cardId}`;
