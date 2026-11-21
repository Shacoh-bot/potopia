import { describe, expect, it } from "vitest";
import {
  boardHref,
  boardQuery,
  cardAnchor,
  cardHref,
} from "@/app/(platform)/admin/cartes/board-url";

describe("retour à la planche depuis la fiche d'une carte", () => {
  it("la fiche garde la place, l'étape, la vue et la page de la planche", () => {
    const href = cardHref("abc", "set=reserve&etape=todo&vue=liste&page=2");
    expect(href).toBe(
      "/admin/cartes/abc?retour=set%3Dreserve%26etape%3Dtodo%26vue%3Dliste%26page%3D2",
    );
    const retour = new URL(href, "http://x").searchParams.get("retour");
    expect(boardHref(boardQuery(retour), "abc")).toBe(
      "/admin/cartes?set=reserve&etape=todo&vue=liste&page=2#carte-abc",
    );
  });

  it("sans planche connue, le retour mène à la planche par défaut", () => {
    expect(cardHref("abc", "")).toBe("/admin/cartes/abc");
    expect(boardHref(boardQuery(undefined), "abc")).toBe("/admin/cartes#carte-abc");
    expect(boardHref("")).toBe("/admin/cartes");
  });

  it("ne garde que les paramètres de la planche et reste dans /admin/cartes", () => {
    expect(boardQuery("set=s1&evil=1&next=//x.com&q=pika")).toBe("set=s1&q=pika");
    expect(boardHref("https://x.com/?set=s1")).toBe("/admin/cartes");
    expect(boardQuery(`q=${"a".repeat(200)}`)).toBe(`q=${"a".repeat(80)}`);
  });

  it("l'ancre du retour vise la carte dans la planche", () => {
    expect(cardAnchor("abc")).toBe("carte-abc");
  });
});
