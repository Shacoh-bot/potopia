import { z } from "zod";

/*
 * Patch notes du site : ce qui change pour les membres, une entrée par jour de mise à jour, la plus
 * récente en haut. Chaque PR qui change quelque chose de visible ajoute ses lignes ici (dans
 * l'entrée du jour, ou une nouvelle entrée en tête), en français simple, sans jargon, sans numéro
 * de PR ni pseudo.
 */

const patchNote = z.object({
  /** Jour de la mise à jour (AAAA-MM-JJ), qui sert aussi d'identifiant. */
  date: z.iso.date("Date au format AAAA-MM-JJ."),
  title: z.string().trim().min(1).max(80),
  items: z.array(z.string().trim().min(1).max(300)).min(1),
});

export type PatchNote = z.infer<typeof patchNote>;

/**
 * Valide les entrées et les range de la plus récente à la plus ancienne. Refuse deux entrées du
 * même jour (une seule entrée par jour : on complète celle qui existe).
 */
export function parsePatchNotes(input: unknown): PatchNote[] {
  const notes = z.array(patchNote).min(1).parse(input);
  const dates = notes.map((n) => n.date);
  const twice = dates.find((d, i) => dates.indexOf(d) !== i);
  if (twice) throw new Error(`Deux entrées le ${twice} : regroupe-les en une seule.`);
  return [...notes].sort((a, b) => b.date.localeCompare(a.date));
}

export const PATCH_NOTES = parsePatchNotes([
  {
    date: "2026-11-14",
    title: "Des vrais sons un peu partout",
    items: [
      "TROIS a de vrais bruitages, plus sobres.",
      "Thème JoJo : ORA, MUDA et le thème de Jotaro suivent le volume en direct, même en plein morceau.",
      "Les effets de thème ont leurs vrais sons : le « ドン!! » de One Piece, Mao Mao, et le « tink » des émeraudes.",
      "Morpion Simpson : M. Burns et l'égalité passent en vraie qualité, en VF.",
      "En coulisses, les cartes Potopia avancent (réservées aux admins pour l'instant) : nouveau look des cartes, ouverture de boosters plus belle avec de vrais bruitages, Potodex plus grand et rangé en pages, et une carte SR ou mieux garantie au plus tard au 20e paquet.",
    ],
  },
  {
    date: "2026-11-13",
    title: "DOUZE débarque",
    items: [
      "Nouveau jeu : DOUZE, douze épreuves par jour autour du nombre 12. Jouable tout de suite, avec une intro courte et des épreuves qui changent bien d'un jour à l'autre.",
      "En coulisses, les admins testent les boosters de cartes (le paquet s'ouvre en 3D) et le Potodex, l'album où l'on range les cartes trouvées.",
    ],
  },
]);

/** Identifiant de la dernière mise à jour : la pastille « nouveau » reste tant qu'elle n'est pas lue. */
export const LATEST_PATCH_NOTE = PATCH_NOTES[0]?.date ?? "";
