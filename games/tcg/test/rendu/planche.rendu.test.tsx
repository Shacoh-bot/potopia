import "../../ui/tcg.css";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameCard, GameCardDefs } from "../../ui/GameCard";
import { REPOS_MS } from "../../ui/StillCard";
import { carte } from "./cartes";

/**
 * Image fixe au repos (cartes ultra légères, option 1) et niveaux de détail (étape 8), dans Firefox
 * et Chrome : une carte figée (`GameCard still` : Potodex, planches de l'admin, banc) non survolée
 * n'a, après `REPOS_MS`, plus aucune animation qui tourne (CSS ni SVG), ses éclats SR sont retirés
 * et ses grains d'effets réduits à un sur trois. Survolée (`data-live`, posé par `Tilt`), elle
 * retrouve tout (cadre SR/SSR et effets compris) ; quittée, elle se fige à nouveau.
 */
const ANIMABLES = new Set(["transform", "opacity", "translate", "rotate", "scale", "visibility"]);
const HORS_PROPRIETES = new Set(["offset", "computedOffset", "easing", "composite"]);

const PLANCHE = [
  { id: "sr-lourds", card: carte("sr", ["mirage", "vitrail", "particules"]), layout: "normal" },
  { id: "ssr-lourds", card: carte("ssr", ["energie", "aquarelle", "braises"]), layout: "fullart" },
] as const;

const prochaineImage = () => new Promise((r) => requestAnimationFrame(() => r(null)));

let root: Root | null = null;
afterEach(() => {
  root?.unmount();
  root = null;
  document.body.replaceChildren();
});

async function poser(t: (typeof PLANCHE)[number]): Promise<HTMLElement> {
  const hote = document.createElement("div");
  hote.style.cssText = "display: inline-block; padding: 20px;";
  document.body.append(hote);
  root = createRoot(hote);
  flushSync(() =>
    root?.render(
      <>
        <GameCardDefs />
        <GameCard card={t.card} imageUrl="data:," layout={t.layout} still />
      </>,
    ),
  );
  const still = hote.querySelector<HTMLElement>(".tcg-still");
  if (!still) throw new Error("Carte sans .tcg-still.");
  // Firefox simule un mouvement du pointeur après une mise en page : si le pointeur du test est
  // resté sur la zone de la carte, `Tilt` la croit survolée (`data-live`). C'était l'instabilité
  // en CI (vitrail/énergie « en cours » hors survol). On attend la mise au repos puis on retire
  // ce faux survol : `pointerenter` ne revient pas tant que le pointeur ne sort pas.
  const fin = performance.now() + REPOS_MS + 3000;
  while (!("repos" in still.dataset) && performance.now() < fin) await prochaineImage();
  if (!("repos" in still.dataset)) throw new Error("Carte jamais mise au repos (data-repos).");
  delete still.dataset.live;
  await prochaineImage();
  await prochaineImage();
  return still;
}

/** Animations CSS de la carte : propriétés animées et état (en cours ou en pause). */
function animations(carte: HTMLElement) {
  return document
    .getAnimations()
    .filter((a) => {
      const cible = (a.effect as KeyframeEffect | null)?.target;
      return cible instanceof Element && carte.contains(cible);
    })
    .map((a) => {
      const effet = a.effect as KeyframeEffect;
      const props = new Set(
        effet.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !HORS_PROPRIETES.has(p))),
      );
      const cible = effet.target as Element;
      return {
        nom: (a as CSSAnimation).animationName ?? "?",
        lourd: !!cible.closest(".tcg-vfx[data-lourd]"),
        cadre: !!cible.closest(".tcg-frame-run, .tcg-frame-run__cut, .tcg-frame-run__light"),
        enCours: a.playState === "running",
        repeint: [...props].filter((p) => !ANIMABLES.has(p)),
      };
    });
}

const affiches = (carte: HTMLElement, sel: string) =>
  [...carte.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== "none").length;

const svgAnimes = (carte: HTMLElement) =>
  [...carte.querySelectorAll<SVGSVGElement>("svg")].filter((s) =>
    s.querySelector("animate, animateTransform"),
  );

describe("planche : carte figée non survolée", () => {
  for (const t of PLANCHE) {
    it(`${t.id} : image fixe au repos (aucune animation en cours), tout revient au survol`, async () => {
      const carte = await poser(t);

      const repos = animations(carte);
      expect(repos.length).toBeGreaterThan(0);
      const enCours = repos.filter((a) => a.enCours);
      expect(enCours, JSON.stringify(enCours)).toEqual([]);
      expect(repos.filter((a) => a.lourd).length).toBeGreaterThan(0);
      const svgs = svgAnimes(carte);
      expect(svgs.length).toBeGreaterThan(0);
      expect(svgs.map((s) => s.animationsPaused())).toEqual(svgs.map(() => true));
      expect(affiches(carte, ".tcg-sr-spark, .tcg-sr-spark-group, .tcg-sr-spark-sprite")).toBe(0);
      const grains = carte.querySelectorAll(".tcg-vfx-mote, .tcg-vfx-ember").length;
      expect(grains).toBeGreaterThan(0);
      expect(affiches(carte, ".tcg-vfx-mote, .tcg-vfx-ember")).toBe(Math.ceil(grains / 3));

      carte.dataset.live = "";
      await prochaineImage();
      await prochaineImage();
      const vivantes = animations(carte).filter((a) => a.enCours);
      expect(vivantes.some((a) => a.lourd)).toBe(true);
      // Cadre animé des SR/SSR : vivant au survol seulement.
      expect(vivantes.some((a) => a.cadre)).toBe(true);
      expect(svgs.map((s) => s.animationsPaused())).toEqual(svgs.map(() => false));
      expect(affiches(carte, ".tcg-vfx-mote, .tcg-vfx-ember")).toBe(grains);
      if (t.card.rarity === "sr") {
        expect(affiches(carte, ".tcg-sr-spark")).toBeGreaterThan(0);
      }

      delete carte.dataset.live;
      await prochaineImage();
      await prochaineImage();
      expect(animations(carte).filter((a) => a.enCours)).toEqual([]);
      expect(svgs.map((s) => s.animationsPaused())).toEqual(svgs.map(() => true));
    });
  }
});
