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
    date: "2026-11-22",
    title: "Nouveaux effets et lumières de cartes",
    publicTitle: "Petites retouches",
    items: [
      "Accueil : les tuiles des apps remplissent toute la largeur du bloc, quelle que soit la taille de la fenêtre. Elles sont plus grandes et réparties en lignes équilibrées (plus de tuile seule sur sa ligne ni de grand vide à droite).",
      {
        admin: true,
        text: "Booster de test de l'admin : il pioche maintenant dans toutes les cartes (réserve « S? » et tous les sets), sauf la corbeille, les cartes marquées Doublon et celles sans image. Le booster des joueurs reste limité au set.",
      },
      {
        admin: true,
        text: "Cartes SSR : deux comètes d'énergie à cœur blanc font sans cesse le tour du cadre arc-en-ciel et débordent un peu en lueur autour de la carte, fluides dans Firefox.",
      },
      {
        admin: true,
        text: "Cartes SR : nouveau cadre carmin étoilé d'or : un carmin vif tourne autour de la carte, de petits éclats dorés scintillent sur le cadre et un halo carmin respire autour. À l'ouverture d'un booster, l'aura de la SR passe aussi au carmin et à l'or.",
      },
      {
        admin: true,
        text: "Cartes : bas de carte revu : set et numéro (« S1 1/100 », « S? » hors set), rareté et étoiles toujours côte à côte, AA juste après dans un cadre plus petit, puis « idée de … » toujours en entier. Textes plus petits et plus serrés ; le texte d'effet trop long rapetisse au lieu d'être coupé.",
      },
      {
        admin: true,
        text: "Cartes : le coût et la puissance restent collés au cadre quand on incline une carte ; avant, sur les cartes non retournables, ils flottaient devant et glissaient tout seuls.",
      },
      {
        admin: true,
        text: "Cartes : les points lumineux se règlent à part pour la normale et la full art : en retirer ou en déplacer un sur une version ne touche plus l'autre. « Reprendre ceux de la version… » recopie effets et points lumineux, seulement quand on clique.",
      },
      {
        admin: true,
        text: "Cartes : deux nouveaux effets visuels, « Lumière de vitrail » (la lumière traverse une illustration en vitrail) et « Énergie vivante » (les zones vives changent de teinte et pulsent).",
      },
      {
        admin: true,
        text: "Cartes : trois nouvelles lumières à placer, avec leur taille : « Eau » (l'image ondule, ronds dans l'eau), « Onde de fusion » (une onde de choc déforme l'image) et « Tourbillon » (l'image s'enroule en spirale).",
      },
      {
        admin: true,
        text: "Cartes : point lumineux plus doux, sans cercle net, et plus de halo blanc qui suit la souris au survol.",
      },
      {
        admin: true,
        text: "Admin cartes : bouton « Retour aux cartes » en haut à droite de la fiche.",
      },
    ],
  },
  {
    date: "2026-11-21",
    title: "Cartes plus lisibles, doublons plus simples",
    items: [
      { admin: true, text: "Cartes : effet visuel Glitch adouci, la carte reste lisible." },
      {
        admin: true,
        text: "Cartes : effets visuels réglables à part pour la normale et la full art.",
      },
      {
        admin: true,
        text: "Admin cartes : « Doublon de » se choisit dans une liste de cartes ; le retour de la fiche garde l'onglet et la vue.",
      },
      {
        admin: true,
        text: "Boîte à idées : « Doublon de » une autre idée, et onglet « Carte à créer ».",
      },
    ],
  },
  {
    date: "2026-11-20",
    title: "Préparation des cartes en 4 étapes",
    items: [
      {
        admin: true,
        text: "Admin cartes : 4 étapes de préparation (de « À traiter » à « À intégrer à un set »), coches de version côte à côte dans la fiche.",
      },
      {
        admin: true,
        text: "Admin cartes : espace de travail hors set, onglet Doublon, l'idée suit sa carte (« Lié à l'idée »).",
      },
    ],
  },
  {
    date: "2026-11-19",
    title: "Boosters plus rapides, étapes de préparation",
    items: [
      {
        admin: true,
        text: "Boosters : le prochain paquet est tiré d'avance et ses illustrations chargées avant le clic.",
      },
      {
        admin: true,
        text: "Admin cartes : étapes de préparation (onglets filtres, classement en un clic), boutons Normale / Full art sous chaque carte, « Tout cocher ».",
      },
    ],
  },
  {
    date: "2026-11-18",
    title: "Boosters fluides dès la première ouverture",
    items: [
      {
        admin: true,
        text: "Boosters : la première ouverture ne saccade plus.",
      },
      {
        admin: true,
        text: "Potodex : sous Firefox, les pastilles de mana et de puissance s'affichent entières sur la petite carte inclinée.",
      },
      {
        admin: true,
        text: "Admin : aperçu « Potodex complet », tout débloqué, en lecture seule.",
      },
    ],
  },
  {
    date: "2026-11-17",
    title: "Auras fluides, carte agrandie sous Firefox",
    items: [
      {
        admin: true,
        text: "Boosters : auras des cartes plus fluides, même rendu.",
      },
      {
        admin: true,
        text: "Cartes : sous Firefox, la carte agrandie s'affiche entière et centrée.",
      },
    ],
  },
  {
    date: "2026-11-16",
    title: "Ouverture des boosters plus vivante",
    items: [
      {
        admin: true,
        text: "Boosters : les auras de toutes les cartes révélées tournent en continu, un peu moins étendues, sans bord visible et toujours présentes derrière la carte quand elle bouge.",
      },
      {
        admin: true,
        text: "Boosters : sous Firefox, l'animation entre la découpe et les cartes s'affiche enfin. Échap sur une carte ouverte en grand ne ferme plus que la carte.",
      },
      {
        admin: true,
        text: "Cartes : l'avertissement « image trop petite » n'apparaît plus qu'en dessous de 1 500 px.",
      },
    ],
  },
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
