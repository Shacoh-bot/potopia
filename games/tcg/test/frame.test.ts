import { describe, expect, it } from "vitest";
import { glowPlacement } from "../src/glow";
import { framePointShift } from "../ui/frame-drag";

// Fenêtre de la carte normale et image portrait 2:3 : en cover, 286 × 429 avant le zoom.
const box = { width: 286, height: 186 };
const natural = { width: 800, height: 1200 };
const shownH = 429;

/** Haut de l'image affichée (px), via le même calcul que les points lumineux (coin 0 %). */
const imageTop = (y: number, zoom: number) =>
  (glowPlacement({ x: 0, y: 0, size: 0 }, { x: 50, y, zoom }, box, natural).top / 100) * box.height;

describe("framePointShift : le cadrage suit la souris", () => {
  it("image plus grande que la fenêtre : glisser vers le bas fait reculer le point", () => {
    const zoom = 1;
    const shift = framePointShift(30, box.height, shownH, zoom);
    expect(shift).toBeLessThan(0);
    // l'image descend exactement de 30 px
    expect(imageTop(50 + shift, zoom) - imageTop(50, zoom)).toBeCloseTo(30);
  });

  it("image dézoomée plus petite que la fenêtre : le point avance avec elle", () => {
    const zoom = 0.4;
    const shift = framePointShift(10, box.height, shownH, zoom);
    expect(shift).toBeGreaterThan(0);
    expect(imageTop(50 + shift, zoom) - imageTop(50, zoom)).toBeCloseTo(10);
  });

  it("image juste à la taille de la fenêtre : rien ne bouge", () => {
    expect(framePointShift(40, box.width, box.width, 1)).toBe(0);
  });
});
