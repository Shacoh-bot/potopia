/**
 * Étapes de préparation dans /admin/cartes. Elles ne concernent que les cartes en préparation, dans
 * la réserve : une carte rangée dans un set n'apparaît dans aucun onglet d'étape et n'a plus de
 * coches (son étape reste en base, sans effet).
 */
type Placed = { setId: string | null; deletedAt?: unknown; prepStage: string };

/** Vrai pour une carte en préparation : dans la réserve, hors corbeille. */
export const inPreparation = (card: Placed): boolean => card.setId === null && !card.deletedAt;

/**
 * Cartes d'une place (`setId` d'un set, ou `null` pour la réserve). L'étape ne filtre que la
 * réserve : un set montre toujours toutes ses cartes.
 */
export function placeCards<T extends Placed>(
  all: readonly T[],
  setId: string | null,
  stage: string | null,
): T[] {
  return all.filter(
    (c) => c.setId === setId && (setId !== null || !stage || c.prepStage === stage),
  );
}
