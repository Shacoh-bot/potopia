import { REST_POSE, SEGMENTS, wrap, type Pose, type Segment } from "./skeleton";

/**
 * Ce qui est jugé : l'angle de chaque articulation, tel qu'on le voit sur l'image. Chaque angle est
 * relatif à son parent (`angle[s]` du squelette) : l'inclinaison du tronc, la tête par rapport au
 * tronc, l'épaule (le bras par rapport au tronc), le coude (l'avant-bras par rapport au bras), la
 * hanche (la cuisse, depuis le bassin) et le genou (la jambe par rapport à la cuisse). Un tronc
 * mal penché ne fausse donc pas les bras.
 */
const JOINTS: { segment: Segment; name: string; weight: number }[] = [
  { segment: "torso", name: "tronc", weight: 1.5 },
  { segment: "head", name: "tête", weight: 0.5 },
  { segment: "upperArmL", name: "épaule gauche", weight: 1 },
  { segment: "foreArmL", name: "coude gauche", weight: 1 },
  { segment: "upperArmR", name: "épaule droite", weight: 1 },
  { segment: "foreArmR", name: "coude droit", weight: 1 },
  { segment: "thighL", name: "hanche gauche", weight: 1 },
  { segment: "shinL", name: "genou gauche", weight: 1 },
  { segment: "thighR", name: "hanche droite", weight: 1 },
  { segment: "shinR", name: "genou droit", weight: 1 },
];

/** Écart d'angle toléré sans perte, et écart au-delà duquel l'articulation ne rapporte plus rien. */
const FREE_DEG = 15;
const ZERO_DEG = 60;

/**
 * Une articulation que la pose debout met déjà à moins de STILL_DEG de la cible n'a pas à bouger :
 * elle ne rapporte rien, mais la plier à tort coûte jusqu'à STILL_COST du score.
 */
const STILL_DEG = 25;
const STILL_COST = 0.4;

const MIRROR: Record<Segment, Segment> = {
  torso: "torso",
  head: "head",
  upperArmL: "upperArmR",
  foreArmL: "foreArmR",
  upperArmR: "upperArmL",
  foreArmR: "foreArmL",
  thighL: "thighR",
  shinL: "shinR",
  thighR: "thighL",
  shinR: "shinL",
};

/** La même pose vue dans un miroir : gauche et droite échangées, angles inversés. */
export function mirrorPose(pose: Pose): Pose {
  const angle = { ...pose.angle };
  for (const s of SEGMENTS) angle[MIRROR[s]] = wrap(-pose.angle[s]);
  return { angle };
}

export type JointScore = {
  segment: Segment;
  name: string;
  /** L'articulation doit changer pour cette pose (sinon, elle doit rester comme debout). */
  moves: boolean;
  /** Écart d'angle avec la cible, en degrés. */
  diff: number;
  score: number;
};

const gap = (a: number, b: number) => Math.abs(wrap(a - b));

/**
 * Score (0 à 1) d'une pose contre une cible. Chaque articulation que la pose demande de changer
 * est notée sur le chemin parcouru depuis la pose debout jusqu'à la cible (0 sans bouger, 1
 * arrivé à moins de FREE_DEG) ; leur moyenne pondérée fait le score. Celles qui n'ont pas à
 * changer ne rapportent rien, mais les plier à tort retire jusqu'à STILL_COST.
 */
function compare(player: Pose, target: Pose): { total: number; parts: JointScore[] } {
  let moved = 0;
  let movedWeights = 0;
  let still = 0;
  let stillWeights = 0;
  const parts = JOINTS.map(({ segment, name, weight }) => {
    const diff = gap(player.angle[segment], target.angle[segment]);
    const restDiff = gap(REST_POSE.angle[segment], target.angle[segment]);
    const moves = restDiff > STILL_DEG;
    if (moves) {
      const score = Math.min(1, Math.max(0, (restDiff - diff) / (restDiff - FREE_DEG)));
      moved += score * weight;
      movedWeights += weight;
      return { segment, name, moves, diff, score };
    }
    const score = Math.min(1, Math.max(0, 1 - (diff - FREE_DEG) / (ZERO_DEG - FREE_DEG)));
    still += score * weight;
    stillWeights += weight;
    return { segment, name, moves, diff, score };
  });
  const progress = movedWeights ? moved / movedWeights : 1;
  const kept = stillWeights ? still / stillWeights : 1;
  return { total: progress * (1 - STILL_COST * (1 - kept)), parts };
}

export type PoseScore = {
  /** Ressemblance, de 0 à 100. */
  percent: number;
  /** La pose a été reproduite en miroir (gauche et droite échangées). */
  mirrored: boolean;
  parts: JointScore[];
};

/**
 * Ressemblance entre la pose du joueur et la pose cible, articulation par articulation (voir
 * JOINTS et compare). Le pantin qu'on n'a pas touché vaut 0 %. La pose en miroir compte aussi :
 * on garde la meilleure des deux.
 */
export function scorePose(player: Pose, target: Pose): PoseScore {
  const straight = compare(player, target);
  const mirrored = compare(player, mirrorPose(target));
  const best = mirrored.total > straight.total ? mirrored : straight;
  return {
    percent: Math.round(best.total * 100),
    mirrored: best === mirrored,
    parts: best.parts,
  };
}

/** Note façon fiche de Stand : A (parfait) à E. */
export function grade(percent: number): "A" | "B" | "C" | "D" | "E" {
  if (percent >= 90) return "A";
  if (percent >= 75) return "B";
  if (percent >= 60) return "C";
  if (percent >= 40) return "D";
  return "E";
}
