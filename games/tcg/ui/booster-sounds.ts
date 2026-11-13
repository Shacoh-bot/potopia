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
 * La carte se retourne, puis sa révélation : de la commune discrète à la SSR qui explose. La
 * révélation part quand la face apparaît (mi-parcours du demi-tour).
 */
export function flipSound(rarity: string) {
  play("flip", { rate: vary(0.95, 1.05) });
  play(revealSound(rarity), { at: 0.12 });
}
