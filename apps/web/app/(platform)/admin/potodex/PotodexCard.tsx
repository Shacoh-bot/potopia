"use client";

import { CARD_HEIGHT, CARD_WIDTH, GameCard, type GameCardFields } from "@app/tcg/ui";
import { cx } from "@app/ui";
import { X } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { zoomToFit } from "./zoom";

/**
 * Carte trouvée du Potodex : la miniature (rendue par le serveur, `children`) est un bouton ; un
 * clic, un toucher ou Entrée ouvre la carte en grand, vivante (inclinaison, reflets), centrée sur
 * un fond assombri. Fermeture : clic à côté, Échap ou le bouton. La grande carte n'est rendue
 * qu'une fois ouverte.
 */
export function PotodexCard({
  card,
  imageUrl,
  setSize,
  fontClass,
  children,
}: {
  card: GameCardFields;
  imageUrl: string | null;
  setSize: number;
  /** Variables des polices des cartes : le dialogue est hors de la page, dans `body`. */
  fontClass: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Voir ${card.name} en grand`}
        className="focus-visible:outline-accent block cursor-zoom-in rounded-[12px] focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        {/* La carte a son propre arrêt de tabulation : seul le bouton doit en avoir un. Sans
            pointeur, elle laisse le survol au bouton, qu'elle suit pour s'incliner. */}
        <div inert className="pointer-events-none">
          {children}
        </div>
      </button>
      {open &&
        createPortal(
          <CardZoom
            card={card}
            imageUrl={imageUrl}
            setSize={setSize}
            fontClass={fontClass}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

function CardZoom({
  card,
  imageUrl,
  setSize,
  fontClass,
  onClose,
}: {
  card: GameCardFields;
  imageUrl: string | null;
  setSize: number;
  fontClass: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  // Avant le premier affichage : taille adaptée à l'écran, dialogue modal (Échap, focus gardé
  // dedans), page bloquée derrière.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const fit = () =>
      setZoom(
        zoomToFit(
          { width: window.innerWidth, height: window.innerHeight },
          { width: CARD_WIDTH, height: CARD_HEIGHT },
        ),
      );
    fit();
    dialog.showModal();
    window.addEventListener("resize", fit);
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", fit);
      root.style.overflow = overflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={card.name}
      onClose={onClose}
      // Un clic sur le fond (le dialogue lui-même, pas la carte) ferme.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cx(
        fontClass,
        "potodex-zoom fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none flex-col items-center justify-center border-0 bg-transparent p-4 open:flex",
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="fixed top-3 right-3 grid size-10 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white"
      >
        <X size={22} aria-hidden />
      </button>
      {zoom !== null && (
        <div className="potodex-zoom-card" style={{ zoom }}>
          <GameCard card={card} imageUrl={imageUrl} setSize={setSize} />
        </div>
      )}
    </dialog>
  );
}
