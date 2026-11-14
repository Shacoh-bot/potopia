import { describe, expect, it } from "vitest";
import {
  BASE_EFFECTS,
  defaultParams,
  EFFECTS,
  effectStats,
  effectText,
  getEffect,
  paramsSchema,
  snapEffectKey,
  TRIGGER_LABELS,
} from "../src/effects";
import { SNAP_CARDS } from "../src/snap-cards";

/** Clés des premiers effets : des cartes en base les utilisent, elles ne changent jamais. */
const STABLE_KEYS = [
  "reveal_debuff_enemies_here",
  "reveal_steal_power_all_here",
  "reveal_debuff_everything",
  "reveal_buff_allies_here",
  "reveal_buff_two_allies",
  "reveal_buff_hand",
  "reveal_draw",
  "reveal_copy_to_hand",
  "reveal_enemy_card_cost_up",
  "reveal_move_strongest_enemy",
  "reveal_move_allies_left",
  "reveal_destroy_enemy_power_10",
  "reveal_destroy_all_one_cost",
  "reveal_destroy_own_gain",
  "reveal_summon_token",
  "reveal_add_random_card",
  "reveal_copy_leftmost_hand_card",
  "reveal_discard_rightmost",
  "reveal_swap_cost_power_deck",
  "reveal_silence_ongoing_here",
  "reveal_energy_next_turn",
  "reveal_if_no_play_here_next",
  "reveal_if_play_here_next",
  "reveal_pull_enemies_cost_3_4",
  "reveal_silence_unrevealed_enemies_here",
  "reveal_flood_location",
  "reveal_destroy_other_locations",
  "reveal_move_and_pull_enemy",
  "reveal_debuff_weakest_enemy_silence",
  "reveal_all_costs_up_next_turn",
  "reveal_merge_into_ally_here",
  "reveal_add_clones_here",
  "reveal_last_played_moves_here",
  "reveal_set_all_here_to_3",
  "reveal_destroy_own_other_locations",
  "reveal_reset_power_here",
  "reveal_repeat_reveals_here",
  "reveal_power_per_ally_here",
  "reveal_destroy_power_at_most_here",
  "reveal_move_away_enemies_played_here",
  "reveal_copy_strongest_enemy_played",
  "reveal_destroy_enemy_one_cost_here",
  "reveal_power_to_next_card",
  "reveal_recruit_cheapest_enemy_deck",
  "reveal_draw_from_enemy_deck",
  "reveal_move_enemy_right",
  "reveal_add_clone_here",
  "reveal_return_discarded_here",
  "reveal_banish_top_add_rocks",
  "reveal_cost_cap_4",
  "reveal_set_hand_power_3",
  "ongoing_buff_allies_here",
  "ongoing_buff_one_cost",
  "ongoing_debuff_cheap_here",
  "ongoing_block_location",
  "ongoing_double_power_here",
  "ongoing_double_reveal_here",
  "ongoing_hand_cost_down",
  "ongoing_protect_here",
  "ongoing_grow_on_play_here",
  "ongoing_power_per_hand_card",
  "ongoing_can_move_once",
  "ongoing_move_away_cost_3_4_played_here",
  "ongoing_power_per_location_with_destroyed",
  "ongoing_hide_plays_here",
  "ongoing_power_per_enemy_here",
  "ongoing_first_card_here",
  "ongoing_split_power_evenly",
  "ongoing_unshakable",
  "ongoing_see_plays_turn_5",
  "ongoing_no_reveals_here",
  "ongoing_enemies_here_cant_move",
  "ongoing_moves_when_card_played_here",
  "ongoing_buff_if_both_sides_full",
  "end_of_turn_grow",
  "end_of_turn_discard_self_from_hand",
  "end_of_turn_damage_all_here",
  "end_of_turn_double_if_losing",
  "destroyed_return_stronger",
  "destroyed_buff_allies",
  "hand_replace_destroyed_ally",
  "hand_cost_down_per_big_ally",
  "hand_cost_down_per_destroyed",
  "hand_cost_down_per_card_last_turn",
  "end_of_game_move_to_win",
];

/** Les 17 effets Snap choisis par l'utilisateur pour ses cartes (13/11/2026). */
const REQUESTED = [
  "Thor",
  "Hobgoblin",
  "Red Hulk",
  "Debrii",
  "Typhoid Mary",
  "Vision",
  "Human Torch",
  "Polaris",
  "Scorpion",
  "Namor",
  "Absorbing Man",
  "Yondu",
  "Blue Marvel",
  "Squirrel Girl",
  "Swarm",
  "Rocket Raccoon",
];

describe("catalogue Marvel Snap complet", () => {
  it("une entrée par carte de collection, avec ses stats, et des clés uniques", () => {
    const snaps = new Set(EFFECTS.map((e) => e.snap));
    for (const name of Object.keys(SNAP_CARDS)) expect(snaps, name).toContain(name);
    expect(EFFECTS).toHaveLength(Object.keys(SNAP_CARDS).length);
    const keys = EFFECTS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("les clés des premiers effets sont toutes là, inchangées", () => {
    expect(BASE_EFFECTS.map((e) => e.key)).toEqual(STABLE_KEYS);
    for (const key of STABLE_KEYS) expect(getEffect(key), key).not.toBeNull();
  });

  it("les effets choisis par l'utilisateur sont là, avec les stats de leur carte Snap", () => {
    for (const snap of REQUESTED) {
      const effect = EFFECTS.find((e) => e.snap === snap);
      expect(effect, snap).toBeDefined();
      expect(effectStats(effect?.key ?? null)).toEqual({
        cost: SNAP_CARDS[snap]?.cost,
        power: SNAP_CARDS[snap]?.power,
      });
    }
    // relevés sur snap.fan le 13/11/2026
    expect(effectStats(snapEffectKey("Hobgoblin"))).toEqual({ cost: 5, power: -8 });
    expect(effectStats(snapEffectKey("Swarm"))).toEqual({ cost: 1, power: 3 });
  });

  it("chaque effet : moment connu, libellé, texte en français fini, réglages valides", () => {
    for (const effect of EFFECTS) {
      expect(Object.keys(TRIGGER_LABELS), effect.key).toContain(effect.trigger);
      expect(effect.label.length, effect.key).toBeGreaterThan(0);
      const text = effectText(effect.key, defaultParams(effect));
      expect(text, effect.key).toMatch(/\.$/);
      expect(text, effect.key).not.toMatch(/[{}]/);
      // les réglages par défaut passent la validation
      const params = Object.fromEntries(
        effect.params.map((p) => [p.name, p.kind === "int" ? p.default : p.default || "Test"]),
      );
      expect(() => paramsSchema(effect).parse(params), effect.key).not.toThrow();
    }
  });

  it("le jeton se renomme : l'effet de Thor peut mélanger un « Grosmarto ! »", () => {
    const thor = getEffect(snapEffectKey("Thor"));
    if (!thor) throw new Error("Thor manquant");
    expect(thor.params.find((p) => p.name === "name")).toMatchObject({
      kind: "text",
      default: "Mjolnir",
    });
    expect(effectText(thor.key, { name: "Grosmarto !" })).toMatch(
      /^Révélation : mélange Grosmarto ! dans ta pioche/,
    );
    expect(effectText(thor.key, defaultParams(thor))).toContain("Mjolnir");
  });

  it("clé d'un effet Snap : sans accents ni ponctuation", () => {
    expect(snapEffectKey("Squirrel Girl")).toBe("snap_squirrel_girl");
    expect(snapEffectKey("Araña")).toBe("snap_arana");
    expect(snapEffectKey("Jeff the Baby Dolphin!?")).toBe("snap_jeff_the_baby_dolphin");
  });
});
