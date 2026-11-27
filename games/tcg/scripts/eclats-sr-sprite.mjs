// Planche des éclats SR pré-calculés (refonte, étape 7, variante « image » du banc d'essai) :
// 30 vues des 14 éclats dorés de la SR-2 sur une boucle de 2,4 s, côte à côte, fond transparent.
// Chaque vue fait 312 × 432 px (la carte 300 × 420 et 6 px de marge : les éclats débordent).
// Les éclats sont dessinés par les vraies règles `.tcg-sr-spark` de tcg.css, figés à l'instant de
// chaque vue (animation en pause, départ décalé) ; leur durée propre est ramenée à 2,4 s pour que
// la boucle se referme. Usage (depuis games/tcg) : node scripts/eclats-sr-sprite.mjs
// Écrit apps/web/public/tcg/eclats-sr.png. Aucun contenu réel : formes géométriques seulement.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ici = dirname(fileURLToPath(import.meta.url));
const VUES = 30;
const BOUCLE = 2.4;
const MARGE = 6;
const [LARGEUR, HAUTEUR] = [300 + 2 * MARGE, 420 + 2 * MARGE];

// Positions et départs : le tableau SR_SPARKS de ui/v5.tsx, relu tel quel.
const v5 = readFileSync(join(ici, "../ui/v5.tsx"), "utf8");
const bloc = v5.match(/const SR_SPARKS[^=]*=\s*\[([\s\S]*?)\n\];/)?.[1];
if (!bloc) throw new Error("SR_SPARKS introuvable dans v5.tsx");
const eclats = [...bloc.matchAll(/\[([-\d., ]+)\]/g)].map((m) => m[1].split(",").map(Number));
if (eclats.length !== 14) throw new Error(`14 éclats attendus, ${eclats.length} lus`);

// Règles des éclats, relues dans tcg.css (de `.tcg-sr-spark {` jusqu'au commentaire de la planche).
const css = readFileSync(join(ici, "../ui/tcg.css"), "utf8");
const debut = css.indexOf(".tcg-sr-spark {");
const fin = css.indexOf("/* Éclats SR du site : planche");
if (debut < 0 || fin < debut) throw new Error("règles .tcg-sr-spark introuvables dans tcg.css");

const vues = Array.from({ length: VUES }, (_, k) => {
  const t = (k * BOUCLE) / VUES;
  const points = eclats
    .map(
      ([x, y, s, depart]) =>
        `<div class="tcg-sr-spark" style="left:${x + MARGE}px;top:${y + MARGE}px;--s:${s}px;` +
        `animation-duration:${BOUCLE}s;animation-delay:${depart - t}s"></div>`,
    )
    .join("");
  return `<div class="vue" style="left:${k * LARGEUR}px">${points}</div>`;
}).join("");
const page = `<!doctype html><style>html,body{margin:0;background:transparent}
.vue{position:absolute;top:0;width:${LARGEUR}px;height:${HAUTEUR}px}
${css.slice(debut, fin)}
.tcg-sr-spark{animation-play-state:paused!important}</style><body>${vues}</body>`;

const navigateur = await chromium.launch();
const p = await navigateur.newPage({ viewport: { width: VUES * LARGEUR, height: HAUTEUR } });
await p.setContent(page);
await p.screenshot({
  path: join(ici, "../../../apps/web/public/tcg/eclats-sr.png"),
  omitBackground: true,
  clip: { x: 0, y: 0, width: VUES * LARGEUR, height: HAUTEUR },
});
await navigateur.close();
console.log(`${VUES} vues de ${LARGEUR} × ${HAUTEUR} écrites`);
