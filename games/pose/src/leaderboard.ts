import { getUsersByIds } from "@app/core";
import { db } from "@app/db";
import { z } from "zod";
import { DAILY_COUNT, dayKey, dayNumber, periodEnd, periodStart } from "./daily";
import { PoseError } from "./errors";

/** Un joueur tel que le classement l'affiche : pseudo et avatar Discord du portail. */
type Who = { id: string; name: string; image: string | null; me: boolean };
/** Journée d'un joueur : ressemblance de chaque pose faite (dans l'ordre), et leur somme. */
export type Player = Who & { rank: number; percents: number[]; points: number };
/** Semaine ou mois : somme des ressemblances, nombre de poses et de jours joués, meilleure pose. */
export type Total = Who & {
  rank: number;
  points: number;
  poses: number;
  days: number;
  best: number;
};
export type Period = "day" | "week" | "month";

const LIMIT = 200;
const collator = new Intl.Collator("fr");

/** À score égal : pseudo puis id, pour un ordre identique d'un rafraîchissement à l'autre. */
const byName = (a: Who, b: Who) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id);

/** Trie par score puis départage, et numérote : les ex æquo partagent le rang, le suivant saute. */
function rank<T extends Who>(rows: T[], score: (a: T, b: T) => number): (T & { rank: number })[] {
  rows.sort((a, b) => score(a, b) || byName(a, b));
  let current = 0;
  return rows.map((row, i) => {
    const prev = rows[i - 1];
    if (!prev || score(prev, row) !== 0) current = i + 1;
    return { ...row, rank: current };
  });
}

/** Garde les LIMIT premiers, plus ma ligne si elle est au-delà (elle garde son vrai rang). */
function top<T extends { me: boolean }>(rows: T[]): T[] {
  const shown = rows.slice(0, LIMIT);
  const mine = rows.findIndex((r) => r.me);
  const row = rows[mine];
  if (mine >= LIMIT && row) shown.push(row);
  return shown;
}

async function identities(ids: string[], meId: string): Promise<Map<string, Who>> {
  const users = await getUsersByIds(ids);
  return new Map(
    users.map((u) => [u.id, { id: u.id, name: u.name, image: u.image, me: u.id === meId }]),
  );
}

const dateInput = z.iso.date().optional();

/**
 * Jour demandé pour l'historique (aujourd'hui par défaut, jamais dans le futur), et premier jour
 * où quelqu'un a joué, pour savoir jusqu'où remonter.
 */
async function historyDates(input: unknown, now: Date) {
  const parsed = dateInput.safeParse(input);
  if (!parsed.success) throw new PoseError(400, "Date invalide");
  const today = dayKey(now);
  const date = parsed.data && parsed.data < today ? parsed.data : today;
  const first = (await db.poseRound.aggregate({ _min: { date: true } }))._min.date ?? today;
  return { date, today, first: first < today ? first : today };
}

/**
 * Classement d'un jour (aujourd'hui par défaut, ou un jour passé) : tous ceux qui ont joué, plus
 * moi. Points = somme des ressemblances des poses faites (300 au plus) ; à égalité, celui qui a
 * fait le plus de poses passe devant.
 */
export async function dayLeaderboard(
  meId: string,
  opts?: { date?: unknown; now?: Date },
): Promise<{
  players: Player[];
  total: number;
  date: string;
  number: number;
  today: string;
  first: string;
}> {
  const { date, today, first } = await historyDates(opts?.date, opts?.now ?? new Date());
  const rounds = await db.poseRound.findMany({
    where: { date },
    select: { userId: true, slot: true, percent: true },
    orderBy: { slot: "asc" },
  });
  const userIds = [...new Set([meId, ...rounds.map((r) => r.userId)])];
  const who = await identities(userIds, meId);
  const rows: Omit<Player, "rank">[] = [];
  for (const id of userIds) {
    const user = who.get(id);
    if (!user) continue;
    const percents = rounds.filter((r) => r.userId === id).map((r) => r.percent);
    rows.push({ ...user, percents, points: percents.reduce((n, p) => n + p, 0) });
  }
  const players = rank(
    rows,
    (a, b) => b.points - a.points || b.percents.length - a.percents.length,
  );
  return {
    players: top(players),
    total: players.length,
    date,
    number: dayNumber(date),
    today,
    first,
  };
}

/**
 * Semaine ou mois : cumul des ressemblances de toutes les poses faites. Par défaut la période en
 * cours, sinon celle qui contient `date` (historique). À égalité : le moins de jours joués.
 */
export async function periodLeaderboard(
  meId: string,
  period: "week" | "month",
  opts?: { date?: unknown; now?: Date },
): Promise<{
  totals: Total[];
  from: string;
  to: string;
  total: number;
  today: string;
  first: string;
}> {
  const { date, today, first } = await historyDates(opts?.date, opts?.now ?? new Date());
  const from = periodStart(date, period);
  const end = periodEnd(from, period);
  const to = end < today ? end : today;
  const rounds = await db.poseRound.findMany({
    where: { date: { gte: from, lte: to } },
    select: { userId: true, date: true, percent: true },
  });
  const userIds = [...new Set([meId, ...rounds.map((r) => r.userId)])];
  const who = await identities(userIds, meId);
  const acc = new Map(
    userIds.map((id) => [id, { points: 0, poses: 0, best: 0, days: new Set<string>() }]),
  );
  for (const r of rounds) {
    const a = acc.get(r.userId);
    if (!a) continue;
    a.points += r.percent;
    a.poses++;
    a.best = Math.max(a.best, r.percent);
    a.days.add(r.date);
  }
  const rows: Omit<Total, "rank">[] = [];
  for (const [id, a] of acc) {
    const user = who.get(id);
    if (!user) continue;
    rows.push({ ...user, points: a.points, poses: a.poses, best: a.best, days: a.days.size });
  }
  const totals = rank(rows, (a, b) => b.points - a.points || a.days - b.days);
  return { totals: top(totals), from, to, total: totals.length, today, first };
}

/** Points d'une journée complète au plus (une pose parfaite vaut 100). */
export const MAX_DAY_POINTS = DAILY_COUNT * 100;
