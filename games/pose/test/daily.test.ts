import { describe, expect, it } from "vitest";
import { DAILY_COUNT, dailyPoses, dayKey } from "../src/daily";
import { POSES } from "../src/poses";
import { verdict, verdictsFor } from "../src/verdicts";

describe("poses du jour", () => {
  it("le jour suit l'heure de Paris : minuit à Paris, pas minuit UTC", () => {
    // 23 h 30 UTC le 2 novembre = 0 h 30 le 3 à Paris (heure d'hiver)
    expect(dayKey(new Date("2026-11-02T23:30:00Z"))).toBe("2026-11-03");
    expect(dayKey(new Date("2026-11-02T22:30:00Z"))).toBe("2026-11-02");
  });

  it("trois poses différentes, les mêmes pour tout le monde le même jour", () => {
    const today = dailyPoses("2026-11-03");
    expect(today).toHaveLength(DAILY_COUNT);
    expect(new Set(today.map((p) => p.id)).size).toBe(DAILY_COUNT);
    expect(dailyPoses("2026-11-03").map((p) => p.id)).toEqual(today.map((p) => p.id));
  });

  it("d'un jour à l'autre, les poses changent, et aucune ne revient avant que toutes soient passées", () => {
    const days = Math.floor(POSES.length / DAILY_COUNT);
    const seen = new Set<string>();
    for (let d = 0; d < days; d++) {
      const key = new Date(Date.UTC(2026, 10, 3 + d)).toISOString().slice(0, 10);
      for (const p of dailyPoses(key)) {
        expect(seen.has(p.id)).toBe(false);
        seen.add(p.id);
      }
    }
  });
});

describe("répliques", () => {
  it("plusieurs répliques par note, et chaque tirage en donne une", () => {
    for (const g of ["Z", "S", "A", "B", "C", "D", "E"] as const) {
      expect(verdictsFor(g).length).toBeGreaterThanOrEqual(8);
      expect(verdictsFor(g)).toContain(verdict(g, 0));
      expect(verdictsFor(g)).toContain(verdict(g, 0.999));
    }
  });
});
