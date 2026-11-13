import { BRAND } from "@app/config/brand";

/** Date du jour (AAAA-MM-JJ) dans le fuseau du site : les épreuves changent à minuit, heure de Paris. */
export function dayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: BRAND.timeZone }).format(now);
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même suite. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine tirée d'un texte (FNV-1a) : chaque jour et chaque épreuve ont la leur. */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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

/** Ouverture du jeu : le 12/12 à 12 h 12, heure de Paris (11 h 12 UTC en hiver). */
export const OPENS_AT = new Date("2026-12-12T11:12:00Z");
/** Journée n° 1 : le jour de l'ouverture. */
export const FIRST_DAY = "2026-12-12";

/** Le jeu est-il ouvert (les parties comptent) ? */
export const isOpen = (now = new Date()) => now.getTime() >= OPENS_AT.getTime();

/** Numéro de la journée de DOUZE (1 le jour de l'ouverture), pour le fil d'activité. */
export function dayNumber(date: string): number {
  const ms = (d: string) => Date.parse(d + "T00:00:00Z");
  return Math.round((ms(date) - ms(FIRST_DAY)) / 86_400_000) + 1;
}
