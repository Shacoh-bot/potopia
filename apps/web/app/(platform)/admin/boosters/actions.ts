"use server";

import { CardInputError, listCards, openBooster, resetCollection } from "@app/tcg";
import type { OpenedCard } from "@app/tcg/ui";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { actionAdmin } from "@/lib/session";
import { cardImageUrls } from "../cartes/images";

export type OpenResult =
  { ok: true; cards: OpenedCard[]; setSize: number } | { ok: false; error: string };

/** Ouvre un paquet du set (test admin : gratuit, illimité) et renvoie ses 5 cartes illustrées. */
export async function openBoosterAction(setCode: string): Promise<OpenResult> {
  const admin = await actionAdmin();
  try {
    const { set, cards } = await openBooster(admin, { setCode });
    const [images, setCards] = await Promise.all([
      cardImageUrls(admin, cards),
      listCards(admin, { setId: set.id }),
    ]);
    revalidatePath("/admin/potodex");
    return {
      ok: true,
      setSize: setCards.length,
      cards: cards.map((card) => ({ id: card.id, card, imageUrl: images.get(card.id) ?? null })),
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
