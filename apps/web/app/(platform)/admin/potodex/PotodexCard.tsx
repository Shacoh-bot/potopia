"use client";

import { CardZoom, GameCard, type GameCardFields } from "@app/tcg/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

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
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const close = () => setOpen(false);
  // Retiré de la page sans `close()`, le dialogue ne rend pas le focus : on le rend à la miniature,
  // une fois le dialogue parti (tant qu'il est là, le reste de la page est inerte).
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
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
      {open && (
        <CardZoom label={card.name} fontClass={fontClass} onClose={close}>
          <GameCard card={card} imageUrl={imageUrl} setSize={setSize} />
        </CardZoom>
      )}
    </>
  );
}
