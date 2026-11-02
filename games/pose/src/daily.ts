import { BRAND } from "@app/config/brand";
import { POSES, type TargetPose } from "./poses";

/** Nombre de poses à faire chaque jour. */
export const DAILY_COUNT = 3;

/** Date du jour (AAAA-MM-JJ) dans le fuseau du site : les poses changent à minuit, heure de Paris. */
export function dayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: BRAND.timeZone }).format(now);
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même suite. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ordre fixe de toutes les poses, tiré une fois pour toutes : les jours se suivent dans cet ordre,
// si bien qu'une pose ne revient qu'après que toutes les autres sont passées.
const SEED = 0x6a6f6a6f;

/**
 * Les poses du jour : les mêmes pour tout le monde, trois nouvelles chaque jour, dans un ordre
 * fixe et mélangé (ajouter des poses change l'ordre à partir de ce jour-là).
 */
export function dailyPoses(key: string, poses: readonly TargetPose[] = POSES): TargetPose[] {
  if (poses.length === 0) return [];
  const order = [...poses];
  const rand = random(SEED);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j] as TargetPose, order[i] as TargetPose];
  }
  const [y = 0, m = 1, d = 1] = key.split("-").map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const count = Math.min(DAILY_COUNT, order.length);
  const start = (day * count) % order.length;
  return Array.from({ length: count }, (_, i) => order[(start + i) % order.length] as TargetPose);
}

/** Date décalée de `days` jours (AAAA-MM-JJ, sans fuseau : calcul sur le calendrier). */
export function shiftDate(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Premier jour de la semaine (lundi) ou du mois qui contient `date`. */
export function periodStart(date: string, period: "week" | "month"): string {
  if (period === "month") return date.slice(0, 8) + "01";
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return shiftDate(date, -weekday);
}

/** Dernier jour de la période commencée le jour `from`. */
export function periodEnd(from: string, period: "week" | "month"): string {
  if (period === "week") return shiftDate(from, 6);
  // le 1er du mois suivant (le 28 + 4 jours tombe toujours dans le mois suivant), moins un jour
  return shiftDate(shiftDate(from.slice(0, 8) + "28", 4).slice(0, 8) + "01", -1);
}

/** Numéro de la journée de Pose JoJo (1 le premier jour du jeu), pour le fil d'activité. */
export const FIRST_DAY = "2026-11-02";
export function dayNumber(date: string): number {
  const ms = (d: string) => Date.parse(d + "T00:00:00Z");
  return Math.round((ms(date) - ms(FIRST_DAY)) / 86_400_000) + 1;
}
