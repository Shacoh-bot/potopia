import { requireMember } from "@app/core";
import { act, getGame } from "@app/morpion";
import { z } from "zod";
import { errorResponse, json } from "@/lib/route";
type Context = { params: Promise<{ id: string }> };
const input = z.object({
  action: z.enum(["accept", "cancel", "move"]),
  version: z.number().int().nonnegative(),
  cell: z.number().int().min(0).max(8).optional(),
});
export async function GET(request: Request, context: Context) {
  try {
    const user = await requireMember(request.headers);
    const { id } = await context.params;
    return json(await getGame(user.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const user = await requireMember(request.headers);
    const { id } = await context.params;
    const body = input.parse(await request.json().catch(() => null));
    return json(await act({ ...body, id, userId: user.id }));
  } catch (error) {
    return errorResponse(error);
  }
}
