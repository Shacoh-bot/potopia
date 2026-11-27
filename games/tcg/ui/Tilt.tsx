"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { watchStillHover } from "./still-hover";

/**
 * Carte qui s'incline vers le pointeur, avec reflet et holo qui suivent (classes de tcg.css).
 * Les effets lisent --mx/--my (%), --x (0 à 1), --rx/--ry et --mr, posées ici sans re-rendu React.
 * --mr : distance du pointeur au coin le plus loin, en diagonales de la carte (0,5 à 1) ; un
 * effet qui suit le pointeur s'en sert pour garder le rayon « farthest-corner » d'un dégradé
 * déplacé par `translate`/`scale` (holo, tcg.css), sans repeindre.
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
  // Un seul calcul par image : un pointeur envoie souvent bien plus de 60 mouvements par seconde
  // (Firefox ne les regroupe pas), et chaque écriture de variable recalcule tout le sous-arbre.
  const frame = useRef(0);
  const last = useRef<{ clientX: number; clientY: number } | null>(null);
  // Boîte lue une fois par survol (pas à chaque mouvement) ; oubliée à la sortie.
  const rect = useRef<DOMRect | null>(null);

  function apply() {
    frame.current = 0;
    const el = ref.current;
    const e = last.current;
    if (!el || !e) return;
    const r = (rect.current ??= el.getBoundingClientRect());
    // Bornés : une carte vue de profil (en plein retournement) est très étroite à l'écran, et
    // l'angle calculé deviendrait énorme.
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1)));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / (r.height || 1)));
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--x", x.toFixed(3));
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.style.setProperty("--ry", `${((x - 0.5) * 18).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 18).toFixed(2)}deg`);
    const w = el.offsetWidth || 1;
    const h = el.offsetHeight || 1;
    const far = Math.hypot(Math.max(x, 1 - x) * w, Math.max(y, 1 - y) * h);
    el.style.setProperty("--mr", (far / Math.hypot(w, h)).toFixed(4));
    if (!("active" in el.dataset)) el.dataset.active = "";
  }

  function move(e: { clientX: number; clientY: number }) {
    last.current = { clientX: e.clientX, clientY: e.clientY };
    if (!frame.current) frame.current = requestAnimationFrame(apply);
  }

  function leave() {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    last.current = null;
    rect.current = null;
    const el = ref.current;
    if (!el) return;
    for (const v of ["--mx", "--my", "--x", "--rx", "--ry", "--mr"]) el.style.removeProperty(v);
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
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

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
