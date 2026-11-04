import { requireMember } from "@app/core";
import { createGame, createRematch, listGames, listPartners } from "@app/morpion";
import { z } from "zod";
import { errorResponse, json } from "@/lib/route";
const input = z.union([
  z.object({ rematchId: z.uuid() }),
  z.object({
    partnerId: z.string().min(1),
    theme: z.enum(["mario", "sw", "simpson", "got", "ghibli"]),
  }),
]);
export async function GET(request: Request) {
  try {
    const user = await requireMember(request.headers);
    const games = await listGames(user.id);
    const partners =
      new URL(request.url).searchParams.get("partners") === "1"
        ? await listPartners(user.id)
        : undefined;
    return json({ games, partners });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireMember(request.headers);
    const body = input.parse(await request.json().catch(() => null));
    return json(
      "rematchId" in body
        ? await createRematch({ id: body.rematchId, userId: user.id })
        : await createGame({ ...body, userId: user.id }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
