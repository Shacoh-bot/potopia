import { publishEvent } from "@app/core";
import { db, Prisma, withTx, type DbTx } from "@app/db";
import { z } from "zod";
import { DAILY_COUNT, dailyPoses, dayKey, dayNumber } from "./daily";
import { PoseError } from "./errors";
import { targetPose } from "./poses";
import { scorePose } from "./score";
import { SEGMENTS, type Angles } from "./skeleton";

/** Une pose du jour, telle que le joueur la voit. */
export type DayPose = { id: string; character: string; name: string; image: string };
/** Une pose jouée : sa place dans la journée, sa ressemblance. */
export type Round = { slot: number; poseId: string; percent: number; mirrored: boolean };
export type DayView = { date: string; number: number; poses: DayPose[]; rounds: Round[] };

const poseView = ({ id, character, name, image }: DayPose): DayPose => ({
  id,
  character,
  name,
  image,
});

async function loadRounds(userId: string, date: string): Promise<Round[]> {
  return db.poseRound.findMany({
    where: { userId, date },
    select: { slot: true, poseId: true, percent: true, mirrored: true },
    orderBy: { slot: "asc" },
  });
}

/** La journée du joueur : les 3 poses du jour et celles qu'il a déjà faites. */
export async function getDay(userId: string, opts?: { now?: Date }): Promise<DayView> {
  const date = dayKey(opts?.now ?? new Date());
  return {
    date,
    number: dayNumber(date),
    poses: dailyPoses(date).map(poseView),
    rounds: await loadRounds(userId, date),
  };
}

const angle = z.number().finite().min(-360).max(360);
const playInput = z.object({
  date: z.iso.date(),
  slot: z
    .number()
    .int()
    .min(0)
    .max(DAILY_COUNT - 1),
  angles: z.object(
    Object.fromEntries(SEGMENTS.map((s) => [s, angle])) as Record<keyof Angles, typeof angle>,
  ),
});

/**
 * Une pose du jour validée. Le client envoie les angles de son pantin ; la ressemblance est
 * calculée ici, contre la pose du jour (jamais un score envoyé par le client). Les poses se font
 * dans l'ordre, une seule fois chacune ; juste après minuit, une pose pensée pour hier est refusée.
 * La dernière pose publie la journée dans le fil d'activité (moyenne seulement).
 */
export async function playPose(
  input: { userId: string; date: unknown; slot: unknown; angles: unknown },
  opts?: { tx?: DbTx; now?: Date },
): Promise<{ round: Round; day: DayView }> {
  const parsed = playInput.safeParse(input);
  if (!parsed.success) throw new PoseError(400, "Pose invalide");
  const { date, slot, angles } = parsed.data;
  const { userId } = input;
  const now = opts?.now ?? new Date();
  if (date !== dayKey(now))
    throw new PoseError(409, "Minuit est passé : voici les nouvelles poses !");

  const done = await loadRounds(userId, date);
  if (done.length >= DAILY_COUNT) {
    throw new PoseError(409, "Tu as fini pour aujourd'hui, reviens demain !");
  }
  if (slot !== done.length) throw new PoseError(409, "Ce n'est pas la pose en cours");

  const target = dailyPoses(date)[slot];
  if (!target) throw new PoseError(409, "Pas de pose pour aujourd'hui");
  const score = scorePose({ angle: angles }, targetPose(target));
  const round: Round = {
    slot,
    poseId: target.id,
    percent: score.percent,
    mirrored: score.mirrored,
  };

  try {
    await withTx(async (tx) => {
      await tx.poseRound.create({ data: { userId, date, ...round } });
      if (slot === DAILY_COUNT - 1) {
        const all = [...done, round];
        const percent = Math.round(all.reduce((n, r) => n + r.percent, 0) / all.length);
        await publishEvent(
          {
            userId,
            app: "pose",
            type: "day_completed",
            payload: { number: dayNumber(date), percent },
          },
          { tx },
        );
      }
    }, opts);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PoseError(409, "Pose déjà validée, recharge la page");
    }
    throw error;
  }
  return { round, day: await getDay(userId, { now }) };
}
