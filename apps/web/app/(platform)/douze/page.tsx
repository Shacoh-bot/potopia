import { isAdmin } from "@app/core";
import { DOUZE_NAME } from "@app/douze";
import { DouzeGame } from "@app/douze/ui";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: DOUZE_NAME };

export default async function DouzePage() {
  const user = await getCurrentMember();
  // en local et pour les admins : une fois la journée finie, en rejouer une autre pour de faux
  // (un jour passé tiré au hasard), sans rien enregistrer
  const practice = process.env.NODE_ENV !== "production" || isAdmin(user.discordId);
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <DouzeGame allowPractice={practice} />
    </div>
  );
}
