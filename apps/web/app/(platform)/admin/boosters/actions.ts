"use server";

import { CardInputError, openBooster, resetCollection } from "@app/tcg";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { actionAdmin } from "@/lib/session";
import { type Pack, packOf, withVictorySounds } from "./pack";

export type OpenResult = ({ ok: true; next: Pack } & Pack) | { ok: false; error: string };

/**
 * Ouvre un paquet de test du set (admin : gratuit, illimité, une carte de chaque rareté haute,
 * hors garanties) : le paquet tiré d'avance. Renvoie ses 5 cartes illustrées, et celles du paquet
 * suivant, tiré aussitôt, à précharger (exposé au navigateur avant son ouverture : voir `packOf`).
 */
export async function openBoosterAction(setCode: string): Promise<OpenResult> {
  const admin = await actionAdmin();
  try {
    const { cards, next } = await openBooster(admin, { setCode }, { test: true });
    const [pack, nextPack] = await Promise.all([
      packOf(admin, cards).then((p) => withVictorySounds(admin, p)),
      packOf(admin, next),
    ]);
    revalidatePath("/admin/potodex");
    // compteur des garanties sous le paquet
    revalidatePath("/admin/boosters");
    return { ok: true, ...pack, next: nextPack };
  } catch (error) {
    if (error instanceof CardInputError) return { ok: false, error: error.message };
    if (error instanceof ZodError) return { ok: false, error: "Set invalide." };
    throw error;
  }
}

/** Vide la collection de test de l'admin connecté (cartes trouvées et paquets ouverts). */
export async function resetCollectionAction(): Promise<void> {
  const admin = await actionAdmin();
  await resetCollection(admin);
  revalidatePath("/admin/potodex");
  revalidatePath("/admin/boosters");
}
