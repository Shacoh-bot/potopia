"use server";

import {
  CARD_SOUND_TYPE,
  CardInputError,
  createVictorySoundUpload,
  syncVictorySounds,
} from "@app/tcg";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { actionAdmin } from "@/lib/session";

function inputError(error: unknown): string | null {
  if (error instanceof CardInputError) return error.message;
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Données invalides.";
  return null;
}

/** URL d'envoi présignée d'un son de victoire (MP3). */
export async function requestVictorySoundAction(
  size: number,
): Promise<{ key: string; url: string } | { error: string }> {
  const admin = await actionAdmin();
  try {
    return await createVictorySoundUpload(admin, { contentType: CARD_SOUND_TYPE, size });
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
}

/** Applique la liste synchronisée (sons non écartés, fichiers envoyés). */
export async function syncVictorySoundsAction(
  list: { id: string; title: string; key: string | null }[],
): Promise<
  { ok: true; added: number; updated: number; disabled: number; active: number } | { error: string }
> {
  const admin = await actionAdmin();
  try {
    const result = await syncVictorySounds(admin, list);
    revalidatePath("/admin/sons-victoire");
    revalidatePath("/admin/potodex");
    return { ok: true, ...result };
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
}
