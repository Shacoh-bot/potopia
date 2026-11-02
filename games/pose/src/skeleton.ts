/**
 * Squelette du pantin : 10 segments rigides articulés. Chaque segment part d'une articulation de
 * son parent et a un angle relatif à lui (en degrés) ; l'angle absolu d'un segment est la somme
 * des angles de ses ancêtres et du sien. Convention : 0° = vers le haut, sens horaire positif
 * (repère SVG, y vers le bas). Le bassin est fixe : le tronc et les cuisses en partent.
 */

export const SEGMENTS = [
  "torso",
  "head",
  "upperArmL",
  "foreArmL",
  "upperArmR",
  "foreArmR",
  "thighL",
  "shinL",
  "thighR",
  "shinR",
] as const;

export type Segment = (typeof SEGMENTS)[number];

/** Une valeur par segment : angles en degrés. */
export type Angles = Record<Segment, number>;

/** Pose du pantin : angle relatif de chaque segment. */
export type Pose = { angle: Angles };

type Bone = {
  parent: Segment | null;
  /** Longueur du segment, en unités du dessin (viewBox 300 × 400). */
  length: number;
  /** Point d'attache sur le parent : fraction de sa longueur et décalage perpendiculaire. */
  at: number;
  side: number;
};

// L = à gauche de l'écran, R = à droite (le pantin est vu de face).
export const BONES: Record<Segment, Bone> = {
  torso: { parent: null, length: 92, at: 0, side: 0 },
  head: { parent: "torso", length: 40, at: 1, side: 0 },
  upperArmL: { parent: "torso", length: 58, at: 0.9, side: -20 },
  foreArmL: { parent: "upperArmL", length: 54, at: 1, side: 0 },
  upperArmR: { parent: "torso", length: 58, at: 0.9, side: 20 },
  foreArmR: { parent: "upperArmR", length: 54, at: 1, side: 0 },
  thighL: { parent: null, length: 74, at: 0, side: -15 },
  shinL: { parent: "thighL", length: 72, at: 1, side: 0 },
  thighR: { parent: null, length: 74, at: 0, side: 15 },
  shinR: { parent: "thighR", length: 72, at: 1, side: 0 },
};

/** Bassin : origine du tronc et des cuisses. */
export const PELVIS = { x: 150, y: 215 };

/** Pose de départ : debout, bras le long du corps. */
export const REST_POSE: Pose = {
  angle: {
    torso: 0,
    head: 0,
    upperArmL: -165,
    // léger pli de départ : il donne le sens dans lequel le coude se plie quand on tire la main
    // (vers l'extérieur)
    foreArmL: -8,
    upperArmR: 165,
    foreArmR: 8,
    thighL: -176,
    shinL: -2,
    thighR: 176,
    shinR: 2,
  },
};

/** Ramène un angle dans ]-180, 180]. */
export function wrap(deg: number): number {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a === 0 ? 180 : a - 180;
}

/** Angles absolus de tous les segments. */
export function absoluteAngles(angle: Angles): Angles {
  const abs = {} as Angles;
  for (const s of SEGMENTS) {
    const parent = BONES[s].parent;
    abs[s] = wrap((parent ? abs[parent] : 0) + angle[s]);
  }
  return abs;
}

/** Angle relatif qui donne l'angle absolu voulu, compte tenu des parents. */
export function relativeFor(pose: Pose, segment: Segment, absolute: number): number {
  const parent = BONES[segment].parent;
  return wrap(absolute - (parent ? absoluteAngles(pose.angle)[parent] : 0));
}

export type Point = { x: number; y: number };

/** Direction d'un angle absolu (vecteur unitaire). */
export const direction = (deg: number): Point => {
  const r = (deg * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
};

/** Début et fin de chaque segment, en coordonnées du dessin. */
export function layout(pose: Pose): Record<Segment, { from: Point; to: Point; angle: number }> {
  const abs = absoluteAngles(pose.angle);
  const out = {} as Record<Segment, { from: Point; to: Point; angle: number }>;
  for (const s of SEGMENTS) {
    const bone = BONES[s];
    let from: Point;
    if (!bone.parent) {
      from = { x: PELVIS.x + bone.side, y: PELVIS.y };
    } else {
      const p = out[bone.parent];
      const d = direction(abs[bone.parent]);
      // décalage perpendiculaire (épaules), dans le repère du parent
      from = {
        x: p.from.x + (p.to.x - p.from.x) * bone.at - d.y * bone.side,
        y: p.from.y + (p.to.y - p.from.y) * bone.at + d.x * bone.side,
      };
    }
    const d = direction(abs[s]);
    out[s] = {
      from,
      to: { x: from.x + d.x * bone.length, y: from.y + d.y * bone.length },
      angle: abs[s],
    };
  }
  return out;
}
