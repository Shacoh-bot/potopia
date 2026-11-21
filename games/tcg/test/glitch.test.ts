import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../ui/tcg.css", import.meta.url), "utf8");
const snap = readFileSync(new URL("../ui/snap-styles.tsx", import.meta.url), "utf8");

/** Décalages horizontaux (px) des règles et images clés dont le nom commence par `prefix`. */
function offsets(prefix: string): number[] {
  const blocks = css.match(
    new RegExp(`(@keyframes )?\\.?${prefix}[\\w-]*[^{]*\\{[\\s\\S]*?\\n\\}`, "g"),
  );
  return (blocks ?? []).flatMap((b) =>
    [...b.matchAll(/translateX\((-?\d+(?:\.\d+)?)px\)/g)].map((m) => Number(m[1])),
  );
}

describe("effet visuel Glitch, doux pour garder la carte lisible", () => {
  it("écarte les canaux rouge et cyan de 1 px au repos et de 3 px au plus par à-coups", () => {
    const split = [...offsets("tcg-glitch-red"), ...offsets("tcg-glitch-cyan")];
    expect(split.length).toBeGreaterThan(0);
    expect(Math.max(...split.map(Math.abs))).toBeLessThanOrEqual(3);
    expect(css).toMatch(/\.tcg-glitch-red \{\n {2}transform: translateX\(-1px\);/);
    expect(css).toMatch(/\.tcg-glitch-cyan \{\n {2}transform: translateX\(1px\);/);
  });

  it("fait sauter les tranches du survol de 4 px au plus", () => {
    const slices = offsets("tcg-glitch(?= \\{)");
    expect(slices.length).toBeGreaterThan(0);
    expect(Math.max(...slices.map(Math.abs))).toBeLessThanOrEqual(4);
  });

  it("ne garde aucun décalage fixe dans le composant", () => {
    expect(snap).not.toMatch(/translateX\(-?4px\)/);
  });
});
