import "../../ui/tcg.css";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameCard, GameCardDefs } from "../../ui/GameCard";
import { H, R, W } from "../../ui/v2";
import { bandClip, CORNER_T, FRAME_LOOP } from "../../ui/v5";
import { carte } from "./cartes";

/**
 * Coin « carré » du cadre SR/SSR (défaut vu par l'utilisateur, 27/11) : les 4 bandes de lumière du
 * cadre, à bouts droits, se chevauchaient aux coins et s'arrêtaient dans l'angle arrondi sur des
 * lignes droites (carré de lumière, net quand la couleur de la SSR passait). Dans Firefox et Chrome :
 * bandes coupées en biais (coin partagé sur sa diagonale), qui couvrent tout le tour, et découpe du
 * cadre arrondie dehors et dedans.
 */
let root: Root | null = null;
afterEach(() => {
  root?.unmount();
  root = null;
  document.body.replaceChildren();
});

describe("cadre SR/SSR : coins", () => {
  it("tour de lumière recalé aux coins : FRAME_LOOP = 2 × (W + H) - 8 × CORNER_T", () => {
    expect(FRAME_LOOP).toBe(2 * (W + H) - 8 * CORNER_T);
  });

  for (const rarity of ["sr", "ssr"] as const) {
    it(`${rarity} : bandes coupées en biais, découpées en arrondi dedans et dehors`, () => {
      const hote = document.createElement("div");
      hote.style.cssText = "display: inline-block; padding: 20px;";
      document.body.append(hote);
      root = createRoot(hote);
      flushSync(() =>
        root?.render(
          <>
            <GameCardDefs />
            <GameCard card={carte(rarity, [])} imageUrl="data:," layout="normal" />
          </>,
        ),
      );
      const boite = hote.querySelector(".tcg-frame-run");
      if (!boite) throw new Error("Pas de bandes de cadre.");
      const bandes = [...hote.querySelectorAll<HTMLElement>(".tcg-frame-run__cut")].map((e) =>
        e.getBoundingClientRect(),
      );
      expect(bandes).toHaveLength(4);
      // Chaque bande porte sa découpe exacte (anneau du cadre entre ses deux diagonales) : la lumière
      // animée sortait de la découpe du parent pendant qu'elle tournait.
      for (const e of hote.querySelectorAll<HTMLElement>(".tcg-frame-run__cut"))
        expect(getComputedStyle(e).clipPath).toMatch(/^polygon\(/);
      // Découpe : coins arrondis dehors ET dans l'angle intérieur du cadre (sinon le bord droit des
      // bandes y dessine un carré de lumière) : SR 2 contours, SSR 4 (lueur, carte, intérieur).
      const decoupe = getComputedStyle(boite).clipPath;
      expect(decoupe.match(/M/g)?.length).toBe(rarity === "sr" ? 2 : 4);
      expect(decoupe).toMatch(/A ?15[ ,]+15 0 0 0/);
      // Tout le tour est couvert : chaque coin de la boîte des bandes est dans une bande.
      const tour = boite.getBoundingClientRect();
      for (const [x = 0, y = 0] of [
        [tour.left + 1, tour.top + 1],
        [tour.right - 1, tour.top + 1],
        [tour.right - 1, tour.bottom - 1],
        [tour.left + 1, tour.bottom - 1],
      ])
        expect(
          bandes.some((b) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom),
          `coin ${x},${y}`,
        ).toBe(true);
    });
  }
  // Fin croissant de lueur SSR hors du coin arrondi (vu par l'utilisateur, 27/11) : la lueur extérieure
  // (4 px) s'arrête au bout de l'arrondi de la carte, en biseau ; plus aucun point de la découpe d'une
  // bande dans le coin, hors du rayon R de l'arrondi.
  for (const [len, out] of [
    [W, 4],
    [H, 4],
    [W, 0],
  ] as const) {
    it(`découpe d'une bande (longueur ${len}, lueur ${out}) : rien hors de l'arrondi du coin`, () => {
      const c = out + R;
      const L = len + 2 * out;
      const points = [...bandClip(len, out).matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => [
        Number(m[1]),
        Number(m[2]),
      ]);
      expect(points.length).toBeGreaterThan(10);
      for (const [x = 0, y = 0] of points) {
        if (y >= c) continue;
        // 0,75 px de chevauchement sur la diagonale (anticrénelage) : tolérance de 0,8 px
        if (x < c) expect(Math.hypot(x - c, y - c), `${x},${y}`).toBeLessThanOrEqual(R + 0.8);
        if (x > L - c)
          expect(Math.hypot(x - (L - c), y - c), `${x},${y}`).toBeLessThanOrEqual(R + 0.8);
      }
      // la lueur garde toute son épaisseur hors des coins
      if (out) {
        expect(points).toContainEqual([c + 2 * out, 0]);
        expect(points).toContainEqual([L - c - 2 * out, 0]);
      }
    });
  }
});
