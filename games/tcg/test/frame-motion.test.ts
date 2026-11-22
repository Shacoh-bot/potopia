import { describe, expect, it } from "vitest";
import { FRAME_MOTION, RARITY_FRAME } from "../ui/v5";

describe("cadre animé selon la rareté", () => {
  it("la SSR a les comètes d'énergie (SSR-2), sur son cadre arc-en-ciel", () => {
    expect(FRAME_MOTION.ssr).toBe("comets");
    expect(RARITY_FRAME.ssr).toContain("conic-gradient");
  });
  it("la SR a le carmin étoilé d'or (SR-2), sur un cadre carmin", () => {
    expect(FRAME_MOTION.sr).toBe("carmine");
    expect(RARITY_FRAME.sr).toContain("#b0063a");
  });
  it("les autres raretés gardent un cadre immobile", () => {
    expect(Object.keys(FRAME_MOTION).sort()).toEqual(["sr", "ssr"]);
  });
});
