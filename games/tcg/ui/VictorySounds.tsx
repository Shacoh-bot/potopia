"use client";

import { effectiveVolume, onVolumeChange } from "@app/ui";
import { useEffect, useRef } from "react";

/**
 * Onglet « Sons » du Potodex : les sons de victoire découverts, à réécouter (lecteur du navigateur,
 * au volume du site). Un seul à la fois : en lancer un arrête les autres.
 */
export function VictorySounds({
  sounds,
}: {
  sounds: { id: string; title: string; url: string }[];
}) {
  const list = useRef<HTMLUListElement>(null);
  const players = () => [...(list.current?.querySelectorAll("audio") ?? [])];
  useEffect(
    () =>
      onVolumeChange(() => {
        for (const a of players()) a.volume = Math.min(1, effectiveVolume());
      }),
    [],
  );
  return (
    <ul ref={list} className="flex flex-col gap-2">
      {sounds.map((s, i) => (
        <li
          key={s.id}
          className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
        >
          <span className="text-muted w-8 text-xs tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="min-w-48 flex-1 text-sm">{s.title}</span>
          <audio
            controls
            preload="none"
            src={s.url}
            aria-label={`Écouter ${s.title}`}
            className="h-8 max-w-full"
            onPlay={(e) => {
              const me = e.currentTarget;
              me.volume = Math.min(1, effectiveVolume());
              for (const a of players()) if (a !== me) a.pause();
            }}
          />
        </li>
      ))}
    </ul>
  );
}
