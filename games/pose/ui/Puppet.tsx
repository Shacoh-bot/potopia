"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  absoluteAngles,
  BONES,
  layout,
  PELVIS,
  relativeFor,
  wrap,
  type Point,
  type Pose,
  type Segment,
} from "../src/skeleton";

// Ordre de dessin : jambes, tronc, bras, tête (les bras passent devant le tronc).
const DRAW_ORDER: Segment[] = [
  "thighL",
  "shinL",
  "thighR",
  "shinR",
  "torso",
  "upperArmL",
  "foreArmL",
  "upperArmR",
  "foreArmR",
  "head",
];

const WIDTH: Record<Segment, number> = {
  torso: 24,
  head: 9,
  upperArmL: 12,
  foreArmL: 11,
  upperArmR: 12,
  foreArmR: 11,
  thighL: 15,
  shinL: 13,
  thighR: 15,
  shinR: 13,
};

const HEAD_RADIUS = 21;

/**
 * Poignées : on attrape les articulations elles-mêmes. Une main ou un pied entraîne tout le
 * membre (cinématique inverse : le coude ou le genou se plie tout seul) ; un coude, un genou, le
 * haut du tronc ou la tête font pivoter leur segment.
 */
type Handle = {
  id: string;
  /** Segment dont la poignée est au bout. */
  segment: Segment;
  /** Pour une main ou un pied : le segment parent, plié par la cinématique inverse. */
  ik?: Segment;
};

// dans l'ordre de dessin : les mains et les pieds passent devant les coudes et les genoux
const HANDLES: Handle[] = [
  { id: "chest", segment: "torso" },
  { id: "kneeL", segment: "thighL" },
  { id: "kneeR", segment: "thighR" },
  { id: "elbowL", segment: "upperArmL" },
  { id: "elbowR", segment: "upperArmR" },
  { id: "footL", segment: "shinL", ik: "thighL" },
  { id: "footR", segment: "shinR", ik: "thighR" },
  { id: "handL", segment: "foreArmL", ik: "upperArmL" },
  { id: "handR", segment: "foreArmR", ik: "upperArmR" },
  { id: "head", segment: "head" },
];

/**
 * Saisie : au clic, la poignée la plus proche du pointeur dans ce rayon (à peine plus que la
 * poignée dessinée) ; sinon le membre sous le pointeur, selon son épaisseur réelle (+ cette
 * marge). Le plus proche gagne toujours, jamais celui qui est dessiné par-dessus.
 */
const HANDLE_HIT = 10;
const LIMB_MARGIN = 2;

/** Distance d'un point à un segment [a, b]. */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Angle absolu (0° = vers le haut, sens horaire) de `a` vers `b`. */
const angleTo = (a: Point, b: Point) => (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;

/** Centre de la tête (le segment de la tête va du cou au sommet du crâne). */
function headCenter(from: Point, to: Point): Point {
  const dx = (to.x - from.x) / BONES.head.length;
  const dy = (to.y - from.y) / BONES.head.length;
  return { x: to.x - dx * HEAD_RADIUS * 0.6, y: to.y - dy * HEAD_RADIUS * 0.6 };
}

/**
 * Cinématique inverse à deux os : plie `upper` et `lower` pour que le bout de `lower` aille au
 * plus près de `target`, en gardant le sens du pli actuel (un coude ne se retourne pas tout seul).
 */
function solveIk(pose: Pose, upper: Segment, lower: Segment, target: Point): Pose {
  const root = layout(pose)[upper].from;
  const l1 = BONES[upper].length;
  const l2 = BONES[lower].length;
  const d = Math.min(
    l1 + l2 - 0.01,
    Math.max(Math.abs(l1 - l2) + 0.5, Math.hypot(target.x - root.x, target.y - root.y)),
  );
  const toward = angleTo(root, target);
  const bend = pose.angle[lower] >= 0 ? 1 : -1;
  const open = (Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) * 180) / Math.PI;
  const upperAbs = toward - bend * open;
  const r = (upperAbs * Math.PI) / 180;
  const joint = { x: root.x + Math.sin(r) * l1, y: root.y - Math.cos(r) * l1 };
  return {
    ...pose,
    angle: {
      ...pose.angle,
      [upper]: relativeFor(pose, upper, upperAbs),
      [lower]: wrap(angleTo(joint, target) - upperAbs),
    },
  };
}

function Bones({
  pose,
  className,
  active,
}: {
  pose: Pose;
  className: string;
  active?: Segment | null;
}) {
  const parts = layout(pose);
  return (
    <g className={className}>
      {DRAW_ORDER.map((s) => {
        const { from, to } = parts[s];
        const cls = s === active ? "pose-seg pose-seg-active" : "pose-seg";
        if (s === "head") {
          const c = headCenter(from, to);
          return (
            <g key={s} className={cls}>
              <line x1={from.x} y1={from.y} x2={c.x} y2={c.y} strokeWidth={WIDTH.head} />
              <circle cx={c.x} cy={c.y} r={HEAD_RADIUS} />
            </g>
          );
        }
        return (
          <g key={s} className={cls}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={WIDTH[s]} />
          </g>
        );
      })}
      <circle className="pose-pelvis" cx={PELVIS.x} cy={PELVIS.y} r={9} />
    </g>
  );
}

type Props = {
  pose: Pose;
  onChange?: (pose: Pose) => void;
  /** Pose attendue, dessinée en fantôme (après la validation). */
  ghost?: Pose | null;
  /** Image calée derrière le pantin (mode éditeur). */
  backdrop?: { src: string; x: number; y: number; scale: number; opacity: number } | null;
};

/**
 * Pantin articulé en SVG, qu'on manipule à la souris ou au doigt, par ses membres ou par ses
 * articulations : une main ou un pied suit le pointeur et le bras ou la jambe se plie tout seul ;
 * un membre, un coude, un genou, le haut du tronc ou la tête font pivoter leur segment, en
 * emportant ce qui y est attaché. Il reste exactement là où on le
 * lâche.
 */
export function Puppet({ pose, onChange, ghost, backdrop }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<Handle | null>(null);

  const toLocal = (e: { clientX: number; clientY: number }): Point | null => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const grab = (handle: Handle, e: ReactPointerEvent<SVGElement>) => {
    e.preventDefault();
    svg.current?.setPointerCapture(e.pointerId);
    setActive(handle);
  };

  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!active || !onChange) return;
    const p = toLocal(e);
    if (!p) return;
    if (active.ik) {
      onChange(solveIk(pose, active.ik, active.segment, p));
      return;
    }
    const seg = active.segment;
    const rel = relativeFor(pose, seg, angleTo(layout(pose)[seg].from, p));
    onChange({ ...pose, angle: { ...pose.angle, [seg]: rel } });
  };

  const release = () => setActive(null);

  const parts = layout(pose);
  const abs = absoluteAngles(pose.angle);
  const handleAt = (h: Handle): Point => {
    const { from, to } = parts[h.segment];
    if (h.segment === "head") return headCenter(from, to);
    // le haut du tronc : un peu sous le cou, pour ne pas chevaucher la tête
    if (h.segment === "torso") {
      const r = (abs.torso * Math.PI) / 180;
      return { x: to.x - Math.sin(r) * 14, y: to.y + Math.cos(r) * 14 };
    }
    return to;
  };

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!onChange) return;
    const p = toLocal(e);
    if (!p) return;
    let best: { handle: Handle; d: number } | null = null;
    for (const h of HANDLES) {
      const at = handleAt(h);
      const d = Math.hypot(p.x - at.x, p.y - at.y);
      if (d <= HANDLE_HIT && (!best || d < best.d)) best = { handle: h, d };
    }
    if (!best) {
      // pas de poignée : le membre sous le pointeur (les plus proches de l'avant d'abord)
      for (const s of [...DRAW_ORDER].reverse()) {
        const { from, to } = parts[s];
        const d =
          s === "head"
            ? Math.hypot(p.x - headCenter(from, to).x, p.y - headCenter(from, to).y) - HEAD_RADIUS
            : distanceToSegment(p, from, to) - WIDTH[s] / 2;
        if (d <= LIMB_MARGIN && (!best || d < best.d)) best = { handle: { id: s, segment: s }, d };
      }
    }
    if (best) grab(best.handle, e);
  };

  return (
    <svg
      ref={svg}
      viewBox="0 0 300 400"
      className={onChange ? "pose-puppet pose-puppet-live" : "pose-puppet"}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {backdrop && (
        <image
          href={backdrop.src}
          x={backdrop.x}
          y={backdrop.y}
          width={300 * backdrop.scale}
          height={400 * backdrop.scale}
          opacity={backdrop.opacity}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <ellipse className="pose-shadow" cx={150} cy={372} rx={70} ry={9} />
      <Bones pose={pose} className="pose-body" active={active?.segment ?? null} />
      {ghost && <Bones pose={ghost} className="pose-ghost" />}
      {onChange &&
        HANDLES.map((h) => {
          const at = handleAt(h);
          const kind = h.ik ? "pose-handle pose-handle-end" : "pose-handle";
          return (
            <circle
              key={h.id}
              className={active?.id === h.id ? `${kind} pose-handle-active` : kind}
              cx={at.x}
              cy={at.y}
              r={h.ik ? 7.5 : 6}
            />
          );
        })}
    </svg>
  );
}
