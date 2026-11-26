import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectPlace, isRetiredEffect } from "../ui/effect-places";
import { VISUAL_EFFECTS, WIND_GUSTS, WIND_HOPS, windStreak } from "../ui/visual-effects";

/**
 * Effet « Vent » : de vraies bourrasques sur l'illustration seule (jamais sur le cadre de rareté) :
 * beaucoup de petits traits qui filent vite et s'effacent, un peu partout, autour du tourbillon.
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

  it("des bourrasques : beaucoup de coups de vent, tous décalés, qui changent de place", () => {
    expect(WIND_GUSTS.length).toBeGreaterThanOrEqual(30);
    const streaks = WIND_GUSTS.filter((g) => g.kind === "streak");
    expect(streaks.length).toBeGreaterThanOrEqual(20);
    // Un trait n'est visible qu'au premier tiers de son passage (≈ 0,32 × durée) : 0,4 à 0,9 s.
    for (const g of streaks) {
      expect(g.duration * 0.32).toBeGreaterThanOrEqual(0.4);
      expect(g.duration * 0.32).toBeLessThanOrEqual(0.95);
    }
    // Tous décalés, et chaque coup saute ailleurs entre deux passages.
    expect(new Set(WIND_GUSTS.map((g) => g.delay.toFixed(3))).size).toBe(WIND_GUSTS.length);
    for (const g of WIND_GUSTS) {
      expect(g.hops).toHaveLength(WIND_HOPS);
      const spots = new Set(g.hops.map((h) => `${Math.round(h.x)}:${Math.round(h.y)}`));
      expect(spots.size).toBe(WIND_HOPS);
      for (const h of g.hops) {
        expect(Math.abs(h.x)).toBeLessThanOrEqual(70);
        expect(Math.abs(h.y)).toBeLessThanOrEqual(100);
      }
    }
  });

  it("suit le tourbillon dans le sens des aiguilles d'une montre (à l'écran)", () => {
    // Orientation moyenne d'un trait par rapport à la tangente horaire en sa place : proche de 0.
    const offsets = WIND_GUSTS.filter((g) => g.kind === "streak").flatMap((g) =>
      g.hops.map((h) => {
        const tangent = (Math.atan2(h.y, h.x) * 180) / Math.PI + 90;
        return ((((h.angle - tangent) % 360) + 540) % 360) - 180;
      }),
    );
    for (const o of offsets) expect(Math.abs(o)).toBeLessThanOrEqual(28.01);
  });

  it("animations : tracé, transparence et sauts de place seulement (ni 3D, ni filtre)", () => {
    const allowed = ["transform", "opacity", "stroke-dashoffset"];
    for (const name of ["tcg-vfx-gust-hop", "tcg-vfx-gust-draw", "tcg-vfx-gust-mote"]) {
      const body = css.split(`@keyframes ${name} {`)[1]?.split("\n}")[0] ?? "";
      const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      expect(props.length).toBeGreaterThan(0);
      for (const p of props) expect(allowed).toContain(p);
    }
    const hop = css.split("@keyframes tcg-vfx-gust-hop {")[1]?.split("\n}")[0] ?? "";
    expect(hop).not.toMatch(/3d|perspective|scale/);
  });

  it("un trait de vent file vers l'avant, avec parfois une boucle au bout", () => {
    expect(windStreak(40, 0.2, false)).toMatch(/^M 0 0 Q 20\.00 8\.00 40\.00 4\.80$/);
    expect(windStreak(40, 0.2, true).match(/ c /g)).toHaveLength(2);
    expect(WIND_GUSTS.some((g) => g.d.includes(" c "))).toBe(true);
  });
});
