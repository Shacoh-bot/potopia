import { effectiveVolume } from "@app/ui";
import type { GameEvent } from "../src/engine";

/** Petites sonorités de synthèse originales, soumises au volume global de la plateforme. */
export class GameSound {
  context: AudioContext | null = null;
  enabled = true;
  private last = 0;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch {
      /* Audio indisponible : le jeu reste jouable. */
    }
  }
  play(event: GameEvent) {
    const c = this.context,
      volume = effectiveVolume();
    if (!c || !this.enabled || !volume || c.state !== "running") return;
    if (event === "kill" && c.currentTime - this.last < 0.12) return;
    this.last = c.currentTime;
    const tones: Record<GameEvent, number[]> = {
      kill: [330],
      hit: [85],
      heal: [440, 660],
      level: [392, 494, 587, 784],
      boss: [110, 146, 110],
      won: [392, 494, 587, 784, 988],
      lost: [220, 196, 146],
    };
    tones[event].forEach((hz, i) => {
      const oscillator = c.createOscillator(),
        gain = c.createGain();
      const at = c.currentTime + i * 0.11;
      oscillator.type = event === "hit" ? "sawtooth" : "triangle";
      oscillator.frequency.setValueAtTime(hz, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume * (event === "kill" ? 0.018 : 0.065), at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.14);
      oscillator.connect(gain);
      gain.connect(c.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.16);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  dispose() {
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}
