"use client";

import {
  BoosterOpening,
  BoosterWarmUp,
  type OpenedCard,
  preloadBoosterOpening,
  preloadBoosterSounds,
  type WarmUpLook,
} from "@app/tcg/ui";
import { buttonClasses } from "@app/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { openBoosterAction } from "./actions";

type Opened = { n: number; cards: OpenedCard[] | null; setSize?: number };

/**
 * Bouton « Ouvrir un paquet » : l'écran d'ouverture s'affiche aussitôt, dans la page, pendant
 * que le serveur tire les cartes (elles ne servent qu'à la fin, au retournement).
 */
export function BoosterOpener({
  setCode,
  fonts,
  looks,
}: {
  setCode: string;
  fonts: string;
  /** Allures des cartes du set, dessinées d'avance par le préchauffage (`BoosterWarmUp`). */
  looks: WarmUpLook[];
}) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warm, setWarm] = useState<"waiting" | "running" | "done">("waiting");
  const column = useRef<HTMLDivElement>(null);

  // Code 3D, modèle, vidéo et sons téléchargés dès l'arrivée sur la page : l'ouverture est
  // immédiate. Puis, page affichée, le préchauffage : la première ouverture ne s'arrête plus.
  useEffect(() => {
    preloadBoosterOpening();
    void preloadBoosterSounds();
    // Dès la page affichée (2 images) : fini avant qu'on ait le temps de cliquer.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setWarm((w) => (w === "waiting" ? "running" : w)));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const warmed = useCallback(() => setWarm("done"), []);

  function open() {
    // Un clic pendant le préchauffage l'arrête : l'ouverture passe avant.
    setWarm("done");
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
    <div ref={column} className="flex flex-col gap-3">
      {warm === "running" && (
        <BoosterWarmUp looks={looks} within={column} onDone={warmed} className={fonts} />
      )}
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
