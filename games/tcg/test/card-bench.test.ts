import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BENCH_STRATES } from "../ui/CardBench";

const css = readFileSync(new URL("../ui/tcg.css", import.meta.url), "utf8");
const v5 = readFileSync(new URL("../ui/v5.tsx", import.meta.url), "utf8");

describe("banc d'essai des cartes (CardBench)", () => {
  it("chaque strate proposée a sa règle dans tcg.css, limitée au banc", () => {
    for (const { key } of BENCH_STRATES) expect(css).toContain(`.tcg-bench[data-sans~="${key}"]`);
  });

  it("chaque repère de strate visé par le banc existe sur la carte (v5)", () => {
    const marks = [...css.matchAll(/\.tcg-bench\[data-sans~="\w+"\] \.(tcg-strate-\w+)/g)].map(
      (m) => m[1],
    );
    expect(marks.length).toBeGreaterThanOrEqual(6);
    for (const mark of marks) expect(v5).toMatch(new RegExp(`className="[^"]*${mark}[ "]`));
  });
});

describe("glisser une carte du banc (bench-drag)", () => {
  it("moveItem déplace un élément et décale les autres", async () => {
    const { moveItem } = await import("../ui/bench-drag");
    expect(moveItem([0, 1, 2, 3], 0, 2)).toEqual([1, 2, 0, 3]);
    expect(moveItem([0, 1, 2, 3], 3, 1)).toEqual([0, 3, 1, 2]);
    expect(moveItem([0, 1, 2], 1, 1)).toEqual([0, 1, 2]);
    expect(moveItem([0, 1, 2], 0, 9)).toEqual([0, 1, 2]);
  });

  it("pendant un glisser, tcg.css met toutes les animations du banc en pause", () => {
    const rule =
      /\.tcg-bench\[data-glisse\]:not\(\[data-glisser="plein"\]\) \*::after \{[^}]*animation-play-state: paused !important;/;
    expect(css).toMatch(rule);
    expect(css).toContain(".tcg-bench [data-glisse-carte] {");
  });
});
