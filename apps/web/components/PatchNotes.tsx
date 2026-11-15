"use client";

import { cx } from "@app/ui";
import { Newspaper } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PatchNote } from "@/content/patch-notes";

/** Dernière mise à jour lue sur cet appareil (sa date). */
const SEEN_KEY = "potopia-patch-notes-vu";
/** Stockage du navigateur inaccessible (ou rendu serveur) : pas de pastille. */
const UNKNOWN = "?";

const listeners = new Set<() => void>();

/** Suit la mise à jour lue : dans cet onglet (`markSeen`) et dans les autres (`storage`). */
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return UNKNOWN;
  }
}

function markSeen(date: string) {
  try {
    localStorage.setItem(SEEN_KEY, date);
  } catch {
    // stockage bloqué : rien à retenir
  }
  for (const listener of listeners) listener();
}

/** « vendredi 14 novembre » (la date est un jour, sans fuseau). */
function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Bouton « Nouveautés » du header, à gauche du thème : il ouvre la liste des mises à jour du site,
 * la plus récente en haut. Une pastille reste tant que la dernière n'a pas été ouverte sur cet
 * appareil (mémorisé dans le navigateur). Fermeture : clic à côté, Échap ou le bouton.
 */
export function PatchNotes({ notes, latest }: { notes: PatchNote[]; latest: string }) {
  const [open, setOpen] = useState(false);
  // Le serveur ne connaît pas le navigateur : pas de pastille au rendu serveur, puis celle lue.
  const seen = useSyncExternalStore(subscribe, readSeen, () => UNKNOWN);
  const unread = !!latest && seen !== UNKNOWN && seen !== latest;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function toggle() {
    setOpen((o) => !o);
    if (unread) markSeen(latest);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? "Nouveautés du site (nouveau)" : "Nouveautés du site"}
        aria-expanded={open}
        title="Nouveautés"
        className="text-muted hover:bg-surface hover:text-text relative rounded-md p-2"
      >
        <Newspaper size={20} />
        {unread && (
          <span
            aria-hidden
            data-patch-notes-dot
            className="bg-accent ring-bg absolute top-1.5 right-1.5 size-2.5 rounded-full ring-2"
          />
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Nouveautés du site"
          className="theme-frame rounded-theme animate-rise absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] shadow-2xl"
          // fond opaque sous le cadre (translucide dans certains thèmes) : le texte reste lisible
          style={{ backgroundColor: "var(--bg)" }}
        >
          {/* le défilement dans un bloc intérieur : les ornements du cadre débordent sans barre */}
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-4">
            <p className="text-text mb-3 text-sm font-semibold">Nouveautés du site</p>
            <ol className="flex flex-col gap-4">
              {notes.map((note, i) => (
                <li key={note.date} className={cx(i > 0 && "border-border border-t pt-4")}>
                  <p className="text-muted text-xs first-letter:uppercase">
                    <time dateTime={note.date}>{formatDay(note.date)}</time>
                  </p>
                  <h3 className="text-text mt-0.5 text-sm font-semibold">{note.title}</h3>
                  <ul className="text-muted mt-1.5 flex list-disc flex-col gap-1 pl-4 text-sm">
                    {note.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
