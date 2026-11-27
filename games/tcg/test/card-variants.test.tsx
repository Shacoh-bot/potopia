import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardBench } from "../ui/CardBench";
import { GameCard } from "../ui/GameCard";
import { SPARK_VARIANTS, SR_SPARKS_FEW } from "../ui/v5";
import { pacedValues } from "../ui/visual-effects";
import { CARTES_TEST } from "./rendu/cartes";

/**
 * Refonte, étape 7 : variantes à choisir au banc d'essai (éclats des SR, mirage et énergie par
 * paliers). Le rendu du site ne change pas : sans option, la carte est celle d'avant.
 */
const sr = CARTES_TEST.find((t) => t.card.rarity === "sr");
if (!sr) throw new Error("aucune SR dans les cartes de test");
const carteSr = (props: Partial<Parameters<typeof GameCard>[0]> = {}) =>
  renderToStaticMarkup(<GameCard card={sr.card} imageUrl="data:," layout="normal" {...props} />);
const compte = (html: string, classe: string) =>
  (html.match(new RegExp(`class="${classe}[" ]`, "g")) ?? []).length;

describe("variantes de l'étape 7 (banc d'essai)", () => {
  it("sans option, la carte SR est identique à la variante « actuel »", () => {
    expect(carteSr()).toBe(carteSr({ sparks: "actuel", pacedEffects: false }));
    expect(compte(carteSr(), "tcg-sr-spark")).toBe(14);
  });

  it("chaque variante d'éclats a le nombre d'éléments animés annoncé", () => {
    expect(compte(carteSr({ sparks: "moins" }), "tcg-sr-spark")).toBe(SR_SPARKS_FEW.length);
    const groupes = carteSr({ sparks: "groupes" });
    expect(compte(groupes, "tcg-sr-spark-group")).toBe(3);
    expect(compte(groupes, "tcg-sr-spark tcg-sr-spark--fixe")).toBe(14);
    const image = carteSr({ sparks: "image" });
    expect(compte(image, "tcg-sr-spark-sprite")).toBe(1);
    expect(compte(image, "tcg-sr-spark")).toBe(0);
  });

  it("l'image pré-calculée existe : 30 vues de 312 × 432", () => {
    const png = readFileSync(
      new URL("../../../apps/web/public/tcg/eclats-sr.png", import.meta.url),
    );
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([30 * 312, 432]);
    const css = readFileSync(new URL("../ui/tcg.css", import.meta.url), "utf8");
    expect(css).toContain('url("/tcg/eclats-sr.png") 0 0 / 3000% 100%');
    expect(css).toContain("steps(30, jump-none)");
  });

  it("mirage et énergie par paliers seulement sur demande", () => {
    for (const fx of ["mirage", "energie"]) {
      const card = { ...sr.card, visualEffectKeys: [fx], visualEffectKeysFull: [fx] };
      const html = (paced: boolean) =>
        renderToStaticMarkup(
          <GameCard card={card} imageUrl="data:," layout="normal" pacedEffects={paced} />,
        );
      expect(html(false)).not.toContain("discrete");
      expect(html(true)).toContain('calcMode="discrete"');
    }
    expect(pacedValues("0;70;0;-70;0", 4)).toBe("0;70;0;-70");
    expect(pacedValues("0.012 0.06;0.016 0.09;0.012 0.06", 2)).toBe("0.012 0.06;0.016 0.09");
  });

  it("le banc propose les 4 variantes d'éclats et affiche la variante active", () => {
    const html = renderToStaticMarkup(
      <CardBench cards={[{ card: sr.card, imageUrl: "data:," }]} />,
    ).replaceAll("&#x27;", "'");
    for (const v of SPARK_VARIANTS) expect(html).toContain(v.label);
    expect(html).toContain("Variante active : Actuel : 14 éclats");
    expect(html).toContain("mirage et énergie actuels");
  });
});
