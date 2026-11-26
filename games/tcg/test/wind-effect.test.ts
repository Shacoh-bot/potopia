import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectPlace, isRetiredEffect } from "../ui/effect-places";
import {
  VISUAL_EFFECTS,
  WIND_GUIDES,
  WIND_GUSTS,
  WIND_HOPS,
  windHead,
  windStreak,
} from "../ui/visual-effects";

/**
 * Effet « Vent » : de vraies bourrasques sur l'illustration seule (jamais sur le cadre de rareté) :
 * traînées de lumière effilées et étincelles qui glissent le long des tourbillons peints (haut : vers la droite, bas : vers la gauche).
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
      expect(new Set(g.hops.map((h) => `${h.guide}:${Math.round(h.angle)}`)).size).toBe(WIND_HOPS);
    }
  });

  it("glisse le long des courbes peintes : un quart de tour au plus, toutes les courbes servent", () => {
    expect(WIND_GUIDES.length).toBeGreaterThanOrEqual(6);
    expect(WIND_GUIDES.length).toBeLessThanOrEqual(10);
    // des bandes serrées et aplaties près de la boule aux remous plus ronds du fond
    const flat = WIND_GUIDES.map((g) => g.ry / g.rx);
    expect(Math.min(...flat)).toBeLessThan(0.5);
    expect(Math.max(...flat)).toBeGreaterThan(0.75);
    const used = new Set<number>();
    for (const g of WIND_GUSTS) {
      for (const h of g.hops) {
        used.add(h.guide);
        expect(h.end - h.angle).toBeGreaterThan(0);
        expect(h.end - h.angle).toBeLessThanOrEqual(90);
      }
    }
    expect(used.size).toBe(WIND_GUIDES.length);
  });

  it("gauche → droite en haut des courbes, droite → gauche en bas, et ça tourne vraiment", () => {
    const bands = new Set<string>();
    let bent = 0;
    for (const g of WIND_GUSTS) {
      for (const h of g.hops) {
        bands.add(h.band);
        const from = windHead(h.guide, h.angle);
        const to = windHead(h.guide, h.end);
        const mid = windHead(h.guide, (h.angle + h.end) / 2);
        if (h.band === "haut") expect(to.x).toBeGreaterThan(from.x);
        else expect(to.x).toBeLessThan(from.x);
        // courbe, pas un trait droit : le milieu s'écarte de la corde
        const chord = Math.hypot(to.x - from.x, to.y - from.y);
        const off =
          Math.abs((to.x - from.x) * (from.y - mid.y) - (from.x - mid.x) * (to.y - from.y)) / chord;
        if (off > chord * 0.06) bent++;
      }
    }
    expect([...bands].sort()).toEqual(["bas", "haut"]);
    expect(bent).toBeGreaterThan(WIND_GUSTS.length * WIND_HOPS * 0.5);
  });

  it("couleurs de l'illustration et cœur clair, pas de blanc plat", () => {
    const colors = new Set(WIND_GUSTS.map((g) => g.color));
    expect(colors.size).toBeGreaterThanOrEqual(4);
    expect(colors.has("#ffffff")).toBe(false);
  });

  it("animation : déplacement, rotation, échelle et transparence seulement (ni 3D, ni filtre)", () => {
    const body = css.split("@keyframes tcg-vfx-gust-fly {")[1]?.split("\n}")[0] ?? "";
    const props = [...body.matchAll(/^\s*([a-z-]+):/gm)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(["transform", "opacity"]).toContain(p);
    expect(body).not.toMatch(/3d|perspective|matrix/);
    for (let k = 0; k < WIND_HOPS; k++) expect(body).toContain(`var(--w-e${k})`);
  });

  it("une traînée est effilée : épaisse à la tête, nulle au bout de la queue", () => {
    const d = windStreak(30, 2, 100);
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
