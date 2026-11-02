import { describe, expect, it } from "vitest";
import { POSES, targetPose } from "../src/poses";
import { grade, mirrorPose, scorePose } from "../src/score";
import {
  absoluteAngles,
  layout,
  relativeFor,
  REST_POSE,
  SEGMENTS,
  wrap,
  type Pose,
} from "../src/skeleton";

const tweak = (pose: Pose, angle: Partial<Pose["angle"]>): Pose => ({
  angle: { ...pose.angle, ...angle },
});

// bras droit tendu à l'horizontale, jambe gauche écartée et pliée
const POINTING = tweak(REST_POSE, { upperArmR: 90, foreArmR: 0, thighL: -150, shinL: -40 });

describe("squelette", () => {
  it("ramène les angles dans ]-180, 180]", () => {
    expect(wrap(190)).toBe(-170);
    expect(wrap(-180)).toBe(180);
    expect(wrap(360)).toBe(0);
  });

  it("les enfants suivent leur parent", () => {
    const abs = absoluteAngles({ ...REST_POSE.angle, torso: 30 });
    expect(abs.head).toBe(30);
    expect(abs.upperArmR).toBe(wrap(30 + REST_POSE.angle.upperArmR));
    // les jambes partent du bassin, pas du tronc
    expect(abs.thighR).toBe(REST_POSE.angle.thighR);
  });

  it("retrouve l'angle relatif qui donne un angle absolu", () => {
    const leaning = tweak(REST_POSE, { torso: 30 });
    const rel = relativeFor(leaning, "upperArmR", 90);
    expect(absoluteAngles({ ...leaning.angle, upperArmR: rel }).upperArmR).toBe(90);
  });

  it("bras tendu à l'horizontale : la main est à droite de l'épaule, à la même hauteur", () => {
    const { from, to } = layout(POINTING).foreArmR;
    expect(to.x).toBeGreaterThan(from.x);
    expect(to.y).toBeCloseTo(from.y);
  });
});

describe("score", () => {
  it("100 % pour la même pose, et pour la pose en miroir", () => {
    expect(scorePose(POINTING, POINTING).percent).toBe(100);
    const mirrored = scorePose(mirrorPose(POINTING), POINTING);
    expect(mirrored.percent).toBe(100);
    expect(mirrored.mirrored).toBe(true);
  });

  it("le pantin debout, sans y toucher, reste à E (ce qui est déjà juste compte un peu)… sauf si la pose est debout", () => {
    expect(scorePose(REST_POSE, POINTING).percent).toBeGreaterThanOrEqual(24);
    expect(scorePose(REST_POSE, POINTING).percent).toBeLessThanOrEqual(25);
    for (const p of POSES) {
      const { percent } = scorePose(REST_POSE, targetPose(p));
      expect(percent).toBeLessThanOrEqual(25);
      expect(grade(percent)).toBe("E");
    }
    expect(scorePose(REST_POSE, REST_POSE).percent).toBe(100);
  });

  it("100 % seulement à quelques degrés près ; 10° d'écart coûte déjà, un grand écart beaucoup", () => {
    expect(scorePose(tweak(POINTING, { upperArmR: 93 }), POINTING).percent).toBe(100);
    const close = scorePose(tweak(POINTING, { upperArmR: 100 }), POINTING).percent;
    expect(close).toBeLessThan(100);
    expect(close).toBeGreaterThanOrEqual(90);
    expect(scorePose(tweak(POINTING, { upperArmR: 150 }), POINTING).percent).toBeLessThan(85);
  });

  it("à mi-chemin entre debout et la pose, une partie des points seulement", () => {
    // depuis la pose debout, le bras levé à moitié seulement, le reste pas touché
    const half = tweak(REST_POSE, { upperArmR: (REST_POSE.angle.upperArmR + 90) / 2 });
    const { percent } = scorePose(half, POINTING);
    expect(percent).toBeGreaterThan(30);
    expect(percent).toBeLessThan(90);
  });

  it("relatif : un tronc penché ne coûte que les points du tronc", () => {
    const leaning = scorePose(tweak(POINTING, { torso: 40 }), POINTING);
    expect(leaning.parts.find((p) => p.segment === "torso")?.score).toBeLessThan(1);
    expect(leaning.parts.filter((p) => p.segment !== "torso").every((p) => p.score === 1)).toBe(
      true,
    );
  });

  it("plier à tort ce qui devait rester droit fait perdre des points", () => {
    const bent = tweak(POINTING, { shinR: 90 });
    expect(scorePose(bent, POINTING).percent).toBeLessThan(100);
  });

  it("note de Z à E", () => {
    expect(grade(100)).toBe("Z");
    expect(grade(99)).toBe("S");
    expect(grade(96)).toBe("S");
    expect(grade(95)).toBe("A");
    expect(grade(85)).toBe("A");
    expect(grade(80)).toBe("B");
    expect(grade(61)).toBe("C");
    expect(grade(45)).toBe("D");
    expect(grade(10)).toBe("E");
  });
});

describe("poses cibles", () => {
  it("chaque pose a tous ses angles, et sa propre pose vaut 100 %", () => {
    for (const p of POSES) {
      const pose = targetPose(p);
      for (const s of SEGMENTS) expect(Number.isFinite(pose.angle[s])).toBe(true);
      expect(scorePose(pose, pose).percent).toBe(100);
    }
  });
});
