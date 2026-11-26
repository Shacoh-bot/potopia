import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARD_AURA_FINISHES } from "../ui/v5";

/**
 * Aura simple (`.tcg-aura`) : une lueur qui suit le contour de la carte et respire, pour les
 * épiques, légendaires, SR et SSR ; rien pour commune, peu commune et rare. Légère : ombre figée,
 * seule l'opacité s'anime ; elle respire aussi sur la planche figée du Potodex.
 */
const css = readFileSync(new URL("../ui/tcg.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("aura simple des cartes", () => {
  it("épique, légendaire, SR et SSR seulement", () => {
    expect([...CARD_AURA_FINISHES].sort()).toEqual(["epic", "legendary", "sr", "ssr"]);
    for (const r of CARD_AURA_FINISHES) expect(css).toContain(`.tcg-aura[data-rarity="${r}"]`);
    for (const r of ["common", "uncommon", "rare"])
      expect(css).not.toContain(`.tcg-aura[data-rarity="${r}"]`);
  });

  it("respire en transparence seulement, lentement", () => {
    const body = css.split("@keyframes tcg-aura-breathe {")[1]?.split("\n}")[0] ?? "";
    const props = [...body.matchAll(/^\s*([a-z-]+):/gm)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(p).toBe("opacity");
    const rule = css.split(".tcg-aura {")[1]?.split("}")[0] ?? "";
    const seconds = Number(/tcg-aura-breathe ([\d.]+)s/.exec(rule)?.[1]);
    expect(seconds).toBeGreaterThanOrEqual(3);
    expect(seconds).toBeLessThanOrEqual(4);
  });

  it("respire aussi sur la planche figée du Potodex", () => {
    const still = css.split(".tcg-still:not([data-live]) :not(")[1]?.split(")")[0] ?? "";
    expect(still).toContain(".tcg-aura");
  });
});
