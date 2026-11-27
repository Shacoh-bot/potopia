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
    date: "2026-11-27",
    title: "Cartes : effets plus légers à afficher",
    publicTitle: "Petites retouches",
    items: [
      "Booster : le son d'une carte (victoire SR/SSR, son propre) part dès l'appui sur la carte, avec le retournement.",
      {
        admin: true,
        text: "Cartes SR : les 14 éclats dorés deviennent une seule image animée pré-calculée, partout. Banc des cartes : plus de choix d'éclats, et le son de « Rejouer le retournement » part dès le clic.",
      },
      {
        admin: true,
        text: "Potodex et planches de cartes : au repos, chaque carte devient une image fixe (cadre et effets arrêtés sur un instant) ; elle s'anime au survol, en grand et à l'ouverture d'un booster. Beaucoup moins de travail pour le navigateur quand il y a des dizaines de cartes.",
      },
      {
        admin: true,
        text: "Banc des cartes : la planche montre autant de cartes qu'une page du Potodex (ou plus, au choix), un clic ouvre la carte en grand comme au Potodex, et on peut glisser une carte pour la changer de place ; ses effets se mettent en pause pendant le geste, pour qu'il reste fluide.",
      },
      {
        admin: true,
        text: "Cartes : cadres SR et SSR, orbite, éclat, holo, lampe, métal et vitrail bougent sans redessiner la carte à chaque image (glissements et rotations seulement). Même rendu, moins de travail pour le navigateur, surtout Firefox.",
      },
      {
        admin: true,
        text: "Cartes : cadres SR et SSR et filets dorés des encadrés dessinés une fois en image (un élément au lieu de ~220 traits), bandes lumineuses simplifiées : 50 à 75 éléments par carte au lieu de 146 à 295. Même rendu.",
      },
      {
        admin: true,
        text: "Cartes SSR : la lueur autour du cadre est portée par ses lumières (4 animations au lieu de 8, même rendu). Une carte hors de l'écran met ses animations en pause.",
      },
      {
        admin: true,
        text: "Potodex et planches : une carte non survolée met en pause ses effets lourds (mirage, énergie, vitrail, aquarelle, glitch), sans éclats dorés SR et avec un grain d'effet sur trois. Au survol, elle redevient complète.",
      },
      {
        admin: true,
        text: "Banc d'essai des cartes : variantes à choisir pour les éclats dorés des SR (6 éclats, 3 groupes, image pré-calculée) et mirage/énergie par paliers, avec la variante active affichée. Le reste du site ne change pas.",
      },
      {
        admin: true,
        text: "Cartes : reflets du cadre cuits dans son image, halo du nom sans filtre, effets de l'illustration dans un calque à part. Plus aucune fusion sur une carte sans effet. Firefox : cadre un peu plus coloré, comme dans Chrome.",
      },
      {
        admin: true,
        text: "Potodex : l'aura des cartes épiques, légendaires, SR et SSR ne respire plus, elle reste fixe (bien plus léger). 12 cartes par page au lieu de 24, et la page suivante est préparée à l'avance : le changement de page est presque immédiat.",
      },
    ],
  },
  {
    date: "2026-11-26",
    title: "Cartes : plus rien ne s'efface au survol dans Firefox",
    publicTitle: "Petites retouches",
    items: [
      {
        admin: true,
        text: "Potodex et fiches : une aura simple qui respire autour des cartes épiques (très légère), légendaires, SR et SSR, aux couleurs de leur rareté. Le gros halo reste réservé à l'ouverture des boosters.",
      },
      {
        admin: true,
        text: "Booster : retourner une SR ou une SSR joue un son de victoire, un nouveau à chaque fois jusqu'à les avoir tous découverts. Le Potodex gagne un onglet « Sons » pour réécouter ceux déjà entendus (caché tant qu'on n'en a aucun).",
      },
      {
        admin: true,
        text: "Cartes : le cadre, le nom, le coût et la puissance ne s'effacent plus quand on survole une carte dans Firefox (booster, Potodex, fiches) : inclinaison sans 3D réelle, même rendu.",
      },
      {
        admin: true,
        text: "Booster : le retournement d'une carte ne montre plus les deux côtés à la fois (retournement « doublé »).",
      },
      {
        admin: true,
        text: "Cartes : nouvel effet « Vent » dans l'éditeur, des traînées d'air et des grains qui tourbillonnent autour de l'illustration.",
      },
      {
        admin: true,
        text: "Effet « Vent » : il tourne maintenant dans l'autre sens, plus fort et plus vite, par rafales irrégulières, comme du vrai vent.",
      },
      {
        admin: true,
        text: "Effet « Vent » refait : des bourrasques de lumière aux couleurs de l'illustration glissent vite le long des tourbillons peints, vers la droite en haut et vers la gauche en bas, avec étincelles et confettis.",
      },
      {
        admin: true,
        text: "Cartes : une carte peut avoir son propre son (normale et full art, à envoyer dans l'éditeur). Il remplace les bruitages quand elle se retourne dans un booster et s'éteint en fondu à la carte suivante ; le banc d'essai le fait réécouter avec « Rejouer le retournement ».",
      },
      {
        admin: true,
        text: "Cartes : filet de sécurité automatique. Avant chaque mise en ligne, les cartes de chaque rareté sont photographiées dans Firefox et Chrome, au repos et au survol : un changement de rendu ou une partie qui disparaît bloque la mise en ligne.",
      },
      {
        admin: true,
        text: "Booster : le son d'une carte (et sa révélation) part dès le début du retournement, sans attendre que la face apparaisse.",
      },
    ],
  },
  {
    date: "2026-11-25",
    title: "Cartes : plus d'aplat rouge ou doré, cadres SR/SSR toujours animés",
    publicTitle: "Petites retouches",
    items: [
      {
        admin: true,
        text: "Cartes : cadre de rareté et filets dorés dessinés sans découpe, plus d'aplat rouge ou doré sur la carte (booster, Potodex). Lumières des cadres SR/SSR : plus de carrés aux coins, animées aussi sans survol dans le Potodex.",
      },
      {
        admin: true,
        text: "Effets « cadre prismatique » et « liseré d'énergie » retirés (ils cachaient le cadre) : plus proposés ni affichés, réglage gardé. Éditeur : cocher un effet ne décale plus la liste (lien « Reprendre ceux de la version… » à place fixe).",
      },
      {
        admin: true,
        text: "Fluidité (booster, Potodex) : l'inclinaison d'une carte suit le pointeur avec un seul calcul par image, les lumières des cadres SR/SSR coûtent moins, et les lueurs d'ambiance du fond s'arrêtent sur ces écrans.",
      },
      {
        admin: true,
        text: "Nouveau « Banc d'essai des cartes » (admin) : une carte, une rangée de booster ou une planche, rareté et effets au choix, strates à couper une à une (3D, holo, cadre…) et compteur d'images par seconde. Pour trouver ce qui fait disparaître une partie des cartes. Lecture seule.",
      },
    ],
  },
  {
    date: "2026-11-24",
    title: "Booster de test : toutes les cartes, même set vide",
    publicTitle: "Petites retouches",
    items: [
      {
        admin: true,
        text: "Cartes : au survol, une carte pouvait se couvrir un instant de la couleur de sa rareté (image et texte cachés). Corrigé : le cadre ne peut plus recouvrir la carte.",
      },
      {
        admin: true,
        text: "Booster de test de l'admin : il pioche dans toutes les cartes du jeu, hors set, sans image et Doublon compris ; seule la corbeille reste exclue. Le bouton d'ouverture apparaît aussi quand le set est vide. Le booster des joueurs ne change pas.",
      },
      {
        admin: true,
        text: "Potodex complet : nouvel onglet « Toutes les cartes », ouvert par défaut, avec chaque carte du jeu (tous sets et réserve) hors corbeille et doublons, Normale et Full art. Lecture seule : ta collection ne change pas.",
      },
    ],
  },
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
