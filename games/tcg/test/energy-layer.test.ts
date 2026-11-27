import { describe, expect, it } from "vitest";
import { applyEnergyMask, energyMaskAlpha } from "../ui/energy-layer";

/**
 * Couche de l'énergie calculée une fois (energy-layer.ts) : même masque que l'ancien filtre SVG
 * (saturation × luminosité). Valeurs attendues calculées à la main sur la chaîne du filtre.
 */
describe("couche masquée de l'énergie", () => {
  it("garde les couleurs vives et claires, efface le gris, le blanc et le sombre", () => {
    expect(energyMaskAlpha(128, 128, 128)).toBe(0);
    expect(energyMaskAlpha(255, 255, 255)).toBe(0);
    expect(energyMaskAlpha(120, 0, 0)).toBe(0); // rouge sombre : sous le seuil de luminosité
    expect(energyMaskAlpha(255, 0, 0)).toBe(0); // rouge pur : luminosité 0,9 − 1,2 < 0
    expect(energyMaskAlpha(0, 255, 255)).toBeCloseTo(0.9 * 0.9, 5); // cyan
    expect(energyMaskAlpha(255, 255, 0)).toBeCloseTo(0.9, 5); // jaune : luminosité bornée à 1
    expect(energyMaskAlpha(0, 255, 0)).toBeCloseTo(0.9 * 0.57, 5); // vert
  });

  it("n'agit que sur l'opacité, pixel par pixel", () => {
    const px = new Uint8ClampedArray([0, 255, 255, 255, 128, 128, 128, 255, 255, 255, 0, 100]);
    applyEnergyMask(px);
    expect([...px]).toEqual([0, 255, 255, 207, 128, 128, 128, 0, 255, 255, 0, 90]);
  });
});
