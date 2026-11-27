import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { watchFrozenSvg, watchOffscreen } from "../ui/offscreen-pause";

/** Observateur factice : garde le rappel et les options, pour simuler l'entrée et la sortie d'écran. */
function fakeObserver() {
  const state: {
    cb?: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    observed: Element[];
    disconnected: boolean;
  } = { observed: [], disconnected: false };
  class Fake {
    constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      state.cb = cb;
      state.options = options;
    }
    observe(el: Element) {
      state.observed.push(el);
    }
    disconnect() {
      state.disconnected = true;
    }
  }
  const fire = (isIntersecting: boolean) =>
    state.cb?.(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as unknown as IntersectionObserver,
    );
  return { Observer: Fake as unknown as typeof IntersectionObserver, state, fire };
}

const css = readFileSync(new URL("../ui/tcg.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("pause des cartes hors de l'écran (refonte, étape 6)", () => {
  it("marque la carte hors écran, puis la rend vivante à son retour", () => {
    const el = { dataset: {} as DOMStringMap } as HTMLElement;
    const { Observer, state, fire } = fakeObserver();
    const stop = watchOffscreen(el, Observer);
    expect(state.observed).toEqual([el]);
    expect(state.options?.rootMargin).toBe("200px");
    fire(false);
    expect(el.dataset.horsEcran).toBe("");
    fire(true);
    expect("horsEcran" in el.dataset).toBe(false);
    fire(false);
    stop?.();
    expect(state.disconnected).toBe(true);
    expect("horsEcran" in el.dataset).toBe(false);
  });

  it("sans IntersectionObserver, ne fait rien (carte animée)", () => {
    const el = { dataset: {} as DOMStringMap } as HTMLElement;
    expect(watchOffscreen(el, undefined)).toBeNull();
    expect(el.dataset).toEqual({});
  });

  it("tcg.css met en pause toutes les animations d'une carte hors écran", () => {
    expect(css).toMatch(
      /\.tcg-tilt\[data-hors-ecran\] \*,\s*\.tcg-tilt\[data-hors-ecran\] \*::before,\s*\.tcg-tilt\[data-hors-ecran\] \*::after \{\s*animation-play-state: paused !important;\s*\}/,
    );
  });

  it("« réduire les animations » arrête toujours cadres, éclats et aura", () => {
    const blocs = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)];
    const arret = blocs.find((b) => (b[1] ?? "").includes(".tcg-frame-run__light"))?.[1] ?? "";
    for (const c of [".tcg-frame-run__light", ".tcg-aura", ".tcg-sr-spark"])
      expect(arret, c).toContain(c);
    expect(arret).toMatch(/animation: none/);
  });
});

describe("image fixe au repos (cartes figées, option 1)", () => {
  it("tcg.css met en pause toutes les animations d'une carte figée au repos, pas survolée", () => {
    expect(css).toMatch(
      /\.tcg-still\[data-repos\]:not\(\[data-live\]\) \*,\s*\.tcg-still\[data-repos\]:not\(\[data-live\]\) \*::before,\s*\.tcg-still\[data-repos\]:not\(\[data-live\]\) \*::after \{\s*animation-play-state: paused !important;\s*transition: none !important;\s*\}/,
    );
  });

  it("watchFrozenSvg : SVG en pause au repos, repris au survol, figé à nouveau ensuite", () => {
    const etat = { pause: 0, reprise: 0 };
    const svg = {
      pauseAnimations: () => etat.pause++,
      unpauseAnimations: () => etat.reprise++,
    };
    const card = { dataset: {} as DOMStringMap } as HTMLElement;
    const el = {
      closest: (sel: string) => (sel === ".tcg-still" ? card : null),
      querySelectorAll: () => [svg],
    } as unknown as HTMLElement;
    let rappel: (() => void) | undefined;
    let options: MutationObserverInit | undefined;
    class Fake {
      constructor(cb: () => void) {
        rappel = cb;
      }
      observe(_: Node, o: MutationObserverInit) {
        options = o;
      }
      disconnect() {}
    }
    const stop = watchFrozenSvg(el, Fake as unknown as typeof MutationObserver);
    expect(options?.attributeFilter).toEqual(["data-live", "data-repos"]);
    expect(options?.subtree).toBe(true);
    expect(etat).toEqual({ pause: 0, reprise: 1 });
    card.dataset.repos = "";
    rappel?.();
    expect(etat.pause).toBe(1);
    card.dataset.live = "";
    rappel?.();
    expect(etat.reprise).toBe(2);
    delete card.dataset.live;
    rappel?.();
    expect(etat.pause).toBe(2);
    stop?.();
    expect(etat.reprise).toBe(3);
  });
});
