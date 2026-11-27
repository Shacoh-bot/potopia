import { listVictorySounds } from "@app/tcg";
import { Card, cx, EmptyState } from "@app/ui";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";
import { SyncForm } from "./SyncForm";

export const metadata: Metadata = { title: "Sons de victoire" };

/**
 * Sons de victoire (retournement d'une SR ou d'une SSR) : la liste vient d'un dossier choisi ici
 * (`liste.json` + mp3, tenu par Poto-Son), jamais du dépôt. Re-synchroniser après un nouveau tri :
 * nouveaux sons envoyés, écartés désactivés, sans changement de code.
 */
export default async function VictorySoundsPage() {
  const admin = await getCurrentAdmin();
  const sounds = await listVictorySounds(admin);
  const active = sounds.filter((s) => s.active).length;
  return (
    <Card title={`Sons de victoire · ${active} actif${active > 1 ? "s" : ""}`}>
      <div className="flex flex-col gap-4">
        <SyncForm current={sounds.map((s) => ({ id: s.id, bytes: s.bytes }))} />
        {sounds.length === 0 ? (
          <EmptyState
            title="Aucun son"
            description="Choisis le dossier des sons : sans son, les SR et SSR gardent leurs bruitages."
          />
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {sounds.map((s) => (
              <li key={s.id} className={cx("flex gap-3", !s.active && "text-muted line-through")}>
                <span className="w-16 tabular-nums">{s.id}</span>
                <span className="flex-1">{s.title}</span>
                <span className="text-muted tabular-nums">{Math.round(s.bytes / 1024)} Ko</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
