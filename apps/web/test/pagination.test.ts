import { describe, expect, it } from "vitest";
import { pageList, pagePrefetch } from "@/app/(platform)/admin/cartes/Pagination";

describe("pagination des cartes", () => {
  it("montre toutes les pages quand il y en a peu", () => {
    expect(pageList(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageList(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("garde toujours la première et la dernière page, les trous deviennent « … »", () => {
    expect(pageList(1, 20)).toEqual([1, 2, 3, 4, 5, "…", 20]);
    expect(pageList(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20]);
    expect(pageList(20, 20)).toEqual([1, "…", 16, 17, 18, 19, 20]);
  });

  it("affiche la page plutôt que « … » quand il n'en manque qu'une", () => {
    expect(pageList(4, 20)).toEqual([1, 2, 3, 4, 5, "…", 20]);
    expect(pageList(5, 20)).toEqual([1, "…", 4, 5, 6, "…", 20]);
  });

  it("précharge en entier les seules pages voisines quand on le demande (Potodex)", () => {
    expect([1, 2, 3, 4, 5].map((to) => pagePrefetch(3, to, true))).toEqual([
      undefined,
      true,
      undefined,
      true,
      undefined,
    ]);
    // sans l'option (menu « Cartes ») : préchargement par défaut de Next partout
    expect([2, 4].map((to) => pagePrefetch(3, to, false))).toEqual([undefined, undefined]);
  });
});
