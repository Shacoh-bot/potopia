import type { CSSProperties } from "react";
import { H, R, W } from "./v2";

/*
 * Anneau de cadre DESSINÉ (trait SVG d'un rectangle arrondi), sans clip-path ni masque.
 *
 * Pourquoi : l'ancien anneau (`Ring`, snap.tsx) était un calque plein-carte troué par un clip-path
 * (avant : un masque composé). Sur une carte inclinée en 3D (survol, ouverture de booster), Firefox
 * et Chrome lâchent parfois ce découpage : le calque se peint entier, d'où l'aplat rouge (cadre SR)
 * ou doré (filets des encadrés) sur toute la carte (vidéo du 25/11). Ici, l'anneau n'est que de la
 * géométrie peinte : rien à découper, rien à perdre.
 *
 * Le trait d'un rectangle arrondi d'épaisseur `width`, centré à `width / 2` du bord et de rayon
 * `radius - width / 2`, a exactement la forme de l'ancien anneau : bord extérieur de rayon
 * `radius`, bord intérieur de rayon `radius - width`.
 *
 * Couleur : unie, ou dégradé (`linear-gradient(<angle>deg, …)`, `conic-gradient(from 0deg at 50%
 * 50%, …)`). Un dégradé ne se pose pas sur un trait SVG sans identifiant partagé (fragile : une
 * carte cachée qui porte le premier identifiant le rend vide). Le tour est donc découpé en
 * segments de trait (pointillés), chacun de la couleur du dégradé en son milieu, posés sur un tour
 * complet de la couleur moyenne qui bouche les joints.
 */

type Rgb = [number, number, number];
type Stop = { color: Rgb; at: number };
export type RingPaint =
  | { kind: "solid"; color: string }
  | { kind: "linear"; angle: number; stops: Stop[] }
  | { kind: "conic"; stops: Stop[] };

const HEX = /#([0-9a-f]{3}|[0-9a-f]{6})\b(?:\s+(-?[\d.]+)%)?/gi;

function hexToRgb(hex: string): Rgb {
  const h = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function parseStops(body: string): Stop[] {
  const raw = [...body.matchAll(HEX)].map((m) => ({
    color: hexToRgb(m[1] ?? "000"),
    at: m[2] === undefined ? NaN : Number(m[2]) / 100,
  }));
  // Positions absentes : réparties également (premier à 0, dernier à 1), comme en CSS.
  const first = raw[0];
  const last = raw[raw.length - 1];
  if (first && Number.isNaN(first.at)) first.at = 0;
  if (last && Number.isNaN(last.at)) last.at = 1;
  for (let i = 1; i < raw.length - 1; i++) {
    const stop = raw[i];
    if (!stop || !Number.isNaN(stop.at)) continue;
    let j = i;
    while (Number.isNaN(raw[j]?.at ?? 0)) j++;
    const from = raw[i - 1]?.at ?? 0;
    const to = raw[j]?.at ?? 1;
    for (let k = i; k < j; k++) {
      const s = raw[k];
      if (s) s.at = from + ((to - from) * (k - i + 1)) / (j - i + 1);
    }
  }
  return raw;
}

/** Lit un fond CSS de cadre : couleur unie, dégradé linéaire ou conique centré. `null` : autre. */
export function parseRingPaint(background: string): RingPaint | null {
  const bg = background.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(bg)) return { kind: "solid", color: bg };
  const linear = /^linear-gradient\(\s*(-?[\d.]+)deg\s*,(.*)\)$/i.exec(bg);
  if (linear) {
    const stops = parseStops(linear[2] ?? "");
    return stops.length > 1 ? { kind: "linear", angle: Number(linear[1]), stops } : null;
  }
  const conic = /^conic-gradient\(\s*from 0deg at 50% 50%\s*,(.*)\)$/i.exec(bg);
  if (conic) {
    const stops = parseStops(conic[1] ?? "");
    return stops.length > 1 ? { kind: "conic", stops } : null;
  }
  return null;
}

function mix(stops: Stop[], t: number): Rgb {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return [0, 0, 0];
  if (t <= first.at) return first.color;
  if (t >= last.at) return last.color;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (!a || !b || t > b.at) continue;
    const u = b.at === a.at ? 1 : (t - a.at) / (b.at - a.at);
    return a.color.map((c, k) => Math.round(c + ((b.color[k] ?? c) - c) * u)) as Rgb;
  }
  return last.color;
}

/** Couleur du dégradé au point (x, y) d'une boîte w × h (mêmes règles que CSS). */
export function paintAt(paint: RingPaint, x: number, y: number, w: number, h: number): Rgb {
  if (paint.kind === "solid") return hexToRgb(paint.color.slice(1, 7));
  const dx = x - w / 2;
  const dy = y - h / 2;
  if (paint.kind === "conic") {
    // Angle depuis le haut, sens horaire, comme `conic-gradient(from 0deg)`.
    const turn = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
    return mix(paint.stops, turn);
  }
  const a = (paint.angle * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const length = Math.abs(w * sin) + Math.abs(h * cos);
  return mix(paint.stops, 0.5 + (dx * sin - dy * cos) / length);
}

/** Point à la distance `s` du tour (départ en haut à gauche après le coin, sens horaire, comme SVG). */
function pointOnRound(s: number, x0: number, y0: number, w: number, h: number, r: number) {
  const sides = [w - 2 * r, h - 2 * r, w - 2 * r, h - 2 * r];
  const arc = (Math.PI * r) / 2;
  const corners: [number, number][] = [
    [x0 + w - r, y0 + r],
    [x0 + w - r, y0 + h - r],
    [x0 + r, y0 + h - r],
    [x0 + r, y0 + r],
  ];
  let left = s;
  for (let i = 0; i < 4; i++) {
    const side = sides[i] ?? 0;
    const [cx, cy] = corners[i] ?? [0, 0];
    if (left <= side) {
      const t = left;
      if (i === 0) return [x0 + r + t, y0];
      if (i === 1) return [x0 + w, y0 + r + t];
      if (i === 2) return [x0 + w - r - t, y0 + h];
      return [x0, y0 + h - r - t];
    }
    left -= side;
    if (left <= arc) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 2 + left / r;
      return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
    }
    left -= arc;
  }
  return [x0 + r, y0];
}

export type RingSegment = { offset: number; length: number; color: string };

const css = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`;

/**
 * Tour du cadre découpé en `count` segments colorés (milieu de chaque segment), plus la couleur
 * moyenne du tour (fond qui bouche les joints). Exporté pour les tests.
 */
export function ringSegments(
  paint: RingPaint,
  w: number,
  h: number,
  width: number,
  radius: number,
  count = 120,
): { perimeter: number; base: string; segments: RingSegment[] } {
  const half = width / 2;
  const iw = w - width;
  const ih = h - width;
  const r = Math.max(radius - half, 0);
  const perimeter = 2 * (iw - 2 * r) + 2 * (ih - 2 * r) + 2 * Math.PI * r;
  const step = perimeter / count;
  const sum: Rgb = [0, 0, 0];
  const segments = Array.from({ length: count }, (_, i) => {
    const [x, y] = pointOnRound((i + 0.5) * step, half, half, iw, ih, r);
    const rgb = paintAt(paint, x ?? 0, y ?? 0, w, h);
    rgb.forEach((c, k) => (sum[k] = (sum[k] ?? 0) + c));
    // Un demi-pixel de plus : les segments se chevauchent, aucun joint clair.
    return { offset: i * step, length: step + 0.5, color: css(rgb) };
  });
  const base = css(sum.map((c) => Math.round(c / count)) as Rgb);
  return { perimeter, base, segments };
}

/** Géométrie et couleur d'un anneau (mêmes défauts que `FrameRing`). */
export type RingSpec = {
  background: string;
  width: number;
  radius?: number;
  w?: number;
  h?: number;
  segments?: number;
};

function full(spec: RingSpec): Required<RingSpec> {
  return { radius: R, w: W, h: H, segments: 120, ...spec };
}

/** Classe CSS de l'image pré-dessinée d'un anneau (empreinte de sa géométrie et de sa couleur). */
export function ringClass(spec: RingSpec): string {
  const s = full(spec);
  const key = [s.background, s.width, s.radius, s.w, s.h, s.segments].join("|");
  let hash = 5381;
  for (let i = 0; i < key.length; i++) hash = ((hash * 33) ^ key.charCodeAt(i)) >>> 0;
  return `tcg-ring-${hash.toString(36)}`;
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Anneau à dégradé en document SVG autonome : exactement les traits de l'ancien `FrameRing`
 * (tour de la couleur moyenne, puis un segment par couleur), dessinés une fois dans une image.
 * Dans une image, l'identifiant `r` ne sort pas du document : aucun conflit entre cartes.
 */
export function ringSvg(spec: RingSpec): string {
  const s = full(spec);
  const paint = parseRingPaint(s.background) ?? { kind: "solid" as const, color: "#888888" };
  const half = s.width / 2;
  const rect = `<rect id='r' x='${num(half)}' y='${num(half)}' width='${num(s.w - s.width)}' height='${num(s.h - s.width)}' rx='${num(Math.max(s.radius - half, 0))}'/>`;
  const open = `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='${s.w}' height='${s.h}' viewBox='0 0 ${s.w} ${s.h}'>`;
  const g = `<g fill='none' stroke-width='${num(s.width)}'>`;
  if (paint.kind === "solid")
    return `${open}${g}${rect.replace("id='r' ", `stroke='${paint.color}' `)}</g></svg>`;
  const ring = ringSegments(paint, s.w, s.h, s.width, s.radius, s.segments);
  const uses = ring.segments
    .map(
      (seg) =>
        `<use xlink:href='#r' stroke='${seg.color}' stroke-dasharray='${num(seg.length)} ${num(ring.perimeter)}' stroke-dashoffset='${num(-seg.offset)}'/>`,
    )
    .join("");
  return `${open}${g}<defs>${rect}</defs><use xlink:href='#r' stroke='${ring.base}'/>${uses}</g></svg>`;
}

/** Règles CSS des anneaux pré-dessinés (bloc généré de tcg.css, voir test/frame-ring-images). */
export function ringCss(specs: RingSpec[]): string {
  const seen = new Set<string>();
  return specs
    .filter((spec) => {
      const c = ringClass(spec);
      return seen.has(c) ? false : (seen.add(c), true);
    })
    .map((spec) => {
      const svg = ringSvg(spec)
        .replace(/%/g, "%25")
        .replace(/#/g, "%23")
        .replace(/</g, "%3C")
        .replace(/>/g, "%3E");
      return `.${ringClass(spec)} {\n  background-image: url("data:image/svg+xml,${svg}");\n}`;
    })
    .join("\n");
}

/**
 * Anneau de cadre d'une boîte `w × h` (par défaut la carte), d'épaisseur `width`, rayon extérieur
 * `radius`. Posé en `position: absolute` en haut à gauche de son parent (`style` pour le décaler).
 *
 * Couleur unie : un trait SVG. Dégradé : un seul élément dont le fond est l'image pré-dessinée de
 * l'anneau (classe `ringClass`, règle générée dans tcg.css) ; avant la refonte (étape 4), 49 à 121
 * traits SVG par anneau, soit ~220 éléments par carte SR/SSR. L'anneau doit figurer dans
 * `PREDRAWN_RINGS` (v5.tsx) ; le test le vérifie pour toutes les cartes du filet.
 */
export function FrameRing({
  background,
  width,
  radius = R,
  w = W,
  h = H,
  segments = 120,
  style,
}: RingSpec & { style?: CSSProperties }) {
  const paint = parseRingPaint(background) ?? { kind: "solid" as const, color: "#888888" };
  const box: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    pointerEvents: "none",
    ...style,
  };
  if (paint.kind !== "solid") {
    const cls = ringClass({ background, width, radius, w, h, segments });
    return (
      <div aria-hidden className={`tcg-ring ${cls}`} style={{ width: w, height: h, ...box }} />
    );
  }
  const half = width / 2;
  return (
    <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={box}>
      <rect
        x={half}
        y={half}
        width={w - width}
        height={h - width}
        rx={Math.max(radius - half, 0)}
        fill="none"
        strokeWidth={width}
        stroke={paint.color}
      />
    </svg>
  );
}
