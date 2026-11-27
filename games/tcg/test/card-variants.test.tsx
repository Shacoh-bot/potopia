import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardBench } from "../ui/CardBench";
import { GameCard } from "../ui/GameCard";
import { pacedValues } from "../ui/visual-effects";
import { CARTES_TEST } from "./rendu/cartes";

/**
 * Refonte, étape 7 : éclats des SR en image animée pré-calculée (choix de l'utilisateur, 27/11),
 * et mirage et énergie par paliers, option du banc d'essai seulement.
 */
const sr = CARTES_TEST.find((t) => t.card.rarity === "sr");
if (!sr) throw new Error("aucune SR dans les cartes de test");
const carteSr = (props: Partial<Parameters<typeof GameCard>[0]> = {}) =>
  renderToStaticMarkup(<GameCard card={sr.card} imageUrl="data:," layout="normal" {...props} />);
const compte = (html: string, classe: string) =>
  (html.match(new RegExp(`class="${classe}[" ]`, "g")) ?? []).length;

describe("éclats SR et options du banc d'essai", () => {
  it("une carte SR porte ses éclats en une seule image animée", () => {
    expect(compte(carteSr(), "tcg-sr-spark-sprite")).toBe(1);
    expect(compte(carteSr(), "tcg-sr-spark")).toBe(0);
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
      // Énergie : teinte en CSS (27/11), paliers par une autre animation ; mirage : SVG discret.
      const marque = fx === "energie" ? "tcg-vfx-energie-hue--paliers" : 'calcMode="discrete"';
      expect(html(false)).not.toContain(marque);
      expect(html(false)).not.toContain("discrete");
      expect(html(true)).toContain(marque);
    }
    expect(pacedValues("0;70;0;-70;0", 4)).toBe("0;70;0;-70");
    expect(pacedValues("0.012 0.06;0.016 0.09;0.012 0.06", 2)).toBe("0.012 0.06;0.016 0.09");
  });

  it("le banc n'a plus de choix d'éclats et affiche l'option active", () => {
    const html = renderToStaticMarkup(
      <CardBench cards={[{ card: sr.card, imageUrl: "data:," }]} />,
    ).replaceAll("&#x27;", "'");
    expect(html).not.toContain("Éclats dorés des SR");
    expect(html).toContain("Variante active : mirage et énergie actuels");
  });
});
