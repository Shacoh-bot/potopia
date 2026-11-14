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
