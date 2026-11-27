import { type PointerEvent, useRef } from "react";

/** Déplacement (px) au-delà duquel un appui devient un glisser ; en dessous, c'est un clic. */
export const DRAG_THRESHOLD = 6;

/** `list` avec l'élément en place `from` déplacé en place `to` (les autres glissent d'un cran). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from === to || from < 0 || to < 0 || from >= out.length || to >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item as T);
  return out;
}

type Drag = { from: number; x: number; y: number; el: HTMLElement; moved: boolean };

/**
 * Glisser-déposer des cases d'une planche (banc des cartes). La case suit le pointeur par
 * `transform` posé directement sur l'élément : aucun rendu React pendant le geste. Pendant le
 * glisser, la case porte `data-glisse-carte` et le banc (`.tcg-bench`) `data-glisse` : tcg.css met
 * alors toutes les animations en pause (aucune carte ne repeint pendant le déplacement). Lâchée
 * sur une autre case (repérée par `data-place`), elle prend sa place (`onDrop`). Un appui sans
 * déplacement reste un clic (`wasDrag()` renvoie faux).
 */
export function useBenchDrag(onDrop: (from: number, to: number) => void) {
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);

  function end(e: PointerEvent<HTMLElement>, drop: boolean) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (!d.moved) return;
    dragged.current = true;
    const target = drop
      ? document
          .elementsFromPoint(e.clientX, e.clientY)
          .map((el) => el.closest<HTMLElement>("[data-place]"))
          .find((el) => el && el !== d.el)
      : null;
    d.el.style.transform = "";
    delete d.el.dataset.glisseCarte;
    const bench = d.el.closest<HTMLElement>(".tcg-bench");
    if (bench) delete bench.dataset.glisse;
    const to = target ? Number(target.dataset.place) : -1;
    if (to >= 0 && to !== d.from) onDrop(d.from, to);
  }

  return {
    /** Gestionnaires à poser sur la case en place `place`. */
    handlers: (place: number) => ({
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (e.button !== 0) return;
        dragged.current = false;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = {
          from: place,
          x: e.clientX,
          y: e.clientY,
          el: e.currentTarget,
          moved: false,
        };
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moved) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          d.moved = true;
          d.el.dataset.glisseCarte = "";
          const bench = d.el.closest<HTMLElement>(".tcg-bench");
          if (bench) bench.dataset.glisse = "";
        }
        d.el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => end(e, true),
      onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e, false),
    }),
    /** Vrai une fois si le dernier appui était un glisser (le clic qui suit est à ignorer). */
    wasDrag() {
      const was = dragged.current;
      dragged.current = false;
      return was;
    },
  };
}
