/*
 * Survol d'une carte figée (`GameCard still`, classe `tcg-still`) : sur la planche de l'admin, la
 * carte est en `pointer-events: none` sous son lien, elle ne voit donc jamais le pointeur. On
 * écoute le premier parent qui le reçoit. Utilisé par `Tilt` (inclinaison, et `data-live` posé
 * sur la carte, d'où tcg.css lui rend 3D, reflet et animations) et par `VisualEffectLayer`
 * (effets animés en JS).
 */

type Handlers = {
  enter?: () => void;
  move?: (e: PointerEvent) => void;
  leave: () => void;
};

/**
 * Écoute le survol de la carte figée qui contient `el`. Sans carte figée autour (carte vivante),
 * ne fait rien et renvoie null. Sinon, renvoie de quoi arrêter l'écoute.
 */
export function watchStillHover(
  el: HTMLElement,
  { enter, move, leave }: Handlers,
): (() => void) | null {
  const card = el.closest<HTMLElement>(".tcg-still");
  if (!card) return null;
  let host: HTMLElement | null = card;
  while (host && getComputedStyle(host).pointerEvents === "none") host = host.parentElement;
  if (!host) return null;
  const target = host;
  const onEnter = () => enter?.();
  const onMove = (e: PointerEvent) => move?.(e);
  target.addEventListener("pointerenter", onEnter);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerleave", leave);
  // Sur mobile, un début de défilement annule le pointeur sans « leave ».
  target.addEventListener("pointercancel", leave);
  return () => {
    target.removeEventListener("pointerenter", onEnter);
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerleave", leave);
    target.removeEventListener("pointercancel", leave);
  };
}
