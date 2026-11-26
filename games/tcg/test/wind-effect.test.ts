import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectPlace, isRetiredEffect } from "../ui/effect-places";
import { VISUAL_EFFECTS, WIND_LAYERS, windTrail } from "../ui/visual-effects";

/**
 * Effet « Vent » : sur l'illustration seule (jamais sur le cadre de rareté), léger (trois calques
 * qui ne font que tourner), en sens inverse des aiguilles d'une montre.
 */
const css = readFileSync(new URL("../ui/tcg.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const migration = readFileSync(
  new URL(
    "../../../packages/db/prisma/migrations/20261126100000_tcg_visual_effects_vent/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("effet Vent", () => {
  it("est au catalogue et rendu, sur l'illustration seule", () => {
    expect(migration).toContain("('vent', 'Vent')");
    expect(VISUAL_EFFECTS.vent).toBeDefined();
    expect(effectPlace("vent")).toBe("art");
    expect(isRetiredEffect("vent")).toBe(false);
  });

  it("trois calques, dont les animations ne touchent que rotation et transparence", () => {
    expect(WIND_LAYERS).toHaveLength(3);
    for (const name of ["tcg-vfx-wind-spin", "tcg-vfx-wind-breathe"]) {
      const body = css.split(`@keyframes ${name} {`)[1]?.split("\n}")[0] ?? "";
      const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      expect(props.length).toBeGreaterThan(0);
      for (const p of props) expect(["rotate", "opacity"]).toContain(p);
    }
    // Un tour complet, en sens inverse des aiguilles d'une montre : boucle sans saut.
    expect(css).toMatch(/@keyframes tcg-vfx-wind-spin \{[\s\S]*?to \{\s*rotate: -360deg;/);
  });

  it("la tête d'une traînée est la plus nette, la queue derrière elle dans le sens du vent", () => {
    const pieces = windTrail(50, 0, 80);
    expect(pieces.map((p) => p.opacity)).toEqual([0.9, 0.55, 0.3, 0.12]);
    // Tête à l'angle 0 (à droite), queue vers les angles croissants (vers le bas à l'écran) :
    // le vent, qui tourne vers les angles décroissants, l'entraîne derrière sa tête.
    expect(pieces[0]?.d.startsWith("M 50.00 0.00 A 50 50 0 0 1")).toBe(true);
    const last = pieces.at(-1)?.d.split(" ") ?? [];
    expect(Number(last.at(-1))).toBeGreaterThan(0);
  });
});
