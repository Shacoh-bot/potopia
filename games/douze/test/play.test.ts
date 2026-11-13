import { listRecentEvents } from "@app/core";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { dayKey, shiftDate } from "../src/daily";
import {
  dailyTrials,
  dayLeaderboard,
  DouzeError,
  getDay,
  periodLeaderboard,
  playRound,
  TRIAL_COUNT,
} from "../src/index";
import { EMPTY_ANSWERS, type Answer } from "../src/trials";

const ME = "user-me";
const OTHER = "user-other";
// midi à Paris le mercredi 16 décembre 2026, loin de minuit : journée n° 34 (n° 1 le 13/11)
const NOW = new Date("2026-12-16T11:00:00Z");
const TODAY = dayKey(NOW);
// le jour de la mise en ligne
const LAUNCH = new Date("2026-11-13T19:00:00Z");

/** Réponse parfaite aux épreuves faciles à réussir, vide pour les autres. */
function answerFor(slot: number, date = TODAY): Answer {
  const trial = dailyTrials(date)[slot];
  if (!trial) throw new Error("pas d'épreuve");
  switch (trial.kind) {
    case "chrono":
      return { ms: 12_000 };
    case "clicks":
      return { count: 12 };
    case "oracle":
      return { pick: trial.options.indexOf(12) };
    default:
      return EMPTY_ANSWERS[trial.kind];
  }
}

const play = (userId: string, slot: number, answer: unknown = answerFor(slot), now = NOW) =>
  playRound({ userId, date: dayKey(now), slot, answer }, { now });

async function expectDouzeError(promise: Promise<unknown>, status: number): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(DouzeError);
  await expect(promise).rejects.toMatchObject({ status });
}

beforeEach(async () => {
  await truncateTestDb();
  await db.user.createMany({
    data: [ME, OTHER].map((id) => ({ id, name: id, email: `${id}@example.test` })),
  });
});

describe("partie du jour", () => {
  it("donne les 12 épreuves du jour, sans leurs réponses", async () => {
    const day = await getDay(ME, { now: NOW });
    expect(day).toMatchObject({ date: TODAY, number: 34, rounds: [] });
    expect(day.trials.map((t) => t.kind)).toEqual(dailyTrials(TODAY).map((t) => t.kind));
    expect(JSON.stringify(day.trials)).not.toContain('"answer"');
  });

  it("ouvert dès la mise en ligne : journée n° 1, la partie compte", async () => {
    const { day } = await play(ME, 0, answerFor(0, dayKey(LAUNCH)), LAUNCH);
    expect(day).toMatchObject({ date: "2026-11-13", number: 1 });
    expect(day.rounds).toHaveLength(1);
  });

  it("calcule les points côté serveur", async () => {
    const trials = dailyTrials(TODAY);
    const slot = trials.findIndex((t) => t.kind === "chrono");
    for (const [i, t] of trials.slice(0, slot).entries()) await play(ME, i, EMPTY_ANSWERS[t.kind]);
    const { round, score } = await play(ME, slot, { ms: 12_250 });
    expect(round).toMatchObject({ slot, kind: "chrono", points: 10 });
    expect(score.note).toContain("12,25 s");
  });

  it("refuse une épreuve hors d'ordre, rejouée, de la veille ou mal formée", async () => {
    await expectDouzeError(play(ME, 1), 409);
    await play(ME, 0);
    await expectDouzeError(play(ME, 0), 409);
    await expectDouzeError(play(ME, 1, { autre: "chose" }), 400);
    await expectDouzeError(
      playRound(
        { userId: ME, date: shiftDate(TODAY, -1), slot: 1, answer: answerFor(1) },
        { now: NOW },
      ),
      409,
    );
    await expectDouzeError(
      playRound({ userId: ME, date: TODAY, slot: 12, answer: {} }, { now: NOW }),
      400,
    );
  });

  it("la 12e épreuve publie la journée dans le fil d'activité", async () => {
    for (let slot = 0; slot < TRIAL_COUNT; slot++) await play(ME, slot);
    await expectDouzeError(play(ME, TRIAL_COUNT - 1), 409);
    const [event] = await listRecentEvents(1);
    // chrono, clics et l'Oracle réussis : 36 points, 3 épreuves parfaites
    expect(event).toMatchObject({
      app: "douze",
      type: "day_completed",
      payload: { number: 34, points: 36, perfect: 3 },
    });
  });
});

describe("classement", () => {
  it("jour : points, épreuves jouées et parfaites ; moi même sans avoir joué", async () => {
    await play(OTHER, 0);
    await play(OTHER, 1);
    const { players } = await dayLeaderboard(ME, { now: NOW });
    const other = players.find((p) => p.id === OTHER);
    const me = players.find((p) => p.id === ME);
    expect(other).toMatchObject({ rank: 1, played: 2 });
    expect(me).toMatchObject({ played: 0, points: 0, me: true });
  });

  it("semaine : cumul des jours et meilleure journée", async () => {
    const yesterday = new Date(NOW.getTime() - 86_400_000);
    for (let slot = 0; slot < TRIAL_COUNT; slot++) {
      await play(ME, slot, answerFor(slot, dayKey(yesterday)), yesterday);
    }
    await play(ME, 0);
    const { totals } = await periodLeaderboard(ME, "week", { now: NOW });
    expect(totals[0]).toMatchObject({ id: ME, days: 2, best: 36 });
    expect(totals[0]?.points).toBeGreaterThanOrEqual(36);
  });
});
