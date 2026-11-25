import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Aucune 3D réelle sur les cartes : dans Firefox, `preserve-3d` faisait disparaître cadre, nom et
 * pastilles d'une carte inclinée au survol, et montrait les deux côtés pendant un retournement.
 * L'inclinaison et les retournements gardent leur perspective, mais à plat.
 */
const read = (file: string) => readFileSync(new URL(`../ui/${file}`, import.meta.url), "utf8");
const css = read("tcg.css");
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("cartes sans 3D réelle", () => {
  it("tcg.css n'utilise ni preserve-3d ni backface-visibility", () => {
    expect(rules).not.toMatch(/preserve-3d/);
    expect(rules).not.toMatch(/backface-visibility/);
  });

  it("l'inclinaison garde sa perspective, will-change seulement pendant le survol", () => {
    const tilt = rules.match(/\.tcg-tilt \{([^}]*)\}/)?.[1] ?? "";
    expect(tilt).toContain("perspective(1000px) rotateX(var(--rx)) rotateY(var(--ry))");
    expect(tilt).not.toContain("will-change");
    expect(rules).toMatch(/\.tcg-tilt\[data-active\] \{[^}]*will-change: transform/);
  });

  it("booster : le dos va jusqu'à la tranche puis disparaît, la face en repart", () => {
    const out = rules.match(/@keyframes tcg-flip-out \{([\s\S]*?)\n\}/)?.[1] ?? "";
    const into = rules.match(/@keyframes tcg-flip-in \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(out).toMatch(/from \{[^}]*rotateY\(0deg\)[^}]*visibility: visible/);
    expect(out).toMatch(/to \{[^}]*rotateY\(90deg\)[^}]*visibility: hidden/);
    expect(into).toMatch(/from \{[^}]*rotateY\(-90deg\)[^}]*visibility: hidden/);
    expect(into).toMatch(/to \{[^}]*rotateY\(0deg\)[^}]*visibility: visible/);
    // La face attend la fin du premier quart de tour (0,31 s) : 0,62 s en tout, comme FLIP_MS.
    expect(rules).toContain("animation: tcg-flip-out 0.31s ease-in both");
    expect(rules).toContain("animation: tcg-flip-in 0.31s 0.31s ease-out both");
    expect(read("BoosterOpening.tsx")).toContain("const FLIP_MS = 620;");
  });

  it("carte retournable : seul le côté tourné vers nous est visible", () => {
    expect(rules).toMatch(/\.tcg-flip\[data-back\] > \.tcg-flip-face:not\(\.tcg-flip-back\)/);
    expect(rules).toMatch(/\.tcg-flip:not\(\[data-back\]\) > \.tcg-flip-back/);
    expect(read("CardFlip.tsx")).toContain('data-back={backVisible ? "" : undefined}');
  });
});
