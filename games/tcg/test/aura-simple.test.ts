import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARD_AURA_FINISHES } from "../ui/v5";

/**
 * Aura simple (`.tcg-aura`) : une lueur fixe qui suit le contour de la carte, pour les épiques,
 * légendaires, SR et SSR ; rien pour commune, peu commune et rare. Aucune animation (choix de
 * l'utilisateur, 27/11 : la respiration coûtait trop sur le Potodex) : une ombre dessinée une fois.
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

  it("fixe : aucune animation, aucune couche promue (choix de l'utilisateur, 27/11)", () => {
    const rule = css.split(".tcg-aura {")[1]?.split("}")[0] ?? "";
    expect(rule).toContain("inset: 0");
    expect(rule).not.toMatch(/animation|will-change/);
    for (const r of CARD_AURA_FINISHES) {
      const own = css.split(`.tcg-aura[data-rarity="${r}"] {`)[1]?.split("}")[0] ?? "";
      expect(own).toContain("box-shadow");
      expect(own).not.toMatch(/animation|will-change|opacity/);
    }
    expect(css).not.toContain("tcg-aura-breathe");
  });
});
