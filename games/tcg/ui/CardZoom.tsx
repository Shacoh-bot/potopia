"use client";

import { X } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { H as CARD_HEIGHT, W as CARD_WIDTH } from "./v2";

type Size = { width: number; height: number };

/** Marge autour de la carte ouverte en grand (px), et place gardée pour le bouton Fermer. */
const MARGIN = 16;
const CLOSE_ROOM = 56;
/** Au-delà, l'illustration (1 200 px au plus) commence à baver. */
const MAX_ZOOM = 2.5;

/**
 * Taille d'une carte ouverte en grand (facteur de `zoom`) : la plus grande où elle tient entière
 * dans l'écran, marges et bouton Fermer compris, sans dépasser `MAX_ZOOM`.
 */
export function zoomToFit(viewport: Size, card: Size): number {
  const width = (viewport.width - 2 * MARGIN) / card.width;
  const height = (viewport.height - 2 * MARGIN - CLOSE_ROOM) / card.height;
  return Math.max(0.1, Math.min(width, height, MAX_ZOOM));
}

/**
 * Carte ouverte en grand, au centre d'un fond assombri (Potodex, ouverture d'un booster). La
 * carte est mise en page directement à sa grande taille (`zoom` CSS) et non grossie après coup
 * (`transform: scale`) : texte et illustration sont dessinés à la taille affichée, nets, même
 * pendant l'inclinaison 3D (un calque 3D grossi après coup gardait la netteté de la petite
 * carte). Fermeture : clic à côté, Échap ou le bouton. Ouvert en modal (`showModal`), le dialogue
 * passe au-dessus de toute la page là où il est (couche du dessus du navigateur), sans portail ;
 * `fontClass` reporte au besoin les variables des polices des cartes. Pas d'aura ici (réservée à
 * l'ouverture des boosters).
 */
export function CardZoom({
  label,
  fontClass,
  onClose,
  children,
}: {
  label: string;
  fontClass?: string;
  onClose: () => void;
  /** La carte, à sa taille normale (300 × 420). */
  children: ReactNode;
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
    if (!dialog.open) dialog.showModal();
    window.addEventListener("resize", fit);
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    // Pas de `close()` ici : son événement `close`, différé, refermerait la carte rouverte
    // aussitôt (effets rejoués en développement). Retiré de la page, le dialogue se ferme seul.
    return () => {
      window.removeEventListener("resize", fit);
      root.style.overflow = overflow;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      // Un clic sur le fond (le dialogue lui-même, pas la carte) ferme.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`${fontClass ?? ""} potodex-zoom fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none flex-col items-center justify-center overflow-hidden border-0 bg-transparent p-4 open:flex`}
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
          {children}
        </div>
      )}
    </dialog>
  );
}
