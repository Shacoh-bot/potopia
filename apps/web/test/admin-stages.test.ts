import { describe, expect, it } from "vitest";
import { inPreparation, placeCards } from "@/app/(platform)/admin/cartes/stages";

const cards = [
  { id: "a", setId: null, prepStage: "todo" },
  { id: "b", setId: null, prepStage: "illustrated" },
  { id: "c", setId: "s1", prepStage: "illustrated" },
  { id: "d", setId: "s1", prepStage: "todo" },
  { id: "e", setId: null, prepStage: "illustrated", deletedAt: new Date() },
];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("étapes de préparation de l'admin des cartes", () => {
  it("un onglet d'étape ne montre que les cartes de la réserve à cette étape", () => {
    expect(ids(placeCards(cards, null, "illustrated"))).toEqual(["b", "e"]);
    expect(ids(placeCards(cards, null, "todo"))).toEqual(["a"]);
    expect(ids(placeCards(cards, null, null))).toEqual(["a", "b", "e"]);
  });

  it("un set montre toutes ses cartes, quelle que soit leur étape", () => {
    expect(ids(placeCards(cards, "s1", null))).toEqual(["c", "d"]);
    expect(ids(placeCards(cards, "s1", "todo"))).toEqual(["c", "d"]);
  });

  it("seules les cartes de la réserve hors corbeille ont des coches d'étape", () => {
    expect(ids(cards.filter(inPreparation))).toEqual(["a", "b"]);
  });
});
