import { getAllCardsPotodex } from "@app/tcg";
import { CardBench } from "@app/tcg/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { cardFaces } from "../cartes/images";

export const metadata: Metadata = { title: "Banc d'essai des cartes" };

/** Cartes proposées au banc (les premières du jeu) : au-delà, les illustrations signées pèsent. */
const MAX_CARDS = 80;

/**
 * Banc d'essai des cartes (admin) : les vraies cartes du jeu (hors corbeille), affichées une par
 * une, en rangée de booster ou en planche, avec rareté, version et effets forçables et des strates
 * à couper (`CardBench`). Sert à trouver dans son propre navigateur ce qui fait disparaître une
 * partie d'une carte ou ce qui ralentit. Lecture seule : rien n'est écrit, ni carte ni collection.
 */
export default async function CardBenchPage() {
  const admin = await getCurrentAdmin();
  const dex = await getAllCardsPotodex(admin);
  const cards = dex.entries.flatMap((e) => (e.found ? [e.card] : [])).slice(0, MAX_CARDS);
  const faces = await cardFaces(admin, cards);
  return (
    <Card title="Banc d'essai des cartes">
      <div className={`${designFonts} flex flex-col gap-3`}>
        <p className="text-muted text-sm">
          Coupe les strates une à une pour voir laquelle fait disparaître une partie de la carte ou
          fait chuter les images par seconde. Lecture seule : rien n&apos;est enregistré.
        </p>
        <CardBench cards={faces} />
      </div>
    </Card>
  );
}
