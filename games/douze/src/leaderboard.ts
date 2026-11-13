import { getUsersByIds } from "@app/core";
import { db } from "@app/db";
import { z } from "zod";
import { dayKey, dayNumber, periodEnd, periodStart } from "./daily";
import { DouzeError } from "./errors";
import { MAX_TRIAL_POINTS } from "./trials";

/** Un joueur tel que le classement l'affiche : pseudo et avatar Discord du portail. */
type Who = { id: string; name: string; image: string | null; me: boolean };
/** Journée d'un joueur : épreuves jouées, épreuves parfaites (12/12), total des points. */
export type Player = Who & { rank: number; points: number; played: number; perfect: number };
/** Semaine ou mois : cumul des points, jours joués, meilleure journée, épreuves parfaites. */
export type Total = Who & {
  rank: number;
  points: number;
  days: number;
  best: number;
  perfect: number;
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
  if (!parsed.success) throw new DouzeError(400, "Date invalide");
  const today = dayKey(now);
  const date = parsed.data && parsed.data < today ? parsed.data : today;
  const first = (await db.douzeRound.aggregate({ _min: { date: true } }))._min.date ?? today;
  return { date, today, first: first < today ? first : today };
}

/**
 * Classement d'un jour (aujourd'hui par défaut, ou un jour passé) : tous ceux qui ont joué, plus
 * moi. Points = somme des points des épreuves jouées (144 au plus) ; à égalité, le plus
 * d'épreuves parfaites passe devant.
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
  const rounds = await db.douzeRound.findMany({
    where: { date },
    select: { userId: true, points: true },
  });
  const userIds = [...new Set([meId, ...rounds.map((r) => r.userId)])];
  const who = await identities(userIds, meId);
  const rows: Omit<Player, "rank">[] = [];
  for (const id of userIds) {
    const user = who.get(id);
    if (!user) continue;
    const mine = rounds.filter((r) => r.userId === id);
    rows.push({
      ...user,
      points: mine.reduce((n, r) => n + r.points, 0),
      played: mine.length,
      perfect: mine.filter((r) => r.points === MAX_TRIAL_POINTS).length,
    });
  }
  const players = rank(rows, (a, b) => b.points - a.points || b.perfect - a.perfect);
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
 * Semaine ou mois : cumul des points de toutes les épreuves jouées. Par défaut la période en
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
  const rounds = await db.douzeRound.findMany({
    where: { date: { gte: from, lte: to } },
    select: { userId: true, date: true, points: true },
  });
  const userIds = [...new Set([meId, ...rounds.map((r) => r.userId)])];
  const who = await identities(userIds, meId);
  const acc = new Map(
    userIds.map((id) => [id, { points: 0, perfect: 0, days: new Map<string, number>() }]),
  );
  for (const r of rounds) {
    const a = acc.get(r.userId);
    if (!a) continue;
    a.points += r.points;
    if (r.points === MAX_TRIAL_POINTS) a.perfect++;
    a.days.set(r.date, (a.days.get(r.date) ?? 0) + r.points);
  }
  const rows: Omit<Total, "rank">[] = [];
  for (const [id, a] of acc) {
    const user = who.get(id);
    if (!user) continue;
    rows.push({
      ...user,
      points: a.points,
      perfect: a.perfect,
      days: a.days.size,
      best: Math.max(0, ...a.days.values()),
    });
  }
  const totals = rank(rows, (a, b) => b.points - a.points || a.days - b.days);
  return { totals: top(totals), from, to, total: totals.length, today, first };
}
