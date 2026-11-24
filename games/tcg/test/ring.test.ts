import { describe, expect, it } from "vitest";
import { Ring, ringClip } from "../ui/snap";

/** Points « x y » du polygone, en px depuis le bord gauche/haut d'une boîte w × h. */
function points(clip: string, w: number, h: number): [number, number][] {
  const body = clip.replace(/^polygon\(evenodd, /, "").replace(/\)$/, "");
  const px = (v: string, size: number) => {
    const m = /^calc\(100% - ([\d.]+)px\)$/.exec(v);
    return m ? size - Number(m[1]) : Number(v.replace("px", ""));
  };
  return body.split(/, (?![^(]*\))/).map((p) => {
    const [x = "", y = ""] = p.split(/ (?![^(]*\))/);
    return [px(x, w), px(y, h)];
  });
}

describe("anneau de cadre (Ring)", () => {
  it("se troue par clip-path, sans masque composé qu'un navigateur peut lâcher (aplat de rareté)", () => {
    const style = Ring({ background: "#3dbb78", width: 5 }).props.style as Record<string, unknown>;
    expect(String(style.clipPath)).toMatch(/^polygon\(evenodd, /);
    expect(Object.keys(style).filter((k) => /mask/i.test(k))).toEqual([]);
  });

  it("garde les rayons de l'ancien masque : extérieur = rayon, intérieur = rayon − épaisseur", () => {
    const [w, h, width, r] = [300, 420, 5, 22];
    const pts = points(ringClip(width, r), w, h);
    const half = pts.length / 2;
    const outer = pts.slice(0, half - 1);
    const inner = pts.slice(half, -1);
    // Chaque point est sur un arc de coin ou sur un bord droit, aux bonnes distances.
    const onRounded = (p: [number, number], inset: number, rad: number) => {
      const cx = Math.min(Math.max(p[0], inset + rad), w - inset - rad);
      const cy = Math.min(Math.max(p[1], inset + rad), h - inset - rad);
      return Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - rad) < 0.01;
    };
    expect(outer.every((p) => onRounded(p, 0, r))).toBe(true);
    expect(inner.every((p) => onRounded(p, width, r - width))).toBe(true);
    // Les deux contours touchent chacun leurs quatre bords.
    expect(Math.min(...outer.map((p) => p[0]))).toBeCloseTo(0);
    expect(Math.max(...inner.map((p) => p[1]))).toBeCloseTo(h - width);
  });
});
