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
