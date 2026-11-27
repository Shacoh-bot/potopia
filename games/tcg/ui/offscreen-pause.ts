/**
 * Budget des cartes (refonte, étape 6) : une carte hors de l'écran n'anime rien. Pose
 * `data-hors-ecran` sur `el` tant qu'il est loin de l'écran (marge de 200 px, pour repartir avant
 * d'apparaître) ; tcg.css y met en pause toutes les animations de la carte, qui reprennent là où
 * elles en étaient. Sans IntersectionObserver (vieux navigateur, rendu serveur) : rien, la carte
 * reste animée. Renvoie de quoi arrêter l'observation.
 */
export function watchOffscreen(
  el: HTMLElement,
  Observer: typeof IntersectionObserver | undefined = globalThis.IntersectionObserver,
): (() => void) | null {
  if (!Observer) return null;
  const io = new Observer(
    (entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (entry.isIntersecting) delete el.dataset.horsEcran;
      else el.dataset.horsEcran = "";
    },
    { rootMargin: "200px" },
  );
  io.observe(el);
  return () => {
    io.disconnect();
    delete el.dataset.horsEcran;
  };
}

/**
 * Niveaux de détail (refonte, étape 8) : met en pause les animations SVG (SMIL : `<animate>` des
 * filtres du mirage et de l'énergie) contenues dans `el` tant que la carte est figée sur une planche
 * sans être survolée (`.tcg-still` sans `data-live`) ou loin de l'écran (`.tcg-tilt` avec
 * `data-hors-ecran`). Le CSS ne sait pas arrêter le SMIL. Reprise là où elles en étaient, au premier
 * survol : le rendu survolé est inchangé. Sans MutationObserver (rendu serveur) : rien. Renvoie de
 * quoi arrêter l'observation (et relance les animations).
 */
export function watchFrozenSvg(
  el: HTMLElement,
  Observer: typeof MutationObserver | undefined = globalThis.MutationObserver,
): (() => void) | null {
  const card = el.closest<HTMLElement>(".tcg-still");
  const tilt = el.closest<HTMLElement>(".tcg-tilt");
  if (!Observer || (!card && !tilt)) return null;
  const svgs = () => [...el.querySelectorAll<SVGSVGElement>("svg")];
  const sync = () => {
    const frozen = (card && !("live" in card.dataset)) || (tilt && "horsEcran" in tilt.dataset);
    for (const svg of svgs()) {
      if (frozen) svg.pauseAnimations?.();
      else svg.unpauseAnimations?.();
    }
  };
  const mo = new Observer(sync);
  if (card) mo.observe(card, { attributes: true, attributeFilter: ["data-live"] });
  if (tilt) mo.observe(tilt, { attributes: true, attributeFilter: ["data-hors-ecran"] });
  sync();
  return () => {
    mo.disconnect();
    for (const svg of svgs()) svg.unpauseAnimations?.();
  };
}
