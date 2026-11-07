"use client";

import { type Me, TroisApp, type TroisReaction } from "@app/trois/ui";
import { Mascot, type MascotMood } from "@/components/Mascot";

const MOODS: Record<NonNullable<TroisReaction>, MascotMood> = { won: "victoire", lost: "erreur" };

/**
 * TROIS avec la mascotte sous le podium (colonne de gauche, très grand écran) : elle saute sur un
 * mot trouvé et s'affaisse sur un mot perdu.
 */
export function TroisWithMascot({ me }: { me: Me }) {
  return (
    <TroisApp
      me={me}
      belowPodium={(reaction) => (
        <Mascot mood={reaction ? MOODS[reaction] : "repos"} height={180} />
      )}
    />
  );
}
