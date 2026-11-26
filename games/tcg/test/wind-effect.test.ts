import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectPlace, isRetiredEffect } from "../ui/effect-places";
import { VISUAL_EFFECTS, WIND_GUSTS, WIND_HOPS, windStreak } from "../ui/visual-effects";

/**
 * Effet « Vent » : de vraies bourrasques sur l'illustration seule (jamais sur le cadre de rareté) :
 * traînées de lumière effilées et étincelles sur de très grands arcs (haut : vers la droite, bas : vers la gauche).
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
      expect(new Set(g.hops.map((h) => `${Math.round(h.cx)}:${Math.round(h.cy)}`)).size).toBe(
        WIND_HOPS,
      );
    }
  });

  it("très grands arcs presque droits : jamais de tour, ni de demi-tour", () => {
    for (const g of WIND_GUSTS) {
      // rayon bien plus grand que la carte (200 de haut) : centre hors de la carte
      expect(g.radius).toBeGreaterThanOrEqual(200);
      for (const h of g.hops) {
        expect(h.end - h.angle).toBeGreaterThan(0);
        expect(h.end - h.angle).toBeLessThanOrEqual(40);
        expect(Math.abs(h.cy)).toBeGreaterThan(100);
      }
    }
  });

  it("gauche → droite dans la moitié haute, droite → gauche dans la moitié basse", () => {
    const head = (h: (typeof WIND_GUSTS)[number]["hops"][number], r: number, a: number) => ({
      x: h.cx + r * Math.cos((a * Math.PI) / 180),
      y: h.cy + r * Math.sin((a * Math.PI) / 180),
    });
    const bands = new Set<string>();
    for (const g of WIND_GUSTS) {
      for (const h of g.hops) {
        bands.add(h.band);
        const from = head(h, g.radius, h.angle);
        const to = head(h, g.radius, h.end);
        if (h.band === "haut") {
          expect(from.y).toBeLessThan(0);
          expect(to.x).toBeGreaterThan(from.x);
        }
        if (h.band === "bas") {
          expect(from.y).toBeGreaterThan(0);
          expect(to.x).toBeLessThan(from.x);
        }
        // de part et d'autre, le trait reste presque droit : il monte ou descend très peu
        expect(Math.abs(to.y - from.y)).toBeLessThan(Math.abs(to.x - from.x) * 0.35);
      }
    }
    expect([...bands].sort()).toEqual(["bas", "haut", "milieu"]);
  });

  it("couleurs de l'illustration et cœur clair, pas de blanc plat", () => {
    const colors = new Set(WIND_GUSTS.map((g) => g.color));
    expect(colors.size).toBeGreaterThanOrEqual(4);
    expect(colors.has("#ffffff")).toBe(false);
  });

  it("animation : déplacement, rotation et transparence seulement (ni 3D, ni filtre)", () => {
    const body = css.split("@keyframes tcg-vfx-gust-fly {")[1]?.split("\n}")[0] ?? "";
    const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(["transform", "opacity"]).toContain(p);
    expect(body).not.toMatch(/3d|perspective|matrix|scale/);
    for (let k = 0; k < WIND_HOPS; k++) expect(body).toContain(`var(--w-e${k})`);
  });

  it("une traînée est effilée : épaisse à la tête, nulle au bout de la queue", () => {
    const d = windStreak(10, 2, 300);
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
    // la queue est derrière la tête (angles négatifs)
    expect((outer[12] as number[])[1]).toBeLessThan(0);
  });
});
