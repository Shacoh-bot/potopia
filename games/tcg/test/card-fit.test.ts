import { describe, expect, it } from "vitest";

import {
  EFFECT_BOX,
  effectTextSize,
  FOOTER_WIDTH,
  footerFontSize,
  footerWidth,
  serialLabel,
} from "../ui/card-fit";

describe("pied de carte : set et numéro", () => {
  it("écrit « S1 1/100 », sans zéros devant", () => {
    expect(serialLabel("S1", 1, 100)).toBe("S1 1/100");
    expect(serialLabel("S2", 12, 40)).toBe("S2 12/40");
  });
  it("hors set (réserve) : « S? » seul, plus le mot « Réserve »", () => {
    expect(serialLabel(null, null)).toBe("S?");
    expect(serialLabel(undefined, null, 100)).toBe("S?");
  });
});

describe("pied de carte : tout tient, « idée de … » en entier", () => {
  const long = {
    serial: "S1 100/100",
    rarity: "SSR",
    stars: 3,
    altArt: true,
    author: "Maximilien-Alexandre de la Tour",
  };
  it("garde 8 px quand le pied est court", () => {
    expect(
      footerFontSize({ serial: "S1 1/100", rarity: "C", stars: 1, altArt: false, author: "Léo" }),
    ).toBe(8);
  });
  it("rapetisse pour un auteur au nom long, sans dépasser la place", () => {
    const size = footerFontSize(long);
    expect(size).toBeLessThan(8);
    expect(footerWidth(long, size)).toBeLessThanOrEqual(FOOTER_WIDTH);
  });
});

describe("texte d'effet : rapetisse au lieu d'être coupé", () => {
  it("garde 13,5 px pour un effet court", () => {
    expect(effectTextSize("Pioche une carte.").fontSize).toBe(13.5);
  });
  it("descend pour un effet long, et le texte tient dans l'encadré", () => {
    const effect = "Quand cette carte est jouée, ".repeat(9) + "détruis une carte adverse.";
    const fit = effectTextSize(effect, "Une phrase d'ambiance un peu longue pour la forme.");
    expect(fit.fontSize).toBeLessThan(13.5);
    expect(fit.fontSize).toBeGreaterThanOrEqual(7);
    // Estimation large : ~0,52 em par caractère.
    const perLine = Math.floor(EFFECT_BOX.width / (fit.fontSize * 0.52));
    expect(Math.ceil(effect.length / perLine) * fit.lineHeight).toBeLessThanOrEqual(
      EFFECT_BOX.height,
    );
  });
});
