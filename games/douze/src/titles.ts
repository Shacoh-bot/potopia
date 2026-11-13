import { MAX_DAY_POINTS } from "./trials";

/**
 * Titre d'une journée, par tranche de 12 points (13 tranches : de 0 à 11 jusqu'à 144). Un total
 * de 12 pile a son titre à lui.
 */
const TITLES = [
  "Zéro sur douze, ou presque",
  "Ça compte jusqu'à 12 sur ses doigts… et ses orteils",
  "Apprenti de la douzaine",
  "Demi-douzaine de talent",
  "Douzième dan de rien du tout",
  "Ami des œufs",
  "Pile entre 0 et 144",
  "Disciple du cadran",
  "Chevalier d'or (le 12e, celui des Poissons)",
  "Douzomane confirmé",
  "Apôtre du 12",
  "Presque une grosse",
  "UNE GROSSE. 144. Douze douzaines.",
] as const;

export function dayTitle(points: number): string {
  if (points === 12) return "12 points pile. Tu as compris le jeu.";
  if (points >= MAX_DAY_POINTS) return TITLES[12];
  return TITLES[Math.max(0, Math.min(11, Math.floor(points / 12)))] as string;
}
