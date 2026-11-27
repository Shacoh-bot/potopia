import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Retournement d'une SR/SSR (choix de l'utilisateur, 27/11/2026) : la révélation de rareté (Web
 * Audio) et le son de victoire tiré (`<audio>`) partent ENSEMBLE ; le son de victoire dure 25 s au
 * plus, avec un fondu de sortie, jamais coupé net. Navigateur simulé, horloge simulée : chaque
 * lecture note son instant, la position de lecture avance avec l'horloge.
 */
const started: { name: string; at: number }[] = [];
const audios: FakeAudio[] = [];

class FakeAudio {
  src: string;
  volume = 1;
  preload = "";
  paused = true;
  private from = 0;
  private listeners = new Map<string, Set<() => void>>();
  constructor(src = "") {
    this.src = src;
    audios.push(this);
  }
  get currentTime() {
    return this.paused ? 0 : (Date.now() - this.from) / 1000;
  }
  set currentTime(_: number) {}
  addEventListener(type: string, f: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(f);
  }
  removeEventListener(type: string, f: () => void) {
    this.listeners.get(type)?.delete(f);
  }
  pause() {
    this.paused = true;
  }
  play() {
    this.paused = false;
    this.from = Date.now();
    started.push({ name: this.src, at: Date.now() });
    return Promise.resolve();
  }
}

/** Contexte Web Audio factice : `start` note le son (porté par son tampon) et son instant. */
class FakeAudioContext {
  state = "running";
  destination = {};
  get currentTime() {
    return Date.now() / 1000;
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} },
      connect: (n: unknown) => n,
    };
  }
  createBufferSource() {
    const src = {
      buffer: null as { name: string } | null,
      playbackRate: { value: 1 },
      connect: (n: unknown) => n,
      start: (t: number) => started.push({ name: src.buffer?.name ?? "?", at: t * 1000 }),
    };
    return src;
  }
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal(
    "OfflineAudioContext",
    class {
      decodeAudioData(b: { name: string }) {
        return Promise.resolve(b);
      }
    },
  );
  vi.stubGlobal("fetch", (url: string) =>
    Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve({ name: url.split("/").pop()?.replace(".mp3", "") }),
    }),
  );
  vi.stubGlobal("requestAnimationFrame", (f: () => void) => setTimeout(f, 16));
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  started.length = 0;
});

describe("son de victoire superposé au retournement", () => {
  it("la révélation de rareté et le son de victoire partent au même instant (SSR, SR)", async () => {
    const sounds = await import("../ui/booster-sounds");
    await sounds.preloadBoosterSounds();
    for (const [rarity, reveal] of [
      ["ssr", "reveal-ssr"],
      ["sr", "reveal-sr-affinage"],
    ] as const) {
      started.length = 0;
      const t0 = Date.now();
      sounds.revealCardSound(rarity, null, `https://stockage.test/victoire-${rarity}.mp3`);
      await vi.advanceTimersByTimeAsync(0);
      const names = started.map((s) => s.name);
      expect(names).toEqual(["flip", reveal, `https://stockage.test/victoire-${rarity}.mp3`]);
      // décalage mesuré entre la révélation et le son de victoire : 0 ms
      for (const s of started) expect(s.at - t0).toBe(0);
    }
  });

  it("le son propre d'une carte joue seul, sans révélation ni son de victoire", async () => {
    const { revealCardSound } = await import("../ui/booster-sounds");
    revealCardSound("ssr", "https://stockage.test/propre.mp3", "https://stockage.test/v.mp3");
    await vi.advanceTimersByTimeAsync(0);
    expect(started.map((s) => s.name)).toEqual(["https://stockage.test/propre.mp3"]);
  });

  it("au-delà de 22 s, fondu jusqu'au silence à 25 s, puis arrêt (jamais coupé net)", async () => {
    const { revealCardSound, stopCardSound } = await import("../ui/booster-sounds");
    stopCardSound(0);
    await vi.advanceTimersByTimeAsync(100);
    revealCardSound("ssr", null, "https://stockage.test/long.mp3");
    const audio = audios.filter((a) => a.src === "https://stockage.test/long.mp3").pop();
    if (!audio) throw new Error("son de victoire non lu");
    const at = async (s: number) => {
      await vi.advanceTimersByTimeAsync(s * 1000 - audio.currentTime * 1000);
      return audio.volume;
    };
    // volume du site (0,8 par défaut) jusqu'à 22 s, puis fondu
    const base = await at(10);
    expect(base).toBeGreaterThan(0);
    expect(await at(22)).toBe(base);
    const v23 = await at(23);
    const v24 = await at(24);
    expect(v23 / base).toBeCloseTo(2 / 3, 1);
    expect(v24 / base).toBeCloseTo(1 / 3, 1);
    expect(v24).toBeLessThan(v23);
    await at(25.1);
    expect(audio.volume).toBe(0);
    expect(audio.paused).toBe(true);
  });

  it("cappedGain : 1 jusqu'à 22 s, linéaire, 0 à 25 s et après", async () => {
    const { cappedGain, VICTORY_MAX_S, VICTORY_FADE_S } = await import("../ui/booster-sounds");
    expect(VICTORY_MAX_S).toBe(25);
    expect(VICTORY_FADE_S).toBeGreaterThan(0);
    expect(cappedGain(0)).toBe(1);
    expect(cappedGain(22)).toBe(1);
    expect(cappedGain(23.5)).toBeCloseTo(0.5);
    expect(cappedGain(25)).toBe(0);
    expect(cappedGain(180)).toBe(0);
  });
});

describe("aura du retournement", () => {
  const css = readFileSync(new URL("../ui/tcg.css", import.meta.url), "utf8");
  const tsx = readFileSync(new URL("../ui/BoosterOpening.tsx", import.meta.url), "utf8");

  it("montée dès le début du demi-tour, pas à sa fin", () => {
    expect(tsx).toMatch(/\{side === "face" && opened && hasAura\(opened\.card\.rarity\)/);
    expect(tsx).not.toMatch(/\{settled && opened && hasAura/);
  });

  it("son fondu finit avec le demi-tour (FLIP_MS), pas après", () => {
    const flipMs = Number(tsx.match(/const FLIP_MS = (\d+);/)?.[1]);
    const rule = css.match(
      /\.tcg-opening-slot > \.tcg-aura-rare \{\s*animation: tcg-aura-in ([\d.]+)s (\w+) both;/,
    );
    expect(rule).not.toBeNull();
    expect(Number(rule?.[1]) * 1000).toBe(flipMs);
    // invisible pendant que le dos tourne (jusqu'à la tranche), entière à la fin
    const frames = css.split("@keyframes tcg-aura-in")[1]?.split("\n}")[0] ?? "";
    expect(frames).toMatch(/50% \{\s*opacity: 0;/);
    expect(frames).toMatch(/100% \{\s*opacity: 1;/);
  });

  it("carte posée : aura entière d'office, sans attendre la fin du fondu", () => {
    expect(tsx).toMatch(/className="tcg-opening-slot absolute"\s+data-settled=\{settled/);
    expect(css).toMatch(
      /\.tcg-opening-slot\[data-settled\] > \.tcg-aura-rare \{\s*animation: none;\s*opacity: 1;/,
    );
  });
});
