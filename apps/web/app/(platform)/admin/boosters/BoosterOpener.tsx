"use client";

import {
  BoosterOpening,
  type OpenedCard,
  preloadBoosterOpening,
  preloadBoosterSounds,
} from "@app/tcg/ui";
import { buttonClasses } from "@app/ui";
import { useEffect, useState } from "react";
import { openBoosterAction } from "./actions";

type Opened = { n: number; cards: OpenedCard[] | null; setSize?: number };

/**
 * Bouton « Ouvrir un paquet » : l'écran d'ouverture s'affiche aussitôt, dans la page, pendant
 * que le serveur tire les cartes (elles ne servent qu'à la fin, au retournement).
 */
export function BoosterOpener({ setCode, fonts }: { setCode: string; fonts: string }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Code 3D, modèle, vidéo et sons téléchargés dès l'arrivée sur la page : l'ouverture est
  // immédiate.
  useEffect(() => {
    preloadBoosterOpening();
    void preloadBoosterSounds();
  }, []);

  function open() {
    setError(null);
    const n = (opened?.n ?? 0) + 1;
    setOpened({ n, cards: null });
    void openBoosterAction(setCode).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setOpened(null);
        return;
      }
      // Ignore un tirage arrivé après qu'on a fermé ou rouvert un autre paquet.
      setOpened((o) => (o?.n === n ? { n, cards: result.cards, setSize: result.setSize } : o));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {opened ? (
        <BoosterOpening
          // Un nouveau paquet repart de zéro (paquet 3D, vidéo, cartes de dos).
          key={opened.n}
          cards={opened.cards}
          setSize={opened.setSize}
          className={fonts}
          onClose={() => setOpened(null)}
          onAgain={open}
        />
      ) : (
        <button type="button" className={`${buttonClasses()} self-start`} onClick={open}>
          Ouvrir un paquet
        </button>
      )}
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
