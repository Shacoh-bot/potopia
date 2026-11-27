import "../../ui/tcg.css";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GameCard, GameCardDefs } from "../../ui/GameCard";
import { carte } from "./cartes";

/**
 * Niveaux de détail des planches (refonte, étape 8), dans Firefox et Chrome : une carte figée
 * (`GameCard still`, Potodex et planches de l'admin) non survolée n'anime que transform et opacity
 * (aucun repeint), ses effets lourds sont en pause (animations CSS et SVG), ses éclats SR sont
 * retirés et ses grains d'effets réduits à un sur trois. Survolée (`data-live`, posé par `Tilt`),
 * elle retrouve tout.
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
  await prochaineImage();
  await prochaineImage();
  const still = hote.querySelector<HTMLElement>(".tcg-still");
  if (!still) throw new Error("Carte sans .tcg-still.");
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
        enCours: a.playState === "running",
        repeint: [...props].filter((p) => !ANIMABLES.has(p)),
      };
    });
}

const affiches = (carte: HTMLElement, sel: string) =>
  [...carte.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== "none").length;

const svgLourds = (carte: HTMLElement) =>
  [...carte.querySelectorAll<SVGSVGElement>(".tcg-vfx[data-lourd] svg")].filter((s) =>
    s.querySelector("animate"),
  );

describe("planche : carte figée non survolée", () => {
  for (const t of PLANCHE) {
    it(`${t.id} : aucune animation qui repeint hors survol, tout revient au survol`, async () => {
      const carte = await poser(t);

      const repos = animations(carte);
      const repeintes = repos.filter((a) => a.enCours && (a.lourd || a.repeint.length));
      expect(repeintes, JSON.stringify(repeintes)).toEqual([]);
      expect(repos.filter((a) => a.lourd).length).toBeGreaterThan(0);
      const svgs = svgLourds(carte);
      expect(svgs.length).toBeGreaterThan(0);
      expect(svgs.map((s) => s.animationsPaused())).toEqual(svgs.map(() => true));
      expect(affiches(carte, ".tcg-sr-spark, .tcg-sr-spark-group, .tcg-sr-spark-sprite")).toBe(0);
      const grains = carte.querySelectorAll(".tcg-vfx-mote, .tcg-vfx-ember").length;
      expect(grains).toBeGreaterThan(0);
      expect(affiches(carte, ".tcg-vfx-mote, .tcg-vfx-ember")).toBe(Math.ceil(grains / 3));

      carte.dataset.live = "";
      await prochaineImage();
      await prochaineImage();
      const vivantes = animations(carte);
      expect(vivantes.some((a) => a.lourd && a.enCours)).toBe(true);
      expect(svgs.map((s) => s.animationsPaused())).toEqual(svgs.map(() => false));
      expect(affiches(carte, ".tcg-vfx-mote, .tcg-vfx-ember")).toBe(grains);
      if (t.card.rarity === "sr") {
        expect(affiches(carte, ".tcg-sr-spark")).toBeGreaterThan(0);
      }

      delete carte.dataset.live;
      await prochaineImage();
      expect(svgs.map((s) => s.animationsPaused())).toEqual(svgs.map(() => true));
    });
  }
});
