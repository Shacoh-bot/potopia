import { describe, expect, it } from "vitest";
import { openingPlan } from "../ui/opening";

describe("déroulé de l'ouverture d'un booster", () => {
  it("se joue en entier : paquet, découpe, relais vidéo", () => {
    expect(openingPlan(false)).toEqual({ startPhase: "pack", fromVideo: true, packFloat: true });
  });

  it("avec « réduire les animations », ne saute jamais l'ouverture (seul le flottement s'arrête)", () => {
    const plan = openingPlan(true);
    expect(plan.startPhase).toBe("pack");
    expect(plan.fromVideo).toBe(true);
    expect(plan.packFloat).toBe(false);
  });
});
