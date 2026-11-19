import type { Metadata } from "next";
import { SURVIVORS_NAME } from "@app/survivors";
import { SurvivorsGame } from "@app/survivors/ui";
import "@app/survivors/ui/survivors.css";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: SURVIVORS_NAME };

export default async function SurvivorsPage() {
  await getCurrentMember();
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <SurvivorsGame />
    </div>
  );
}
