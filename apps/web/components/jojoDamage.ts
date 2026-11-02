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
 * frappée, morceaux et effets dans la couche `.jojo-fx`. Animations en transform et opacity.
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
const INJURIES: readonly (readonly [number, string])[] = [
  [10, "bruise"],
  [22, "bandage"],
  [34, "bruise-chin"],
  [52, "bump"],
  [64, "black-eye"],
  [76, "bandage-cheek"],
  [88, "swelling"],
  [100, "dizzy"],
];
const SMALL_EVERY_MS = 160; // un petit élément ne réagit pas à chaque coup
const RING_EVERY_MS = 650; // Sonic perd des anneaux au plus toutes les 650 ms
const REPAIR_MS = 4300; // durée de la réparation par Crazy Diamond
const CD_PINK = "#ff8fc8";
const HUD = ".jojo-fx, .jojo-decor, .jojo-fx-hint";

export const DAMAGE_SOUNDS = {
  glass: "/audio/jojo-glass.mp3",
  restore: "/audio/jojo-cd-restore.mp3",
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

/**
 * Morceaux d'une case de w × h brisée le long de sa fissure principale (ses deux troncs, partis du
 * même point) : la fissure, prolongée jusqu'aux bords gauche et droit, coupe la case en deux ; des
 * lignes brisées partent de points de la fissure vers le haut et vers le bas et découpent chaque
 * moitié. Polygones en px, qui couvrent toute la case sans se chevaucher.
 */
function crackShards(w: number, h: number, a: Point[], b: Point[], cuts: number): Point[][] {
  // la fissure de gauche à droite : le tronc qui finit le plus à gauche, retourné, puis l'autre
  const aEnd = a[a.length - 1] ?? [0, 0];
  const bEnd = b[b.length - 1] ?? [0, 0];
  const [left, right] = aEnd[0] <= bEnd[0] ? [a, b] : [b, a];
  const line: Point[] = [...[...left].reverse(), ...right.slice(1)].map(([x, y]) => [
    Math.min(Math.max(x, 0), w),
    Math.min(Math.max(y, 1), h - 1),
  ]);
  const first = line[0] ?? [0, h / 2];
  const last = line[line.length - 1] ?? [w, h / 2];
  if (first[0] > 0) line.unshift([0, first[1]]);
  if (last[0] < w) line.push([w, last[1]]);
  // tour de la case (sens horaire depuis le coin haut gauche), compté à partir du bout gauche
  const P = 2 * (w + h);
  const around = ([x, y]: Point) => {
    const t =
      y <= 0.5 ? x : x >= w - 0.5 ? w + y : y >= h - 0.5 ? w + h + (w - x) : 2 * w + h + (h - y);
    return (t - (2 * w + h + (h - (line[0]?.[1] ?? 0))) + 2 * P) % P;
  };
  const corners: Point[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const cornersBetween = (from: number, to: number) =>
    corners
      .map((c) => ({ c, t: around(c) }))
      .filter(({ t }) => t > Math.min(from, to) && t < Math.max(from, to))
      .sort((u, v) => (from < to ? u.t - v.t : v.t - u.t))
      .map(({ c }) => c);
  // points de départ des découpes, répartis le long de la fissure
  const picks = Array.from({ length: cuts }, (_, i) =>
    Math.round(((i + 1) / (cuts + 1)) * (line.length - 1)),
  ).filter((v, i, all) => v > 0 && v < line.length - 1 && all.indexOf(v) === i);
  const spread = (w / (picks.length + 1)) * 0.3;
  // ligne brisée d'un point de la fissure jusqu'au bord haut (ou bas)
  const toEdge = ([x, y]: Point, edge: number): Point[] => {
    const pts: Point[] = [[x, y]];
    for (const k of [0.35, 0.7]) {
      pts.push([
        Math.min(Math.max(x + rand(-spread, spread), 1), w - 1),
        y + (edge - y) * k + rand(-4, 4),
      ]);
    }
    pts.push([Math.min(Math.max(x + rand(-spread, spread), 1), w - 1), edge]);
    return pts;
  };
  const ups = picks.map((i) => toEdge(line[i] ?? [0, 0], 0));
  const downs = picks.map((i) => toEdge(line[i] ?? [0, 0], h));
  const edges = [0, ...picks, line.length - 1];
  const polys: Point[][] = [];
  for (let k = 0; k + 1 < edges.length; k++) {
    const i = edges[k] ?? 0;
    const j = edges[k + 1] ?? 0;
    const crack = line.slice(i, j + 1);
    // au-dessus de la fissure : on remonte par la découpe de droite, on revient par le haut
    const upI = k === 0 ? [line[0] ?? [0, 0]] : (ups[k - 1] ?? []);
    const upJ = k + 1 === edges.length - 1 ? [line[j] ?? [w, 0]] : (ups[k] ?? []);
    const topI = around(upI[upI.length - 1] ?? [0, 0]);
    const topJ = around(upJ[upJ.length - 1] ?? [0, 0]);
    polys.push([
      ...crack,
      ...upJ.slice(1),
      ...cornersBetween(topJ, topI),
      ...[...upI].reverse().slice(0, -1),
    ]);
    // en dessous : on descend par la découpe de droite, on revient par le bas
    const downI = k === 0 ? [line[0] ?? [0, 0]] : (downs[k - 1] ?? []);
    const downJ = k + 1 === edges.length - 1 ? [line[j] ?? [w, 0]] : (downs[k] ?? []);
    const botI = k === 0 ? P : around(downI[downI.length - 1] ?? [0, 0]);
    const botJ = around(downJ[downJ.length - 1] ?? [0, 0]);
    polys.push([
      ...crack,
      ...downJ.slice(1),
      ...cornersBetween(botJ, botI),
      ...[...downI].reverse().slice(0, -1),
    ]);
  }
  return polys;
}

/** Première zone qui coupe ce qui déborde (défilement ou overflow), ou null : la page elle-même. */
function clipParent(el: Element): Element | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(p);
    if (/auto|scroll|hidden|clip/.test(overflowX + overflowY)) return p;
  }
  return null;
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

export function createDamage(env: Env): Damage {
  const { layer, transient, spawn, word, play, later, quake, reducedMotion } = env;

  // ── Les cases ──
  /** Un trait de la fissure principale (tronc ou ramification) : ses points, ses deux tracés. */
  type Branch = { paths: SVGPathElement[]; pts: Point[] };
  /** Un tronc : il part du premier coup vers un bord, et avance par à-coups. */
  type Trunk = Branch & { cap: number; reach: number; length: number; dev: number };
  type MainCrack = {
    svg: SVGSVGElement;
    origin: Point;
    trunks: [Trunk, Trunk];
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

  /** La case tremble, dans la limite de la place qu'elle a autour d'elle. */
  const jolt = (el: Element, power: number, ms: number) => {
    if (reducedMotion()) return;
    const space = room(el);
    const free = (gap: number) => Math.max(0, Math.min(power, gap));
    const clampX = (v: number) => Math.max(-free(space.left), Math.min(v, free(space.right)));
    const clampY = (v: number) => Math.max(-free(space.top), Math.min(v, free(space.bottom)));
    const frames = Array.from({ length: 6 }, (_, i) => ({
      transform:
        i === 5
          ? "none"
          : `translate(${clampX(rand(-power, power)).toFixed(1)}px, ${clampY(rand(-power, power)).toFixed(1)}px)`,
    }));
    el.animate(frames, { duration: ms, composite: "add" });
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
    if (main.twigs >= 70) return;
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
  /**
   * La fissure principale encaisse un coup. Comme une vraie fissure, elle ne grandit pas d'un peu à
   * chaque coup : la tension monte, puis elle cède d'un coup, un bond en avant à angles vifs, qui
   * lâche des ramifications (de plus en plus, à mesure que la case s'use). Ses deux troncs
   * atteignent les bords vers 80 % de l'usure ; une étoile s'élargit autour du point de départ.
   * Renvoie true si elle vient de bondir (la case tremble alors plus fort).
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
      const origin: Point = [
        Math.min(Math.max(x - r.left, 10), w - 10),
        Math.min(Math.max(y - r.top, 10), h - 10),
      ];
      // les deux troncs partent dans des directions opposées, en travers de la case
      const cap = Math.atan2(h * rand(-0.35, 0.35), w);
      // distance jusqu'au bord gauche ou droit, en suivant le cap
      const reach = (a: number) =>
        (Math.cos(a) > 0 ? w - origin[0] : origin[0]) / Math.max(Math.abs(Math.cos(a)), 0.5);
      const trunk = (a: number): Trunk => ({
        ...stroke(svg, origin, false),
        cap: a,
        reach: reach(a),
        length: 0,
        dev: 0,
      });
      entry.main = { svg, origin, trunks: [trunk(cap), trunk(cap + Math.PI)], twigs: 0, webs: 0 };
    }
    const main = entry.main;
    const wear = wearOf(entry);
    let burst = false;
    for (const t of main.trunks) {
      const last = t.pts[t.pts.length - 1] ?? main.origin;
      // arrivé au bord gauche ou droit : il a traversé la case
      if (last[0] <= 0 || last[0] >= w) continue;
      // longueur qu'il « devrait » avoir : il ne bouge pas tant que le retard est faible…
      const target = t.reach * Math.min(1, wear / 0.8);
      if (target - t.length < t.reach * rand(0.07, 0.2)) continue;
      // … puis il bondit, et dépasse un peu
      burst = true;
      const goal = Math.min(t.reach * 1.05, target + t.reach * rand(0, 0.06));
      let [px, py] = last;
      while (t.length < goal) {
        // cap gardé à peu près (jamais en arrière), avec des cassures vives
        t.dev = Math.max(
          -0.6,
          Math.min(0.6, t.dev * 0.5 + (Math.random() < 0.3 ? rand(-0.7, 0.7) : rand(-0.22, 0.22))),
        );
        // trop près du haut ou du bas de la case : la cassure repart vers le milieu
        const toward = Math.sin(t.cap + t.dev) < 0 ? -1 : 1; // -1 : vers le haut
        if ((py < 26 && toward < 0) || (py > h - 26 && toward > 0)) t.dev = -t.dev;
        const a = t.cap + t.dev;
        const seg = rand(9, 20);
        px = Math.min(Math.max(px + Math.cos(a) * seg, 0), w);
        py = Math.min(Math.max(py + Math.sin(a) * seg, 0), h);
        t.pts.push([px, py]);
        t.length += seg;
        // les ramifications partent des cassures, de plus en plus nombreuses
        if (Math.random() < 0.12 + wear * 0.3) {
          const side = Math.random() < 0.5 ? -1 : 1;
          twig(
            main,
            w,
            h,
            [px, py],
            a + side * rand(0.5, 1.3),
            t.reach * rand(0.08, 0.22) * (0.5 + wear),
            0,
          );
        }
        if (px <= 0 || px >= w) break;
      }
      redraw(t);
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
    if (growMain(box, current, x, y) && !reducedMotion()) jolt(box, 6 + wearOf(current) * 8, 220);
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
   * La case vole en éclats : elle est masquée (sa place reste dans la page), et des copies d'elle,
   * chacune découpée selon un morceau (clip-path), partent du point d'impact et retombent.
   * Crazy Diamond arrive peu après.
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
    const [ta, tb] = entry?.main?.trunks ?? [];
    const polys =
      ta && tb && ta.pts.length + tb.pts.length > 4
        ? crackShards(r.width, r.height, ta.pts, tb.pts, r.width * r.height > 300_000 ? 3 : 4)
        : shardPolygons(r.width, r.height, lx, ly, r.width * r.height > 300_000 ? 6 : 9);
    const canvases = [...box.querySelectorAll("canvas")];
    const flights = polys.map((poly) => {
      const piece = document.createElement("div");
      piece.className = "jojo-fx-shard";
      const copy = box.cloneNode(true) as HTMLElement;
      copy.setAttribute("aria-hidden", "true");
      copy.inert = true;
      copy.removeAttribute("id");
      Object.assign(copy.style, {
        position: "absolute",
        left: "0",
        top: "0",
        margin: "0",
        width: `${r.width}px`,
        height: `${r.height}px`,
        visibility: "visible",
        // une animation d'entrée de la case (apparition en fondu…) ne doit pas se rejouer
        animation: "none",
        transition: "none",
      });
      // le contenu des canvas ne se copie pas avec le DOM
      copy.querySelectorAll("canvas").forEach((c, i) => {
        const from = canvases[i];
        if (from && from.width > 0 && from.height > 0) c.getContext("2d")?.drawImage(from, 0, 0);
      });
      piece.style.clipPath = `polygon(${poly
        .map(([px, py]) => `${px.toFixed(1)}px ${py.toFixed(1)}px`)
        .join(", ")})`;
      const cx = poly.reduce((sum, p) => sum + p[0], 0) / poly.length;
      const cy = poly.reduce((sum, p) => sum + p[1], 0) / poly.length;
      piece.style.transformOrigin = `${cx}px ${cy}px`;
      piece.append(copy);
      shards.append(piece);
      // chaque morceau s'écarte du point d'impact, tourne, et tombe
      const dx = cx - lx;
      const dy = cy - ly;
      const len = Math.hypot(dx, dy) || 1;
      const push = rand(50, 160);
      const fx = (dx / len) * push;
      const fy = (dy / len) * push;
      const spin = rand(-70, 70);
      return piece.animate(
        [
          { transform: "translate(0, 0) rotate(0)", opacity: 1 },
          {
            transform: `translate(${fx * 0.5}px, ${fy * 0.5 - 18}px) rotate(${spin * 0.3}deg)`,
            opacity: 1,
            offset: 0.22,
          },
          {
            transform: `translate(${fx}px, ${fy + rand(380, 640)}px) rotate(${spin}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: reducedMotion() ? 1 : rand(950, 1300),
          easing: "cubic-bezier(0.4, 0, 0.9, 0.6)",
          fill: "forwards",
        },
      );
    });
    // la case elle-même disparaît, avec ses fêlures (elles restent dans les morceaux)
    box.style.visibility = "hidden";
    if (entry) {
      entry.host.remove();
      boxes.delete(box);
    }
    broken.set(box, { el: box, shards, flights });
    lastBox = box;
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
      all.append(hurt);
      ko.hurts.push(hurt);
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

  const damaged = () => broken.size > 0 || screenCracks.length > 0 || ko.hits > 0;

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
    // tout part en même temps : il sort, le son de ses coups, ses coups, et le rembobinage
    play(DAMAGE_SOUNDS.restore, { volume: 1 });

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
