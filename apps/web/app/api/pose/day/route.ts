import { requireMember } from "@app/core";
import { getDay } from "@app/pose";
import { errorResponse, json } from "@/lib/route";

/** Pose JoJo : les 3 poses du jour et celles que le membre a déjà faites. */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    return json(await getDay(user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
