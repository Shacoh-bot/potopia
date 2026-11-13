import { publishEvent } from "@app/core";
import { db, Prisma, withTx, type DbTx } from "@app/db";
import { z, ZodError } from "zod";
import { dayKey, dayNumber } from "./daily";
import { DouzeError } from "./errors";
import {
  dailyTrials,
  MAX_TRIAL_POINTS,
  scoreTrial,
  TRIAL_COUNT,
  trialView,
  type TrialKind,
  type TrialScore,
  type TrialView,
} from "./trials";

/** Une épreuve jouée : sa place dans la journée, son type, ses points. */
export type Round = { slot: number; kind: TrialKind; points: number };
export type DayView = {
  date: string;
  number: number;
  trials: TrialView[];
  rounds: Round[];
};

async function loadRounds(userId: string, date: string): Promise<Round[]> {
  const rows = await db.douzeRound.findMany({
    where: { userId, date },
    select: { slot: true, kind: true, points: true },
    orderBy: { slot: "asc" },
  });
  return rows.map((r) => ({ ...r, kind: r.kind as TrialKind }));
}

/** Options : `now` fixe l'heure (tests). */
type Options = { now?: Date };

/** La journée du joueur : les 12 épreuves du jour et celles qu'il a déjà jouées. */
export async function getDay(userId: string, opts?: Options): Promise<DayView> {
  const now = opts?.now ?? new Date();
  const date = dayKey(now);
  return {
    date,
    number: dayNumber(date),
    trials: dailyTrials(date).map(trialView),
    rounds: await loadRounds(userId, date),
  };
}

const playInput = z.object({
  date: z.iso.date(),
  slot: z
    .number()
    .int()
    .min(0)
    .max(TRIAL_COUNT - 1),
});

/**
 * Une épreuve du jour jouée. Le client envoie sa réponse (temps d'arrêt du chrono, nombre de
 * clics, case choisie…) ; les points sont calculés ici, contre l'épreuve du jour recalculée par le
 * serveur. Les épreuves se jouent dans l'ordre, une seule fois chacune ; juste après minuit, une
 * réponse pensée pour hier est refusée. La 12e publie la journée dans le fil d'activité (total et
 * nombre d'épreuves parfaites seulement).
 */
export async function playRound(
  input: { userId: string; date: unknown; slot: unknown; answer: unknown },
  opts?: Options & { tx?: DbTx },
): Promise<{ round: Round; score: TrialScore; day: DayView }> {
  const parsed = playInput.safeParse(input);
  if (!parsed.success) throw new DouzeError(400, "Réponse invalide");
  const { date, slot } = parsed.data;
  const { userId } = input;
  const now = opts?.now ?? new Date();
  if (date !== dayKey(now))
    throw new DouzeError(409, "Minuit est passé : voici les nouvelles épreuves !");

  const done = await loadRounds(userId, date);
  if (done.length >= TRIAL_COUNT) {
    throw new DouzeError(409, "Tu as fait tes 12 épreuves, reviens demain !");
  }
  if (slot !== done.length) throw new DouzeError(409, "Ce n'est pas l'épreuve en cours");

  const trial = dailyTrials(date)[slot];
  if (!trial) throw new DouzeError(409, "Pas d'épreuve pour aujourd'hui");
  let score: TrialScore;
  try {
    score = scoreTrial(trial, input.answer);
  } catch (error) {
    if (error instanceof ZodError) throw new DouzeError(400, "Réponse invalide");
    throw error;
  }
  const round: Round = { slot, kind: trial.kind, points: score.points };

  try {
    await withTx(async (tx) => {
      await tx.douzeRound.create({ data: { userId, date, ...round } });
      if (slot === TRIAL_COUNT - 1) {
        const all = [...done, round];
        await publishEvent(
          {
            userId,
            app: "douze",
            type: "day_completed",
            payload: {
              number: dayNumber(date),
              points: all.reduce((n, r) => n + r.points, 0),
              perfect: all.filter((r) => r.points === MAX_TRIAL_POINTS).length,
            },
          },
          { tx },
        );
      }
    }, opts);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DouzeError(409, "Épreuve déjà jouée, recharge la page");
    }
    throw error;
  }
  return { round, score, day: await getDay(userId, { now }) };
}
