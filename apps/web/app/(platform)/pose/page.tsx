import { POSE_NAME } from "@app/pose";
import { PoseGame } from "@app/pose/ui";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: POSE_NAME };

export default async function PosePage({
  searchParams,
}: {
  searchParams: Promise<{ editeur?: string }>;
}) {
  await getCurrentMember();
  // éditeur des poses cibles (calage des angles sur les images) : en local seulement
  const editor = process.env.NODE_ENV !== "production" && "editeur" in (await searchParams);
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <PoseGame editor={editor} />
    </div>
  );
}
