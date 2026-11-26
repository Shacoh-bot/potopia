import { readdirSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameCard } from "../ui/GameCard";
import { CARTES_TEST } from "./rendu/cartes";

/**
 * Filet de sécurité de la refonte du rendu des cartes (notes : refonte-cartes.md, étape 2) : un
 * cliquet. Les valeurs d'aujourd'hui sont des plafonds ; une étape de la refonte peut les baisser,
 * jamais les monter sans le dire ici. Le rendu à l'écran est gardé par le banc de rendu
 * (`test/rendu`, Firefox + Chrome, `pnpm test:rendu`).
 */
const read = (file: string) => readFileSync(new URL(`../ui/${file}`, import.meta.url), "utf8");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const css = sansCommentaires(read("tcg.css"));

/**
 * Plafond d'éléments HTML/SVG par carte (rendu serveur) : 295 le 26/11, SR normale (commune 146, full
 * art 48-197). Cible de la refonte : 80.
 */
const PLAFOND_ELEMENTS = 295;

/**
 * Propriétés qu'une animation peut faire varier sans repeindre la carte : le compositeur s'en
 * charge seul. `visibility` sert aux retournements (bascule nette, aucun repeint progressif).
 */
const ANIMABLES = new Set(["transform", "opacity", "scale", "rotate", "translate", "visibility"]);

/** Animations qui repeignent encore, à reprendre à l'étape 3 (animations compositeur). */
const EXCEPTIONS_ANIMEES: Record<string, string[]> = {
  "tcg-orbit": ["--tcg-angle"],
  "tcg-sweep": ["left"],
  "tcg-glitch": ["clip-path"],
  "tcg-frame-run-720": ["background-position-x"],
  "tcg-frame-run-1440": ["background-position-x"],
  "tcg-vitrail-sun": ["-webkit-mask-position", "mask-position"],
  "tcg-shock-lens": ["--tcg-shock"],
};

/** Fusions de couleurs (`mix-blend-mode`) par fichier : à faire baisser (étape 5, fusions cuites). */
const FUSIONS: Record<string, number> = {
  "tcg.css": 33,
  "CardBench.tsx": 1,
  "premium.tsx": 1,
  "snap-styles.tsx": 14,
  "snap.tsx": 3,
  "v2.tsx": 2,
  "v5.tsx": 1,
  "visual-effects.tsx": 2,
};
const FICHIERS_UI = readdirSync(new URL("../ui/", import.meta.url)).filter((f) =>
  /\.(tsx?|css)$/.test(f),
);

function animationsDe(feuille: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [, nom, corps] of feuille.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?)\n\}/g)) {
    if (!nom || !corps) continue;
    const props = new Set([...corps.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1] ?? ""));
    const hors = [...props].filter((p) => !ANIMABLES.has(p));
    if (hors.length) out[nom] = hors;
  }
  return out;
}

/** Strates repérées (`tcg-strate-*`) que chaque mise en page doit garder. */
const STRATES_ATTENDUES = {
  normal: ["filets", "bandeau", "cadre", "encadres", "pied", "pastilles"],
  // La full art n'a pas de filets autour de l'illustration.
  fullart: ["bandeau", "cadre", "encadres", "pied", "pastilles"],
};

describe("filet de sécurité des cartes", () => {
  const rendus = CARTES_TEST.map((t) => ({
    id: t.id,
    html: renderToStaticMarkup(<GameCard card={t.card} imageUrl="data:," layout={t.layout} />),
  }));

  it("chaque carte reste sous le plafond d'éléments", () => {
    const comptes = Object.fromEntries(
      rendus.map((r) => [r.id, r.html.match(/<[a-zA-Z]/g)?.length ?? 0]),
    );
    expect(Math.max(...Object.values(comptes)), JSON.stringify(comptes)).toBeLessThanOrEqual(
      PLAFOND_ELEMENTS,
    );
  });

  it("aucune carte n'utilise de 3D réelle", () => {
    for (const r of rendus) {
      expect(r.html, r.id).not.toMatch(/preserve-3d|backface-visibility/);
    }
    for (const f of FICHIERS_UI) {
      expect(sansCommentaires(read(f)), f).not.toMatch(/preserve-3d|preserve3d|backfaceVisibility/);
    }
  });

  it("toutes les strates sont présentes dans le rendu", () => {
    const strates = ["filets", "bandeau", "cadre", "encadres", "pied", "pastilles"];
    for (const r of rendus) {
      const presentes = strates.filter((s) => r.html.includes(`tcg-strate-${s}`));
      expect(presentes, r.id).toEqual(
        STRATES_ATTENDUES[r.id.endsWith("-normale") ? "normal" : "fullart"],
      );
    }
  });

  it("aucune fusion de couleurs en plus", () => {
    for (const f of FICHIERS_UI) {
      const n = sansCommentaires(read(f)).match(/mix-blend-mode|mixBlendMode/g)?.length ?? 0;
      expect(n, f).toBeLessThanOrEqual(FUSIONS[f] ?? 0);
    }
  });

  it("tcg.css n'anime que transform et opacity, hors exceptions connues", () => {
    expect(animationsDe(css)).toEqual(EXCEPTIONS_ANIMEES);
  });
});
