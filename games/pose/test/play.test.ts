import { listRecentEvents } from "@app/core";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { dailyPoses, dayKey, shiftDate } from "../src/daily";
import { dayLeaderboard, getDay, periodLeaderboard, playPose, PoseError } from "../src/index";
import { targetPose } from "../src/poses";
import { REST_POSE } from "../src/skeleton";

const ME = "user-me";
const OTHER = "user-other";
// midi à Paris le 4 novembre 2026 : loin de minuit
const NOW = new Date("2026-11-04T11:00:00Z");
const TODAY = dayKey(NOW);

/** Les angles exacts de la pose du jour n° `slot` : 100 % assurés. */
const perfect = (slot: number, date = TODAY) => {
  const target = dailyPoses(date)[slot];
  if (!target) throw new Error("pas de pose");
  return targetPose(target).angle;
};

const play = (userId: string, slot: number, angles: unknown, now = NOW) =>
  playPose({ userId, date: dayKey(now), slot, angles }, { now });

async function expectPoseError(promise: Promise<unknown>, status: number): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(PoseError);
  await expect(promise).rejects.toMatchObject({ status });
}

beforeEach(async () => {
  await truncateTestDb();
  await db.user.createMany({
    data: [ME, OTHER].map((id) => ({ id, name: id, email: `${id}@example.test` })),
  });
});

describe("partie du jour", () => {
  it("donne les 3 poses du jour et celles déjà faites", async () => {
    const day = await getDay(ME, { now: NOW });
    expect(day.date).toBe(TODAY);
    expect(day.poses.map((p) => p.id)).toEqual(dailyPoses(TODAY).map((p) => p.id));
    expect(day.rounds).toEqual([]);
  });

  it("calcule la ressemblance côté serveur à partir des angles", async () => {
    const { round } = await play(ME, 0, perfect(0));
    expect(round).toMatchObject({ slot: 0, percent: 100, poseId: dailyPoses(TODAY)[0]?.id });
    const { round: lazy } = await play(ME, 1, REST_POSE.angle);
    expect(lazy.percent).toBeLessThanOrEqual(25);
  });

  it("refuse une pose hors d'ordre, rejouée, de trop ou mal formée", async () => {
    await expectPoseError(play(ME, 1, perfect(1)), 409);
    await play(ME, 0, perfect(0));
    await expectPoseError(play(ME, 0, perfect(0)), 409);
    await expectPoseError(play(ME, 1, { torso: 0 }), 400);
    await expectPoseError(play(ME, 1, { ...perfect(1), torso: "beaucoup" }), 400);
    await play(ME, 1, perfect(1));
    await play(ME, 2, perfect(2));
    await expectPoseError(play(ME, 2, perfect(2)), 409);
  });

  it("refuse une pose pensée pour la veille, juste après minuit", async () => {
    const yesterday = shiftDate(TODAY, -1);
    await expectPoseError(
      playPose({ userId: ME, date: yesterday, slot: 0, angles: perfect(0) }, { now: NOW }),
      409,
    );
  });

  it("publie la journée finie dans le fil d'activité, moyenne seulement", async () => {
    await play(ME, 0, perfect(0));
    await play(ME, 1, perfect(1));
    expect(await listRecentEvents(10)).toHaveLength(0);
    await play(ME, 2, REST_POSE.angle);
    const [event] = await listRecentEvents(10);
    expect(event).toMatchObject({ userId: ME, app: "pose", type: "day_completed" });
    expect(event?.payload).toEqual({ number: expect.any(Number), percent: expect.any(Number) });
  });
});

describe("classement", () => {
  it("jour : somme des ressemblances, ex æquo au même rang, moi même sans avoir joué", async () => {
    await play(OTHER, 0, perfect(0));
    await play(OTHER, 1, perfect(1));
    const board = await dayLeaderboard(ME, { now: NOW });
    expect(board.players.map((p) => [p.id, p.rank, p.points])).toEqual([
      [OTHER, 1, 200],
      [ME, 2, 0],
    ]);
    expect(board.players.find((p) => p.me)?.percents).toEqual([]);
  });

  it("historique : un jour passé, et la semaine qui le contient", async () => {
    const before = new Date(NOW.getTime() - 2 * 86_400_000);
    await play(ME, 0, perfect(0, dayKey(before)), before);
    await play(OTHER, 0, perfect(0));

    const past = await dayLeaderboard(ME, { date: dayKey(before), now: NOW });
    expect(past.date).toBe(dayKey(before));
    expect(past.players[0]).toMatchObject({ id: ME, points: 100 });
    expect(past.first).toBe(dayKey(before));

    const week = await periodLeaderboard(ME, "week", { now: NOW });
    expect(week.totals.find((t) => t.id === ME)).toMatchObject({ points: 100, days: 1, poses: 1 });
    // un jour futur retombe sur aujourd'hui
    expect((await dayLeaderboard(ME, { date: "2099-01-01", now: NOW })).date).toBe(TODAY);
    await expectPoseError(dayLeaderboard(ME, { date: "hier", now: NOW }), 400);
  });
});
