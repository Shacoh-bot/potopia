/*
 * Dégâts de la rafale de Star Platinum (thème JoJo, `JojoFx`) et leur réparation par Crazy Diamond.
 * - La case frappée tremble pour de bon (la case entière, pas seulement son contenu), sans jamais
 *   déborder de la zone qui la contient : aucune barre de défilement n'apparaît.
 * - Les coups la fissurent petit à petit : des fêlures en étoile, dessinées au hasard autour du
 *   point d'impact, de plus en plus grandes, serrées et fréquentes à mesure que la case s'use, et
 *   elle tremble de plus en plus fort. Une fissure principale part du premier coup et traverse la
 *   case un peu plus à chaque coup, avec ses ramifications, jusqu'à ses bords. On arrête de la
 *   frapper : tout s'estompe. On s'acharne jusqu'au bout (SHATTER_AT coups) : la case vole en
 *   éclats depuis ce premier point, en morceaux qui retombent et disparaissent.
 * - Les petits éléments du header encaissent aussi : Sonic perd ses anneaux, les coups rebondissent
 *   sur Luffy (il est en caoutchouc), la steel ball tourne sur elle-même, les boutons valsent.
 * - La mascotte encaisse une dizaine de secondes : des blessures de plus en plus graves (bleus,
 *   pansements, bosse, œil au beurre noir, joue enflée, étoiles), sa couronne qui s'en va, ses
 *   yeux qui se ferment, puis elle est envoyée s'écraser sur le bord de l'écran, qui se fissure, et
 *   elle y reste incrustée. Quand les poings sont sur elle, ils ne frappent rien d'autre.
 * - Une fois la rafale finie, Crazy Diamond (le Stand de Josuke) répare tout : il sort, le son de
 *   ses coups part et il frappe, et dans le même temps tout se rembobine (les morceaux remontent
 *   et se recollent, la mascotte revole à sa place, ses blessures s'effacent, sa couronne revient),
 *   jusqu'à être comme neuf à la fin du son. « ドラァ ! », « グレート ! ».
 * Tout passe par le DOM et l'API Web Animations (aucun état React) : fêlures en SVG dans la case
 * frappée, morceaux et effets dans la couche `.jojo-fx`. Animations en transform et opacity, en 2D.
 * Pour rester fluide pendant la rafale : au bris, chaque morceau est une copie de la case où ce
 * qui tombe hors du morceau est mis en sommeil, et les fêlures sont recopiées d'un seul canvas
 * (prepareCopies) ; un seul tremblement à la fois par case ; la zone qui la contient sans barre de
 * défilement (lockScroll).
 */

// Usure d'une case : de 0 (intacte) à 1 (elle se brise), selon les coups reçus d'affilée.
const SHATTER_AT = 100; // coups sur une même case (environ 8,5 s de rafale) : elle se brise
const CRACK_EVERY_MS = 320; // une fêlure de plus au plus toutes les 320 ms… jusqu'à 2 fois plus vite
const CRACKS_PER_BOX = 26;
const CRACK_SPACING = 46; // en dessous, on ne refissure pas au même endroit (moins, usée)
const FADE_AFTER_MS = 1500; // case qu'on ne frappe plus : ses fêlures s'estompent
// Réparation : tout se rembobine pendant le son des coups de Crazy Diamond (3 s), et finit juste
// avant la fin du son.
const REWIND_MS = 2850;
// La mascotte : coups reçus (85 ms chacun) avant chaque étape.
const CROWN_AT = 45; // sa couronne s'en va
const DAZED_AT = 100; // ses yeux se ferment
const LAUNCH_AT = 118; // envoyée sur le bord de l'écran, au bout d'une dizaine de secondes
const MASCOT_PAD = 24; // autour d'elle, les coups sont encore pour elle
/** Blessures de la mascotte, de plus en plus graves : à partir de combien de coups. */
// Posées par rapport aux repères de la vraie mascotte : ses yeux derrière ses lunettes (paupières de
// Mascot.tsx), le nez et la bouche en dessous, la couronne sur le haut du crâne.
const INJURIES: readonly (readonly [number, string])[] = [
  [8, "bruise"],
  [16, "nosebleed"],
  [26, "cut-brow"],
  [36, "bruise-chin"],
  [52, "black-eye"],
  [62, "glasses-crack"],
  [72, "mouth-blood"],
  [82, "swelling"],
  [92, "cut-cheek"],
  [100, "tears"],
  [106, "dizzy"],
  [112, "blood-face"],
];
const PAIN = ["グハッ", "ぐっ…", "痛ッ", "ゴフッ", "ガハッ"];
const SMALL_EVERY_MS = 160; // un petit élément ne réagit pas à chaque coup
const RING_EVERY_MS = 650; // Sonic perd des anneaux au plus toutes les 650 ms
const REPAIR_MS = 4300; // durée de la réparation par Crazy Diamond
const CD_PINK = "#ff8fc8";
const HUD = ".jojo-fx, .jojo-decor, .jojo-fx-hint";

export const DAMAGE_SOUNDS = {
  glass: "/audio/jojo-glass.mp3",
  /** Début d'un bris de verre : la fissure principale qui bondit. */
  crack: "/audio/jojo-glass-crack.mp3",
  restore: "/audio/jojo-cd-restore.mp3",
  /** Voix de Josuke (« DORARARA ») sur les coups de Crazy Diamond, joués avec `restore`. */
  doraRush: "/audio/jojo-dora-rush.mp3",
} as const;
export const DAMAGE_SPRITES = ["/jojo/crazy-diamond.webp"] as const;

type Env = {
  layer: HTMLElement;
  transient: (className: string, style: Partial<CSSStyleDeclaration>, text?: string) => HTMLElement;
  spawn: (className: string, style?: Partial<CSSStyleDeclaration>, text?: string) => HTMLElement;
  word: (x: number, y: number, text: string, color: string, spread: number) => void;
  play: (src: string, opts?: { volume?: number }) => HTMLAudioElement;
  later: (ms: number, fn: () => void) => number;
  quake: (power: number, ms: number) => void;
  reducedMotion: () => boolean;
};

export type Damage = {
  /** Un coup de poing au point (x, y) : `final` pour le « ORA ! » qui conclut la rafale. */
  hit: (x: number, y: number, final?: boolean) => void;
  /** Il reste quelque chose que Crazy Diamond doit réparer (case brisée, mascotte assommée). */
  damaged: () => boolean;
  /** Crazy Diamond répare tout (sans effet s'il n'y a rien ; après la réparation en cours). */
  repair: () => void;
  /** Remet tout en place d'un coup, sans effet (thème quitté, démontage). */
  clear: () => void;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
type Point = [number, number];

/** Une ligne brisée de `from` dans la direction `angle` : quelques segments, angle qui dévie. */
function jagged(from: Point, angle: number, length: number, steps: number): Point[] {
  const pts: Point[] = [from];
  let [x, y] = from;
  let a = angle;
  for (let i = 0; i < steps; i++) {
    a += rand(-0.38, 0.38);
    const step = (length / steps) * rand(0.7, 1.3);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  return pts;
}
const polyline = (pts: Point[]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");

/**
 * Fêlure en étoile centrée sur (r, r) : des rayons brisés, quelques ramifications, et des bouts
 * d'anneaux qui relient les rayons, comme une vitre ou un mur qui a pris un coup.
 */
function crackPath(r: number): string {
  const c: Point = [r, r];
  const rays = 5 + Math.floor(rand(0, 4));
  const base = rand(0, Math.PI * 2);
  const parts: string[] = [];
  const rings: Point[][] = [];
  for (let i = 0; i < rays; i++) {
    const angle = base + (i / rays) * Math.PI * 2 + rand(-0.3, 0.3);
    const pts = jagged(c, angle, r * rand(0.45, 0.95), 4 + Math.floor(rand(0, 3)));
    parts.push(polyline(pts));
    rings.push(pts);
    // ramification
    const from = pts[2];
    if (from && Math.random() < 0.5) {
      parts.push(
        polyline(jagged(from, angle + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 0.9), r * 0.3, 2)),
      );
    }
  }
  // anneaux : on relie le 1er (puis le 2e) point de rayons voisins
  for (const k of [1, 2]) {
    for (let i = 0; i < rings.length; i++) {
      const a = rings[i]?.[k];
      const b = rings[(i + 1) % rings.length]?.[k];
      if (!a || !b || Math.random() > (k === 1 ? 0.7 : 0.35)) continue;
      const mid: Point = [(a[0] + b[0]) / 2 + rand(-3, 3), (a[1] + b[1]) / 2 + rand(-3, 3)];
      parts.push(polyline([a, mid, b]));
    }
  }
  return parts.join("");
}

const SVG = "http://www.w3.org/2000/svg";
/** Une fêlure (SVG de 2r de côté), posée en (x, y) dans `host`. */
function crackElement(x: number, y: number, r: number, className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("width", String(r * 2));
  svg.setAttribute("height", String(r * 2));
  svg.style.left = `${x - r}px`;
  svg.style.top = `${y - r}px`;
  const d = crackPath(r);
  const dent = document.createElementNS(SVG, "circle");
  dent.setAttribute("cx", String(r));
  dent.setAttribute("cy", String(r));
  dent.setAttribute("r", String(Math.max(3, r * 0.09)));
  dent.setAttribute("class", "jojo-crack-dent");
  // trait clair décalé (l'arête de la fêlure) sous le trait sombre
  for (const kind of ["light", "dark"]) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", `jojo-crack-${kind}`);
    svg.append(path);
  }
  svg.append(dent);
  return svg;
}

/**
 * Morceaux d'une case de w × h brisée au point (x, y) : des parts en éventail autour du point,
 * chacune coupée en deux (un éclat près de l'impact, un autre jusqu'au bord). Polygones en px.
 */
function shardPolygons(w: number, h: number, x: number, y: number, parts: number): Point[][] {
  const angles = Array.from(
    { length: parts },
    (_, i) => ((i + rand(-0.3, 0.3)) / parts) * Math.PI * 2,
  ).sort((a, b) => a - b);
  // point du bord de la case dans la direction `a`
  const edge = (a: number): Point => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const tx = dx > 1e-6 ? (w - x) / dx : dx < -1e-6 ? -x / dx : Infinity;
    const ty = dy > 1e-6 ? (h - y) / dy : dy < -1e-6 ? -y / dy : Infinity;
    const t = Math.min(tx, ty);
    return [x + dx * t, y + dy * t];
  };
  const corners: Point[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const polys: Point[][] = [];
  for (let i = 0; i < parts; i++) {
    const a1 = angles[i] ?? 0;
    const a2 = i + 1 < parts ? (angles[i + 1] ?? 0) : (angles[0] ?? 0) + Math.PI * 2;
    const p1 = edge(a1);
    const p2 = edge(a2);
    // coins de la case compris entre les deux rayons, dans l'ordre
    const between = corners
      .map((c) => {
        let a = Math.atan2(c[1] - y, c[0] - x);
        while (a < a1) a += Math.PI * 2;
        return { c, a };
      })
      .filter(({ a }) => a < a2)
      .sort((u, v) => u.a - v.a)
      .map(({ c }) => c);
    const k = rand(0.3, 0.55);
    const q1: Point = [x + (p1[0] - x) * k, y + (p1[1] - y) * k];
    const q2: Point = [x + (p2[0] - x) * k, y + (p2[1] - y) * k];
    polys.push([[x, y], q1, q2]);
    polys.push([q1, p1, ...between, p2, q2]);
  }
  return polys;
}

/** Position d'un point du bord de la case w × h, comptée sur son tour (sens horaire depuis le coin
 * haut gauche). */
function perimeter(w: number, h: number, [x, y]: Point): number {
  if (y <= 0.5) return x;
  if (x >= w - 0.5) return w + y;
  if (y >= h - 0.5) return w + h + (w - x);
  return 2 * w + h + (h - y);
}

/** Prolonge le trait jusqu'au bord de la case, dans la direction de son dernier segment. */
function toBorder(w: number, h: number, pts: Point[]): Point[] {
  const clamp = ([x, y]: Point): Point => [
    Math.min(Math.max(x, 0), w),
    Math.min(Math.max(y, 0), h),
  ];
  const out = pts.map(clamp);
  const last = out[out.length - 1] ?? [w / 2, h / 2];
  if (last[0] <= 0 || last[1] <= 0 || last[0] >= w || last[1] >= h) return out;
  const prev = out[out.length - 2] ?? [w / 2, h / 2];
  const a = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const tx = dx > 1e-6 ? (w - last[0]) / dx : dx < -1e-6 ? -last[0] / dx : Infinity;
  const ty = dy > 1e-6 ? (h - last[1]) / dy : dy < -1e-6 ? -last[1] / dy : Infinity;
  const t = Math.min(tx, ty);
  out.push(clamp([last[0] + dx * t, last[1] + dy * t]));
  return out;
}

/**
 * Morceaux d'une case de w × h brisée le long de sa fissure principale : ses branches, parties du
 * même point vers les bords, la découpent en secteurs (une seule branche : une coupe invisible,
 * à l'opposé, ferme le second). Polygones en px, qui couvrent toute la case.
 */
function sectorShards(w: number, h: number, origin: Point, branches: Point[][]): Point[][] {
  const lines = branches.filter((b) => b.length >= 2).map((b) => toBorder(w, h, b));
  if (lines.length === 1) {
    const end = lines[0]?.[lines[0].length - 1] ?? [w, h / 2];
    const a = Math.atan2(origin[1] - end[1], origin[0] - end[0]) + rand(-0.5, 0.5);
    lines.push(
      toBorder(w, h, [origin, [origin[0] + Math.cos(a) * 20, origin[1] + Math.sin(a) * 20]]),
    );
  }
  if (lines.length < 2) return [];
  const P = 2 * (w + h);
  const end = (l: Point[]) => perimeter(w, h, l[l.length - 1] ?? origin);
  lines.sort((u, v) => end(u) - end(v));
  const corners: Point[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  return lines.map((a, i) => {
    const b = lines[(i + 1) % lines.length] ?? a;
    const from = end(a);
    let to = end(b);
    if (to <= from) to += P;
    // coins du bord entre les deux branches, dans le sens horaire
    const between = corners
      .flatMap((c) => [
        { c, t: perimeter(w, h, c) },
        { c, t: perimeter(w, h, c) + P },
      ])
      .filter(({ t }) => t > from && t < to)
      .sort((u, v) => u.t - v.t)
      .map(({ c }) => c);
    return [...a, ...between, ...[...b].reverse().slice(0, -1)];
  });
}

const area = (poly: Point[]) =>
  Math.abs(
    poly.reduce((sum, [x1, y1], i) => {
      const [x2, y2] = poly[(i + 1) % poly.length] ?? [x1, y1];
      return sum + x1 * y2 - x2 * y1;
    }, 0),
  ) / 2;

/**
 * Un morceau recoupé en `parts` éclats de tailles très différentes, comme du verre : des parts en
 * éventail depuis un point intérieur décalé au hasard, coupées à des sommets tirés au hasard.
 */
function splinter(poly: Point[], parts: number): Point[][] {
  if (parts <= 1 || poly.length < 4) return [poly];
  const n = poly.length;
  let [cx, cy] = poly.reduce<Point>(([sx, sy], [x, y]) => [sx + x / n, sy + y / n], [0, 0]);
  const toward = poly[Math.floor(rand(0, n))] ?? [cx, cy];
  const k = rand(0, 0.3);
  cx += (toward[0] - cx) * k;
  cy += (toward[1] - cy) * k;
  const cuts = [
    ...new Set(Array.from({ length: Math.min(parts, n) }, () => Math.floor(rand(0, n)))),
  ].sort((a, b) => a - b);
  if (cuts.length < 2) return [poly];
  return cuts.map((from, i) => {
    const to = cuts[(i + 1) % cuts.length] ?? from;
    const run: Point[] = [];
    for (let j = from; ; j = (j + 1) % n) {
      run.push(poly[j] ?? [cx, cy]);
      if (j === to) break;
    }
    return [[cx, cy], ...run];
  });
}

/**
 * Première zone qui coupe ce qui déborde (défilement ou overflow), ou null : la page elle-même.
 * Gardée en mémoire par case : la chercher remonte l'arbre avec getComputedStyle, à chaque coup.
 */
const clips = new WeakMap<Element, Element | null>();
function clipParent(el: Element): Element | null {
  if (clips.has(el)) return clips.get(el) ?? null;
  let found: Element | null = null;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(p);
    if (/auto|scroll|hidden|clip/.test(overflowX + overflowY)) {
      found = p;
      break;
    }
  }
  clips.set(el, found);
  return found;
}

/**
 * Pendant que ses cases tremblent, une zone qui défile ne doit jamais faire apparaître de barre de
 * défilement : sur chaque axe où rien ne déborde encore, son défilement est coupé (overflow:
 * hidden, sans effet visible), puis rendu peu après le dernier tremblement. Un axe qui défilait
 * déjà garde sa barre, qui ne change pas.
 */
const LOCK_MS = 450;
const locks = new Map<HTMLElement, { timer: number; x: string; y: string }>();
function lockScroll(el: Element | null) {
  if (!(el instanceof HTMLElement)) return;
  const held = locks.get(el);
  if (held) {
    window.clearTimeout(held.timer);
  } else {
    const x = el.style.overflowX;
    const y = el.style.overflowY;
    if (el.scrollWidth <= el.clientWidth) el.style.overflowX = "hidden";
    if (el.scrollHeight <= el.clientHeight) el.style.overflowY = "hidden";
    locks.set(el, { timer: 0, x, y });
  }
  const lock = locks.get(el);
  if (!lock) return;
  lock.timer = window.setTimeout(() => {
    locks.delete(el);
    el.style.overflowX = lock.x;
    el.style.overflowY = lock.y;
  }, LOCK_MS);
}

/**
 * Jusqu'où la case peut bouger de chaque côté sans sortir de la zone qui la contient : au-delà,
 * elle serait coupée, ou ferait apparaître une barre de défilement.
 */
function room(el: Element) {
  const r = el.getBoundingClientRect();
  const clip = clipParent(el);
  if (!clip) {
    const doc = document.documentElement;
    return {
      left: r.left,
      right: doc.clientWidth - r.right,
      top: Infinity,
      bottom: doc.scrollHeight - (r.bottom + window.scrollY),
    };
  }
  const c = clip.getBoundingClientRect();
  return {
    left: r.left - c.left - clip.clientLeft,
    right: c.left + clip.clientLeft + clip.clientWidth - r.right,
    top: r.top - c.top - clip.clientTop,
    bottom: clip.scrollHeight - (r.bottom - c.top - clip.clientTop + clip.scrollTop),
  };
}

/**
 * Les fêlures d'une case (les SVG de son calque `.jojo-cracks`), peintes une fois dans un canvas
 * de la taille de la case : les morceaux en recopient chacun leur part (drawImage), au lieu de
 * recopier des centaines de traits SVG à styler et mettre en page dans chaque morceau.
 */
function paintCracks(host: Element | null, box: DOMRect, dpr: number): HTMLCanvasElement | null {
  const svgs = host ? [...host.querySelectorAll("svg")] : [];
  if (svgs.length === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(box.width * dpr);
  canvas.height = Math.ceil(box.height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  for (const svg of svgs) {
    const at = svg.getBoundingClientRect();
    for (const el of svg.querySelectorAll<SVGGeometryElement>("path, circle")) {
      const cs = getComputedStyle(el);
      const shift = cs.transform === "none" ? new DOMMatrix() : new DOMMatrix(cs.transform);
      const shape =
        el instanceof SVGCircleElement
          ? (() => {
              const c = new Path2D();
              c.arc(el.cx.baseVal.value, el.cy.baseVal.value, el.r.baseVal.value, 0, Math.PI * 2);
              return c;
            })()
          : new Path2D(el.getAttribute("d") ?? "");
      ctx.save();
      ctx.translate(at.left - box.left + shift.e, at.top - box.top + shift.f);
      ctx.globalAlpha = Number(cs.opacity) || 1;
      if (cs.fill && cs.fill !== "none") {
        ctx.fillStyle = cs.fill;
        ctx.fill(shape);
      }
      if (cs.stroke && cs.stroke !== "none") {
        ctx.strokeStyle = cs.stroke;
        ctx.lineWidth = parseFloat(cs.strokeWidth) || 1;
        ctx.lineCap = cs.strokeLinecap as CanvasLineCap;
        ctx.lineJoin = cs.strokeLinejoin as CanvasLineJoin;
        ctx.stroke(shape);
      }
      ctx.restore();
    }
  }
  return canvas;
}

/**
 * De quoi fabriquer vite les copies d'une case brisée, une par morceau. Chaque copie a la mise en
 * page de la case, mais seul ce qui touche son morceau y est recopié : ce qui tombe entièrement
 * hors du morceau y devient une boîte vide à sa taille, en sommeil (content-visibility: hidden),
 * qui garde sa place sans rien à styler, mettre en page ni dessiner. Les canvas recopiés reçoivent
 * l'image de l'original. Sans ça, des dizaines de copies complètes figeaient l'écran au bris.
 */
function prepareCopies(box: HTMLElement) {
  const r = box.getBoundingClientRect();
  type Span = { x: number; y: number; w: number; h: number };
  // ce qui peut être mis en sommeil : une boîte (pas un morceau de texte en ligne), hors SVG
  const spans = new Map<Element, Span>();
  for (const el of box.querySelectorAll("*")) {
    if (!(el instanceof HTMLElement)) continue;
    const display = getComputedStyle(el).display;
    if (display === "inline" || display === "contents" || display === "none") continue;
    const e = el.getBoundingClientRect();
    if (e.width === 0 || e.height === 0) continue;
    spans.set(el, { x: e.left - r.left, y: e.top - r.top, w: e.width, h: e.height });
  }
  return {
    /** Une copie de la case pour le morceau de boîte (bx, by, bw, bh), en px dans la case. */
    copyFor(bx: number, by: number, bw: number, bh: number): HTMLElement {
      const outside = (sp: Span) =>
        sp.x + sp.w < bx - 2 || sp.y + sp.h < by - 2 || sp.x > bx + bw + 2 || sp.y > by + bh + 2;
      const copyOf = (node: Node): Node | null => {
        if (!(node instanceof Element)) return node.cloneNode(false);
        // les fêlures viennent du canvas commun (paintCracks)
        if (node.classList.contains("jojo-cracks")) return null;
        const span = spans.get(node);
        const shell = node.cloneNode(false) as Element;
        if (span && outside(span) && shell instanceof HTMLElement) {
          shell.style.contentVisibility = "hidden";
          shell.style.containIntrinsicSize = `${span.w}px ${span.h}px`;
          return shell;
        }
        if (node instanceof HTMLCanvasElement && shell instanceof HTMLCanvasElement) {
          if (node.width > 0 && node.height > 0) shell.getContext("2d")?.drawImage(node, 0, 0);
          return shell;
        }
        for (const child of node.childNodes) {
          const c = copyOf(child);
          if (c) shell.append(c);
        }
        return shell;
      };
      return copyOf(box) as HTMLElement;
    },
  };
}

export function createDamage(env: Env): Damage {
  const { layer, transient, spawn, word, play, later, quake, reducedMotion } = env;

  // ── Les cases ──
  /** Un trait de la fissure principale (tronc ou ramification) : ses points, ses deux tracés. */
  type Branch = { paths: SVGPathElement[]; pts: Point[] };
  /** Un tronc : il part du premier coup vers un bord, et avance par à-coups. */
  /**
   * Une fissure qui rayonne du point d'impact jusqu'à un bord : par à-coups, vers `cap` (à `maxDev`
   * près), née à l'usure `born`.
   */
  type Trunk = Branch & {
    cap: number;
    reach: number;
    length: number;
    dev: number;
    born: number;
    maxDev: number;
  };
  type MainCrack = {
    svg: SVGSVGElement;
    origin: Point;
    trunks: Trunk[];
    /** Rayons du départ (1 à 3), puis combien il en faut à la fin pour couvrir la case. */
    first: number;
    radials: number;
    /** Cercles de fissures déjà tracés autour du point d'impact. */
    rings: number;
    twigs: number;
    webs: number;
  };
  type Box = {
    host: HTMLElement;
    cracks: { el: SVGSVGElement; x: number; y: number }[];
    last: number;
    hits: number;
    fade: number;
    /** Fissure principale : partie du premier coup, elle traverse la case coup après coup. */
    main: MainCrack | null;
  };
  const boxes = new Map<Element, Box>();
  /** Cases brisées, en attente de Crazy Diamond : leurs morceaux et la chute de chacun. */
  type Broken = { el: HTMLElement; shards: HTMLElement; flights: Animation[] };
  const broken = new Map<Element, Broken>();
  const screenCracks: SVGSVGElement[] = [];
  /** Dernière case brisée : c'est là que Crazy Diamond apparaît. */
  let lastBox: Element | null = null;

  /**
   * La case tremble, dans la limite de la place qu'elle a autour d'elle. Un seul tremblement à la
   * fois par case (le nouveau remplace l'ancien) : deux tremblements additionnés dépasseraient la
   * place calculée pour chacun, et feraient déborder la case.
   */
  const jolts = new WeakMap<Element, Animation>();
  const jolt = (el: Element, power: number, ms: number) => {
    if (reducedMotion()) return;
    jolts.get(el)?.cancel();
    lockScroll(clipParent(el));
    const space = room(el);
    const free = (gap: number) => Math.max(0, Math.min(power, gap - 1));
    const clampX = (v: number) => Math.max(-free(space.left), Math.min(v, free(space.right)));
    const clampY = (v: number) => Math.max(-free(space.top), Math.min(v, free(space.bottom)));
    const frames = Array.from({ length: 6 }, (_, i) => ({
      transform:
        i === 5
          ? "none"
          : `translate(${clampX(rand(-power, power)).toFixed(1)}px, ${clampY(rand(-power, power)).toFixed(1)}px)`,
    }));
    jolts.set(el, el.animate(frames, { duration: ms, composite: "add" }));
  };

  const wearOf = (entry: Box | undefined) => Math.min(1, (entry?.hits ?? 0) / SHATTER_AT);

  /** Un trait de plus dans la fissure principale (deux tracés : l'arête claire, le trait sombre). */
  const stroke = (svg: SVGSVGElement, from: Point, twig: boolean): Branch => {
    const paths = ["light", "dark"].map((kind) => {
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("class", `jojo-crack-${kind}${twig ? " jojo-crack-twig" : ""}`);
      svg.append(path);
      return path;
    });
    return { paths, pts: [from] };
  };
  const redraw = (b: Branch) => {
    const d = polyline(b.pts);
    for (const path of b.paths) path.setAttribute("d", d);
  };
  /**
   * Une ramification d'un coup, tout de suite à sa longueur : une ligne brisée, à angles vifs,
   * coupée au bord de la case ; parfois elle se ramifie à son tour.
   */
  const twig = (
    main: MainCrack,
    w: number,
    h: number,
    from: Point,
    angle: number,
    length: number,
    depth: number,
  ) => {
    if (main.twigs >= 110) return;
    main.twigs += 1;
    const b = stroke(main.svg, from, true);
    let [x, y] = from;
    let a = angle;
    let done = 0;
    while (done < length) {
      a += Math.random() < 0.25 ? rand(-0.9, 0.9) : rand(-0.3, 0.3);
      const seg = rand(7, 16);
      x = Math.min(Math.max(x + Math.cos(a) * seg, 0), w);
      y = Math.min(Math.max(y + Math.sin(a) * seg, 0), h);
      b.pts.push([x, y]);
      done += seg;
      if (x <= 0 || y <= 0 || x >= w || y >= h) break;
      if (depth < 2 && Math.random() < 0.12) {
        twig(
          main,
          w,
          h,
          [x, y],
          a + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.1),
          (length - done) * 0.6,
          depth + 1,
        );
      }
    }
    redraw(b);
  };
  /** Éclats de verre qui sautent du point (x, y) de l'écran, puis retombent. */
  const glassBits = (x: number, y: number, count: number, force = 1) => {
    if (reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      const size = rand(3, 10) * (0.7 + force * 0.4);
      const bit = spawn("jojo-fx-glassbit", {
        left: `${x}px`,
        top: `${y}px`,
        width: `${size}px`,
        height: `${size}px`,
        rotate: `${rand(0, 360)}deg`,
      });
      const a = rand(0, Math.PI * 2);
      const v = rand(30, 110) * force;
      bit.animate(
        [
          { transform: "translate(0, 0) rotate(0)", opacity: 1 },
          {
            transform: `translate(${Math.cos(a) * v}px, ${Math.sin(a) * v - rand(10, 40)}px) rotate(${rand(-300, 300)}deg)`,
            opacity: 0.9,
            offset: 0.4,
          },
          {
            transform: `translate(${Math.cos(a) * v * 1.4}px, ${Math.sin(a) * v + rand(80, 220)}px) rotate(${rand(-600, 600)}deg)`,
            opacity: 0,
          },
        ],
        { duration: rand(450, 900), easing: "cubic-bezier(0.3, 0.6, 0.7, 1)" },
      ).onfinish = () => bit.remove();
    }
  };
  /** Un rayon de plus dans la fissure principale, du point d'impact vers le bord. */
  const radial = (
    svg: SVGSVGElement,
    origin: Point,
    w: number,
    h: number,
    a: number,
    born: number,
    maxDev: number,
  ): Trunk => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const tx = dx > 1e-6 ? (w - origin[0]) / dx : dx < -1e-6 ? -origin[0] / dx : Infinity;
    const ty = dy > 1e-6 ? (h - origin[1]) / dy : dy < -1e-6 ? -origin[1] / dy : Infinity;
    return {
      ...stroke(svg, origin, false),
      cap: a,
      reach: Math.min(tx, ty),
      length: 0,
      dev: 0,
      born,
      maxDev,
    };
  };
  /** Premier point du rayon à au moins `dist` du point d'impact (ou rien s'il n'y arrive pas). */
  const pointAt = (t: Trunk, origin: Point, dist: number): Point | null =>
    t.pts.find((p) => Math.hypot(p[0] - origin[0], p[1] - origin[1]) >= dist) ?? null;
  /**
   * Le cercle de fissures n° `k` : entre chaque paire de rayons voisins assez longs, un trait brisé
   * qui les relie à peu près à la même distance du point d'impact (jamais un vrai cercle, et il en
   * manque toujours quelques-uns). Renvoie true s'il en a tracé au moins un.
   */
  const ring = (main: MainCrack, w: number, h: number, k: number, of: number): boolean => {
    const o = main.origin;
    // de tout près du point d'impact jusqu'aux coins de la case
    const far = Math.max(
      Math.hypot(o[0], o[1]),
      Math.hypot(w - o[0], o[1]),
      Math.hypot(o[0], h - o[1]),
      Math.hypot(w - o[0], h - o[1]),
    );
    const radius = far * (0.1 + 0.85 * Math.pow((k + 1) / of, 1.25));
    const sorted = [...main.trunks].sort(
      (u, v) =>
        (((u.cap % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) -
        (((v.cap % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)),
    );
    let drawn = 0;
    sorted.forEach((t, i) => {
      const next = sorted[(i + 1) % sorted.length];
      if (!next || next === t || Math.random() < 0.22) return;
      const pa = pointAt(t, o, radius * rand(0.85, 1.15));
      const pb = pointAt(next, o, radius * rand(0.85, 1.15));
      if (!pa || !pb) return;
      // un trait brisé, un peu bombé vers l'extérieur
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (len < 12 || len > far * 1.1) return;
      const nx = -(pb[1] - pa[1]) / len;
      const ny = (pb[0] - pa[0]) / len;
      const out = (pa[0] + pb[0]) / 2 - o[0] < 0 === nx < 0 ? 1 : -1;
      const pts: Point[] = [pa];
      const steps = 2 + Math.floor(rand(0, 3));
      for (let s = 1; s < steps; s++) {
        const f = s / steps;
        const bow = Math.sin(f * Math.PI) * len * rand(0.04, 0.16) * out;
        pts.push([
          Math.min(Math.max(pa[0] + (pb[0] - pa[0]) * f + nx * bow + rand(-4, 4), 0), w),
          Math.min(Math.max(pa[1] + (pb[1] - pa[1]) * f + ny * bow + rand(-4, 4), 0), h),
        ]);
      }
      pts.push(pb);
      const b = stroke(main.svg, pa, true);
      b.pts = pts;
      later(drawn * 14, () => redraw(b));
      drawn += 1;
    });
    return drawn > 0;
  };
  /** Trace `count` points du trait (le bond se dessine en quelques images, pas d'un seul coup). */
  const reveal = (b: Branch, count: number) => {
    const d = polyline(b.pts.slice(0, count));
    for (const path of b.paths) path.setAttribute("d", d);
  };
  /**
   * La fissure principale encaisse un coup, comme une vitre qui prend coup sur coup au même
   * endroit. Elle ne grandit pas d'un peu à chaque coup : la tension monte, puis elle cède d'un
   * coup, un bond très rapide (dessiné en une centaine de millisecondes) à angles vifs, par segments
   * très inégaux, avec des ramifications.
   * - Au début, 1 à 3 fissures partent du point d'impact (le premier coup, ramené vers le centre)
   *   et grandissent vite : elles touchent les bords vers 55 % de l'usure.
   * - Puis d'autres rayonnent du même point, dans les trous entre elles, jusqu'à une douzaine qui
   *   partent dans tous les sens et atteignent toutes les bords vers 90 %.
   * - Des cercles de fissures, brisés et incomplets, relient les rayons voisins à des distances de
   *   plus en plus grandes : à la fin, la toile de verre brisé couvre toute la case.
   * Chaque bond craque (début de bris de verre, de plus en plus fort), fait sauter des éclats au
   * bout de la fissure, et lâche parfois un « ピキッ ». Une étoile s'élargit autour du point de
   * départ. Renvoie true si elle vient de bondir (la case tremble alors plus fort).
   */
  const growMain = (box: Element, entry: Box, x: number, y: number): boolean => {
    const r = box.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    if (!entry.main) {
      const svg = document.createElementNS(SVG, "svg");
      svg.setAttribute("class", "jojo-maincrack");
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));
      entry.host.append(svg);
      // le premier coup, ramené vers le centre de la case
      const pull = w * h > 200_000 ? 0.65 : 0.35;
      const hx = x - r.left;
      const hy = y - r.top;
      const origin: Point = [
        Math.min(Math.max(hx + (w / 2 - hx) * pull + rand(-0.06, 0.06) * w, w * 0.15), w * 0.85),
        Math.min(Math.max(hy + (h / 2 - hy) * pull + rand(-0.06, 0.06) * h, h * 0.2), h * 0.8),
      ];
      // 1, 2 ou 3 branches, dans des directions au hasard (haut, bas, en diagonale…), assez
      // écartées pour ne jamais se croiser
      const count = Math.random() < 0.28 ? 1 : Math.random() < 0.6 ? 2 : 3;
      const base = rand(0, Math.PI * 2);
      const caps =
        count === 1
          ? [base]
          : count === 2
            ? [base, base + Math.PI + rand(-0.7, 0.7)]
            : [0, 1, 2].map((i) => base + (i * Math.PI * 2) / 3 + rand(-0.3, 0.3));
      entry.main = {
        svg,
        origin,
        trunks: caps.map((a) => radial(svg, origin, w, h, a, 0, 0.7)),
        first: caps.length,
        // une douzaine de rayons à la fin (plus dans une grande case)
        radials: (w * h > 200_000 ? 14 : 11) + Math.floor(rand(-1, 2)),
        rings: 0,
        twigs: 0,
        webs: 0,
      };
    }
    const main = entry.main;
    const wear = wearOf(entry);
    let burst = false;
    // de nouveaux rayons partent du point d'impact, chacun dans le plus grand trou entre les autres
    const wanted = Math.round(
      main.first + (main.radials - main.first) * Math.min(1, Math.max(0, (wear - 0.1) / 0.68)),
    );
    while (main.trunks.length < wanted) {
      const caps = main.trunks
        .map((t) => ((t.cap % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
        .sort((a, b) => a - b);
      let gapAt = 0;
      let gap = 0;
      caps.forEach((c, i) => {
        const next = i + 1 < caps.length ? (caps[i + 1] ?? c) : (caps[0] ?? c) + Math.PI * 2;
        if (next - c > gap) {
          gap = next - c;
          gapAt = c;
        }
      });
      const a = gapAt + gap * rand(0.38, 0.62);
      // assez serré pour ne pas croiser ses voisins
      main.trunks.push(radial(main.svg, main.origin, w, h, a, wear, Math.min(0.7, gap * 0.22)));
    }
    for (const t of main.trunks) {
      const last = t.pts[t.pts.length - 1] ?? main.origin;
      // arrivée au bord : cette branche a fini
      if (last[0] <= 0 || last[1] <= 0 || last[0] >= w || last[1] >= h) continue;
      // longueur qu'il « devrait » avoir (vite au début, puis jusqu'au bord) : il ne bouge pas
      // tant que le retard est faible (au hasard), puis il bondit, et dépasse un peu
      const progress =
        t.born === 0
          ? Math.pow(Math.min(1, wear / 0.55), 0.6)
          : Math.pow(Math.min(1, (wear - t.born) / Math.max(0.1, 0.9 - t.born)), 0.7);
      const target = t.reach * progress;
      const lag = target - t.length;
      if (lag < t.reach * rand(0.03, 0.15) && !(lag > t.reach * 0.02 && Math.random() < 0.12)) {
        continue;
      }
      burst = true;
      const goal = Math.min(t.reach * 1.05, target + t.reach * rand(0, 0.08));
      const before = t.pts.length;
      const pending: [number, () => void][] = [];
      let [px, py] = last;
      while (t.length < goal) {
        // cap gardé à peu près (jamais en arrière), avec des cassures vives et inégales
        t.dev = Math.max(
          -t.maxDev,
          Math.min(
            t.maxDev,
            t.dev * 0.45 + (Math.random() < 0.35 ? rand(-0.85, 0.85) : rand(-0.25, 0.25)),
          ),
        );
        const a = t.cap + t.dev;
        // segments très inégaux : de petits zigzags, et parfois une longue ligne droite
        const seg = Math.random() < 0.15 ? rand(28, 46) : rand(5, 22);
        px = Math.min(Math.max(px + Math.cos(a) * seg, 0), w);
        py = Math.min(Math.max(py + Math.sin(a) * seg, 0), h);
        t.pts.push([px, py]);
        t.length += seg;
        // les ramifications partent des cassures, au moment où le bond y passe ; parfois une fourche
        const at: Point = [px, py];
        const step = t.pts.length - before;
        const side = Math.random() < 0.5 ? -1 : 1;
        if (wear > 0.25 && Math.random() < 0.05) {
          pending.push([
            step,
            () => twig(main, w, h, at, a + side * rand(0.35, 0.8), t.reach * rand(0.25, 0.45), 0),
          ]);
        } else if (Math.random() < 0.08 + wear * 0.22) {
          pending.push([
            step,
            () =>
              twig(
                main,
                w,
                h,
                at,
                a + side * rand(0.5, 1.3),
                t.reach * rand(0.08, 0.22) * (0.5 + wear),
                0,
              ),
          ]);
        }
        if (px <= 0 || py <= 0 || px >= w || py >= h) break;
      }
      // le bond se dessine très vite, en 4 images, ses ramifications au fur et à mesure
      const added = t.pts.length - before;
      const frames = reducedMotion() ? 1 : 4;
      for (let f = 1; f <= frames; f++) {
        const upTo = before + Math.ceil((added * f) / frames);
        later((f - 1) * 26, () => {
          reveal(t, upTo);
          for (const [i, grow] of pending)
            if (i > (added * (f - 1)) / frames && i <= (added * f) / frames) grow();
        });
      }
      // bruit et éclats au bout de la fissure, là où elle vient d'arriver
      const tip = t.pts[t.pts.length - 1] ?? main.origin;
      later(frames * 26, () => {
        const here = box.getBoundingClientRect();
        glassBits(here.left + tip[0], here.top + tip[1], 3 + Math.round(wear * 7), 0.6 + wear);
      });
    }
    if (burst) {
      const snap = play(DAMAGE_SOUNDS.crack, { volume: 0.3 + wear * 0.6 });
      snap.preservesPitch = false;
      snap.playbackRate = rand(0.8, 1.35);
      if (wear > 0.35 && Math.random() < 0.45) {
        const tip = main.trunks[Math.floor(rand(0, main.trunks.length))]?.pts.at(-1) ?? main.origin;
        transient(
          "jojo-fx-word jojo-fx-kana",
          {
            left: `${r.left + tip[0]}px`,
            top: `${r.top + tip[1] - 20}px`,
            color: "#e8f4ff",
            fontSize: `${20 + wear * 26}px`,
            rotate: `${rand(-20, 20)}deg`,
          },
          ["ピキッ", "ビキッ", "バキッ"][Math.floor(rand(0, 3))],
        );
      }
    }
    // des cercles de fissures relient les rayons, de plus en plus loin du point d'impact
    const ringAt = [0.26, 0.42, 0.56, 0.68, 0.79, 0.88, 0.95];
    while (main.rings < ringAt.length && wear >= (ringAt[main.rings] ?? 1)) {
      if (ring(main, w, h, main.rings, ringAt.length)) burst = true;
      main.rings += 1;
    }
    // l'étoile autour du point de départ s'élargit en trois temps
    const webAt = [0.3, 0.6, 0.85];
    while (main.webs < webAt.length && wear >= (webAt[main.webs] ?? 1)) {
      main.webs += 1;
      const web = crackElement(main.origin[0], main.origin[1], 40 + main.webs * 45, "jojo-crack");
      entry.host.append(web);
    }
    return burst;
  };

  /** Les fêlures d'une case qu'on ne frappe plus s'estompent, puis disparaissent. */
  const fadeBox = (box: Element, entry: Box) => {
    if (boxes.get(box) !== entry) return;
    boxes.delete(box);
    entry.host.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: reducedMotion() ? 1 : 700,
      easing: "ease-in",
      fill: "forwards",
    }).onfinish = () => entry.host.remove();
  };

  const crack = (box: Element, x: number, y: number, big: boolean) => {
    const now = performance.now();
    let entry = boxes.get(box);
    if (!entry) {
      const host = document.createElement("span");
      host.className = "jojo-cracks";
      host.setAttribute("aria-hidden", "true");
      box.append(host);
      entry = { host, cracks: [], last: 0, hits: 0, fade: 0, main: null };
      boxes.set(box, entry);
    }
    // tant qu'on la frappe, ses fêlures restent ; on arrête, elles s'estompent
    const current = entry;
    window.clearTimeout(current.fade);
    current.fade = later(FADE_AFTER_MS, () => fadeBox(box, current));
    current.hits += big ? 6 : 1;
    if (current.hits >= SHATTER_AT && box instanceof HTMLElement) {
      // elle cède depuis le premier point, là où est partie la fissure principale
      const r = box.getBoundingClientRect();
      const [ox, oy] = current.main?.origin ?? [x - r.left, y - r.top];
      return shatter(box, r.left + ox, r.top + oy);
    }
    // la fissure principale bondit : la case accuse le coup
    if (growMain(box, current, x, y) && !reducedMotion()) jolt(box, 8 + wearOf(current) * 9, 220);
    const wear = wearOf(current);
    if (!big && now - current.last < CRACK_EVERY_MS * (1 - 0.5 * wear)) return;
    const r = box.getBoundingClientRect();
    const lx = x - r.left;
    const ly = y - r.top;
    const spacing = CRACK_SPACING * (1 - 0.6 * wear);
    const close = current.cracks.some((c) => Math.hypot(c.x - lx, c.y - ly) < spacing);
    if (!big && (close || current.cracks.length >= CRACKS_PER_BOX)) return;
    current.last = now;
    // petites au début, de grandes fêlures quand la case est près de céder
    const size = (big ? rand(70, 100) : rand(32, 50)) + wear * rand(60, 110);
    const el = crackElement(lx, ly, size, "jojo-crack");
    current.host.append(el);
    current.cracks.push({ el, x: lx, y: ly });
    if (!reducedMotion()) {
      el.animate(
        [
          { transform: "scale(0.25)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: big ? 200 : 130, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.2)" },
      );
    }
  };

  /**
   * La case vole en éclats : elle est masquée (sa place reste dans la page), et ses morceaux
   * (clip-path) partent du point d'impact et retombent. Seuls les plus gros emportent une copie de
   * la case (allégée : ni ombres, ni filtres, ni animations, voir .jojo-fx-shards) ; les petits
   * éclats sont du verre teinté de la couleur de la case : copier la case pour chacun figeait
   * l'écran. Tout tombe en 2D. Crazy Diamond arrive peu après.
   */
  const shatter = (box: HTMLElement, x: number, y: number) => {
    if (broken.has(box)) return;
    const entry = boxes.get(box);
    if (entry) window.clearTimeout(entry.fade);
    const r = box.getBoundingClientRect();
    const lx = Math.min(Math.max(x - r.left, 8), r.width - 8);
    const ly = Math.min(Math.max(y - r.top, 8), r.height - 8);
    const shards = spawn("jojo-fx-shards", {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    // les morceaux suivent la fissure principale ; sans elle, un éventail autour de l'impact (grande
    // case comme La Place : moins de morceaux, chacun est une copie entière de la case)
    const main = entry?.main;
    const big = r.width * r.height > 300_000;
    const sectors = main
      ? sectorShards(
          r.width,
          r.height,
          main.origin,
          main.trunks.map((t) => t.pts),
        )
      : [];
    const base =
      sectors.length > 0 ? sectors : shardPolygons(r.width, r.height, lx, ly, big ? 5 : 7);
    // puis chaque morceau recoupé en éclats de tailles très différentes, comme du verre (moins
    // d'éclats dans une grande case : chacun est une copie entière de la case)
    const total = base.reduce((sum, poly) => sum + area(poly), 0) || 1;
    const wanted = big ? 16 : 30;
    const polys = base.flatMap((poly) =>
      splinter(poly, Math.max(1, Math.round(((wanted * area(poly)) / total) * rand(0.5, 1.6)))),
    );
    const copies = prepareCopies(box);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cracks = paintCracks(entry?.host ?? null, r, dpr);
    const pieces = polys.map((poly) => {
      const piece = document.createElement("div");
      piece.className = "jojo-fx-shard";
      // chaque éclat a la taille de son morceau, pas celle de toute la case : bien moins de
      // surface à dessiner quand ils sont des dizaines à tomber en même temps
      const xs = poly.map((pt) => pt[0]);
      const ys = poly.map((pt) => pt[1]);
      const bx = Math.max(0, Math.floor(Math.min(...xs)));
      const by = Math.max(0, Math.floor(Math.min(...ys)));
      const bw = Math.ceil(Math.max(...xs)) - bx;
      const bh = Math.ceil(Math.max(...ys)) - by;
      Object.assign(piece.style, {
        left: `${bx}px`,
        top: `${by}px`,
        width: `${bw}px`,
        height: `${bh}px`,
      });
      const copy = copies.copyFor(bx, by, bw, bh);
      copy.setAttribute("aria-hidden", "true");
      copy.inert = true;
      copy.removeAttribute("id");
      Object.assign(copy.style, {
        position: "absolute",
        left: `${-bx}px`,
        top: `${-by}px`,
        margin: "0",
        width: `${r.width}px`,
        height: `${r.height}px`,
        visibility: "visible",
        // une animation d'entrée de la case (apparition en fondu…) ne doit pas se rejouer
        animation: "none",
        transition: "none",
      });
      piece.append(copy);
      // les fêlures de ce morceau, recopiées du canvas commun
      if (cracks && bw > 0 && bh > 0) {
        const part = document.createElement("canvas");
        part.className = "jojo-fx-shard-cracks";
        part.width = Math.ceil(bw * dpr);
        part.height = Math.ceil(bh * dpr);
        part
          .getContext("2d")
          ?.drawImage(
            cracks,
            bx * dpr,
            by * dpr,
            part.width,
            part.height,
            0,
            0,
            part.width,
            part.height,
          );
        piece.append(part);
      }
      piece.style.clipPath = `polygon(${poly
        .map(([px, py]) => `${(px - bx).toFixed(1)}px ${(py - by).toFixed(1)}px`)
        .join(", ")})`;
      const cx = poly.reduce((sum, p) => sum + p[0], 0) / poly.length;
      const cy = poly.reduce((sum, p) => sum + p[1], 0) / poly.length;
      piece.style.transformOrigin = `${cx - bx}px ${cy - by}px`;
      // reflet du verre : un éclat de lumière, différent sur chaque morceau
      piece.style.setProperty("--glint", `${rand(0, 360).toFixed(0)}deg`);
      piece.style.setProperty("--shine", rand(0.06, 0.38).toFixed(2));
      // chaque éclat part de son côté : les petits plus loin, à des vitesses et des moments
      // différents, en tournoyant, puis tombe
      const dx = cx - lx;
      const dy = cy - ly;
      const len = Math.hypot(dx, dy) || 1;
      const small = Math.min(1, 6000 / Math.max(area(poly), 1));
      const push = rand(30, 140) + small * rand(40, 160);
      const fx = (dx / len) * push + rand(-30, 30);
      const fy = (dy / len) * push;
      const spin = rand(-120, 120) * (1 + small);
      // en 2D : le basculement en 3D mettait chaque copie de la case sur sa propre couche 3D. Un
      // écrasement sur un axe en tournant donne l'effet du verre qui pivote, pour bien moins cher.
      const flip = rand(0.25, 1);
      const fall: [Keyframe[], KeyframeAnimationOptions] = [
        [
          { transform: "translate(0, 0) rotate(0) scale(1, 1)", opacity: 1 },
          {
            transform: `translate(${fx * 0.45}px, ${fy * 0.45 - rand(8, 46)}px) rotate(${spin * 0.25}deg) scale(1, ${(1 + flip) / 2})`,
            opacity: 1,
            offset: rand(0.15, 0.3),
          },
          {
            transform: `translate(${fx}px, ${fy + rand(420, 780)}px) rotate(${spin}deg) scale(${flip}, 1)`,
            opacity: 0,
          },
        ],
        {
          duration: reducedMotion() ? 1 : rand(800, 1650),
          delay: reducedMotion() ? 0 : rand(0, 220),
          easing: "cubic-bezier(0.4, 0, 0.9, 0.6)",
          fill: "both",
        },
      ];
      return { piece, fall };
    });
    for (const { piece } of pieces) shards.append(piece);
    const flights = pieces.map(({ piece, fall }) => piece.animate(...fall));
    // la case elle-même disparaît, avec ses fêlures (elles restent dans les morceaux)
    box.style.visibility = "hidden";
    if (entry) {
      entry.host.remove();
      boxes.delete(box);
    }
    broken.set(box, { el: box, shards, flights });
    lastBox = box;
    // poussière de verre le long de la fissure
    const line = main?.trunks.flatMap((t) => t.pts) ?? [];
    for (let i = 0; i < 6; i++) {
      const [bx, by] = line[Math.floor(rand(0, line.length))] ?? [lx, ly];
      glassBits(r.left + bx, r.top + by, 4, 1.6);
    }
    play(DAMAGE_SOUNDS.glass, { volume: 1 });
    quake(16, 480);
    transient(
      "jojo-fx-final jojo-fx-kana",
      { left: `${x}px`, top: `${y}px`, color: "#e8f4ff" },
      "ガシャーン",
    );
  };

  /**
   * La case brisée se reconstitue : ses morceaux refont leur chute à l'envers en `ms`
   * millisecondes, puis elle revient.
   */
  const restoreBox = ({ el, shards, flights }: Broken, animated: boolean, ms = REWIND_MS) => {
    broken.delete(el);
    const done = () => {
      el.style.removeProperty("visibility");
      shards.remove();
    };
    if (!animated || reducedMotion()) return done();
    // la page a pu défiler depuis : les morceaux reviennent là où est la case maintenant
    const r = el.getBoundingClientRect();
    shards.style.left = `${r.left}px`;
    shards.style.top = `${r.top}px`;
    let left = flights.length;
    if (left === 0) return done();
    for (const a of flights) {
      // à l'envers, à la vitesse qui le ramène au départ en `ms`
      const at = typeof a.currentTime === "number" ? a.currentTime : 0;
      a.onfinish = () => {
        left -= 1;
        if (left === 0) done();
      };
      a.playbackRate = -Math.max(at, 1) / ms;
      a.play();
    }
  };

  // ── Les petits éléments du header ──
  const lastSmall = new WeakMap<Element, number>();
  let lastRings = 0;
  let luffyTalked = 0;
  const knock = (el: Element, spin = 14) => {
    if (reducedMotion()) return;
    el.animate(
      [
        {
          transform: `translate(${rand(-3, 3)}px, ${rand(-3, 1)}px) rotate(${rand(-spin, spin)}deg)`,
        },
        { transform: `rotate(${rand(-spin, spin) / 2}deg)` },
        { transform: "none" },
      ],
      { duration: 260, composite: "add", easing: "ease-out" },
    );
  };
  /** Sonic touché perd ses anneaux, qui retombent en s'éparpillant. */
  const rings = (el: Element) => {
    const now = performance.now();
    if (now - lastRings < RING_EVERY_MS) return;
    lastRings = now;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const ring = transient("jojo-fx-coin", {
        left: `${r.left + r.width / 2}px`,
        top: `${r.top + r.height / 2}px`,
      });
      const dx = rand(-90, 90);
      const up = rand(40, 90);
      ring.animate(
        [
          { transform: "translate(0, 0)", opacity: 1 },
          { transform: `translate(${dx * 0.6}px, ${-up}px)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${dx}px, ${rand(30, 70)}px)`, opacity: 0 },
        ],
        { duration: rand(700, 950), easing: "ease-out", fill: "forwards" },
      ).onfinish = () => ring.remove();
    }
  };
  /** Luffy est en caoutchouc : il s'étire, rebondit, et les coups ne lui font rien. */
  const rubber = (el: Element) => {
    if (!reducedMotion()) {
      el.animate(
        [
          { transform: "scale(1, 1)" },
          { transform: `scale(1.55, 0.7) translateX(${rand(-6, 6)}px)` },
          { transform: "scale(0.85, 1.2)" },
          { transform: "scale(1, 1)" },
        ],
        { duration: 380, easing: "ease-out" },
      );
    }
    const now = performance.now();
    if (now - luffyTalked < 6000) return;
    luffyTalked = now;
    const r = el.getBoundingClientRect();
    transient(
      "jojo-fx-bubble jojo-fx-bubble-luffy",
      { left: `${Math.max(r.left + r.width / 2, 140)}px`, top: `${r.bottom + 70}px` },
      "効かねェな… ゴムだから",
    );
  };
  const small = (el: Element, kind: string | null) => {
    const now = performance.now();
    if (now - (lastSmall.get(el) ?? 0) < SMALL_EVERY_MS) return;
    lastSmall.set(el, now);
    if (kind === "luffy") return rubber(el);
    if (kind === "orb") {
      // la steel ball de Gyro : la rotation, toujours la rotation
      if (!reducedMotion()) {
        el.animate([{ transform: "rotate(0)" }, { transform: "rotate(720deg)" }], {
          duration: 520,
          easing: "ease-out",
          composite: "add",
        });
      }
      return;
    }
    knock(el);
    if (kind === "sonic") rings(el);
  };

  // ── La mascotte ──
  type Ko = {
    hits: number;
    body?: Animation;
    crown?: Animation;
    lids: Animation[];
    /** Blessures posées sur elle, dans l'ordre. */
    hurts: HTMLElement[];
  };
  const fresh = (): Ko => ({ hits: 0, lids: [], hurts: [] });
  let ko: Ko = fresh();
  const mascotParts = (btn: Element) => ({
    inner: btn.querySelector(".mascot"),
    all: btn.querySelector(".mascot-all"),
    crown: btn.querySelector(".mascot-crown"),
    lids: [...btn.querySelectorAll(".mascot-lid")],
  });
  /** Gouttes de sang qui giclent du point (x, y) de l'écran, puis retombent. */
  const blood = (x: number, y: number, count: number, force = 1) => {
    if (reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      const size = rand(4, 11) * (0.7 + force * 0.3);
      const drop = spawn("jojo-fx-blood", {
        left: `${x}px`,
        top: `${y}px`,
        width: `${size}px`,
        height: `${size * rand(1, 1.6)}px`,
      });
      const a = rand(-Math.PI, 0);
      const v = rand(30, 110) * force;
      drop.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          {
            transform: `translate(${Math.cos(a) * v}px, ${Math.sin(a) * v}px) scale(1)`,
            opacity: 1,
            offset: 0.35,
          },
          {
            transform: `translate(${Math.cos(a) * v * 1.3}px, ${Math.sin(a) * v + rand(120, 260)}px) scale(0.6)`,
            opacity: 0,
          },
        ],
        { duration: rand(500, 900), easing: "cubic-bezier(0.3, 0.5, 0.7, 1)" },
      ).onfinish = () => drop.remove();
    }
  };
  /** Taches laissées sur l'écran (sang de la mascotte écrasée), effacées par Crazy Diamond. */
  const stains: HTMLElement[] = [];

  /** Envoyée dans le bord de l'écran, à l'opposé du poing ; le bord se fissure. */
  const launch = (btn: HTMLElement, fx: number, fy: number) => {
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = cx - fx;
    let dy = cy - fy;
    const len = Math.hypot(dx, dy);
    if (len < 8) [dx, dy] = [1, -0.35];
    else [dx, dy] = [dx / len, dy / len];
    // jusqu'au bord de l'écran, mascotte entière dans la fenêtre
    const hw = r.width / 2;
    const hh = r.height / 2;
    const tx = dx > 0 ? (window.innerWidth - hw - cx) / dx : dx < 0 ? (hw - cx) / dx : Infinity;
    const ty = dy > 0 ? (window.innerHeight - hh - cy) / dy : dy < 0 ? (hh - cy) / dy : Infinity;
    const t = Math.max(0, Math.min(tx, ty));
    const mx = dx * t;
    const my = dy * t;
    const spin = (dx >= 0 ? 1 : -1) * rand(380, 560);
    const ms = Math.max(260, Math.min(520, t * 0.6));
    ko.body = btn.animate(
      [
        { transform: "translate(0, 0) rotate(0)" },
        { transform: `translate(${mx}px, ${my}px) rotate(${spin}deg)` },
      ],
      { duration: ms, easing: "cubic-bezier(0.15, 0.7, 0.35, 1)", fill: "forwards" },
    );
    later(ms, () => {
      // impact : le bord de l'écran se fissure là où elle s'est écrasée
      const ix = cx + mx + dx * hw;
      const iy = cy + my + dy * hh;
      const el = crackElement(ix, iy, rand(120, 160), "jojo-fx-crack");
      layer.append(el);
      screenCracks.push(el);
      transient("jojo-fx-don", { left: `${cx + mx}px`, top: `${cy + my - 40}px` }, "ドン");
      quake(14, 420);
      // le sang éclabousse le bord de l'écran, et une dent part
      const splat = spawn("jojo-fx-splat", {
        left: `${ix}px`,
        top: `${iy}px`,
        rotate: `${rand(0, 360)}deg`,
      });
      stains.push(splat);
      blood(ix, iy, 14, 2);
      const tooth = spawn("jojo-fx-tooth", { left: `${ix}px`, top: `${iy}px` });
      tooth.animate(
        [
          { transform: "translate(0, 0) rotate(0)", opacity: 1 },
          {
            transform: `translate(${-dx * 120}px, -110px) rotate(400deg)`,
            opacity: 1,
            offset: 0.4,
          },
          { transform: `translate(${-dx * 200}px, 260px) rotate(900deg)`, opacity: 0 },
        ],
        { duration: 1100, easing: "ease-out" },
      ).onfinish = () => tooth.remove();
    });
  };
  const mascotHit = (btn: HTMLElement, x: number, y: number, final: boolean) => {
    if (ko.body) return knock(btn, 6); // déjà dans le mur
    const { inner, all, crown, lids } = mascotParts(btn);
    if (!inner) return;
    ko.hits += final ? 6 : 1;
    // une blessure de plus à chaque palier (posée sur l'image, à l'échelle de la mascotte)
    for (const [at, kind] of INJURIES.slice(ko.hurts.length)) {
      if (ko.hits < at || !all) break;
      const hurt = document.createElement("span");
      hurt.className = `mascot-hurt mascot-hurt-${kind}`;
      hurt.setAttribute("aria-hidden", "true");
      // un verre de ses lunettes qui se fend
      if (kind === "glasses-crack") {
        const glass = crackElement(40, 40, 40, "mascot-hurt-crack");
        glass.setAttribute("viewBox", "0 0 80 80");
        glass.setAttribute("width", "100%");
        glass.setAttribute("height", "100%");
        glass.style.left = "0";
        glass.style.top = "0";
        hurt.append(glass);
      }
      all.append(hurt);
      ko.hurts.push(hurt);
    }
    // le sang gicle à chaque coup, de plus en plus, et il crie sa douleur
    const pain = Math.min(1, ko.hits / LAUNCH_AT);
    if (ko.hits > 12) blood(x, y, 1 + Math.round(pain * 5), 0.6 + pain);
    if (ko.hits > 18 && ko.hits % 13 === 0) {
      const m = btn.getBoundingClientRect();
      transient(
        "jojo-fx-word jojo-fx-kana jojo-fx-pain",
        {
          left: `${m.left + m.width * rand(0.2, 0.8)}px`,
          top: `${m.top + m.height * 0.15}px`,
          fontSize: `${22 + pain * 22}px`,
          rotate: `${rand(-18, 18)}deg`,
        },
        PAIN[Math.floor(rand(0, PAIN.length))],
      );
    }
    if (!reducedMotion()) {
      inner.animate(
        [
          {
            transform: `translate(${rand(-6, 6)}px, ${rand(-4, 4)}px) rotate(${rand(-12, 12)}deg) scale(${rand(0.9, 1)}, ${rand(0.88, 1)})`,
          },
          { transform: "none" },
        ],
        { duration: 150, composite: "add" },
      );
    }
    if (ko.hits >= DAZED_AT && ko.lids.length === 0) {
      ko.lids = lids.map((lid) =>
        lid.animate([{ transform: "scaleY(1)" }], { duration: 120, fill: "forwards" }),
      );
    }
    if (ko.hits >= CROWN_AT && !ko.crown && crown) {
      const side = x < btn.getBoundingClientRect().left + 20 ? 1 : -1;
      ko.crown = crown.animate(
        [
          { transform: "translate(0, 0) rotate(0)", opacity: 1 },
          {
            transform: `translate(${side * 60}px, -140px) rotate(${side * 400}deg)`,
            opacity: 1,
            offset: 0.45,
          },
          { transform: `translate(${side * 110}px, 260px) rotate(${side * 900}deg)`, opacity: 0 },
        ],
        { duration: 1100, easing: "ease-out", fill: "forwards" },
      );
    }
    if (ko.hits >= LAUNCH_AT && !reducedMotion()) launch(btn, x, y);
  };

  // ── Un coup ──
  const hit = (x: number, y: number, final = false) => {
    // les poings sur la mascotte (ou juste à côté) : c'est elle qui prend, pas la case derrière
    const mascot = document.querySelector<HTMLElement>('[data-ora="mascot"]');
    const m = mascot?.getBoundingClientRect();
    if (
      mascot &&
      m &&
      m.width > 0 &&
      x >= m.left - MASCOT_PAD &&
      x <= m.right + MASCOT_PAD &&
      y >= m.top - MASCOT_PAD &&
      y <= m.bottom + MASCOT_PAD
    ) {
      return mascotHit(mascot, x, y, final);
    }
    const top = document.elementsFromPoint(x, y).find((e) => !e.closest(HUD));
    if (!top) return;
    const target = top.closest<HTMLElement>("[data-ora]");
    if (target?.dataset.ora === "mascot") return;
    if (target) return small(target, target.dataset.ora ?? null);
    const headerItem = top.closest("header button, header a");
    if (headerItem) return small(headerItem, null);
    const box = top.closest(".theme-frame");
    if (!box) return;
    // plus elle est usée, plus elle tremble
    const wear = wearOf(boxes.get(box));
    jolt(box, (final ? 9 : 4) + wear * 7, final ? 420 : 140);
    crack(box, x, y, final);
  };

  const damaged = () =>
    broken.size > 0 || screenCracks.length > 0 || stains.length > 0 || ko.hits > 0;

  /** Joue l'animation à l'envers jusqu'à son début, en `ms` millisecondes, puis l'annule. */
  const rewind = (a: Animation, ms: number) => {
    a.onfinish = () => a.cancel();
    const at = typeof a.currentTime === "number" ? a.currentTime : 0;
    a.playbackRate = -Math.max(at, 1) / ms;
    a.play();
  };
  /**
   * Remet la mascotte en `ms` millisecondes : le corps revole depuis le bord de l'écran, la
   * couronne revient, les yeux se rouvrent, et ses blessures s'effacent, des dernières aux premières.
   */
  const restoreMascot = (animated: boolean, ms = REWIND_MS) => {
    const { body, crown, lids, hurts } = ko;
    ko = fresh();
    const parts = [body, crown, ...lids].filter((a): a is Animation => !!a);
    if (!animated || reducedMotion()) {
      parts.forEach((a) => a.cancel());
      hurts.forEach((h) => h.remove());
      return;
    }
    parts.forEach((a) => rewind(a, ms));
    [...hurts].reverse().forEach((h, i) => {
      h.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 260,
        delay: (i * ms) / Math.max(hurts.length, 1),
        fill: "forwards",
      }).onfinish = () => h.remove();
    });
  };
  const closeCrack = (el: SVGSVGElement) => {
    if (reducedMotion()) return el.remove();
    el.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(0)", opacity: 0 },
      ],
      { duration: 320, easing: "ease-in", fill: "forwards" },
    ).onfinish = () => el.remove();
  };

  const clear = () => {
    for (const { host, fade } of boxes.values()) {
      window.clearTimeout(fade);
      host.remove();
    }
    boxes.clear();
    for (const b of [...broken.values()]) restoreBox(b, false);
    for (const el of screenCracks.splice(0)) el.remove();
    for (const el of stains.splice(0)) el.remove();
    restoreMascot(false);
    lastBox = null;
  };

  // ── Crazy Diamond ──
  let repairing = false;
  let again = false;
  const inView = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  };
  function repair() {
    if (!damaged()) return;
    // une autre case se brise pendant qu'il répare : il s'en occupe juste après
    if (repairing) {
      again = true;
      return;
    }
    repairing = true;
    const mascot = document.querySelector<HTMLElement>('[data-ora="mascot"]');
    // Crazy Diamond apparaît à côté de la dernière case brisée, sinon de la mascotte
    const focus =
      (lastBox && broken.has(lastBox) && inView(lastBox) ? lastBox : null) ??
      [...broken.keys()].find(inView) ??
      (ko.hits > 0 && mascot ? mascot : null);
    const f = focus?.getBoundingClientRect();
    const fx = f ? f.left + f.width / 2 : window.innerWidth / 2;
    const fy = f
      ? Math.min(Math.max(f.top + Math.min(f.height, 260) / 2, 120), window.innerHeight - 160)
      : window.innerHeight / 2;
    // à droite de la case, tourné vers la gauche (son poing est à gauche), ou l'inverse
    const onRight = fx < window.innerWidth / 2;
    const cdX = Math.min(Math.max(fx + (onRight ? 170 : -170), 110), window.innerWidth - 110);
    const cd = spawn(`jojo-fx-cd${onRight ? "" : " jojo-fx-cd-flip"}`, {
      left: `${cdX}px`,
      top: `${fy}px`,
    });
    // tout part en même temps : il sort, le son de la réparation et celui de ses coups
    // (« DORARARA »), ses coups, et le rembobinage
    play(DAMAGE_SOUNDS.restore, { volume: 1 });
    play(DAMAGE_SOUNDS.doraRush, { volume: 0.5 });
    stains.splice(0).forEach((el) => {
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: REWIND_MS * 0.6,
        delay: REWIND_MS * 0.3,
        fill: "forwards",
      }).onfinish = () => el.remove();
    });

    // les DORA claquent sur ce qui est réparé
    const targets: Element[] = [...broken.keys()].filter(inView);
    if (ko.hits > 0 && mascot) targets.push(mascot);
    const spots = targets.map((t) => {
      const r = t.getBoundingClientRect();
      return () =>
        [
          rand(r.left + 10, r.right - 10),
          rand(Math.max(r.top, 0) + 10, Math.min(r.bottom, window.innerHeight) - 10),
        ] as const;
    });
    spots.push(() => [fx + rand(-60, 60), fy + rand(-60, 60)] as const);
    for (let t = 60; t < REWIND_MS; t += 90) {
      later(t, () => {
        const spot = spots[Math.floor(rand(0, spots.length))];
        if (!spot) return;
        const [x, y] = spot();
        word(x, y, "DORA", CD_PINK, 40);
      });
    }
    // les morceaux remontent et se recollent, la mascotte revole à sa place
    [...broken.values()].forEach((b) => restoreBox(b, true));
    if (ko.hits > 0) restoreMascot(true);
    screenCracks
      .splice(0)
      .forEach((el, i) => later(REWIND_MS * 0.55 + i * 120, () => closeCrack(el)));

    // « ドラァ ! » final, à la fin de la rafale de coups
    later(REWIND_MS + 60, () => {
      transient(
        "jojo-fx-final jojo-fx-kana",
        { left: `${fx}px`, top: `${fy}px`, color: CD_PINK },
        "ドラァ !",
      );
      transient("jojo-fx-ring jojo-fx-ring-cd", { left: `${fx}px`, top: `${fy}px` });
    });
    later(REWIND_MS + 450, () => {
      const r = cd.getBoundingClientRect();
      transient(
        "jojo-fx-bubble jojo-fx-bubble-cd jojo-fx-kana",
        {
          left: `${Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130)}px`,
          top: `${r.top + 20}px`,
        },
        "グレート !",
      );
    });
    later(REPAIR_MS - 400, () => {
      cd.classList.add("jojo-fx-leave");
      cd.addEventListener("animationend", () => cd.remove(), { once: true });
    });
    later(REPAIR_MS, () => {
      repairing = false;
      lastBox = null;
      if (again) {
        again = false;
        repair();
      }
    });
  }

  return { hit, damaged, repair, clear };
}
