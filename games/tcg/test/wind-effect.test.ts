import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectPlace, isRetiredEffect } from "../ui/effect-places";
import { VISUAL_EFFECTS, WIND_GUSTS, WIND_HOPS, windStreak } from "../ui/visual-effects";

/**
 * Effet « Vent » : de vraies bourrasques sur l'illustration seule (jamais sur le cadre de rareté) :
 * traînées de lumière effilées et étincelles qui filent autour du tourbillon puis s'effacent.
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

  it("des bourrasques : beaucoup de coups de vent, tous décalés, qui repartent d'ailleurs", () => {
    const streaks = WIND_GUSTS.filter((g) => g.kind === "streak");
    expect(streaks.length).toBeGreaterThanOrEqual(20);
    expect(WIND_GUSTS.filter((g) => g.kind !== "streak").length).toBeGreaterThanOrEqual(15);
    // Une traînée n'est visible que 8 % de son cycle de 4 passages (0,32 × un passage) : 0,4-0,95 s.
    for (const g of streaks) {
      expect(g.duration * 0.32).toBeGreaterThanOrEqual(0.4);
      expect(g.duration * 0.32).toBeLessThanOrEqual(0.95);
    }
    expect(new Set(WIND_GUSTS.map((g) => g.delay.toFixed(5))).size).toBe(WIND_GUSTS.length);
    for (const g of WIND_GUSTS) {
      expect(g.hops).toHaveLength(WIND_HOPS);
      expect(new Set(g.hops.map((h) => Math.round(h.angle))).size).toBe(WIND_HOPS);
      // sens des aiguilles d'une montre à l'écran : l'angle croît pendant le passage
      for (const h of g.hops) expect(h.end).toBeGreaterThan(h.angle + 40);
    }
  });

  it("couleurs de l'illustration et cœur clair, pas de blanc plat", () => {
    const colors = new Set(WIND_GUSTS.map((g) => g.color));
    expect(colors.size).toBeGreaterThanOrEqual(4);
    expect(colors.has("#ffffff")).toBe(false);
  });

  it("animation : rotation, échelle et transparence seulement (ni 3D, ni filtre)", () => {
    const body = css.split("@keyframes tcg-vfx-gust-fly {")[1]?.split("\n}")[0] ?? "";
    const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(["transform", "opacity"]).toContain(p);
    expect(body).not.toMatch(/3d|perspective|translate|matrix/);
    for (let k = 0; k < WIND_HOPS; k++) expect(body).toContain(`var(--w-e${k})`);
  });

  it("une traînée est effilée : épaisse à la tête, nulle au bout de la queue", () => {
    const d = windStreak(60, 2);
    // « M tête … queue (bord extérieur) L queue … tête (bord intérieur) A … Z »
    const pts = (d.split(" A ")[0] ?? "")
      .replace("M ", "")
      .split(" L ")
      .map((x) => x.split(" ").map(Number));
    const outer = pts.slice(0, 13);
    const inner = pts.slice(13, 26).reverse();
    const gap = (i: number) =>
      Math.hypot(...(outer[i] as number[])) - Math.hypot(...(inner[i] as number[]));
    expect(gap(0)).toBeCloseTo(4, 1);
    expect(gap(6)).toBeLessThan(gap(0));
    expect(gap(12)).toBeCloseTo(0, 5);
    // la queue est derrière la tête (angles négatifs : vers le haut à droite de l'écran)
    expect((outer[12] as number[])[1]).toBeLessThan(0);
  });
});
