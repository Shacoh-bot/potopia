"use server";

import { CardInputError, openBooster, resetCollection } from "@app/tcg";
import type { OpenedCard } from "@app/tcg/ui";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { actionAdmin } from "@/lib/session";
import { cardFaces } from "../cartes/images";

export type OpenResult =
  { ok: true; cards: OpenedCard[]; setSize: number } | { ok: false; error: string };

/**
 * Ouvre un paquet de test du set (admin : gratuit, illimité, une carte de chaque rareté haute,
 * hors garanties) et renvoie ses 5 cartes illustrées.
 */
export async function openBoosterAction(setCode: string): Promise<OpenResult> {
  const admin = await actionAdmin();
  try {
    const { cards } = await openBooster(admin, { setCode }, { test: true });
    // mêmes données que le menu « Cartes » : image, « idée de … », taille du set
    const faces = await cardFaces(admin, cards);
    revalidatePath("/admin/potodex");
    // compteur des garanties sous le paquet
    revalidatePath("/admin/boosters");
    return {
      ok: true,
      setSize: faces[0]?.setSize ?? 0,
      // chaque carte dans sa version tirée (`layout`), Alt Art comprise
      cards: faces.map(({ card, imageUrl }) => ({ id: card.id, card, imageUrl })),
    };
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
