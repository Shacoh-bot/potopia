import { describe, expect, it } from "vitest";
import { AURA_MARGIN, MARGIN_UNITS, makeSparks, type Room, sparkPoints } from "../ui/CardAura";

// Canevas d'une aura de carte de 240 px affichée (tampon allégé à 0,75).
const W = Math.round(240 * (1 + 2 * AURA_MARGIN) * 0.75);
const H = Math.round((W * (504 + 4 * 180 * AURA_MARGIN)) / (360 * (1 + 2 * AURA_MARGIN)));
const room: Room = [MARGIN_UNITS, MARGIN_UNITS, MARGIN_UNITS, MARGIN_UNITS];

describe("sparkPoints (étincelles des auras)", () => {
  const sparks = makeSparks(340);
  const out = new Float32Array(sparks.length * 5 * 4);

  it("au plus 5 points par étincelle, tous dans le canevas, éclat entre 0 et 1", () => {
    for (const t of [3, 7.35, 12.95, 40]) {
      const n = sparkPoints(sparks, t, room, W, H, out);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(sparks.length * 5);
      for (let i = 0; i < n; i++) {
        const [x = NaN, y = NaN, r = NaN, a = NaN] = out.subarray(i * 4, i * 4 + 4);
        expect(x - r).toBeGreaterThanOrEqual(0);
        expect(x + r).toBeLessThanOrEqual(W);
        expect(y - r).toBeGreaterThanOrEqual(0);
        expect(y + r).toBeLessThanOrEqual(H);
        expect(r).toBeGreaterThan(0);
        expect(a).toBeGreaterThan(0.003);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });

  it("même instant, mêmes points (rien n'est stocké d'une image à l'autre)", () => {
    const a = new Float32Array(out.length);
    const b = new Float32Array(out.length);
    const na = sparkPoints(sparks, 9.2, room, W, H, a);
    sparkPoints(sparks, 2, room, W, H, b);
    const nb = sparkPoints(sparks, 9.2, room, W, H, b);
    expect(nb).toBe(na);
    expect(Array.from(b.subarray(0, nb * 4))).toEqual(Array.from(a.subarray(0, na * 4)));
  });

  it("un cadre proche éteint les étincelles avant lui", () => {
    const tight: Room = [20, MARGIN_UNITS, MARGIN_UNITS, MARGIN_UNITS];
    const k = W / (360 * (1 + 2 * AURA_MARGIN));
    const cardLeft = W / 2 - 180 * k;
    for (const t of [3, 8, 15]) {
      const n = sparkPoints(sparks, t, tight, W, H, out);
      for (let i = 0; i < n; i++) expect(out[i * 4]).toBeGreaterThan(cardLeft - 20 * k);
    }
  });
});
