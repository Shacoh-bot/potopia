import { requireMember } from "@app/core";
import { playRound } from "@app/douze";
import { errorResponse, json } from "@/lib/route";

/** En local, DOUZE est ouvert avant l'heure (le 12/12 à 12 h 12), pour le tester. */
const early = process.env.NODE_ENV !== "production";

/**
 * DOUZE : joue l'épreuve en cours. Le corps porte la journée (`date`), l'épreuve (`slot`) et la
 * réponse du joueur ; les points sont calculés par le jeu, jamais envoyés par le client.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const body = (await request.json().catch(() => ({}))) as {
      date?: unknown;
      slot?: unknown;
      answer?: unknown;
    };
    return json(
      await playRound(
        { userId: user.id, date: body.date, slot: body.slot, answer: body.answer },
        { early },
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
