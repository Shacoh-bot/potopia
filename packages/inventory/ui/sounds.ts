"use client";

import { effectiveVolume } from "@app/ui";

/**
 * Joue un court bruitage (découpé dans les sons de Sonic 2), à une fraction du volume du site, avec
 * un fondu sur la fin pour qu'il ne s'arrête pas net.
 */
export function playClip(src: string, volume: number, fadeOutMs = 400): void {
  const audio = new Audio(src);
  const level = effectiveVolume() * volume;
  audio.volume = level;
  audio.addEventListener("loadedmetadata", () => {
    const fadeAt = Math.max(0, audio.duration * 1000 - fadeOutMs);
    window.setTimeout(() => {
      const t0 = performance.now();
      const step = window.setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / fadeOutMs);
        audio.volume = level * (1 - k);
        if (k >= 1) window.clearInterval(step);
      }, 40);
    }, fadeAt);
  });
  audio.play().catch(() => {});
}

// « Tink » quand on tape sur une émeraude de l'inventaire : un vrai scintillement de Sonic 2, jamais
// deux fois le même. Trois variantes du son (entier, plus court, avec un léger écho) et une note de
// la gamme pentatonique sol, la, do, ré, mi (la vitesse de lecture change la hauteur), chacune tirée
// au hasard sans répéter la précédente, donc ça sonne toujours juste ; légèrement désaccordé, avec
// un volume un peu différent. Comme les coups de pioche d'un jeu de minage.
const TINK_SRCS = [
  "/audio/emerald-tink-1.mp3",
  "/audio/emerald-tink-2.mp3",
  "/audio/emerald-tink-3.mp3",
];
const TINK_RATES = [3 / 4, 5 / 6, 1, 9 / 8, 5 / 4]; // sol, la, do, ré, mi
const TINK_VOLUME = 0.4;
let lastNote = -1;
let lastVariant = -1;

/** Un indice au hasard parmi `count`, jamais `last`. */
function pickOther(count: number, last: number): number {
  if (last < 0) return Math.floor(Math.random() * count);
  const i = Math.floor(Math.random() * (count - 1));
  return i < last ? i : i + 1;
}

/** Télécharge les « tink » d'avance (le navigateur les garde ensuite en cache). */
export function preloadTink(): void {
  for (const src of TINK_SRCS) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = src;
  }
}

export function playTink(): void {
  const level = effectiveVolume() * TINK_VOLUME;
  if (level <= 0) return;
  lastNote = pickOther(TINK_RATES.length, lastNote);
  lastVariant = pickOther(TINK_SRCS.length, lastVariant);
  const audio = new Audio(TINK_SRCS[lastVariant]);
  // la vitesse change la hauteur (et pas seulement le tempo)
  audio.preservesPitch = false;
  audio.playbackRate = (TINK_RATES[lastNote] ?? 1) * (1 + (Math.random() - 0.5) * 0.015);
  audio.volume = Math.min(1, level * (0.8 + Math.random() * 0.3));
  audio.play().catch(() => {});
}

// Volumes volontairement discrets : ces sons passent par-dessus les musiques du header.
export const SOUNDS = {
  pickup: { src: "/audio/emerald.mp3", volume: 0.35 },
  unseal: { src: "/audio/emeralds-unseal.mp3", volume: 0.4 },
  seal: { src: "/audio/emeralds-seal.mp3", volume: 0.4 },
} as const;
