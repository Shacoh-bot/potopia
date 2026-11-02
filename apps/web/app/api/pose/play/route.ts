import { requireMember } from "@app/core";
import { playPose } from "@app/pose";
import { errorResponse, json } from "@/lib/route";

/**
 * Pose JoJo : valide la pose en cours. Le corps porte la journée (`date`), la pose (`slot`) et les
 * angles du pantin ; la ressemblance est calculée par le jeu, jamais envoyée par le client.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const body = (await request.json().catch(() => ({}))) as {
      date?: unknown;
      slot?: unknown;
      angles?: unknown;
    };
    return json(
      await playPose({ userId: user.id, date: body.date, slot: body.slot, angles: body.angles }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
