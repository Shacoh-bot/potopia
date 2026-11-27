/**
 * Cases par page du Potodex : 12 (24 avant le 27/11). Moins de cartes dessinées à la fois, donc une
 * planche plus légère et un changement de page plus court (moins d'illustrations signées, moins de
 * cartes à monter) ; 12 remplit des rangées entières à 2, 3, 4 ou 6 colonnes.
 */
export const POTODEX_PAGE_SIZE = 12;

/**
 * Page `pageParam` (texte de l'adresse, 1 par défaut) d'une liste découpée en pages de `size` :
 * un numéro invalide ou hors limites tombe sur la première ou la dernière page.
 */
export function paginate<T>(
  items: readonly T[],
  pageParam: string | undefined,
  size: number,
): { page: number; pageCount: number; shown: T[] } {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1), pageCount);
  return { page, pageCount, shown: items.slice((page - 1) * size, page * size) };
}
