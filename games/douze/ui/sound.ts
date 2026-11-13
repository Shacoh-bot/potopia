import { effectiveVolume } from "@app/ui";

// Petits bips synthétisés (aucun fichier son) : top départ, réussite, raté. Au volume du site.
let context: AudioContext | null = null;

function tone(freq: number, start: number, duration: number, type: OscillatorType = "square") {
  const volume = effectiveVolume() * 0.12;
  if (volume <= 0 || typeof window === "undefined") return;
  try {
    context ??= new AudioContext();
    const t = context.currentTime + start;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(context.destination);
    osc.start(t);
    osc.stop(t + duration);
  } catch {
    // pas de son disponible : le jeu continue en silence
  }
}

export const sounds = {
  /** Annonce d'une épreuve. */
  go: () => {
    tone(523, 0, 0.09);
    tone(784, 0.1, 0.14);
  },
  /** Petit retour de clic (une tuile, un paquet de 12). */
  tick: () => tone(1046, 0, 0.05, "triangle"),
  /** Résultat d'une épreuve, selon ses points (0 à 12). */
  result: (points: number) => {
    if (points >= 12) {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.08, 0.16));
    } else if (points > 0) {
      tone(659, 0, 0.12);
      tone(784, 0.12, 0.16);
    } else {
      tone(220, 0, 0.18, "sawtooth");
      tone(165, 0.18, 0.3, "sawtooth");
    }
  },
};
