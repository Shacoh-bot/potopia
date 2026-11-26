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

  it("cinq calques, dont les animations ne touchent que rotation, déplacement, transparence", () => {
    expect(WIND_LAYERS).toHaveLength(5);
    const names = [
      "tcg-vfx-wind-gust-a",
      "tcg-vfx-wind-gust-b",
      "tcg-vfx-wind-sway",
      "tcg-vfx-wind-breathe",
      "tcg-vfx-wind-motes-breathe",
    ];
    for (const name of names) {
      const body = css.split(`@keyframes ${name} {`)[1]?.split("\n}")[0] ?? "";
      const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      expect(props.length).toBeGreaterThan(0);
      for (const p of props) expect(["rotate", "translate", "opacity"]).toContain(p);
    }
    // Rafales : un tour complet dans le sens des aiguilles d'une montre (boucle sans saut), à
    // vitesse inégale (le premier quart ne fait pas 90°).
    for (const g of ["a", "b"]) {
      const body = css.split(`@keyframes tcg-vfx-wind-gust-${g} {`)[1]?.split("\n}")[0] ?? "";
      expect(body).toMatch(/0% \{\s*rotate: 0deg;/);
      expect(body).toMatch(/100% \{\s*rotate: 360deg;/);
      expect(body).not.toMatch(/25% \{\s*rotate: 90deg;/);
    }
    // Pas deux calques au même pas.
    expect(new Set(WIND_LAYERS.map((l) => l.duration)).size).toBe(WIND_LAYERS.length);
  });

  it("la tête d'une traînée est la plus nette, la queue derrière elle dans le sens du vent", () => {
    const pieces = windTrail(50, 0, 80);
    expect(pieces.map((p) => p.opacity)).toEqual([1, 0.68, 0.4, 0.16]);
    // Tête à l'angle 0 (à droite), queue vers les angles décroissants (vers le haut à l'écran) :
    // le vent, qui tourne vers les angles croissants, l'entraîne derrière sa tête.
    expect(pieces[0]?.d.startsWith("M 50.00 0.00 L")).toBe(true);
    const last = pieces.at(-1)?.d.split(" ") ?? [];
    expect(Number(last.at(-1))).toBeLessThan(0);
  });

  it("pas une orbite : le rayon change le long d'une traînée", () => {
    const radii = windTrail(50, 0, 120, 0.3, 0.08)
      .flatMap((p) => p.d.split(/[ML]/).filter((x) => x.trim()))
      .map((pt) => Math.hypot(...pt.trim().split(" ").map(Number)));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(8);
  });
});
