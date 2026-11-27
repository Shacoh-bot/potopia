import { describe, expect, it } from "vitest";
import { FrameRing, paintAt, parseRingPaint, ringSegments, ringSvg } from "../ui/frame-ring";
import { RARITY_FRAME } from "../ui/v5";

type Node = { type?: unknown; props?: Record<string, unknown> } | Node[] | null | undefined;

/** Balisage simplifié de l'arbre rendu (sans react-dom) : balises et attributs. */
function renderToStaticMarkup(node: Node): string {
  if (Array.isArray(node)) return node.map(renderToStaticMarkup).join("");
  if (!node || typeof node !== "object") return "";
  const { children, style, ...rest } = (node.props ?? {}) as Record<string, unknown>;
  const name = typeof node.type === "string" ? node.type : "";
  const attrs = Object.entries(rest)
    .map(([k, v]) => ` ${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}="${String(v)}"`)
    .join("");
  const css = style ? ` style="${JSON.stringify(style)}"` : "";
  return `<${name}${attrs}${css}>${renderToStaticMarkup(children as Node)}`;
}

describe("anneau de cadre dessiné (FrameRing)", () => {
  it("lit toutes les couleurs de cadre de rareté (unies et coniques SR/SSR)", () => {
    for (const bg of Object.values(RARITY_FRAME)) expect(parseRingPaint(bg)).not.toBeNull();
    expect(parseRingPaint(RARITY_FRAME.sr)?.kind).toBe("conic");
    expect(parseRingPaint(RARITY_FRAME.rare)).toEqual({ kind: "solid", color: "#4688f0" });
  });

  it("n'a ni clip-path ni masque : rien qu'un navigateur puisse lâcher (aplat de rareté au survol)", () => {
    // Couleur unie : un trait SVG.
    const uni = renderToStaticMarkup(FrameRing({ background: RARITY_FRAME.epic, width: 7 }));
    expect(uni).toMatch(/^<svg/);
    expect(uni).not.toMatch(/clip|mask|background/i);
    expect(uni.match(/fill="none"/g)?.length).toBe(uni.match(/<rect/g)?.length);
    // Dégradé (SR, SSR) : un seul élément, l'image pré-dessinée de l'anneau en fond (étape 4).
    for (const bg of [RARITY_FRAME.sr, RARITY_FRAME.ssr]) {
      const html = renderToStaticMarkup(FrameRing({ background: bg, width: 7 }));
      expect(html).toMatch(/^<div[^>]*class-name="tcg-ring tcg-ring-[0-9a-z]+"/);
      expect(html).not.toMatch(/clip|mask/i);
      // L'image : seulement des traits (fill none), sans découpe.
      const svg = ringSvg({ background: bg, width: 7 });
      expect(svg).not.toMatch(/clip|mask/i);
      expect(svg).toContain("<g fill='none'");
      expect(svg.match(/<use /g)?.length).toBe(121);
    }
  });

  it("a la forme de l'ancien anneau : bord extérieur de rayon R, intérieur de rayon R − épaisseur", () => {
    const html = renderToStaticMarkup(FrameRing({ background: "#3dbb78", width: 7, radius: 22 }));
    // Trait centré à 3,5 px du bord, rayon 18,5 : 22 dehors, 15 dedans.
    expect(html).toContain('x="3.5"');
    expect(html).toContain('rx="18.5"');
    expect(html).toContain('stroke-width="7"');
    expect(html).toContain('width="293"');
  });

  it("suit le dégradé conique : couleur du haut, puis du bas de la carte", () => {
    const paint = parseRingPaint(RARITY_FRAME.sr);
    if (!paint) throw new Error("conique illisible");
    expect(paintAt(paint, 150, 0, 300, 420)).toEqual([0xb0, 0x06, 0x3a]);
    expect(paintAt(paint, 150, 420, 300, 420)).toEqual([0xe0, 0x00, 0x3c]);
    const ring = ringSegments(paint, 300, 420, 7, 22, 120);
    expect(ring.segments).toHaveLength(120);
    // Segments jointifs (et un peu chevauchants) sur tout le tour.
    const last = ring.segments[119];
    expect((last?.offset ?? 0) + (last?.length ?? 0)).toBeGreaterThanOrEqual(ring.perimeter);
  });

  it("dégradé linéaire : mêmes extrémités qu'en CSS (gauche → droite à 90°)", () => {
    const paint = parseRingPaint("linear-gradient(90deg, #000000 0%, #ffffff 100%)");
    if (!paint) throw new Error("linéaire illisible");
    expect(paintAt(paint, 0, 10, 200, 20)).toEqual([0, 0, 0]);
    expect(paintAt(paint, 200, 10, 200, 20)).toEqual([255, 255, 255]);
    expect(paintAt(paint, 100, 10, 200, 20)).toEqual([128, 128, 128]);
  });
});
