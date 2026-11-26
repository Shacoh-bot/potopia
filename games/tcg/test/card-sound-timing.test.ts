import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Son au retournement d'une carte : il part au DÉBUT du retournement, dès le geste, sans attendre
 * que la face apparaisse (choix de l'utilisateur, 26/11/2026). Navigateur simulé : un faux
 * `<audio>` note chaque lecture.
 */
const played: { src: string; at: number }[] = [];

class FakeAudio {
  src: string;
  volume = 1;
  preload = "";
  constructor(src = "") {
    this.src = src;
  }
  addEventListener() {}
  pause() {}
  play() {
    played.push({ src: this.src, at: Date.now() });
    return Promise.resolve();
  }
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("requestAnimationFrame", (f: () => void) => setTimeout(f, 16));
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("son au retournement", () => {
  it("le son propre d'une carte part tout de suite, au début du retournement", async () => {
    const { revealCardSound } = await import("../ui/booster-sounds");
    const start = Date.now();
    revealCardSound("ssr", "https://stockage.test/sounds/a.mp3");
    await vi.advanceTimersByTimeAsync(0);
    expect(played).toHaveLength(1);
    expect(played[0]?.src).toBe("https://stockage.test/sounds/a.mp3");
    expect((played[0]?.at ?? 0) - start).toBe(0);
  });

  it("la révélation de rareté part aussi avec le geste (aucun délai)", () => {
    const src = readFileSync(new URL("../ui/booster-sounds.ts", import.meta.url), "utf8");
    const body = src.split("export function flipSound")[1]?.split("\n}")[0] ?? "";
    expect(body).toContain("play(revealSound(rarity))");
    expect(body).not.toMatch(/at:/);
  });
});
