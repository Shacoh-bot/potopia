import { describe, expect, it } from "vitest";
import { glowPeriod } from "../src/card-rules";
import { glowPlacement } from "../src/glow";

const point = { x: 50, y: 50, size: 10 };

describe("glowPlacement", () => {
  it("image aux proportions de la fenêtre, sans cadrage : position telle quelle", () => {
    const at = glowPlacement(
      { x: 25, y: 75, size: 10 },
      null,
      { width: 200, height: 100 },
      { width: 400, height: 200 },
    );
    expect(at).toEqual({ left: 25, top: 75, radius: 20 });
  });

  it("image plus haute que la fenêtre (cover) : le cadrage vertical déplace le point", () => {
    // image 100×200 dans 100×100 : affichée 100×200, 100 px de surplus en hauteur
    const box = { width: 100, height: 100 };
    const natural = { width: 100, height: 200 };
    // cadrée en haut : le haut de l'image est visible, son centre tombe en bas de la fenêtre
    expect(glowPlacement(point, { x: 50, y: 0, zoom: 1 }, box, natural).top).toBe(100);
    // cadrée en bas : son centre tombe en haut de la fenêtre
    expect(glowPlacement(point, { x: 50, y: 100, zoom: 1 }, box, natural).top).toBe(0);
    // centrée : au milieu
    expect(glowPlacement(point, { x: 50, y: 50, zoom: 1 }, box, natural).top).toBe(50);
  });

  it("le zoom écarte le point du centre de cadrage et grossit le halo", () => {
    const box = { width: 100, height: 100 };
    const natural = { width: 100, height: 100 };
    const at = glowPlacement({ x: 75, y: 50, size: 10 }, { x: 50, y: 50, zoom: 2 }, box, natural);
    expect(at).toEqual({ left: 100, top: 50, radius: 20 });
  });
});

describe("glowPeriod", () => {
  it("0 : fixe ; plus la vitesse est grande, plus le clignotement est court", () => {
    expect(glowPeriod(0)).toBeNull();
    expect(glowPeriod(1)).toBe(6);
    expect(glowPeriod(10)).toBeCloseTo(0.6);
  });
});
