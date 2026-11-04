import { MorpionLobby } from "@app/morpion/ui";
import "@app/morpion/ui/morpion.css";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";
export const metadata: Metadata = { title: "Morpion" };
export default async function MorpionPage() {
  await getCurrentMember();
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <MorpionLobby />
    </div>
  );
}
