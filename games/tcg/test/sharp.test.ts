import { describe, expect, it } from "vitest";
import { needsLarger } from "../ui/sharp";

// Version réduite d'une image portrait : 533 × 800 px.
const small = { width: 533, height: 800 };

describe("needsLarger : la grande image quand la petite serait floue", () => {
  it("petite carte d'une planche (fenêtre 381 × 248) : la version réduite suffit", () => {
    // en cover, l'image fait 381 × 572 à l'écran : 0,71 pixel écran par pixel d'image
    expect(needsLarger({ width: 381, height: 572 }, small, 1)).toBe(false);
  });

  it("carte agrandie ×2,5 ou écran haute densité : la grande", () => {
    expect(needsLarger({ width: 715, height: 1073 }, small, 1)).toBe(true);
    expect(needsLarger({ width: 381, height: 572 }, small, 2)).toBe(true);
  });

  it("sans taille d'image connue : rien", () => {
    expect(needsLarger({ width: 500, height: 500 }, { width: 0, height: 0 }, 1)).toBe(false);
  });
});
