import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LINES, pickLine, type LineEvent } from "../src/lines";

const EVENTS: LineEvent[] = ["good", "mid", "bad", "reset", "idle", "start"];
const publicDir = fileURLToPath(new URL("../../../apps/web/public", import.meta.url));

describe("répliques JoJo", () => {
  it("chaque moment a plusieurs répliques, et chaque son existe", () => {
    for (const e of EVENTS) expect(LINES.filter((l) => l.on.includes(e)).length).toBeGreaterThan(2);
    for (const l of LINES) expect(existsSync(publicDir + l.sound)).toBe(true);
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
  });

  it("jamais deux fois la même d'affilée", () => {
    const first = pickLine("bad", null, () => 0);
    expect(first).not.toBeNull();
    for (const r of [0, 0.3, 0.6, 0.99]) {
      expect(pickLine("bad", first?.id ?? null, () => r)?.id).not.toBe(first?.id);
    }
  });
});
