import { describe, expect, it } from "vitest";
import { paginate } from "@/app/(platform)/admin/potodex/paginate";

const cards = Array.from({ length: 50 }, (_, i) => i + 1);

describe("pagination du Potodex", () => {
  it("découpe en pages de taille fixe, la dernière incomplète", () => {
    expect(paginate(cards, undefined, 24)).toMatchObject({ page: 1, pageCount: 3 });
    expect(paginate(cards, "1", 24).shown).toEqual(cards.slice(0, 24));
    expect(paginate(cards, "3", 24).shown).toEqual([49, 50]);
  });

  it("numéro invalide ou hors limites : première ou dernière page", () => {
    expect(paginate(cards, "abc", 24).page).toBe(1);
    expect(paginate(cards, "0", 24).page).toBe(1);
    expect(paginate(cards, "99", 24).page).toBe(3);
  });

  it("set vide ou petit : une seule page", () => {
    expect(paginate([], "2", 24)).toEqual({ page: 1, pageCount: 1, shown: [] });
    expect(paginate(cards.slice(0, 10), undefined, 24).pageCount).toBe(1);
  });
});
