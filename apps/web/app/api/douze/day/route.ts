import { requireMember } from "@app/core";
import { getDay } from "@app/douze";
import { errorResponse, json } from "@/lib/route";

/** En local, DOUZE est ouvert avant l'heure (le 12/12 à 12 h 12), pour le tester. */
const early = process.env.NODE_ENV !== "production";

/** DOUZE : les 12 épreuves du jour et celles que le membre a déjà jouées. */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    return json(await getDay(user.id, { early }));
  } catch (error) {
    return errorResponse(error);
  }
}
