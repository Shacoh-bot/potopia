"use client";

import { buttonClasses } from "@app/ui";
import { useTransition } from "react";
import { resetCollectionAction } from "../boosters/actions";

/** Vide la collection de test (après confirmation) : Potodex noir, garantie de SSR remise à zéro. */
export function ResetCollectionButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={buttonClasses({ variant: "secondary", size: "sm" })}
      disabled={disabled || pending}
      onClick={() => {
        if (
          !confirm(
            "Vider ta collection de test ? Cartes trouvées et paquets ouverts seront effacés.",
          )
        )
          return;
        start(() => resetCollectionAction());
      }}
    >
      {pending ? "Remise à zéro…" : "Remettre à zéro"}
    </button>
  );
}
