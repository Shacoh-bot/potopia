"use client";

import { effectiveVolume, onVolumeChange } from "@app/ui";
import { BOOSTER_SOUNDS, BOOSTER_SOUNDS_BASE, revealSound } from "./booster-sound-files";

/*
 * Bruitages de l'ouverture d'un booster : vrais sons de Pokémon TCG Pocket (liste dans
 * `booster-sound-files.ts`), joués avec Web Audio. Ils sont téléchargés et décodés d'avance
 * (`preloadBoosterSounds`, appelé en arrivant sur la page) : aucun délai au premier geste.
 * Volume du site (bouton du header) appliqué en fin de chaîne, y compris pendant un son long.
 */

const buffers = new Map<string, AudioBuffer>();
let loading: Promise<void> | null = null;
let ctx: AudioContext | null = null;
let volume: GainNode | null = null;

/** Télécharge et décode tous les sons (une seule fois ; réessaie au prochain appel en cas d'échec). */
export function preloadBoosterSounds(): Promise<void> {
  if (typeof window === "undefined" || typeof OfflineAudioContext === "undefined") {
    return Promise.resolve();
  }
  if (!loading) {
    // Décodage hors contexte de lecture : celui-ci ne peut démarrer qu'après un geste du joueur.
    const decoder = new OfflineAudioContext(1, 1, 44100);
    loading = Promise.all(
      BOOSTER_SOUNDS.map(async (name) => {
        if (buffers.has(name)) return;
        const res = await fetch(`${BOOSTER_SOUNDS_BASE}${name}.mp3`);
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

/** Contexte de lecture partagé, créé au premier son (donc après un geste du joueur). */
function output(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx || !volume) {
    ctx = new AudioContext();
    volume = ctx.createGain();
    volume.gain.value = effectiveVolume();
    volume.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: volume };
}

onVolumeChange(() => {
  if (ctx && volume) volume.gain.setTargetAtTime(effectiveVolume(), ctx.currentTime, 0.02);
});

/** Nombre au hasard entre `min` et `max`. */
const vary = (min: number, max: number) => min + Math.random() * (max - min);

/** Joue un son (ou un extrait : `offset` et `duration` en secondes, avec un fondu de sortie). */
function play(
  name: string,
  {
    at = 0,
    rate = 1,
    gain = 1,
    offset = 0,
    duration,
  }: { at?: number; rate?: number; gain?: number; offset?: number; duration?: number } = {},
) {
  if (effectiveVolume() <= 0) return;
  const buffer = buffers.get(name);
  if (!buffer) {
    void preloadBoosterSounds(); // pas encore là : il sera prêt pour le geste suivant
    return;
  }
  const o = output();
  if (!o) return;
  const t = o.ctx.currentTime + at;
  const src = o.ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const env = o.ctx.createGain();
  env.gain.value = gain;
  src.connect(env).connect(o.out);
  if (duration === undefined) {
    src.start(t, offset);
    return;
  }
  const end = t + duration / rate;
  env.gain.setValueAtTime(gain, Math.max(t, end - 0.03));
  env.gain.linearRampToValueAtTime(0, end);
  src.start(t, offset, duration);
}

/** Le paquet qu'on saisit. */
export function grabSound() {
  play("grab", { rate: vary(0.95, 1.05) });
}

/** Un morceau de déchirure, joué tant que la souris glisse sur la ligne (plus fort si plus vite). */
export function tearSound(speed: number) {
  // Un grain pris au hasard dans le crépitement de la vraie découpe : chaque morceau diffère.
  play("tear", {
    offset: vary(0.05, 0.5),
    duration: vary(0.07, 0.11),
    rate: vary(0.92, 1.08),
    gain: Math.min(1, 0.35 + speed * 0.45),
  });
}

/** Le paquet s'ouvre. */
export function openSound() {
  play("open");
}

/** Une carte qui se pose sur la table. */
export function landSound() {
  play("land", { rate: vary(0.92, 1.08), gain: vary(0.75, 1) });
}

/**
 * La carte se retourne, avec sa révélation : de la commune discrète à la SSR qui explose. Tout
 * part au DÉBUT du retournement, dès le geste (choix de l'utilisateur, 26/11/2026).
 */
export function flipSound(rarity: string) {
  play("flip", { rate: vary(0.95, 1.05) });
  play(revealSound(rarity));
}

/*
 * Son propre d'une carte (Singham…) : un fichier du stockage, joué par un élément <audio> (pas
 * Web Audio : pas besoin d'en-têtes CORS du stockage). Il remplace les bruitages du retournement,
 * part au début du retournement (dès le geste) et s'arrête en fondu dès qu'une autre carte se
 * retourne.
 */

const warmed = new Map<string, HTMLAudioElement>();
let playing: HTMLAudioElement | null = null;
let pending: number | null = null;

/** Télécharge d'avance le son propre d'une carte (cache du navigateur), sans le jouer. */
export function preloadCardSound(url: string) {
  if (typeof Audio === "undefined" || warmed.has(url)) return;
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = url;
  warmed.set(url, audio);
}

/** Arrête le son propre en cours (fondu de `fadeS` secondes) et celui qui allait partir. */
export function stopCardSound(fadeS = 0.4) {
  if (pending !== null) window.clearTimeout(pending);
  pending = null;
  const audio = playing;
  playing = null;
  if (!audio) return;
  const from = audio.volume;
  const start = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / (fadeS * 1000));
    audio.volume = from * (1 - k);
    if (k < 1) requestAnimationFrame(step);
    else audio.pause();
  };
  requestAnimationFrame(step);
}

/** Joue le son propre d'une carte dans `at` secondes (0 : tout de suite), au volume du site. */
export function cardSound(url: string, { at = 0 }: { at?: number } = {}) {
  stopCardSound();
  if (typeof Audio === "undefined" || effectiveVolume() <= 0) return;
  pending = window.setTimeout(() => {
    pending = null;
    const audio = new Audio(url);
    audio.volume = Math.min(1, effectiveVolume());
    playing = audio;
    audio.addEventListener("ended", () => {
      if (playing === audio) playing = null;
    });
    void audio.play().catch(() => {
      if (playing === audio) playing = null;
    });
  }, at * 1000);
}

/**
 * Retournement d'une carte dans un booster : son son propre s'il en a un (rien d'autre, pas même
 * la révélation SR/SSR), sinon les bruitages de sa rareté. Le son propre précédent s'arrête en fondu.
 */
export function revealCardSound(rarity: string, soundUrl?: string | null) {
  if (soundUrl) {
    cardSound(soundUrl);
    return;
  }
  stopCardSound();
  flipSound(rarity);
}

onVolumeChange(() => {
  if (playing) playing.volume = Math.min(1, effectiveVolume());
});
