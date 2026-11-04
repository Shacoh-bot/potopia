import { getGame, MorpionError } from "@app/morpion";
import { MorpionGame } from "@app/morpion/ui";
import "@app/morpion/ui/morpion.css";
import { forbidden, notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { getCurrentMember } from "@/lib/session";
export const metadata: Metadata = { title: "Duel de Morpion" };
export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentMember();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let initial;
  try {
    initial = await getGame(user.id, id);
  } catch (error) {
    if (error instanceof MorpionError) {
      if (error.status === 403) forbidden();
      if (error.status === 404) notFound();
    }
    throw error;
  }
  return <MorpionGame key={id} initial={initial} />;
}
