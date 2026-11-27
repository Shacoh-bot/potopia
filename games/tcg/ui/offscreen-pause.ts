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
