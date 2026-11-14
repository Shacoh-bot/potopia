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

// « Tink » quand on tape sur une émeraude de l'inventaire : l'orbe d'expérience de Minecraft
// (0,2 s, en WAV : pas de blanc d'encodeur au début), jamais deux fois le même. Une note de la gamme
// pentatonique sol, la, do, ré, mi (la vitesse de lecture change la hauteur), tirée au hasard sans
// répéter la précédente, donc ça sonne toujours juste ; légèrement désaccordé, avec un volume un peu
// différent. Comme les coups de pioche d'un jeu de minage.
const TINK_SRCS = ["/audio/emerald-tink.wav"];
const TINK_RATES = [3 / 4, 5 / 6, 1, 9 / 8, 5 / 4]; // sol, la, do, ré, mi
const TINK_VOLUME = 0.7;
let lastNote = -1;
let lastVariant = -1;

/** Un indice au hasard parmi `count`, jamais `last`. */
function pickOther(count: number, last: number): number {
  if (count < 2) return 0;
  if (last < 0) return Math.floor(Math.random() * count);
  const i = Math.floor(Math.random() * (count - 1));
  return i < last ? i : i + 1;
}

// Sons décodés une fois (Web Audio) : un nouvel élément <audio> à chaque coup devait recharger et
// décoder le fichier avant de jouer, d'où un décalage net entre le clic et le son.
const tinkBuffers: (AudioBuffer | undefined)[] = [];
let tinkLoading: Promise<void> | null = null;
let tinkContext: AudioContext | null = null;

/** Télécharge et décode les « tink » d'avance (une fois ; réessaie si ça a échoué). */
export function preloadTink(): void {
  if (tinkLoading || typeof OfflineAudioContext === "undefined") return;
  // décodage hors contexte de lecture : celui-ci ne peut démarrer qu'après un geste
  const decoder = new OfflineAudioContext(1, 1, 44100);
  tinkLoading = Promise.all(
    TINK_SRCS.map(async (src, i) => {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`${src} : ${res.status}`);
      tinkBuffers[i] = await decoder.decodeAudioData(await res.arrayBuffer());
    }),
  ).then(
    () => undefined,
    () => {
      tinkLoading = null;
    },
  );
}

export function playTink(): void {
  const level = effectiveVolume() * TINK_VOLUME;
  if (level <= 0 || typeof AudioContext === "undefined") return;
  preloadTink();
  // variantes déjà prêtes ; tant qu'aucune ne l'est (tout premier coup), rien ne joue
  const ready = TINK_SRCS.map((_, i) => i).filter((i) => tinkBuffers[i]);
  if (ready.length === 0) return;
  lastNote = pickOther(TINK_RATES.length, lastNote);
  const pool = ready.length > 1 ? ready.filter((i) => i !== lastVariant) : ready;
  lastVariant = pool[Math.floor(Math.random() * pool.length)] ?? 0;
  tinkContext ??= new AudioContext();
  const ctx = tinkContext;
  if (ctx.state === "suspended") void ctx.resume();
  const source = ctx.createBufferSource();
  source.buffer = tinkBuffers[lastVariant] ?? null;
  // la vitesse de lecture change la hauteur : une note de la gamme, légèrement désaccordée
  source.playbackRate.value = (TINK_RATES[lastNote] ?? 1) * (1 + (Math.random() - 0.5) * 0.015);
  const gain = ctx.createGain();
  gain.gain.value = Math.min(1, level * (0.8 + Math.random() * 0.3));
  source.connect(gain).connect(ctx.destination);
  source.start();
}

// Volumes volontairement discrets : ces sons passent par-dessus les musiques du header.
export const SOUNDS = {
  pickup: { src: "/audio/emerald.mp3", volume: 0.35 },
  unseal: { src: "/audio/emeralds-unseal.mp3", volume: 0.4 },
  seal: { src: "/audio/emeralds-seal.mp3", volume: 0.4 },
} as const;
