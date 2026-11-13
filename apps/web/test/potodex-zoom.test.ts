import { describe, expect, it } from "vitest";
import { zoomToFit } from "@/app/(platform)/admin/potodex/zoom";

const CARD = { width: 300, height: 420 };

/** Taille de la carte une fois zoomée, et ce qu'il reste d'écran autour. */
function fits(viewport: { width: number; height: number }) {
  const zoom = zoomToFit(viewport, CARD);
  return {
    zoom,
    width: CARD.width * zoom,
    height: CARD.height * zoom,
  };
}

describe("carte du Potodex ouverte en grand", () => {
  it("tient entière sur un téléphone en portrait, limitée par la largeur", () => {
    const { width, height } = fits({ width: 375, height: 667 });
    expect(width).toBeLessThanOrEqual(375 - 32);
    expect(height).toBeLessThanOrEqual(667 - 32);
    expect(width).toBeCloseTo(343);
  });

  it("tient entière sur un écran large, limitée par la hauteur (bouton Fermer compris)", () => {
    const { width, height } = fits({ width: 1920, height: 1080 });
    expect(height).toBeCloseTo(1080 - 32 - 56);
    expect(width).toBeLessThan(1920);
  });

  it("tient sur un téléphone en paysage", () => {
    const { height } = fits({ width: 844, height: 390 });
    expect(height).toBeLessThanOrEqual(390 - 32 - 56);
  });

  it("ne grossit pas au-delà de ce que l'illustration supporte", () => {
    expect(fits({ width: 5120, height: 2880 }).zoom).toBe(2.5);
  });

  it("reste positive sur une fenêtre minuscule", () => {
    expect(fits({ width: 20, height: 20 }).zoom).toBeGreaterThan(0);
  });
});
