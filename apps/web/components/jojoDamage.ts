/*
 * Dégâts de la rafale de Star Platinum (thème JoJo, `JojoFx`) et leur réparation par Crazy Diamond.
 * - La case frappée tremble pour de bon (la case entière, pas seulement son contenu), sans jamais
 *   déborder de la zone qui la contient : aucune barre de défilement n'apparaît.
 * - Les coups la fissurent : des fêlures en étoile, dessinées au hasard autour du point d'impact.
 * - Les petits éléments du header encaissent aussi : Sonic perd ses anneaux, les coups rebondissent
 *   sur Luffy (il est en caoutchouc), la steel ball tourne sur elle-même, les boutons valsent.
 * - La mascotte : sonnée (yeux fermés), puis sa couronne saute, puis elle est envoyée dans le bord
 *   de l'écran, qui se fissure, et elle y reste incrustée.
 * - Après la rafale, Crazy Diamond (le Stand de Josuke) surgit, « DORARARA », et tout revient à sa
 *   place : les fêlures se referment, la mascotte revole à sa place, sa couronne aussi. « グレート ! »
 * Tout passe par le DOM et l'API Web Animations (aucun état React) : fêlures en SVG dans la case
 * frappée, effets dans la couche `.jojo-fx`. Animations en transform et opacity.
 */

const CRACK_EVERY_MS = 320; // une fêlure de plus au plus toutes les 320 ms par case
const CRACKS_PER_BOX = 9;
const CRACK_SPACING = 46; // en dessous, on ne refissure pas au même endroit
const DAZED_AT = 4; // coups sur la mascotte : yeux fermés
const CROWN_AT = 8; // … sa couronne saute
const LAUNCH_AT = 14; // … envoyée dans le décor
const SMALL_EVERY_MS = 160; // un petit élément ne réagit pas à chaque coup
const RING_EVERY_MS = 650; // Sonic perd des anneaux au plus toutes les 650 ms
const REPAIR_MS = 2900; // durée de la réparation par Crazy Diamond
const CD_PINK = "#ff8fc8";
const HUD = ".jojo-fx, .jojo-decor, .jojo-fx-hint";

export const DAMAGE_SOUNDS = {
  doraRush: "/audio/jojo-dora-rush.mp3",
  dora: "/audio/jojo-dora.mp3",
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
  /** Il reste quelque chose à réparer. */
  damaged: () => boolean;
  /** Crazy Diamond répare tout (sans effet s'il n'y a rien, ou s'il répare déjà). */
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
  type Box = {
    host: HTMLElement;
    cracks: { el: SVGSVGElement; x: number; y: number }[];
    last: number;
  };
  const boxes = new Map<Element, Box>();
  const screenCracks: SVGSVGElement[] = [];
  /** Dernière case fissurée : c'est là que Crazy Diamond apparaît. */
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

  const crack = (box: Element, x: number, y: number, big: boolean) => {
    const now = performance.now();
    let entry = boxes.get(box);
    if (!big && entry && now - entry.last < CRACK_EVERY_MS) return;
    if (!entry) {
      const host = document.createElement("span");
      host.className = "jojo-cracks";
      host.setAttribute("aria-hidden", "true");
      box.append(host);
      entry = { host, cracks: [], last: 0 };
      boxes.set(box, entry);
    }
    const r = box.getBoundingClientRect();
    const lx = x - r.left;
    const ly = y - r.top;
    const close = entry.cracks.some((c) => Math.hypot(c.x - lx, c.y - ly) < CRACK_SPACING);
    if (!big && (close || entry.cracks.length >= CRACKS_PER_BOX)) return;
    entry.last = now;
    const size = big ? rand(110, 150) : rand(45, 80);
    const el = crackElement(lx, ly, size, "jojo-crack");
    entry.host.append(el);
    entry.cracks.push({ el, x: lx, y: ly });
    lastBox = box;
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
  type Ko = { hits: number; body?: Animation; crown?: Animation; lids: Animation[] };
  let ko: Ko = { hits: 0, lids: [] };
  const mascotParts = (btn: Element) => ({
    inner: btn.querySelector(".mascot"),
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
    const { inner, crown, lids } = mascotParts(btn);
    if (!inner) return;
    ko.hits += final ? LAUNCH_AT : 1;
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
    const top = document.elementsFromPoint(x, y).find((e) => !e.closest(HUD));
    if (!top) return;
    const target = top.closest<HTMLElement>("[data-ora]");
    if (target?.dataset.ora === "mascot") return mascotHit(target, x, y, final);
    if (target) return small(target, target.dataset.ora ?? null);
    const headerItem = top.closest("header button, header a");
    if (headerItem) return small(headerItem, null);
    const box = top.closest(".theme-frame");
    if (!box) return;
    jolt(box, final ? 9 : 5, final ? 420 : 140);
    crack(box, x, y, final);
  };

  const damaged = () => boxes.size > 0 || screenCracks.length > 0 || ko.hits > 0;

  /** Remet la mascotte : la couronne et le corps refont le chemin à l'envers. */
  const restoreMascot = (animated: boolean) => {
    const parts = [ko.body, ko.crown, ...ko.lids].filter((a): a is Animation => !!a);
    ko = { hits: 0, lids: [] };
    for (const a of parts) {
      if (!animated || reducedMotion()) {
        a.cancel();
        continue;
      }
      a.onfinish = () => a.cancel();
      a.updatePlaybackRate(1.6);
      a.reverse();
    }
  };
  const closeCrack = (el: SVGSVGElement, animated: boolean, after?: () => void) => {
    if (!animated || reducedMotion()) {
      el.remove();
      after?.();
      return;
    }
    el.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(0)", opacity: 0 },
      ],
      { duration: 320, easing: "ease-in", fill: "forwards" },
    ).onfinish = () => {
      el.remove();
      after?.();
    };
  };

  const clear = () => {
    for (const { host } of boxes.values()) host.remove();
    boxes.clear();
    for (const el of screenCracks.splice(0)) el.remove();
    restoreMascot(false);
    lastBox = null;
  };

  // ── Crazy Diamond ──
  let repairing = false;
  const inView = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  };
  const repair = () => {
    if (repairing || !damaged()) return;
    repairing = true;
    const mascot = document.querySelector<HTMLElement>('[data-ora="mascot"]');
    // Crazy Diamond apparaît à côté de la dernière case fissurée, sinon de la mascotte
    const focus =
      (lastBox && inView(lastBox) ? lastBox : null) ??
      (ko.body && mascot ? mascot : null) ??
      [...boxes.keys()].find(inView) ??
      null;
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
    play(DAMAGE_SOUNDS.doraRush, { volume: 0.9 });

    // les DORA claquent sur tout ce qui est réparé
    const spots = [
      ...[...boxes.keys()].filter(inView).map((b) => {
        const r = b.getBoundingClientRect();
        return () =>
          [
            rand(r.left + 20, r.right - 20),
            rand(Math.max(r.top, 0) + 20, Math.min(r.bottom, window.innerHeight) - 20),
          ] as const;
      }),
      () => [fx + rand(-60, 60), fy + rand(-60, 60)] as const,
    ];
    for (let t = 120; t < 1400; t += 95) {
      later(t, () => {
        const spot = spots[Math.floor(rand(0, spots.length))];
        if (!spot) return;
        const [x, y] = spot();
        word(x, y, "DORA", CD_PINK, 40);
      });
    }
    // les fêlures se referment une à une, la mascotte revole à sa place
    const all = [...boxes.values()].flatMap((b) => b.cracks.map((c) => ({ box: b, el: c.el })));
    all.forEach(({ box, el }, i) => {
      later(200 + Math.min(i * 70, 1000), () =>
        closeCrack(el, true, () => {
          if (box.host.childElementCount === 0) box.host.remove();
        }),
      );
    });
    const screen = screenCracks.splice(0);
    screen.forEach((el, i) => later(500 + i * 120, () => closeCrack(el, true)));
    later(350, () => restoreMascot(true));
    later(1250, () => {
      boxes.clear();
      lastBox = null;
    });

    // « ドラァ ! » final, et l'éclat de ce qui est comme neuf
    later(1450, () => {
      play(DAMAGE_SOUNDS.dora, { volume: 1 });
      transient(
        "jojo-fx-final jojo-fx-kana",
        { left: `${fx}px`, top: `${fy}px`, color: CD_PINK },
        "ドラァ !",
      );
      transient("jojo-fx-ring jojo-fx-ring-cd", { left: `${fx}px`, top: `${fy}px` });
    });
    later(2000, () => {
      const r = cd.getBoundingClientRect();
      transient(
        "jojo-fx-bubble jojo-fx-bubble-cd",
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
    });
  };

  return { hit, damaged, repair, clear };
}
