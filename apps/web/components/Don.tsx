"use client";

import { DON_EVENT, effectiveVolume } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DON_MS = 1900;
// préchargé à l'ouverture du menu des thèmes (ThemeSwitcher de @app/ui) : il surgit au coup de
// tambour
const GEAR5 = "/onepiece/portrait-gear5.webp";
// nuages de vapeur de Gear 5, en couronne autour de lui (en % de l'écran), qui éclatent l'un
// après l'autre
const PUFFS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return {
    x: 50 + Math.cos(angle) * 30,
    y: 52 + Math.sin(angle) * 30,
    delay: 120 + i * 70,
    size: 80 + (i % 3) * 30,
  };
});
// Le vrai « ドン!! » de l'anime (coup de taiko qui résonne), préchargé au montage.
const SOUND = "/audio/onepiece-don.mp3";
const VOLUME = 0.9;

/**
 * « ドン!! » façon manga (thème One Piece) : flash, lignes de
 * vitesse noires qui convergent vers le centre et onomatopée qui claque en tremblant, sur le vrai
 * bruitage « ドン!! » de l'anime ; Luffy en
 * Gear 5 surgit derrière en riant, rebondit comme du caoutchouc dans une couronne de nuages de
 * vapeur, puis tout s'efface. Déclenché par `don()` de `@app/ui` (choix du thème One Piece).
 * Monté une fois, layout racine.
 */
export function Don() {
  const [on, setOn] = useState(false);
  const onRef = useRef(false);

  useEffect(() => {
    let timer = 0;
    const audio = new Audio(SOUND);
    audio.preload = "auto";
    const start = () => {
      if (onRef.current) return;
      onRef.current = true;
      setOn(true);
      const level = effectiveVolume() * VOLUME;
      if (level > 0) {
        audio.currentTime = 0;
        audio.volume = Math.min(1, level);
        audio.play().catch(() => {});
      }
      timer = window.setTimeout(() => {
        onRef.current = false;
        setOn(false);
      }, DON_MS);
    };
    window.addEventListener(DON_EVENT, start);
    return () => {
      window.removeEventListener(DON_EVENT, start);
      window.clearTimeout(timer);
      audio.pause();
    };
  }, []);

  if (!on) return null;
  return createPortal(
    <div aria-hidden className="don-layer pointer-events-none fixed inset-0 z-100">
      <span className="don-flash" />
      <span className="don-lines" />
      {PUFFS.map((p, i) => (
        <span
          key={i}
          className="don-puff"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
      <span className="don-gear5" style={{ backgroundImage: `url(${GEAR5})` }} />
      <span className="don-text">
        <span>
          ドン<span className="don-bang">!!</span>
        </span>
      </span>
    </div>,
    document.body,
  );
}
