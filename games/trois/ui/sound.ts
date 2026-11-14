"use client";

import { effectiveVolume, onVolumeChange } from "@app/ui";
import { useSyncExternalStore } from "react";
import type { Mark } from "../src/game";
import { type SoundName, TROIS_SOUNDS } from "./sound-files";

// Sons du jeu : bips de cases de Motus ; touches, clics, mot trouvé, perdu et 3 sur 3 : sons
// d'interface de Pokémon TCG Pocket, fichiers de `public/audio/trois/` téléchargés et décodés dès
// l'arrivée sur la page ; vrais sons « mèmes » pour le mode Boobzilla (sa petite boucle chiptune
// reste synthétisée).

const KEY = "trois_muted";
let ctx: AudioContext | null = null;
let master: AudioNode | null = null;
let volume: GainNode | null = null;
let muted = false;
const listeners = new Set<() => void>();

try {
  muted = typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
} catch {
  /* stockage indisponible */
}

/** Contexte audio + sortie commune (un compresseur évite la saturation quand les accords s'empilent). */
function audio() {
  if (muted || typeof window === "undefined") return null;
  // le contexte ne peut démarrer qu'après un geste de l'utilisateur : on le crée au premier son
  if (!ctx || !master) {
    ctx = new AudioContext();
    master = ctx.createDynamicsCompressor();
    // volume global du site (bouton du header), appliqué en toute fin de chaîne
    volume = ctx.createGain();
    volume.gain.value = effectiveVolume();
    master.connect(volume).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { a: ctx, out: master };
}

onVolumeChange(() => {
  if (ctx && volume) volume.gain.setTargetAtTime(effectiveVolume(), ctx.currentTime, 0.02);
});

const buffers = new Map<SoundName, AudioBuffer>();
let loading: Promise<void> | null = null;

/** Télécharge et décode les sons (une fois ; réessaie au prochain appel en cas d'échec). */
export function preloadSounds(): Promise<void> {
  if (typeof window === "undefined" || typeof OfflineAudioContext === "undefined") {
    return Promise.resolve();
  }
  if (!loading) {
    // Décodage hors contexte de lecture : celui-ci ne peut démarrer qu'après un geste du joueur.
    const decoder = new OfflineAudioContext(1, 1, 44100);
    loading = Promise.all(
      TROIS_SOUNDS.map(async (name) => {
        if (buffers.has(name)) return;
        const res = await fetch(`/audio/trois/${name}.mp3`);
        if (!res.ok) throw new Error(`${name} : ${res.status}`);
        buffers.set(name, await decoder.decodeAudioData(await res.arrayBuffer()));
      }),
    ).then(
      () => undefined,
      () => {
        loading = null;
      },
    );
  }
  return loading;
}

// Ce module ne sert qu'à TROIS : les sons se chargent dès l'arrivée sur la page.
void preloadSounds();

/** Joue un son du jeu, éventuellement décalé de `at` secondes (et accéléré de `rate`). */
function play(name: SoundName, at = 0, rate = 1) {
  const buffer = buffers.get(name);
  if (!buffer) {
    void preloadSounds(); // pas encore là : il sera prêt pour le geste suivant
    return;
  }
  const au = audio();
  if (!au) return;
  const src = au.a.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  src.connect(au.out);
  src.start(au.a.currentTime + at);
}

type Tone = {
  freq: number;
  to?: number;
  at?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
};

function tone({ freq, to, at = 0, dur = 0.1, type = "sine", vol = 0.15 }: Tone) {
  const au = audio();
  if (!au) return;
  const { a, out } = au;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// ─── Mode Boobzilla : sons absurdes ───────────────────────────────────────────

let chaos = false;
const rnd = (min: number, max: number) => min + Math.random() * (max - min);

// Vrais sons « mèmes » (myinstants) ; la hauteur varie un peu à chaque fois.
export const silly = {
  /** prout (deux prouts différents, au hasard) */
  fart: (at = 0) => play(Math.random() < 0.5 ? "silly-fart-1" : "silly-fart-2", at, rnd(0.85, 1.2)),
  /** rugissement de Godzilla (1954) */
  roar: (at = 0) => play("silly-roar", at),
  /** boing de dessin animé */
  boing: (at = 0) => play("silly-boing", at, rnd(0.9, 1.15)),
  /** corne de stade MLG */
  airhorn: (at = 0) => play("silly-airhorn", at),
  /** canard en plastique */
  squeak: (at = 0) => play("silly-squeak", at, rnd(0.9, 1.2)),
  /** coin-coin */
  quack: (at = 0) => play("silly-quack", at, rnd(0.9, 1.15)),
  /** sifflet à coulisse */
  slide: (at = 0) => play("silly-slide", at, rnd(0.9, 1.1)),
  /** trombone triste (sortie du mode) */
  sadTrombone: () => play("silly-trombone"),

  /** un son absurde au hasard */
  random(at = 0) {
    const all = [
      silly.fart,
      silly.boing,
      silly.squeak,
      silly.quack,
      silly.slide,
      silly.fart,
      silly.boing,
    ];
    (all[(Math.random() * all.length) | 0] ?? silly.fart)(at);
  },
};

/** En mode Boobzilla, les petits sons de l'interface deviennent absurdes. */
export function setChaos(on: boolean) {
  chaos = on;
}

let music: ReturnType<typeof setInterval> | null = null;

/** Boucle chiptune débile tant que le mode est actif. */
export function startMusic() {
  stopMusic();
  const bass = [65.41, 65.41, 77.78, 87.31, 65.41, 98, 87.31, 77.78];
  const lead = [523, 659, 784, 1047, 784, 659, 622, 784, 523, 659, 784, 932, 880, 784, 659, 587];
  let i = 0;
  music = setInterval(() => {
    tone({
      freq: (bass[(i >> 1) % bass.length] ?? 65.41) * 2,
      dur: 0.12,
      type: "square",
      vol: 0.05,
    });
    if (i % 2 === 0)
      tone({ freq: lead[(i >> 1) % lead.length] ?? 523, dur: 0.1, type: "square", vol: 0.025 });
    if (i % 4 === 0) tone({ freq: 120, to: 40, dur: 0.12, vol: 0.2 }); // grosse caisse
    i++;
  }, 140);
}

export function stopMusic() {
  if (music) clearInterval(music);
  music = null;
}

export const sfx = {
  key: () => (chaos ? silly.random() : play("key")),
  back: () => (chaos ? silly.fart() : play("back")),
  click: () => (chaos ? silly.boing() : play("click")),
  /** mot refusé : le bip grave d'une lettre absente de Motus */
  error: () => (chaos ? silly.airhorn() : play("error")),
  /** une case qui se retourne, au moment où elle se retourne : les bips de lettres de Motus */
  tile: (mark: Mark, at: number) => play(`tile-${mark}`, at),
  /** un mot trouvé : petit son de récompense, court et sobre */
  win: () => play("win"),
  /** mot perdu (seulement si « To Be Continued » ne joue pas : voir Game) */
  lose: () => play("lose"),
  /** 3 sur 3 : son de montée de rang */
  perfect: () => play("perfect"),
  success: () => play("success"),
};

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? "1" : "0");
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => muted,
    () => false,
  );
}
