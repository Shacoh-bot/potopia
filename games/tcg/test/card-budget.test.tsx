import { readdirSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameCard } from "../ui/GameCard";
import { EFFETS_LOURDS, VISUAL_EFFECTS } from "../ui/visual-effects";
import { CARTES_TEST, carte } from "./rendu/cartes";

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
 * 75 avec trois effets au pointeur. Cible de la refonte (80) atteinte. Étape 5 : trait du polissage
 * et chaîne SVG des cadres unis dans l'image du cadre, 48-51, SR 73-74, SSR 68-69, pointeur 74.
 */
const PLAFOND_ELEMENTS = 74;

/**
 * Bandes animées des cadres SR/SSR par carte (`tcg-frame-run__light`, une par bord). Étape 6 : la
 * lueur de la SSR est portée par les bandes du cadre, 8 → 4.
 */
const PLAFOND_BANDES = 4;

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
 *   à pré-calculer à l'étape 7 ;
 * - tcg-sr-spark-sprite : variante « image pré-calculée » des éclats SR, au banc d'essai seulement
 *   (étape 7) : 30 paliers de `background-position` en 2,4 s, une seule boîte par carte.
 */
const EXCEPTIONS_ANIMEES: Record<string, string[]> = {
  "tcg-glitch": ["clip-path"],
  "tcg-shock-lens": ["--tcg-shock"],
  "tcg-sr-spark-sprite": ["background-position"],
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
  // Étape 5 : polissage du cadre cuit dans son image (fusion calculée une fois au dessin).
  "frame-ring.tsx": 1,
  "tcg.css": 33,
  "CardBench.tsx": 1,
  "premium.tsx": 1,
  "snap-styles.tsx": 14,
  "snap.tsx": 3,
  "v2.tsx": 2,
  "v5.tsx": 0,
  "visual-effects.tsx": 2,
};
const FICHIERS_UI = readdirSync(new URL("../ui/", import.meta.url)).filter((f) =>
  /\.(tsx?|css)$/.test(f),
);

/**
 * Classes dont une règle de tcg.css pose une fusion (`mix-blend-mode`) ou un filtre (`filter`,
 * `backdrop-filter`) : la dernière partie de chaque sélecteur de ces règles.
 */
const CLASSES_FUSION = new Set(
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , corps]) =>
      /(?:^|[\s;])(?:mix-blend-mode|(?:-webkit-)?(?:backdrop-)?filter)\s*:\s*(?!none)/.test(
        corps ?? "",
      ),
    )
    .flatMap(([, sel]) =>
      (sel ?? "")
        .split(",")
        .flatMap((s) => [
          ...(
            s
              .trim()
              .split(/[\s>+~]+/)
              .pop() ?? ""
          ).matchAll(/\.([\w-]+)/g),
        ])
        .map((m) => m[1] ?? ""),
    ),
);

/**
 * Fusions et filtres présents dans le rendu d'une carte : styles en ligne, attributs SVG `filter`
 * et éléments d'une classe de `CLASSES_FUSION`. Chacun force un groupe de rendu à part.
 */
function fusionsEtFiltres(html: string): number {
  let n = 0;
  for (const [balise] of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const style = balise.match(/style="([^"]*)"/)?.[1] ?? "";
    n += style.match(/(?:mix-blend-mode|(?:backdrop-)?filter):(?!none)/g)?.length ?? 0;
    if (/\sfilter="url\(/.test(balise)) n++;
    const classes = balise.match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
    if (classes.some((c) => CLASSES_FUSION.has(c))) n++;
  }
  return n;
}

/**
 * Plafond de fusions et filtres par carte (`fusionsEtFiltres`). Étape 4 : 2 sans effet (polissage
 * soft-light du cadre, halo drop-shadow du titre), 5 avec trois effets, 15-16 avec trois effets au
 * pointeur. Étape 5 (fusions cuites) : polissage dans l'image du cadre, halo du titre en ombres de
 * texte : 0, 3 et 13-14 ; restent le contour du titre sans bandeau (full art sans encadrés : chaîne
 * de drop-shadow, pas reproduite à l'identique en ombres de texte), le flou des encadrés de la full
 * art et les fusions propres aux effets (holo, lampe, métal…), dans le groupe isolé de l'illustration.
 */
const PLAFOND_FUSIONS_DEFAUT = 3;
const PLAFOND_FUSIONS: Record<string, number> = {
  "rare-pointeur": 13,
  "legendary-pointeur": 14,
};

/** Cartes sans effet : aucune fusion ni aucun filtre. */
const SANS_EFFET = /-normale$/;

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
    if (process.env.BUDGET_LOG) console.log(JSON.stringify(comptes));
    expect(Math.max(...Object.values(comptes)), JSON.stringify(comptes)).toBeLessThanOrEqual(
      PLAFOND_ELEMENTS,
    );
  });

  it("lumières SR/SSR : au plus 4 bandes animées par carte", () => {
    // Étape 6 : le coût d'un cadre animé suit le nombre d'éléments animés (planche de 40 SSR, Chrome
    // GPU : 8 bandes 29-33 im/s, 4 bandes 47-54). La SSR avait 8 bandes (lueur à part), plus que 4.
    const comptes = Object.fromEntries(
      rendus.map((r) => [r.id, r.html.match(/tcg-frame-run__light /g)?.length ?? 0]),
    );
    expect(Math.max(...Object.values(comptes)), JSON.stringify(comptes)).toBe(PLAFOND_BANDES);
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
      // Hors images en data URL (anneaux pré-dessinés : fusion cuite, calculée une fois).
      const source = sansCommentaires(read(f)).replace(/url\("data:[^"]*"\)/g, "");
      const n = source.match(/mix-blend-mode|mixBlendMode/g)?.length ?? 0;
      expect(n, f).toBeLessThanOrEqual(FUSIONS[f] ?? 0);
    }
  });

  it("fusions et filtres vivants par carte sous leur plafond", () => {
    const comptes = Object.fromEntries(rendus.map((r) => [r.id, fusionsEtFiltres(r.html)]));
    if (process.env.BUDGET_LOG) console.log(JSON.stringify(comptes));
    for (const [id, n] of Object.entries(comptes)) {
      const plafond = SANS_EFFET.test(id) ? 0 : (PLAFOND_FUSIONS[id] ?? PLAFOND_FUSIONS_DEFAUT);
      expect(n, `${id} ${JSON.stringify(comptes)}`).toBeLessThanOrEqual(plafond);
    }
  });

  it("au plus 1 effet lourd vivant par carte (animation hors transform/opacity)", () => {
    // Classes qui portent une animation de la liste blanche (repeinte à chaque image).
    const lourdes = new Set<string>();
    for (const [, sel, corps] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const nom = (corps ?? "").match(/animation(?:-name)?\s*:\s*([\w-]+)/)?.[1];
      if (!nom || !(nom in EXCEPTIONS_ANIMEES)) continue;
      for (const c of (sel ?? "").match(/\.tcg-[\w-]+/g) ?? []) lourdes.add(c.slice(1));
    }
    lourdes.delete("tcg-tilt");
    expect(lourdes.size).toBeGreaterThan(0);
    for (const r of rendus) {
      const vivantes = [...lourdes].filter((c) =>
        new RegExp(`class="(?:[^"]* )?${c}[ "]`).test(r.html),
      );
      expect(vivantes.length, `${r.id} ${vivantes}`).toBeLessThanOrEqual(1);
    }
  });

  it("planche : tout effet qui repeint (SVG animé, animation de la liste blanche) est déclaré lourd", () => {
    // Étape 8 (niveaux de détail) : un effet qui repeint doit figurer dans EFFETS_LOURDS
    // (`data-lourd`). Au repos sur une planche, tout est en pause (image fixe, StillCard) ; mais hors
    // de l'écran sur une carte vivante, seul le SVG animé des effets lourds est arrêté
    // (`watchFrozenSvg`).
    const repeignantes = Object.keys(EXCEPTIONS_ANIMEES).filter((c) => c !== "tcg-sr-spark-sprite");
    for (const cle of Object.keys(VISUAL_EFFECTS)) {
      for (const layout of ["normal", "fullart"] as const) {
        const html = renderToStaticMarkup(
          <GameCard card={carte("common", [cle])} imageUrl="data:," layout={layout} still />,
        );
        const vfx = html.slice(html.indexOf('class="tcg-vfx"'));
        const repeint =
          vfx.includes("<animate") || repeignantes.some((c) => vfx.includes(`class="${c}`));
        if (repeint) expect(EFFETS_LOURDS.has(cle), `${cle} (${layout})`).toBe(true);
        if (EFFETS_LOURDS.has(cle)) expect(vfx, cle).toMatch(/class="tcg-vfx"[^>]*data-lourd=""/);
      }
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
