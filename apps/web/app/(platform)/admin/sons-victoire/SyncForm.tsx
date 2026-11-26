"use client";

import { planVictorySync } from "@app/tcg/ui";
import { Button } from "@app/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestVictorySoundAction, syncVictorySoundsAction } from "./actions";

/**
 * Synchronise un dossier de sons de victoire : `liste.json` (de Poto-Son) et ses mp3. Seuls les sons
 * non écartés comptent ; seuls les nouveaux ou changés (taille) sont envoyés au stockage ; ceux qui
 * ne sont plus dans la liste deviennent inactifs.
 */
export function SyncForm({ current }: { current: { id: string; bytes: number }[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sync(input: HTMLInputElement) {
    const all = [...(input.files ?? [])];
    const path = (f: File) => (f.webkitRelativePath || f.name).replaceAll("\\", "/");
    const listFile = all.find((f) => path(f).split("/").pop() === "liste.json");
    if (!listFile) return setStatus("liste.json absent du dossier choisi.");
    setBusy(true);
    try {
      const files = new Map(all.map((f) => [path(f), f]));
      const plan = planVictorySync(
        JSON.parse(await listFile.text()),
        new Map([...files].map(([p, f]) => [p, f.size])),
        new Map(current.map((s) => [s.id, s.bytes])),
      );
      const list: { id: string; title: string; key: string | null }[] = [];
      const toSend = plan.filter((p) => p.file).length;
      let sent = 0;
      for (const item of plan) {
        const file = item.file ? files.get(item.file) : undefined;
        let key: string | null = null;
        if (file) {
          setStatus(`Envoi ${++sent}/${toSend} : ${item.id}…`);
          const upload = await requestVictorySoundAction(file.size);
          if ("error" in upload) throw new Error(`${item.id} : ${upload.error}`);
          const res = await fetch(upload.url, {
            method: "PUT",
            headers: { "content-type": "audio/mpeg" },
            body: file,
          });
          if (!res.ok) throw new Error(`${item.id} : envoi refusé (${res.status}).`);
          key = upload.key;
        }
        list.push({ id: item.id, title: item.title, key });
      }
      const result = await syncVictorySoundsAction(list);
      if ("error" in result) throw new Error(result.error);
      setStatus(
        `Synchronisé : ${result.active} sons actifs (${result.added} ajoutés, ${result.updated} remplacés, ${result.disabled} désactivés).`,
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Échec de la synchronisation.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span>Dossier des sons (liste.json + mp3)</span>
        <input
          type="file"
          multiple
          disabled={busy}
          data-testid="victory-folder"
          // dossier entier : liste.json et rendus/*.mp3
          {...{ webkitdirectory: "" }}
          onChange={(e) => void sync(e.currentTarget)}
        />
      </label>
      {status && (
        <p role="status" className="text-muted text-sm">
          {status}
        </p>
      )}
      {busy && <Button disabled>Synchronisation…</Button>}
    </div>
  );
}
