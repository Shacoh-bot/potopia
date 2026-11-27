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
 * art 48-197). Étape 4 (socle fixe) : anneaux à dégradé pré-dessinés en images (~220 traits SVG de
 * moins) et bandes SR/SSR d'une boîte par bord : 49-52 (commune à légendaire), SR 73-74, SSR 68-69,
 * 75 avec trois effets au pointeur. Cible de la refonte (80) atteinte.
 */
const PLAFOND_ELEMENTS = 75;

/** Classes des parties animées d'une carte : jamais dans un calque du socle (`tcg-socle`). */
const ANIMEES = /tcg-frame-run|tcg-sr-spark|tcg-aura|tcg-vfx|tcg-glare|tcg-reveal/;

/** Contenus des éléments de classe `tcg-socle` (HTML du rendu serveur, bien formé). */
function socles(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<div class="[^"]*\btcg-socle\b[^"]*"/g)) {
    let depth = 0;
    const re = /<(\/?)div\b[^>]*>/g;
    re.lastIndex = m.index ?? 0;
    for (let t = re.exec(html); t; t = re.exec(html)) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) {
        out.push(html.slice(m.index, re.lastIndex));
        break;
      }
    }
  }
  return out;
}

/**
 * Propriétés qu'une animation peut faire varier sans repeindre la carte : le compositeur s'en
 * charge seul. `visibility` sert aux retournements (bascule nette, aucun repeint progressif).
 */
const ANIMABLES = new Set(["transform", "opacity", "scale", "rotate", "translate", "visibility"]);

/**
 * Animations qui repeignent encore (liste blanche motivée). Étape 3 : orbite, prisme, liseré,
 * éclat, cadres SR/SSR et soleil du vitrail passés en transform ; restent :
 * - tcg-glitch : tranches de l'image au survol seulement, 5 à-coups (steps) par 0,7 s ; en
 *   transform il faudrait 5 copies de l'illustration ;
 * - tcg-shock-lens : rayon de l'anneau-loupe d'un point lumineux (petit disque) ; effet lourd,
 *   à pré-calculer à l'étape 7.
 */
const EXCEPTIONS_ANIMEES: Record<string, string[]> = {
  "tcg-glitch": ["clip-path"],
  "tcg-shock-lens": ["--tcg-shock"],
};

/**
 * Règles dont le fond ou le masque suit le pointeur (var(--mx/--my) dans background ou mask) :
 * repeintes à chaque mouvement. Étape 3 : holo, lampe, métal et vitrail passés en translate.
 * Restent : `.tcg-holo`/`.tcg-sparkle` (anciennes maquettes v2/premium, hors carte du jeu) et le
 * trou des ombres (effet lourd, étape 7).
 */
const REPEINTS_AU_POINTEUR = [
  ".tcg-holo",
  ".tcg-sparkle",
  ".tcg-tilt[data-active] .tcg-vfx-shadows",
];

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
    layout: t.layout,
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

  it("le socle (cadre, pastilles) n'a aucun enfant animé", () => {
    for (const r of rendus) {
      const s = socles(r.html);
      expect(s.length, r.id).toBeGreaterThanOrEqual(3);
      for (const bloc of s) expect(bloc, r.id).not.toMatch(ANIMEES);
    }
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
      expect(presentes, r.id).toEqual(STRATES_ATTENDUES[r.layout]);
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

  it("aucun fond ni masque ne suit le pointeur, hors exceptions connues", () => {
    const regles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , corps]) =>
        /(?:^|[\s;])(?:-webkit-)?(?:background|mask)[\w-]*\s*:[^;]*var\(--m[xy]/.test(corps ?? ""),
      )
      .map(([, sel]) => (sel ?? "").trim().replace(/\s+/g, " "));
    expect(regles).toEqual(REPEINTS_AU_POINTEUR);
  });
});
