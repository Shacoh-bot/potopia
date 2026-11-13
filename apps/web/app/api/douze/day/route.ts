import { requireMember } from "@app/core";
import { getDay } from "@app/douze";
import { errorResponse, json } from "@/lib/route";

/** DOUZE : les 12 épreuves du jour et celles que le membre a déjà jouées. */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    return json(await getDay(user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
