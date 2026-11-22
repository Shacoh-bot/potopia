import { describe, expect, it } from "vitest";
import { FRAME_MOTION, RARITY_FRAME } from "../ui/v5";

describe("cadre animé selon la rareté", () => {
  it("seule la SSR a les comètes d'énergie (SSR-2), sur son cadre arc-en-ciel", () => {
    expect(FRAME_MOTION).toEqual({ ssr: "comets" });
    expect(RARITY_FRAME.ssr).toContain("conic-gradient");
  });
  it("la SR et la légendaire gardent un cadre immobile", () => {
    expect(FRAME_MOTION.sr).toBeUndefined();
    expect(FRAME_MOTION.legendary).toBeUndefined();
  });
});
