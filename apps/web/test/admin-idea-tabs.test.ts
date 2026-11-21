import { describe, expect, it } from "vitest";
import { asIdeaTab, combineState, needsCard } from "../app/(platform)/admin/ideas/card-counts";

describe("onglets de la boîte à idées", () => {
  it("connaît l'onglet « Carte à créer »", () => {
    expect(asIdeaTab("a-creer")).toBe("a-creer");
    expect(asIdeaTab("inconnu")).toBeUndefined();
  });

  it("une idée marquée « Doublon de… » est en doublon, quelles que soient ses cartes", () => {
    expect(combineState(undefined, true)).toEqual({ cards: 0, duplicate: true, trashed: false });
    expect(combineState({ cards: 0, duplicate: false, trashed: true }, true)).toEqual({
      cards: 0,
      duplicate: true,
      trashed: false,
    });
    expect(combineState({ cards: 2, duplicate: false, trashed: false }, false)).toEqual({
      cards: 2,
      duplicate: false,
      trashed: false,
    });
  });

  it("« Carte à créer » : idée gardée sans carte seulement", () => {
    expect(needsCard(combineState(undefined, false))).toBe(true);
    expect(needsCard(combineState(undefined, true))).toBe(false);
    expect(needsCard({ cards: 1, duplicate: false, trashed: false })).toBe(false);
    expect(needsCard({ cards: 0, duplicate: false, trashed: true })).toBe(false);
  });
});
