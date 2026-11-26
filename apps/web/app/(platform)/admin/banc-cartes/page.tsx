import { presignGetStable } from "@app/storage";
import { getAllCardsPotodex, revealSoundKeyFor } from "@app/tcg";
import { CardBench } from "@app/tcg/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../cartes/fonts";
import { cardFaces } from "../cartes/images";

export const metadata: Metadata = { title: "Banc d'essai des cartes" };

/**
 * Cartes proposées au banc : celles qui ont un son propre d'abord (pour l'écouter avec « Rejouer le
 * retournement »), puis les premières du jeu ; au-delà, les illustrations signées pèsent.
 */
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
  const all = dex.entries.flatMap((e) => (e.found ? [e.card] : []));
  const voiced = (c: (typeof all)[number]) => !!(c.revealSoundKey || c.revealSoundKeyFull);
  const cards = [...all.filter(voiced), ...all.filter((c) => !voiced(c))].slice(0, MAX_CARDS);
  const faces = await Promise.all(
    (await cardFaces(admin, cards)).map(async (face) => {
      const [normal, fullart] = await Promise.all(
        (["normal", "fullart"] as const).map((v) => {
          const key = revealSoundKeyFor(face.card, v);
          return key ? presignGetStable(key) : null;
        }),
      );
      return { ...face, sounds: { normal: normal ?? null, fullart: fullart ?? null } };
    }),
  );
  return (
    <Card title="Banc d'essai des cartes">
      <div className={`${designFonts} flex flex-col gap-3`}>
        <p className="text-muted text-sm">
          Coupe les strates une à une pour voir laquelle fait disparaître une partie de la carte ou
          fait chuter les images par seconde. Les cartes à son propre sont en tête : « Rejouer le
          retournement » le fait entendre. Lecture seule : rien n&apos;est enregistré.
        </p>
        <CardBench cards={faces} />
      </div>
    </Card>
  );
}
