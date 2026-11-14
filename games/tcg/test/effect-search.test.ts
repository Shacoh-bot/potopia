import { describe, expect, it } from "vitest";
import { COST_FILTER_MAX, searchEffects } from "../src/effect-search";
import { EFFECTS, effectTriggers, getEffect, snapEffectKey } from "../src/effects";
import { SNAP_CARDS } from "../src/snap-cards";

const keys = (filters: Parameters<typeof searchEffects>[1]) =>
  searchEffects(EFFECTS, filters).map((e) => e.key);

describe("recherche d'effet dans l'admin", () => {
  it("sans filtre : tout le catalogue", () => {
    expect(searchEffects(EFFECTS, {})).toHaveLength(EFFECTS.length);
  });

  it("par nom de carte Snap, sans casse ni accents", () => {
    expect(keys({ query: "squirrel girl" })).toContain(snapEffectKey("Squirrel Girl"));
    expect(keys({ query: "ARANA" })).toContain(snapEffectKey("Araña"));
  });

  it("par mot du texte français, chaque mot devant y être", () => {
    const found = searchEffects(EFFECTS, { query: "ecureuil lieu" });
    expect(found.map((e) => e.key)).toContain(snapEffectKey("Squirrel Girl"));
    expect(searchEffects(EFFECTS, { query: "écureuil zzzzz" })).toHaveLength(0);
  });

  it("par moment : tous les moments d'une carte, pas seulement le principal", () => {
    const electro = getEffect(snapEffectKey("Electro"));
    if (!electro) throw new Error("Electro manquant");
    expect(electro.trigger).toBe("reveal");
    expect(effectTriggers(electro)).toEqual(["reveal", "ongoing"]);
    expect(keys({ trigger: "ongoing" })).toContain(electro.key);
    expect(keys({ trigger: "reveal" })).toContain(electro.key);
    expect(keys({ query: "electro", trigger: "ongoing" })).toEqual([electro.key]);
    // Khonshu : Défaussée puis Révélation ; Mysterio : Révélation puis Activation
    expect(keys({ trigger: "reveal" })).toContain(snapEffectKey("Khonshu"));
    expect(keys({ trigger: "activate" })).toContain(snapEffectKey("Mysterio"));
    // « un effet Révélation » au milieu d'une phrase n'est pas un moment
    const absorbing = getEffect(snapEffectKey("Absorbing Man"));
    if (!absorbing) throw new Error("Absorbing Man manquant");
    expect(effectTriggers(absorbing)).toEqual(["reveal"]);
    // chaque effet a au moins son moment principal, en premier
    for (const e of EFFECTS) expect(effectTriggers(e)[0]).toBe(e.trigger);
  });

  it("par moment et par coût de la carte Snap (6 : 6 ou plus)", () => {
    for (const e of searchEffects(EFFECTS, { trigger: "discarded" })) {
      expect(e.trigger).toBe("discarded");
    }
    expect(keys({ trigger: "discarded" })).toContain(snapEffectKey("Swarm"));
    for (const e of searchEffects(EFFECTS, { cost: 1 })) expect(SNAP_CARDS[e.snap]?.cost).toBe(1);
    for (const e of searchEffects(EFFECTS, { cost: COST_FILTER_MAX })) {
      expect(SNAP_CARDS[e.snap]?.cost).toBeGreaterThanOrEqual(COST_FILTER_MAX);
    }
    expect(keys({ query: "thor", trigger: "reveal", cost: 3 })).toContain(snapEffectKey("Thor"));
    expect(keys({ query: "thor", cost: 4 })).not.toContain(snapEffectKey("Thor"));
  });
});
