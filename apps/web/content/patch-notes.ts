import { z } from "zod";

/*
 * Patch notes du site : ce qui change, une entrée par jour de mise à jour, la plus récente en haut.
 * Chaque PR qui change quelque chose de visible ajoute ses lignes ici (dans l'entrée du jour, ou
 * une nouvelle entrée en tête), en français simple, sans jargon, sans numéro de PR ni pseudo.
 *
 * Visibilité : une ligne écrite en simple texte est pour tout le monde ; une nouveauté réservée
 * aux admins (cartes, boosters, Potodex, outils d'admin…) s'écrit `{ text, admin: true }`. Les
 * lignes admin ne partent jamais vers le navigateur d'un non-admin (`notesFor`, côté serveur) :
 * pour les autres, au plus une ligne vague, sans détail (« En coulisses, les admins préparent… »).
 */

const line = z.union([
  z.string().trim().min(1).max(300),
  z.object({ text: z.string().trim().min(1).max(300), admin: z.literal(true) }),
]);

const patchNote = z.object({
  /** Jour de la mise à jour (AAAA-MM-JJ), qui sert aussi d'identifiant. */
  date: z.iso.date("Date au format AAAA-MM-JJ."),
  title: z.string().trim().min(1).max(80),
  /** Titre montré aux non-admins quand le titre parle d'une nouveauté admin ; absent : `title`. */
  publicTitle: z.string().trim().min(1).max(80).optional(),
  items: z.array(line).min(1),
});

export type PatchNoteEntry = z.infer<typeof patchNote>;

/** Une entrée telle que l'envoie le serveur : seulement les lignes que ce compte peut voir. */
export type PatchNote = { date: string; title: string; items: string[] };

/**
 * Valide les entrées et les range de la plus récente à la plus ancienne. Refuse deux entrées du
 * même jour (une seule entrée par jour : on complète celle qui existe).
 */
export function parsePatchNotes(input: unknown): PatchNoteEntry[] {
  const notes = z.array(patchNote).min(1).parse(input);
  const dates = notes.map((n) => n.date);
  const twice = dates.find((d, i) => dates.indexOf(d) !== i);
  if (twice) throw new Error(`Deux entrées le ${twice} : regroupe-les en une seule.`);
  return [...notes].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Patch notes d'un compte, à appeler côté serveur : un admin voit tout ; un non-admin ne reçoit
 * aucune ligne admin, et une entrée sans ligne pour lui disparaît (ni titre, ni date, ni pastille).
 */
export function notesFor(notes: PatchNoteEntry[], isAdmin: boolean): PatchNote[] {
  return notes.flatMap((note) => {
    const items = note.items.flatMap((item) =>
      typeof item === "string" ? [item] : isAdmin ? [item.text] : [],
    );
    if (items.length === 0) return [];
    const title = isAdmin ? note.title : (note.publicTitle ?? note.title);
    return [{ date: note.date, title, items }];
  });
}

/** Date de la dernière entrée visible : la pastille « nouveau » reste tant qu'elle n'est pas lue. */
export function latestPatchNote(notes: PatchNote[]): string {
  return notes[0]?.date ?? "";
}

export const PATCH_NOTES = parsePatchNotes([
  {
    date: "2026-11-15",
    title: "Des cartes qui brillent à l'ouverture",
    items: [
      {
        admin: true,
        text: "Cartes : à l'ouverture d'un booster, chaque carte révélée s'entoure d'une aura qui monte en puissance avec sa rareté. Ailleurs, un simple halo doux au survol, et une carte cliquée s'ouvre en grand, bien nette, même pendant l'ouverture.",
      },
    ],
  },
  {
    date: "2026-11-14",
    title: "Des vrais sons un peu partout",
    items: [
      "TROIS a de vrais bruitages, plus sobres.",
      "Thème JoJo : ORA, MUDA et le thème de Jotaro suivent le volume en direct, même en plein morceau.",
      "Les effets de thème ont leurs vrais sons : le « ドン!! » de One Piece, Mao Mao, et le « tink » des émeraudes.",
      "Morpion Simpson : M. Burns et l'égalité passent en vraie qualité, en VF.",
      {
        admin: true,
        text: "Cartes : nouveau look (plus de coins dorés ni de gemmes, filet doré collé au cadre, full art plus lisible).",
      },
      {
        admin: true,
        text: "Boosters : ouverture plus belle, avec de vrais bruitages, et une carte SR ou mieux garantie au plus tard au 20e paquet.",
      },
      { admin: true, text: "Potodex : cartes plus grandes, rangées en pages." },
    ],
  },
  {
    date: "2026-11-13",
    title: "DOUZE débarque",
    items: [
      "Nouveau jeu : DOUZE, douze épreuves par jour autour du nombre 12. Jouable tout de suite, avec une intro courte et des épreuves qui changent bien d'un jour à l'autre.",
      "En coulisses, les admins préparent les cartes Potopia.",
      {
        admin: true,
        text: "Boosters de cartes en test (le paquet s'ouvre en 3D) et Potodex, l'album où l'on range les cartes trouvées.",
      },
    ],
  },
]);
