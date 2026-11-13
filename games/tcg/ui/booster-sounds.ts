"use client";

import { effectiveVolume } from "@app/ui";

/*
 * Bruitages de l'ouverture d'un booster, synthétisés dans le navigateur (Web Audio) : rien à
 * télécharger, et chaque son varie un peu à chaque fois (hauteur, durée, grain), comme un vrai
 * geste. Volumes doux, multipliés par le volume du site (bouton du header).
 */

let shared: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** Contexte audio partagé (créé au premier son, donc après un geste du joueur). */
function audio(): { ctx: AudioContext; out: GainNode } | null {
  const level = effectiveVolume();
  if (level <= 0 || typeof AudioContext === "undefined") return null;
  shared ??= new AudioContext();
  if (shared.state === "suspended") void shared.resume();
  const out = shared.createGain();
  out.gain.value = level;
  out.connect(shared.destination);
  return { ctx: shared, out };
}

/** Bruit blanc (1 s), réutilisé par tous les sons. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

/** Nombre au hasard entre `min` et `max`. */
const vary = (min: number, max: number) => min + Math.random() * (max - min);

/** Souffle de bruit filtré : `from` → `to` Hz, enveloppe douce. */
function breath(
  { ctx, out }: { ctx: AudioContext; out: GainNode },
  {
    at = 0,
    duration,
    from,
    to,
    q = 1,
    gain,
    type = "bandpass",
  }: {
    at?: number;
    duration: number;
    from: number;
    to: number;
    q?: number;
    gain: number;
    type?: BiquadFilterType;
  },
) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.playbackRate.value = vary(0.8, 1.2);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + duration * 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(env).connect(out);
  src.start(t, Math.random() * 0.5, duration + 0.05);
}

/** Note douce (sinus et une harmonique), pour les révélations. */
function bell(
  { ctx, out }: { ctx: AudioContext; out: GainNode },
  { at, freq, duration, gain }: { at: number; freq: number; duration: number; gain: number },
) {
  const t = ctx.currentTime + at;
  for (const [mult, level] of [
    [1, 1],
    [2.01, 0.25],
    [3.98, 0.08],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * mult * vary(0.997, 1.003);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain * level, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }
}

/** Le film plastique qu'on saisit : quelques froissements brefs. */
export function grabSound() {
  const a = audio();
  if (!a) return;
  const n = Math.round(vary(2, 4));
  for (let i = 0; i < n; i++) {
    breath(a, {
      at: i * vary(0.03, 0.07),
      duration: vary(0.04, 0.08),
      from: vary(3500, 6000),
      to: vary(2500, 4000),
      q: 2.5,
      gain: vary(0.05, 0.09),
    });
  }
}

/** Un morceau de déchirure, joué tant que la souris glisse sur la ligne (plus fort si plus vite). */
export function tearSound(speed: number) {
  const a = audio();
  if (!a) return;
  breath(a, {
    duration: vary(0.05, 0.09),
    from: vary(2200, 3200),
    to: vary(1200, 1800),
    q: 1.4,
    gain: Math.min(0.16, 0.04 + speed * 0.08),
  });
}

/** Le paquet s'ouvre : déchirure franche, puis souffle de lumière qui monte. */
export function openSound() {
  const a = audio();
  if (!a) return;
  breath(a, { duration: 0.22, from: 2600, to: 900, q: 0.9, gain: 0.18 });
  breath(a, { at: 0.12, duration: 1.1, from: 300, to: 2400, q: 0.6, gain: 0.07 });
  for (let i = 0; i < 5; i++) {
    bell(a, {
      at: 0.25 + i * vary(0.07, 0.11),
      freq: vary(1800, 3200),
      duration: 0.35,
      gain: 0.015,
    });
  }
}

/** Une carte qui se pose sur la table : petit glissé feutré. */
export function landSound() {
  const a = audio();
  if (!a) return;
  breath(a, {
    duration: vary(0.09, 0.14),
    from: vary(1400, 2000),
    to: vary(500, 800),
    q: 0.8,
    gain: vary(0.07, 0.1),
  });
}

/** Gammes des révélations (Hz) : plus la carte est rare, plus l'arpège monte et dure. */
const REVEAL: Record<string, number[]> = {
  common: [],
  uncommon: [659.3],
  rare: [659.3, 987.8],
  epic: [587.3, 880, 1174.7],
  legendary: [523.3, 659.3, 784, 1046.5],
  sr: [523.3, 659.3, 784, 1046.5, 1318.5],
  ssr: [523.3, 659.3, 784, 987.8, 1174.7, 1568, 2093],
};

/** La carte se retourne : un « fwip » de carton, puis une note ou un arpège selon la rareté. */
export function flipSound(rarity: string) {
  const a = audio();
  if (!a) return;
  breath(a, {
    duration: vary(0.12, 0.18),
    from: vary(700, 1000),
    to: vary(2400, 3400),
    q: 1.2,
    gain: vary(0.07, 0.1),
  });
  const notes = REVEAL[rarity] ?? [];
  const step = rarity === "ssr" || rarity === "sr" ? 0.075 : 0.09;
  const shift = vary(0.98, 1.02);
  notes.forEach((freq, i) =>
    bell(a, {
      at: 0.1 + i * step,
      freq: freq * shift,
      duration: rarity === "ssr" ? 1.4 : 0.9,
      gain: 0.05,
    }),
  );
  // Les plus belles cartes scintillent un instant.
  if (rarity === "legendary" || rarity === "sr" || rarity === "ssr") {
    for (let i = 0; i < 8; i++) {
      bell(a, {
        at: 0.2 + i * vary(0.05, 0.09),
        freq: vary(2400, 4200),
        duration: 0.3,
        gain: 0.012,
      });
    }
  }
}
