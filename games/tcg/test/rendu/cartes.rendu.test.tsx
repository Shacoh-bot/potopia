import "../../ui/tcg.css";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { GameCard, GameCardDefs } from "../../ui/GameCard";
import { CARTES_TEST, type CarteTest } from "./cartes";

/**
 * Banc de rendu des cartes (refonte, étape 2) : chaque rareté, sans effet puis avec trois effets,
 * au repos et inclinée au survol, dans Firefox et Chrome. Animations figées à leur première image.
 * Deux gardes :
 * - capture de référence par carte (tolérance 1 % de pixels) : une étape de la refonte doit garder
 *   le même rendu ; un changement voulu renouvelle les références (`pnpm test:rendu:docker --update`) ;
 * - au survol, toutes les strates (cadre, nom, encadrés, pastilles…) restent visibles dans la carte :
 *   c'est le bug de Firefox du 25/11 (cadre, nom et pastilles disparus sur la carte survolée).
 */
const FIGER = `*, *::before, *::after {
  animation-delay: 0s !important;
  animation-play-state: paused !important;
  transition: none !important;
  caret-color: transparent !important;
}
body { margin: 0; background: #1b1b22; font-family: "DejaVu Sans", sans-serif; }`;

/** Strates qui doivent rester visibles ; la full art n'a pas d'encadrés, donc pas de filets. */
const STRATES = {
  normal: ["filets", "bandeau", "cadre", "encadres", "pied", "pastilles"],
  fullart: ["bandeau", "cadre", "encadres", "pied", "pastilles"],
} as const;
const TOLERANCE = {
  comparatorName: "pixelmatch",
  comparatorOptions: { allowedMismatchedPixelRatio: 0.01 },
} as const;

/** Illustration fictive : un dégradé et quelques disques, dessinés sur place (aucun fichier). */
function illustration(): string {
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 840;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas 2D indisponible.");
  const grad = g.createLinearGradient(0, 0, 600, 840);
  grad.addColorStop(0, "#2f6f4f");
  grad.addColorStop(1, "#d9a441");
  g.fillStyle = grad;
  g.fillRect(0, 0, 600, 840);
  for (const [x, y, r, col] of [
    [180, 300, 120, "#e94f37"],
    [420, 520, 160, "#3f88c5"],
    [300, 700, 90, "#f6f7eb"],
  ] as const) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL("image/png");
}

const prochaineImage = () => new Promise((r) => requestAnimationFrame(() => r(null)));

let root: Root | null = null;
let image = "";

beforeAll(async () => {
  const style = document.createElement("style");
  style.textContent = FIGER;
  document.head.append(style);
  image = illustration();
  const im = new Image();
  im.src = image;
  await im.decode();
});

afterEach(() => {
  root?.unmount();
  root = null;
  document.body.replaceChildren();
});

async function poser(t: CarteTest): Promise<HTMLElement> {
  const hote = document.createElement("div");
  hote.dataset.testid = "carte";
  hote.style.cssText = "display: inline-block; padding: 40px;";
  document.body.append(hote);
  const racine = createRoot(hote);
  root = racine;
  flushSync(() =>
    racine.render(
      <>
        <GameCardDefs />
        <GameCard card={t.card} imageUrl={image} layout={t.layout} />
      </>,
    ),
  );
  await document.fonts.ready;
  await prochaineImage();
  await prochaineImage();
  // Images posées après coup (copies de l'illustration) : toutes chargées avant la capture.
  const images = () => [...hote.querySelectorAll("img")];
  for (let essai = 0; essai < 40 && images().some((i) => i.naturalWidth === 0); essai++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const cassees = images().filter((i) => i.naturalWidth === 0);
  expect(
    cassees.map((i) => `${i.parentElement?.className} ${i.getAttribute("src")?.slice(0, 30)}`),
  ).toEqual([]);
  return hote;
}

/** Un élément est vu s'il a une taille, n'est ni masqué ni transparent, et reste dans la carte. */
function vu(el: Element, carte: DOMRect): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  if (r.right < carte.left || r.left > carte.right || r.bottom < carte.top || r.top > carte.bottom)
    return false;
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
  }
  return true;
}

function tiltDe(hote: HTMLElement): HTMLElement {
  const tilt = hote.querySelector<HTMLElement>(".tcg-tilt");
  if (!tilt) throw new Error("Carte sans .tcg-tilt.");
  return tilt;
}

function stratesCachees(hote: HTMLElement, layout: CarteTest["layout"]): string[] {
  const carte = tiltDe(hote).getBoundingClientRect();
  return STRATES[layout].filter((s) => {
    const repères = [...hote.querySelectorAll(`.tcg-strate-${s}`)];
    const elements = repères.flatMap((r) => [r, ...r.querySelectorAll("*")]);
    return !elements.some((e) => vu(e, carte));
  });
}

describe("rendu des cartes", () => {
  for (const t of CARTES_TEST) {
    it(`${t.id} : au repos`, async () => {
      const hote = await poser(t);
      expect(stratesCachees(hote, t.layout)).toEqual([]);
      await expect.element(page.getByTestId("carte")).toMatchScreenshot(`${t.id}-repos`, TOLERANCE);
    });

    it(`${t.id} : inclinée au survol, strates visibles`, async () => {
      const hote = await poser(t);
      const tilt = tiltDe(hote);
      // Coin haut gauche : inclinaison franche, la plus exposée au bug.
      await userEvent.hover(tilt, { position: { x: 30, y: 30 } });
      await prochaineImage();
      await prochaineImage();
      expect(tilt.hasAttribute("data-active")).toBe(true);
      expect(stratesCachees(hote, t.layout)).toEqual([]);
      await expect
        .element(page.getByTestId("carte"))
        .toMatchScreenshot(`${t.id}-survol`, TOLERANCE);
    });
  }
});
