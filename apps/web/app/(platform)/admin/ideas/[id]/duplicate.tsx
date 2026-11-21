"use client";

import { Button, Input } from "@app/ui";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setIdeaDuplicateAction } from "../actions";

export type IdeaChoice = { id: string; label: string };

const foldText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Nombre d'idées proposées sous la recherche. */
const PICKER_RESULTS = 8;

/**
 * « Doublon de… » sur la fiche d'une idée : choix DANS LA LISTE des idées (recherche par titre ou
 * auteur), pas de texte libre. Marquée : lien « Doublon de : titre — auteur » et « Ce n'est plus
 * un doublon ». Les cartes liées à l'idée ne bougent pas.
 */
export function IdeaDuplicateControl({
  ideaId,
  current,
  candidates,
}: {
  ideaId: string;
  current: IdeaChoice | null;
  /** Idées qu'on peut choisir (ni l'idée elle-même, ni une idée déjà doublon). */
  candidates: IdeaChoice[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (ofId: string | null) =>
    startTransition(async () => {
      const res = await setIdeaDuplicateAction(ideaId, ofId);
      setError(res.error ?? null);
      if (!res.error) {
        setOpen(false);
        setQuery("");
        router.refresh();
      }
    });

  const q = foldText(query.trim());
  const found = candidates
    .filter((c) => !q || foldText(c.label).includes(q))
    .slice(0, PICKER_RESULTS);

  return (
    <div className="flex flex-col gap-2 text-sm">
      {current ? (
        <p className="flex flex-wrap items-center gap-2">
          <span>
            Doublon de :{" "}
            <Link href={`/admin/ideas/${current.id}`} className="text-accent hover:underline">
              {current.label}
            </Link>
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => save(null)}
          >
            Ce n&apos;est plus un doublon
          </Button>
        </p>
      ) : open ? (
        <div className="border-border bg-surface flex w-96 max-w-full flex-col gap-1 rounded-md border p-2">
          <span className="flex items-center gap-1">
            <Input
              autoFocus
              value={query}
              disabled={pending}
              placeholder="Doublon de quelle idée ?"
              aria-label="Chercher l'idée d'origine du doublon"
              className="h-8 py-0 text-xs"
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Annuler le doublon"
              className="text-muted hover:text-text p-1"
            >
              <X size={14} />
            </button>
          </span>
          <span role="listbox" aria-label="Idées d'origine possibles" className="flex flex-col">
            {found.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={false}
                disabled={pending}
                onClick={() => save(c.id)}
                className="hover:bg-accent/15 text-text truncate rounded px-1 py-1 text-left text-xs disabled:opacity-60"
              >
                {c.label}
              </button>
            ))}
            {found.length === 0 && <span className="text-muted px-1 text-xs">Aucune idée.</span>}
          </span>
        </div>
      ) : (
        <div>
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Doublon de…
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
