"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { watchStillHover } from "./still-hover";

/**
 * Carte qui s'incline vers le pointeur, avec reflet et holo qui suivent (classes de tcg.css).
 * Les effets lisent --mx/--my (%), --x (0 à 1) et --rx/--ry, posées ici sans re-rendu React.
 * Dans une carte figée (planche), elle suit le survol de son parent (`watchStillHover`) et pose
 * `data-live` sur la carte : tcg.css lui rend alors 3D, reflet et animations.
 */
export function Tilt({
  children,
  radius,
  style,
}: {
  children: ReactNode;
  radius: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: { clientX: number; clientY: number }) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Bornés : une carte vue de profil (en plein retournement) est très étroite à l'écran, et
    // l'angle calculé deviendrait énorme.
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1)));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / (r.height || 1)));
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--x", x.toFixed(3));
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--ry", `${(x - 0.5) * 18}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 18}deg`);
    el.dataset.active = "";
  }

  function leave() {
    const el = ref.current;
    if (!el) return;
    for (const v of ["--mx", "--my", "--x", "--rx", "--ry"]) el.style.removeProperty(v);
    delete el.dataset.active;
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const card = el.closest<HTMLElement>(".tcg-still");
    return (
      watchStillHover(el, {
        enter: () => card && (card.dataset.live = ""),
        move,
        leave: () => {
          leave();
          if (card) delete card.dataset.live;
        },
      }) ?? undefined
    );
  }, []);

  return (
    <div
      ref={ref}
      className="tcg-tilt"
      onPointerMove={move}
      onPointerLeave={leave}
      // Sur mobile, un début de défilement annule le pointeur sans « leave » : on remet la carte à plat.
      onPointerCancel={leave}
      style={{ borderRadius: radius, ...style }}
    >
      {children}
    </div>
  );
}
