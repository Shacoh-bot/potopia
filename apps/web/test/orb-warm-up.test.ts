import { describe, expect, it } from "vitest";
import {
  afterWarmUpHop,
  ORB_WARM_UP_MAX_HOPS,
  ORB_WARM_UP_SMOOTH_MS,
} from "../components/orbWarmUp";

describe("préchauffage du rebond de la boule", () => {
  it("finit après deux rebonds fluides de suite", () => {
    const first = afterWarmUpHop(0, 0, 17);
    expect(first).toEqual({ cleanStreak: 1, done: false });
    expect(afterWarmUpHop(1, first.cleanStreak, 17)).toEqual({ cleanStreak: 2, done: true });
  });

  it("repart de zéro après une image longue (compilation ou page occupée)", () => {
    expect(afterWarmUpHop(1, 1, 550)).toEqual({ cleanStreak: 0, done: false });
    // juste au seuil : encore fluide
    expect(afterWarmUpHop(1, 0, ORB_WARM_UP_SMOOTH_MS).cleanStreak).toBe(1);
  });

  it("n'insiste pas au-delà du nombre maximal de rebonds", () => {
    expect(afterWarmUpHop(ORB_WARM_UP_MAX_HOPS - 2, 0, 900).done).toBe(false);
    expect(afterWarmUpHop(ORB_WARM_UP_MAX_HOPS - 1, 0, 900).done).toBe(true);
  });
});
