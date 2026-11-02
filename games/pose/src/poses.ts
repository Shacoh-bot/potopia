import type { Angles, Pose } from "./skeleton";

export type TargetPose = {
  id: string;
  character: string;
  name: string;
  /** Image servie par apps/web/public. */
  image: string;
  /** Angles relatifs du squelette, tels qu'on les voit sur l'image. */
  angles: Angles;
};

/** La pose cible, prête à comparer ou à dessiner. */
export function targetPose(target: TargetPose): Pose {
  return { angle: target.angles };
}

// Rendus officiels des jeux JoJo (All Star Battle surtout), détourés : public/pose/<id>.webp.
// Angles calés en pointant les articulations sur chaque image (épaules, coudes, poignets,
// hanches, genoux, chevilles), vérifiés en superposant le squelette à l'image. Retouches :
// éditeur `/pose?editeur`, en local.
/** Poses célèbres de JoJo à reproduire. */
export const POSES: TargetPose[] = [
  {
    id: "jotaro-hat-tip",
    character: "Jotaro Kujo",
    name: "La casquette",
    image: "/pose/jotaro-hat-tip.webp",
    angles: { torso: 17, head: -12, upperArmL: -76, foreArmL: 124, upperArmR: 131, foreArmR: 149, thighL: -178, shinL: -7, thighR: 157, shinR: 11 },
  },
  {
    id: "dio-claws-spread",
    character: "DIO",
    name: "Les griffes",
    image: "/pose/dio-claws-spread.webp",
    angles: { torso: -10, head: -2, upperArmL: -125, foreArmL: 99, upperArmR: 153, foreArmR: -112, thighL: -132, shinL: -84, thighR: 153, shinR: 3 },
  },
  {
    id: "dio-standing-menace",
    character: "DIO",
    name: "La menace",
    image: "/pose/dio-standing-menace.webp",
    angles: { torso: 15, head: -30, upperArmL: -167, foreArmL: -43, upperArmR: 139, foreArmR: 79, thighL: 174, shinL: -15, thighR: 165, shinR: 4 },
  },
  {
    id: "dio-leap",
    character: "DIO",
    name: "Le bond",
    image: "/pose/dio-leap.webp",
    angles: { torso: -16, head: -38, upperArmL: -109, foreArmL: -25, upperArmR: 27, foreArmR: -157, thighL: -72, shinL: -122, thighR: -164, shinR: -21 },
  },
  {
    id: "dio-brando-arms-open",
    character: "Dio Brando",
    name: "Bras ouverts",
    image: "/pose/dio-brando-arms-open.webp",
    angles: { torso: 9, head: 2, upperArmL: -167, foreArmL: 31, upperArmR: 105, foreArmR: -30, thighL: 169, shinL: 2, thighR: 171, shinR: 11 },
  },
  {
    id: "giorno-wide-stance",
    character: "Giorno Giovanna",
    name: "Le coude levé",
    image: "/pose/giorno-wide-stance.webp",
    angles: { torso: 5, head: 2, upperArmL: -87, foreArmL: -174, upperArmR: 164, foreArmR: 50, thighL: -168, shinL: 27, thighR: 153, shinR: -4 },
  },
  {
    id: "josuke-arms-frame",
    character: "Josuke Higashikata",
    name: "Le cadre",
    image: "/pose/josuke-arms-frame.webp",
    angles: { torso: 6, head: 6, upperArmL: -45, foreArmL: 132, upperArmR: 70, foreArmR: -158, thighL: -171, shinL: -22, thighR: 168, shinR: 23 },
  },
  {
    id: "jonathan-wide-stance",
    character: "Jonathan Joestar",
    name: "En garde",
    image: "/pose/jonathan-wide-stance.webp",
    angles: { torso: 7, head: 8, upperArmL: -150, foreArmL: 5, upperArmR: -144, foreArmR: 150, thighL: -149, shinL: -6, thighR: 161, shinR: 1 },
  },
  {
    id: "joseph-crouch-frame",
    character: "Joseph Joestar",
    name: "Accroupi",
    image: "/pose/joseph-crouch-frame.webp",
    angles: { torso: -2, head: 22, upperArmL: 42, foreArmL: -15, upperArmR: 81, foreArmR: -161, thighL: -122, shinL: -142, thighR: 96, shinR: -149 },
  },
  {
    id: "bucciarati-hand-hip",
    character: "Bruno Bucciarati",
    name: "La main sur la hanche",
    image: "/pose/bucciarati-hand-hip.webp",
    angles: { torso: -3, head: -4, upperArmL: -155, foreArmL: -74, upperArmR: 170, foreArmR: 24, thighL: 171, shinL: 11, thighR: 156, shinR: 28 },
  },
  {
    id: "gyro-wide-stance",
    character: "Gyro Zeppeli",
    name: "Grand écart",
    image: "/pose/gyro-wide-stance.webp",
    angles: { torso: 5, head: 10, upperArmL: -140, foreArmL: -63, upperArmR: 180, foreArmR: 12, thighL: -149, shinL: 2, thighR: 152, shinR: -2 },
  },
  {
    id: "jolyne-hand-face",
    character: "Jolyne Cujoh",
    name: "La main au visage",
    image: "/pose/jolyne-hand-face.webp",
    angles: { torso: 7, head: 9, upperArmL: 156, foreArmL: -36, upperArmR: -168, foreArmR: 170, thighL: -155, shinL: -37, thighR: -176, shinR: -4 },
  },
  {
    id: "kakyoin-pose",
    character: "Noriaki Kakyoin",
    name: "Le doigt levé",
    image: "/pose/kakyoin-pose.webp",
    angles: { torso: -14, head: 11, upperArmL: 158, foreArmL: -119, upperArmR: 172, foreArmR: 134, thighL: -170, shinL: -4, thighR: -161, shinR: -12 },
  },
  {
    id: "kira-crossed",
    character: "Yoshikage Kira",
    name: "Bras croisés",
    image: "/pose/kira-crossed.webp",
    angles: { torso: 2, head: -2, upperArmL: -179, foreArmL: -75, upperArmR: 178, foreArmR: 69, thighL: 174, shinL: 4, thighR: -165, shinR: -25 },
  },
  {
    id: "polnareff-lean",
    character: "Jean-Pierre Polnareff",
    name: "Le penché",
    image: "/pose/polnareff-lean.webp",
    angles: { torso: -7, head: -19, upperArmL: -76, foreArmL: 169, upperArmR: 154, foreArmR: 10, thighL: -164, shinL: -3, thighR: -168, shinR: -3 },
  },
  {
    id: "rohan-arm-overhead",
    character: "Rohan Kishibe",
    name: "Le bras au-dessus",
    image: "/pose/rohan-arm-overhead.webp",
    angles: { torso: 0, head: 0, upperArmL: -3, foreArmL: 107, upperArmR: 160, foreArmR: 20, thighL: -176, shinL: -4, thighR: 178, shinR: 11 },
  },
];
