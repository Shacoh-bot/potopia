import { readFileSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CARD_RARITIES } from "../src/card-rules";
import { ringClass, ringCss, ringSegments, ringSvg, parseRingPaint } from "../ui/frame-ring";
import { GameCard } from "../ui/GameCard";
import { PREDRAWN_RINGS } from "../ui/v5";
import { CARTES_TEST } from "./rendu/cartes";

/**
 * Anneaux à dégradé pré-dessinés (refonte, étape 4) : leurs images sont un bloc généré de
 * tcg.css. `ANNEAUX=ecrire pnpm vitest run test/frame-ring-images` le régénère.
 */
const CSS_URL = new URL("../ui/tcg.css", import.meta.url);
const DEBUT =
  "/* <anneaux générés> : test/frame-ring-images.test.tsx (ANNEAUX=ecrire pour régénérer) */\n";
const FIN = "/* </anneaux générés> */";

function bloc(css: string): string {
  const a = css.indexOf(DEBUT);
  const b = css.indexOf(FIN);
  if (a < 0 || b < a) throw new Error("bloc des anneaux introuvable dans tcg.css");
  return css.slice(a + DEBUT.length, b);
}

describe("anneaux pré-dessinés", () => {
  const attendu = `${ringCss(PREDRAWN_RINGS)}\n`;

  it("le bloc généré de tcg.css est à jour", () => {
    let css = readFileSync(CSS_URL, "utf8");
    if (process.env.ANNEAUX === "ecrire" && bloc(css) !== attendu) {
      css = css.replace(DEBUT + bloc(css), DEBUT + attendu);
      writeFileSync(CSS_URL, css);
    }
    expect(bloc(css)).toBe(attendu);
  });

  it("chaque anneau à dégradé des cartes a son image", () => {
    const BASE = CARTES_TEST[0]?.card;
    if (!BASE) throw new Error("aucune carte de test");
    const css = bloc(readFileSync(CSS_URL, "utf8"));
    const cartes = [
      ...CARTES_TEST.map((t) => ({ card: t.card, layout: t.layout })),
      ...CARD_RARITIES.map((r) => ({
        card: { ...BASE, rarity: r },
        layout: "normal" as const,
      })),
    ];
    let vus = 0;
    for (const { card, layout } of cartes) {
      const html = renderToStaticMarkup(<GameCard card={card} imageUrl="data:," layout={layout} />);
      for (const [cls] of html.matchAll(/tcg-ring-[0-9a-z]+/g)) {
        vus++;
        expect(css, cls).toContain(`.${cls} {`);
      }
    }
    expect(vus).toBeGreaterThan(0);
  });

  it("l'image reprend les traits de l'ancien anneau (tour + un trait par segment)", () => {
    for (const spec of PREDRAWN_RINGS) {
      const svg = ringSvg(spec);
      const paint = parseRingPaint(spec.background);
      if (!paint || paint.kind === "solid") throw new Error(`anneau uni : ${spec.background}`);
      const n = spec.segments ?? 120;
      const ring = ringSegments(
        paint,
        spec.w ?? 300,
        spec.h ?? 420,
        spec.width,
        spec.radius ?? 22,
        n,
      );
      expect(svg.match(/<use /g)?.length).toBe(n + 1);
      expect(svg).toContain(`stroke='${ring.base}'`);
      expect(svg).not.toMatch(/"/);
      expect(ringClass(spec)).toMatch(/^tcg-ring-[0-9a-z]+$/);
    }
  });
});
