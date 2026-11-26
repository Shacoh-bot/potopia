"use client";

import { Button } from "@app/ui";
import { useState } from "react";

type Version = "normal" | "fullart";

type Props = {
  /** Son entendu au retournement de chaque version (la full art reprend celui de la normale). */
  sounds: Record<Version, string | null>;
  /** La full art a son propre son (sinon elle reprend celui de la normale). */
  fullHasOwn: boolean;
  /** URL d'envoi présignée (server action de l'app). */
  request: (size: number) => Promise<{ key: string; url: string } | { error: string }>;
  /** Pose le son envoyé sur une version, ou le retire avec `null` (server action de l'app). */
  confirm: (key: string | null, version: Version) => Promise<{ error: string } | null>;
};

const LABELS: Record<Version, string> = { normal: "Normale", fullart: "Full art" };

/**
 * Son propre d'une carte (admin) : un MP3 par version, joué quand la carte se retourne dans un
 * booster à la place des bruitages de sa rareté. Envoi direct au stockage (URL présignée), puis
 * confirmation ; « Retirer » rend les bruitages (la full art reprend alors le son de la normale).
 */
export function CardSoundUpload({ sounds, fullHasOwn, request, confirm }: Props) {
  const [busy, setBusy] = useState<Version | null>(null);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  async function send(version: Version, file: File) {
    setBusy(version);
    setStatus(null);
    try {
      if (file.type !== "audio/mpeg") throw new Error("Format de son refusé : MP3 uniquement.");
      const upload = await request(file.size);
      if ("error" in upload) throw new Error(upload.error);
      const put = await fetch(upload.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "audio/mpeg" },
      });
      if (!put.ok) throw new Error(`Envoi refusé par le stockage (${put.status}).`);
      const failed = await confirm(upload.key, version);
      if (failed) throw new Error(failed.error);
      setStatus({ text: `${LABELS[version]} : son posé.`, ok: true });
    } catch (error) {
      setStatus({ text: (error as Error).message, ok: false });
    }
    setBusy(null);
  }

  async function remove(version: Version) {
    setBusy(version);
    const failed = await confirm(null, version);
    setStatus(
      failed
        ? { text: failed.error, ok: false }
        : { text: `${LABELS[version]} : son retiré.`, ok: true },
    );
    setBusy(null);
  }

  return (
    <section className="flex flex-col gap-3 text-sm">
      <h3 className="font-semibold">Son au retournement</h3>
      <p className="text-muted">
        MP3 (2 Mo maximum), joué quand la carte se retourne dans un booster, à la place des
        bruitages de sa rareté. Sans son à elle, la full art reprend celui de la normale.
      </p>
      {(["normal", "fullart"] as const).map((version) => {
        const own = version === "normal" ? !!sounds.normal : fullHasOwn;
        return (
          <div key={version} className="flex flex-wrap items-center gap-3">
            <span className="w-20 font-medium">{LABELS[version]}</span>
            {sounds[version] ? (
              <audio controls preload="none" src={sounds[version] ?? undefined} className="h-8" />
            ) : (
              <span className="text-muted">bruitages de rareté</span>
            )}
            {version === "fullart" && !own && sounds.fullart && (
              <span className="text-muted">(celui de la normale)</span>
            )}
            <label className="border-border cursor-pointer rounded border px-3 py-1">
              {busy === version ? "Envoi…" : own ? "Remplacer" : "Envoyer un MP3"}
              <input
                type="file"
                accept="audio/mpeg,.mp3"
                className="sr-only"
                disabled={busy !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void send(version, file);
                }}
              />
            </label>
            {own && (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                onClick={() => void remove(version)}
              >
                Retirer
              </Button>
            )}
          </div>
        );
      })}
      {status && (
        <p role="status" className={status.ok ? "text-muted" : "text-danger"}>
          {status.text}
        </p>
      )}
    </section>
  );
}
