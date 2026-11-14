import type { EffectTrigger } from "./effects";

/*
 * Effets en français des cartes de collection de Marvel Snap qui ne sont pas dans `BASE_EFFECTS`
 * (src/effects.ts), indexés par le nom exact de la carte (celui de `SNAP_CARDS`). Écrits à la
 * main, reformulés (jamais une traduction mot à mot). Réglages entre accolades, valeur par défaut
 * = celle de la carte Snap : `{amount:2}`, `{amount2:3}`, `{count:2}`, `{cost:1}` (nombres),
 * `{name:Écureuil}`, `{name2:…}` (noms de jetons). `pnpm snap:catalog` liste les cartes qui
 * n'ont pas encore leur texte.
 */

export type SnapText = { trigger: EffectTrigger; label: string; text: string };

export const SNAP_TEXTS: Record<string, SnapText> = {
  Abomination: {
    trigger: "none",
    label: "Aucune capacité (stats seules)",
    text: "Aucune capacité.",
  },
  "Absorbing Man": {
    trigger: "reveal",
    label: "Copie le texte de ta dernière carte Révélation jouée",
    text: "Révélation : si ta dernière carte jouée a un effet Révélation, copie son texte.",
  },
  "Adam Warlock": {
    trigger: "end_of_turn",
    label: "Pioche si tu gagnes ici, sinon se renforce",
    text: "Fin de tour : si tu gagnes ici, pioche une carte. Sinon, +{amount:1}.",
  },
  "Adamantium Infusion": {
    trigger: "reveal",
    label: "Se bannit pour ramener ta carte détruite la plus forte, doublée",
    text: "Révélation : se bannit pour ramener ici ta carte détruite la plus forte, avec sa puissance doublée.",
  },
  Aero: {
    trigger: "reveal",
    label: "Attire ici la dernière carte jouée par l'adversaire",
    text: "Révélation : la dernière carte jouée par l'adversaire vient ici.",
  },
  Agamotto: {
    trigger: "start_of_game",
    label: "Mélange des Arcanes anciens dans ta pioche",
    text: "Début de partie : mélange {count:4} {name:Arcanes anciens} dans ta pioche.",
  },
  "Agatha Harkness": {
    trigger: "start_of_game",
    label: "Piochée d'office, joue tes cartes à ta place les tours pairs",
    text: "Début de partie : tu pioches Agatha. Les tours pairs, c'est elle qui joue tes cartes à ta place.",
  },
  "Agent Coulson": {
    trigger: "reveal",
    label: "Ajoute une carte à 4 coûts et une à 5 coûts à ta main",
    text: "Révélation : ajoute à ta main une carte au hasard à 4 coûts et une autre à 5 coûts.",
  },
  "Agent Venom": {
    trigger: "reveal",
    label: "Fixe la puissance des cartes de ta pioche",
    text: "Révélation : toutes les cartes de ta pioche passent à {amount:3} de puissance.",
  },
  Agony: {
    trigger: "ongoing",
    label: "Fusionne avec la prochaine carte que tu joues ici",
    text: "Permanent : après que tu joues une carte ici, fusionne avec elle.",
  },
  "Air-Walker": {
    trigger: "destroyed",
    label: "Remplacée par une carte à 4 coûts de ta main ou ta pioche",
    text: "Détruite : une carte à 4 coûts de ta main ou de ta pioche prend sa place.",
  },
  Ajax: {
    trigger: "ongoing",
    label: "Plus forte pour chaque carte en jeu affaiblie",
    text: "Permanent : +{amount:1} pour chaque carte en jeu qui subit un malus de puissance.",
  },
  "America Chavez": {
    trigger: "reveal",
    label: "Renforce la carte du dessus de ta pioche",
    text: "Révélation : +{amount:3} à la carte du dessus de ta pioche.",
  },
  Annihilus: {
    trigger: "reveal",
    label: "Fait changer de camp tes cartes à puissance négative",
    text: "Révélation : tes cartes à moins de 0 de puissance changent de camp. Celles qui ne le peuvent pas sont détruites.",
  },
  "Ant Man": {
    trigger: "ongoing",
    label: "Plus forte si ton côté de ce lieu est plein",
    text: "Permanent : +{amount:4} si ton côté de ce lieu est plein.",
  },
  "Anti-Polar Magneto": {
    trigger: "reveal",
    label: "Pose une carte à 3 ou 4 coûts de ta main dans chaque autre lieu",
    text: "Révélation : pose dans chaque autre lieu une carte à 3 ou 4 coûts de ta main.",
  },
  "Anti-Venom": {
    trigger: "reveal",
    label: "Met à 0 le coût et la puissance du dessus de ta pioche",
    text: "Révélation : la carte du dessus de ta pioche passe à 0 coût et 0 de puissance.",
  },
  Apocalypse: {
    trigger: "discarded",
    label: "Revient en main plus forte quand elle est défaussée",
    text: "Défaussée : revient dans ta main avec +{amount:4}.",
  },
  Araña: {
    trigger: "activate",
    label: "Renforce ta prochaine carte et la déplace à droite",
    text: "Activation : ta prochaine carte jouée gagne +{amount:1} et se déplace d'un lieu vers la droite.",
  },
  "Archangel Horseman of Death": {
    trigger: "objective",
    label: "Ressuscite une de tes cartes ici après plusieurs destructions",
    text: "Objectif : une fois que tes cartes ont été détruites {count:4} fois, ressuscite-en une ici avec +{amount:5}.",
  },
  Ares: {
    trigger: "reveal",
    label: "Plus forte si le dessus de ta pioche bat celui de l'adversaire",
    text: "Révélation : compare la puissance des 3 cartes du dessus de chaque pioche. Si ton total est plus élevé, +{amount:6}.",
  },
  Arishem: {
    trigger: "start_of_game",
    label: "Ajoute de nouvelles cartes à ta pioche et de l'énergie au tour 3",
    text: "Début de partie : mélange {count:12} nouvelles cartes dans ta pioche. Au tour 3, +{amount:1} d'énergie maximum.",
  },
  "Arnim Zola": {
    trigger: "reveal",
    label: "Détruit une de tes cartes ici pour la copier ailleurs",
    text: "Révélation : détruit une autre de tes cartes ici et en place une copie dans chacun des autres lieux.",
  },
  "Askani'son": {
    trigger: "activate",
    label: "Crée une carte dans un autre lieu, de plus en plus chère",
    text: "Activation : crée une carte à {cost:1} coût dans un autre lieu. Ce coût augmente chaque fois que tu gagnes ici au début d'un tour.",
  },
  "Astral Projection": {
    trigger: "reveal",
    label: "Copie le texte d'une carte Révélation de ta main",
    text: "Révélation : copie le texte d'une carte Révélation de ta main.",
  },
  Attuma: {
    trigger: "end_of_turn",
    label: "Détruit une de tes cartes plus faibles ici",
    text: "Fin de tour : détruit une autre de tes cartes ici moins puissante qu'elle.",
  },
  "Aunt May": {
    trigger: "end_of_turn",
    label: "Améliore une carte déplaçable de ta main après un déplacement",
    text: "Fin de tour : si tu as utilisé une capacité de déplacement, une carte déplaçable de ta main coûte {amount:1} de moins et gagne +{amount2:2}.",
  },
  Aurora: {
    trigger: "reveal",
    label: "Renforce une carte de chaque type d'effet dans chaque lieu",
    text: "Révélation : dans chaque lieu, +{amount:2} à une autre de tes cartes Révélation. Idem pour une carte Permanent, une Activation et une Fin de tour.",
  },
  "Awesome Andy": {
    trigger: "activate",
    label: "Renforce une de tes cartes dans chaque autre lieu",
    text: "Activation : +{amount:2} à une de tes cartes dans chaque autre lieu.",
  },
  "Baron Mordo": {
    trigger: "reveal",
    label: "Rend chère la carte du dessus de la pioche adverse",
    text: "Révélation : la carte du dessus de la pioche adverse coûte 6 jusqu'au tour 6.",
  },
  Bastion: {
    trigger: "reveal",
    label: "Copie en main tes autres cartes ici, à petit coût",
    text: "Révélation : ajoute à ta main une copie de chacune de tes autres cartes ici, à {cost:2} coûts et {amount:3} de puissance.",
  },
  "Batroc the Leaper": {
    trigger: "ongoing",
    label: "Suit une carte qui se déplace et se renforce",
    text: "Permanent : quand une carte se déplace, la suit et gagne +{amount:2} (une fois par tour).",
  },
  Beast: {
    trigger: "reveal",
    label: "Renvoie tes autres cartes d'ici en main, moins chères",
    text: "Révélation : renvoie tes autres cartes ici dans ta main. Elles coûtent {amount:1} de moins au prochain tour.",
  },
  "Beta Ray Bill": {
    trigger: "reveal",
    label: "Mélange Stormbreaker dans ta pioche",
    text: "Révélation : mélange {name:Stormbreaker} dans ta pioche.",
  },
  Bishop: {
    trigger: "ongoing",
    label: "Plus forte après chaque carte que tu joues",
    text: "Permanent : après chaque carte que tu joues, +{amount:1}.",
  },
  "Black Bolt": {
    trigger: "reveal",
    label: "Défausse la carte la moins chère de la main adverse",
    text: "Révélation : défausse la carte la moins chère de la main adverse.",
  },
  "Black Knight": {
    trigger: "ongoing",
    label: "Ajoute la Lame d'ébène en main après une défausse",
    text: "Permanent : après que tu défausses une carte, ajoute la {name:Lame d'ébène} à ta main, avec la puissance de cette carte (une fois par partie).",
  },
  "Black Panther": {
    trigger: "reveal",
    label: "Double sa puissance",
    text: "Révélation : double sa puissance.",
  },
  "Black Swan": {
    trigger: "activate",
    label: "Rend gratuites tes cartes à 1 coût jusqu'au prochain tour",
    text: "Activation : jusqu'à la fin du prochain tour, tes cartes à 1 coût coûtent 0.",
  },
  "Black Widow": {
    trigger: "activate",
    label: "Ajoute une Morsure de la Veuve à la main adverse",
    text: "Activation : ajoute une {name:Morsure de la Veuve} à la main adverse.",
  },
  Blink: {
    trigger: "reveal",
    label: "Échange ta dernière carte jouée avec une de ta pioche",
    text: "Révélation : remplace ta dernière carte jouée par une carte de ta pioche qui coûte autant ou plus.",
  },
  Blob: {
    trigger: "reveal",
    label: "Absorbe des cartes de ta pioche jusqu'à être très forte",
    text: "Révélation : absorbe des cartes de ta pioche jusqu'à avoir gagné 13 de puissance ou plus.",
  },
  "Blue Marvel": {
    trigger: "ongoing",
    label: "Renforce toutes tes autres cartes",
    text: "Permanent : tes autres cartes ont +{amount:1}.",
  },
  Boomerang: {
    trigger: "activate",
    label: "Revient en main en volant de la puissance à la main adverse",
    text: "Activation : revient dans ta main. Chaque fois qu'elle revient dans ta main, vole {amount:4} de puissance, répartie au hasard, aux personnages de la main adverse.",
  },
  "Bruce Banner": {
    trigger: "end_of_turn",
    label: "Peut se transformer en Hulk s'il te reste de l'énergie",
    text: "Fin de tour : s'il te reste de l'énergie, 33 % de chances de se transformer en Hulk.",
  },
  "Bucky Barnes": {
    trigger: "destroyed",
    label: "Remplacée par le Soldat de l'Hiver",
    text: "Détruite : le {name:Soldat de l'Hiver} prend sa place.",
  },
  Bullseye: {
    trigger: "activate",
    label: "Défausse tes cartes à 1 coût pour affaiblir autant d'adversaires",
    text: "Activation : défausse toutes les cartes à 1 coût ou moins de ta main, puis −{amount:2} à autant de cartes adverses différentes.",
  },
  Caiera: {
    trigger: "ongoing",
    label: "Protège tes cartes à 1 et 6 coûts de la destruction",
    text: "Permanent : tes cartes à 1 et 6 coûts ne peuvent pas être détruites.",
  },
  "Caliban Horseman of Pestilence": {
    trigger: "objective",
    label: "Affaiblit la carte adverse la plus chère",
    text: "Objectif : quand tu as {count:3} cartes à 4 coûts ou plus en jeu, −{amount:6} à la carte adverse la plus chère.",
  },
  "Captain Britain": {
    trigger: "ongoing",
    label: "Renforce tes grosses cartes jouées et réduit un coût en main",
    text: "Permanent : après que tu joues une carte à 4 coûts ou plus, elle gagne +{amount:1} et une carte de ta main coûte {amount2:1} de moins.",
  },
  "Captain Carter": {
    trigger: "ongoing",
    label: "Donne sa puissance à tes cartes du rang arrière ici",
    text: "Permanent : tes cartes du rang arrière ici gagnent autant de puissance qu'elle (pas elle-même).",
  },
  "Cassandra Nova": {
    trigger: "reveal",
    label: "Vole de la puissance à chaque carte de la pioche adverse",
    text: "Révélation : vole {amount:1} de puissance à chaque carte de la pioche adverse.",
  },
  Cerebro: {
    trigger: "ongoing",
    label: "Renforce tes cartes les plus fortes",
    text: "Permanent : tes cartes les plus fortes ont +{amount:3}.",
  },
  Chamber: {
    trigger: "activate",
    label: "Plus forte pour chacune de tes cartes à 5 coûts ou plus",
    text: "Activation : +{amount:2} pour chaque carte à 5 coûts ou plus que tu as ici et en main.",
  },
  Chameleon: {
    trigger: "reveal",
    label: "Copie le texte d'une carte révélée ici ce tour",
    text: "Révélation : copie le texte d'une autre carte ici que tu as révélée ce tour.",
  },
  Clea: {
    trigger: "ongoing",
    label: "Ajoute les Flammes de la Faltine en main quand elle se renforce",
    text: "Permanent : quand elle gagne de la puissance de façon durable (en main ou en jeu), ajoute les {name:Flammes de la Faltine} à ta main.",
  },
  Cloak: {
    trigger: "reveal",
    label: "Permet à toutes les cartes de venir ici au prochain tour",
    text: "Révélation : au prochain tour, toutes les cartes peuvent se déplacer vers ce lieu.",
  },
  Cobra: {
    trigger: "activate",
    label: "Détruit une carte adverse créée ici",
    text: "Activation : détruit ici une carte adverse créée par un effet.",
  },
  "Colleen Wing": {
    trigger: "reveal",
    label: "Défausse la carte la moins chère de ta main",
    text: "Révélation : défausse la carte la moins chère de ta main.",
  },
  "Colonel America": {
    trigger: "ongoing",
    label: "Renforce tes cartes ici pour chaque tour avec défausse",
    text: "Permanent : tes autres cartes ici ont +{amount:1} pour chaque tour où tu as défaussé une carte.",
  },
  Copycat: {
    trigger: "hand",
    label: "Copie en la piochant le texte du dessous de la pioche adverse",
    text: "Quand tu la pioches, copie le texte de la carte du dessous de la pioche adverse.",
  },
  "Corvus Glaive": {
    trigger: "reveal",
    label: "Défausse des cartes pour gagner de l'énergie maximum",
    text: "Révélation : défausse {count:2} cartes de ta main pour gagner +1 d'énergie maximum.",
  },
  "Cosmic Ghost Rider": {
    trigger: "reveal",
    label: "Retire le texte des cartes adverses du rang avant ici",
    text: "Révélation : retire le texte des cartes adverses du rang avant ici.",
  },
  Crossbones: {
    trigger: "hand",
    label: "Jouable seulement là où tu gagnes",
    text: "Ne peut être jouée que dans un lieu où tu gagnes.",
  },
  "Cull Obsidian": {
    trigger: "hand",
    label: "Jouable seulement là où tu as une carte à 1 coût",
    text: "Ne peut être jouée que dans un lieu où tu as une carte à 1 coût.",
  },
  Cyclops: {
    trigger: "none",
    label: "Aucune capacité (stats seules)",
    text: "Aucune capacité.",
  },
  Dagger: {
    trigger: "moved",
    label: "Plus forte pour chaque carte adverse là où elle arrive",
    text: "Quand elle se déplace, +{amount:2} pour chaque carte adverse dans le lieu où elle arrive.",
  },
  Daken: {
    trigger: "reveal",
    label: "Ajoute l'Éclat de Muramasa à ta main",
    text: "Révélation : ajoute l'{name:Éclat de Muramasa} à ta main.",
  },
  Danger: {
    trigger: "activate",
    label: "Détruit une carte adverse plus faible ici",
    text: "Activation : détruit une carte adverse ici moins puissante qu'elle.",
  },
  Darkhawk: {
    trigger: "ongoing",
    label: "Plus forte pour chaque carte de la pioche adverse",
    text: "Permanent : +{amount:2} pour chaque carte de la pioche adverse.",
  },
  Dazzler: {
    trigger: "ongoing",
    label: "Plus forte pour chaque lieu plein de ton côté",
    text: "Permanent : +{amount:2} pour chaque lieu où ton côté est plein.",
  },
  "Deafening Chord": {
    trigger: "reveal",
    label: "Retire le texte d'une petite carte adverse ici",
    text: "Révélation : retire le texte d'une carte adverse ici à 3 coûts ou moins.",
  },
  "Death Fractured Frontier": {
    trigger: "reveal",
    label: "Ressuscite toutes tes cartes détruites",
    text: "Révélation : ressuscite toutes tes cartes détruites, chacune dans un lieu au hasard.",
  },
  Deathlok: {
    trigger: "reveal",
    label: "Détruit tes autres cartes ici",
    text: "Révélation : détruit tes autres cartes ici.",
  },
  Debrii: {
    trigger: "reveal",
    label: "Ajoute un rocher dans chaque autre lieu",
    text: "Révélation : ajoute un {name:Rocher} dans chaque autre lieu.",
  },
  Diamondback: {
    trigger: "ongoing",
    label: "Aggrave le malus des cartes adverses affaiblies ici",
    text: "Permanent : les cartes adverses ici qui subissent un malus de puissance ont −{amount:2} de plus.",
  },
  "Doctor Doom": {
    trigger: "reveal",
    label: "Ajoute un Doombot dans chaque autre lieu",
    text: "Révélation : ajoute un {name:Doombot} de 5 de puissance dans chaque autre lieu.",
  },
  "Doctor Doom 2099": {
    trigger: "end_of_turn",
    label: "Ajoute un Doombot 2099 si tu as joué une seule carte",
    text: "Fin de tour : si tu as joué exactement 1 carte ce tour, ajoute un {name:Doombot 2099} dans un lieu au hasard.",
  },
  "Doctor Octopus": {
    trigger: "reveal",
    label: "Tire ici la carte la plus faible de la main adverse",
    text: "Révélation : la carte la moins puissante de la main adverse est posée de son côté, ici.",
  },
  "Doctor Octopus Fractured Frontier": {
    trigger: "reveal",
    label: "Remet une carte sur ta pioche contre un personnage au hasard",
    text: "Révélation : remet la carte la plus à gauche de ta main sur ta pioche et gagne un personnage au hasard. +{amount:3} aux deux.",
  },
  "Doctor Strange": {
    trigger: "reveal",
    label: "Déplace ici tes autres cartes les plus fortes",
    text: "Révélation : déplace ici tes autres cartes les plus fortes.",
  },
  Domino: {
    trigger: "hand",
    label: "Toujours piochée au tour 2",
    text: "Tu la pioches toujours au tour 2, jamais avant.",
  },
  Dormammu: {
    trigger: "start_of_game",
    label: "Lance un rituel d'invocation",
    text: "Début de partie : lance un rituel d'invocation (ajoute l'étape 1 à ta main).",
  },
  Dracula: {
    trigger: "end_of_game",
    label: "Défausse une carte de ta main pour gagner sa puissance",
    text: "Fin de partie : défausse une carte de ta main et gagne sa puissance.",
  },
  "Dragon Lord": {
    trigger: "reveal",
    label: "Pose ici une carte de ta main",
    text: "Révélation : pose ici une carte de ta main.",
  },
  "Dragon of the Moon": {
    trigger: "reveal",
    label: "Vole de la puissance aux cartes de coût pair de toutes les mains",
    text: "Révélation : vole {amount:1} de puissance à chaque carte de coût pair, dans TOUTES les mains.",
  },
  Drax: {
    trigger: "reveal",
    label: "Plus forte si l'adversaire a joué ici ce tour",
    text: "Révélation : si l'adversaire a joué une carte ici ce tour, +{amount:4}.",
  },
  "Drax, Avatar Of Life": {
    trigger: "end_of_turn",
    label: "Plus forte et traque la carte adverse plus puissante",
    text: "Fin de tour : si l'adversaire a joué ce tour une carte plus puissante, +{amount:3}. Rejoint ensuite le lieu de cette carte si cela t'y fait gagner.",
  },
  "Ebony Maw": {
    trigger: "ongoing",
    label: "Bloque ce lieu pour toi, jouable jusqu'au tour 3",
    text: "Permanent : tu ne peux plus jouer de cartes ici. Ne peut pas être jouée après le tour 3.",
  },
  Echo: {
    trigger: "ongoing",
    label: "Retire les capacités des cartes Permanent adverses jouées ici",
    text: "Permanent : après que l'adversaire joue une carte Permanent ici, retire ses capacités.",
  },
  Electro: {
    trigger: "reveal",
    label: "Donne de l'énergie maximum mais limite à une carte par tour",
    text: "Révélation : +{amount:1} d'énergie maximum. Permanent : tu ne peux jouer qu'une carte par tour.",
  },
  Elixir: {
    trigger: "reveal",
    label: "Ramène ici une carte détruite au tour précédent",
    text: "Révélation : ramène ici une de tes cartes détruites au tour précédent.",
  },
  "Elsa Bloodstone": {
    trigger: "ongoing",
    label: "Renforce chaque carte qui remplit ton côté d'un lieu",
    text: "Permanent : chaque carte que tu joues pour remplir ton côté d'un lieu gagne +{amount:2}.",
  },
  "Emperor Hulkling": {
    trigger: "start_of_game",
    label: "Copie le texte d'une carte à 6 coûts au hasard",
    text: "Début de partie : copie le texte d'une carte à 6 coûts au hasard.",
  },
  "En Sabah Nur": {
    trigger: "objective",
    label: "Se transforme en Apocalypse si tes rangs avant sont pleins",
    text: "Objectif : remplis le rang avant de chaque lieu pour te transformer en Apocalypse, l'élu des Célestes.",
  },
  "Entropic Havok": {
    trigger: "start_of_turn",
    label: "Vole de l'énergie bonus à l'adversaire",
    text: "Début de tour : vole {amount:1} d'énergie bonus à l'adversaire (s'il en a).",
  },
  "Esme Cuckoo": {
    trigger: "reveal",
    label: "Copie en main une carte de ta pioche avec coût et puissance fixés",
    text: "Révélation : copie une carte de ta pioche dans ta main, à {cost:3} coûts et {amount:4} de puissance.",
  },
  Eson: {
    trigger: "end_of_turn",
    label: "Pose ici une carte créée de ta main",
    text: "Fin de tour : pose ici une carte créée de ta main.",
  },
  "Ezekiel Sims": {
    trigger: "ongoing",
    label: "Se renforce et part quand tu joues ici une carte plus forte",
    text: "Permanent : après que tu joues ici une carte plus puissante qu'elle, gagne +{amount:2} et part dans un autre lieu.",
  },
  Falcon: {
    trigger: "reveal",
    label: "Renvoie tes cartes à 1 coût dans ta main",
    text: "Révélation : renvoie tes cartes à 1 coût dans ta main.",
  },
  "Fan Fei": {
    trigger: "activate",
    label: "Renforce tes autres cartes ici et les déplace à droite",
    text: "Activation : +{amount:1} à tes autres cartes ici, puis déplace-les d'un lieu vers la droite.",
  },
  Fantasticar: {
    trigger: "activate",
    label: "Renforce tes cartes Fin de tour",
    text: "Activation : +{amount:2} à tes cartes Fin de tour.",
  },
  Fantomex: {
    trigger: "activate",
    label: "Affaiblit les rangs avant adverses après défausse et destruction",
    text: "Activation : si tu as eu des cartes défaussées et des cartes détruites, −{amount:2} aux cartes adverses du rang avant, dans chaque lieu.",
  },
  "Fastball Special": {
    trigger: "reveal",
    label: "Sacrifie ta carte la plus forte ici pour affaiblir un adversaire",
    text: "Révélation : détruit ta carte la plus forte ici et inflige autant de puissance en moins à une carte adverse ici.",
  },
  "Fenris Wolf": {
    trigger: "activate",
    label: "Ressuscite de ton côté la plus forte carte adverse perdue",
    text: "Activation : ressuscite de ton côté, ici, la carte adverse défaussée ou détruite la plus forte.",
  },
  "Fin Fang Foom": {
    trigger: "reveal",
    label: "Gagne la puissance d'une carte adverse du rang avant ici",
    text: "Révélation : gagne la puissance d'une carte adverse du rang avant ici.",
  },
  Firehair: {
    trigger: "ongoing",
    label: "Rejoue l'effet Révélation de tes cartes détruites",
    text: "Permanent : quand une de tes cartes est détruite, Firehair déclenche son effet Révélation.",
  },
  Firelord: {
    trigger: "reveal",
    label: "Ramène ici une de tes cartes à 3 coûts défaussée ou détruite",
    text: "Révélation : ramène ici une de tes cartes à 3 coûts défaussée ou détruite.",
  },
  Forge: {
    trigger: "reveal",
    label: "Renforce ta prochaine carte jouée",
    text: "Révélation : ta prochaine carte jouée gagne +{amount:2}.",
  },
  "Friendly Neighborhood Carnage": {
    trigger: "reveal",
    label: "Pousse tes cartes d'ici vers la droite et se renforce",
    text: "Révélation : déplace tes autres cartes d'ici vers le lieu de droite, et gagne +{amount:2} pour chacune.",
  },
  Frigga: {
    trigger: "reveal",
    label: "Copie dans ta main ta dernière carte jouée",
    text: "Révélation : ajoute à ta main une copie de la dernière carte que tu as jouée (si possible).",
  },
  Galacta: {
    trigger: "ongoing",
    label: "Renforce chaque tour ta première carte jouée ailleurs",
    text: "Permanent : à chaque tour, ta première carte jouée dans un autre lieu est révélée avec +{amount:2}.",
  },
  "Galactus First Steps": {
    trigger: "end_of_turn",
    label: "Grandit quand tu gagnes le lieu de son Héraut",
    text: "Fin de tour : si tu gagnes le lieu de son Héraut, +{amount:2} (en main comme en jeu). Son Héraut est le prochain personnage que tu joues après l'avoir vue.",
  },
  Gambit: {
    trigger: "reveal",
    label: "Défausse une carte pour détruire une carte adverse",
    text: "Révélation : défausse une carte de ta main pour détruire une carte adverse au hasard.",
  },
  "Gambit Horseman of Death": {
    trigger: "objective",
    label: "Détruit des cartes adverses grâce à tes cartes créées",
    text: "Objectif : joue des cartes créées pour {amount2:6} coûts au total. Détruit alors au hasard des cartes adverses totalisant jusqu'à {amount:3} coûts.",
  },
  Gamora: {
    trigger: "reveal",
    label: "Plus forte si l'adversaire a joué ici ce tour",
    text: "Révélation : si l'adversaire a joué une carte ici ce tour, +{amount:4}.",
  },
  Ghost: {
    trigger: "reveal",
    label: "Retire les capacités des cartes Fin de tour ici",
    text: "Révélation : retire les capacités de toutes les cartes Fin de tour ici.",
  },
  Giganto: {
    trigger: "hand",
    label: "Jouable seulement dans le lieu de gauche",
    text: "Ne peut être jouée que dans le lieu de gauche.",
  },
  Gilgamesh: {
    trigger: "reveal",
    label: "Plus forte pour chacune de tes cartes renforcées",
    text: "Révélation : +{amount:1} pour chacune de tes autres cartes dont la puissance a augmenté.",
  },
  Gladiator: {
    trigger: "reveal",
    label: "Fait venir une carte adverse ici et la détruit si plus faible",
    text: "Révélation : place une carte de la pioche adverse ici, du côté adverse. Si elle a moins de puissance que Gladiator, elle est détruite.",
  },
  Goliath: {
    trigger: "ongoing",
    label: "Plus forte pour chacune de tes autres cartes Permanent",
    text: "Permanent : +{amount:1} pour chacune de tes autres cartes Permanent.",
  },
  Goose: {
    trigger: "ongoing",
    label: "Interdit ici les cartes à 4 coûts ou plus",
    text: "Permanent : personne ne peut jouer ici de carte à 4 coûts ou plus.",
  },
  Gorgon: {
    trigger: "ongoing",
    label: "Renchérit les cartes créées de l'adversaire",
    text: "Permanent : les cartes créées de l'adversaire coûtent {amount:1} de plus (6 maximum).",
  },
  "Gorr the God Butcher": {
    trigger: "ongoing",
    label: "Plus forte pour chaque carte Révélation en jeu",
    text: "Permanent : +{amount:2} pour CHAQUE carte à effet Révélation en jeu, des deux côtés.",
  },
  "Grand Master": {
    trigger: "reveal",
    label: "Envoie une carte Révélation au centre et rejoue son effet",
    text: "Révélation : déplace une autre de tes cartes Révélation d'ici vers le lieu du milieu ; son effet se déclenche à nouveau.",
  },
  "Green Goblin": {
    trigger: "reveal",
    label: "Passe du côté adverse",
    text: "Révélation : change de camp.",
  },
  Groot: {
    trigger: "reveal",
    label: "Plus fort si l'adversaire a joué ici ce tour",
    text: "Révélation : si l'adversaire a joué une carte ici ce tour, +{amount:4}.",
  },
  Gwenpool: {
    trigger: "reveal",
    label: "Renforce au hasard des personnages de ta main",
    text: "Révélation : {count:3} fois de suite, un personnage de ta main pris au hasard gagne +{amount:2}.",
  },
  "H.E.R.B.I.E.": {
    trigger: "activate",
    label: "Propose une nouvelle Activation à chaque tour",
    text: "Activation : sa capacité Activation change à chaque tour où elle est en jeu, jusqu'à ce que tu en utilises une.",
  },
  Havok: {
    trigger: "end_of_turn",
    label: "Échange ton énergie maximum contre de la puissance",
    text: "Fin de tour : tu perds {amount2:1} d'énergie maximum et elle gagne +{amount:3}.",
  },
  "Hawkeye Kate Bishop": {
    trigger: "reveal",
    label: "Ajoute des flèches à ta main",
    text: "Révélation : ajoute à ta main {count:2} jetons {name:Flèche}.",
  },
  Headpool: {
    trigger: "destroyed",
    label: "Revient en main et renforce toute ta main",
    text: "Détruite : revient dans ta main, puis +{amount:1} à toutes les cartes de ta main.",
  },
  Hela: {
    trigger: "reveal",
    label: "Ressuscite tes cartes défaussées, une par coût",
    text: "Révélation : pour chaque coût différent parmi tes cartes défaussées, ramène l'une d'elles dans un lieu au hasard.",
  },
  Helicarrier: {
    trigger: "discarded",
    label: "Remplit ta main de cartes au hasard",
    text: "Défaussée : remplit ta main de cartes au hasard.",
  },
  Hellcow: {
    trigger: "activate",
    label: "Défausse une carte de ta main",
    text: "Activation : défausse une carte de ta main.",
  },
  Hellion: {
    trigger: "reveal",
    label: "Rend tes cartes déplaçables vers ce lieu",
    text: "Révélation : au prochain tour, tes cartes peuvent se déplacer vers ce lieu.",
  },
  Hercules: {
    trigger: "ongoing",
    label: "Renvoie ailleurs la première carte alliée qui arrive ici",
    text: "Permanent : la première fois à chaque tour qu'une autre de tes cartes arrive ici, elle repart vers un autre lieu.",
  },
  "High Evolutionary": {
    trigger: "start_of_game",
    label: "Éveille tes cartes sans capacité",
    text: "Début de partie : libère le potentiel de tes cartes sans capacité.",
  },
  "Hit-Monkey": {
    trigger: "reveal",
    label: "Plus fort pour chaque autre carte jouée ce tour",
    text: "Révélation : +{amount:2} pour chaque autre carte que tu as jouée ce tour.",
  },
  Hobgoblin: {
    trigger: "reveal",
    label: "Passe du côté adverse",
    text: "Révélation : change de camp.",
  },
  "Hope Summers": {
    trigger: "ongoing",
    label: "Donne de l'énergie au tour suivant pour chaque carte jouée ici",
    text: "Permanent : après chaque carte que tu joues ici, +{amount:1} d'énergie au prochain tour.",
  },
  "Howard the Duck": {
    trigger: "ongoing",
    label: "Montre la carte du dessus de ta pioche",
    text: "Permanent : touche-la pour voir la carte du dessus de ta pioche.",
  },
  Hulk: {
    trigger: "none",
    label: "Aucune capacité (stats seules)",
    text: "Aucune capacité.",
  },
  "Human Torch": {
    trigger: "moved",
    label: "Double sa puissance quand elle se déplace",
    text: "Quand elle se déplace, double sa puissance.",
  },
  "Hydra Bob": {
    trigger: "end_of_turn",
    label: "Se déplace quand un joueur fait Snap",
    text: "Fin de tour : se déplace si un joueur a fait Snap.",
  },
  "Hydra Stomper": {
    trigger: "ongoing",
    label: "Plus fort pour chaque déplacement de tes cartes",
    text: "Permanent : +{amount:1} pour chaque déplacement d'une de tes cartes dans la partie.",
  },
  "Hydro-Man": {
    trigger: "reveal",
    label: "Fixe le coût du dessus de chaque pioche",
    text: "Révélation : la carte du dessus de CHAQUE pioche passe à {cost:1} coût.",
  },
  Ikari: {
    trigger: "hand",
    label: "Jouable seulement face à une carte adverse affaiblie",
    text: "Ne peut être jouée que dans un lieu où une carte adverse subit une baisse de puissance.",
  },
  "Infinity Ultron": {
    trigger: "reveal",
    label: "Ajoute des Pierres d'Ultron à ta main",
    text: "Révélation : ajoute à ta main {count:2} jetons {name:Pierre d'Ultron}.",
  },
  "Invisible Woman First Steps": {
    trigger: "activate",
    label: "Double les effets Fin de tour de tes cartes ce tour",
    text: "Activation : ce tour-ci, les effets Fin de tour de tes cartes se déclenchent deux fois.",
  },
  "Iron Fist": {
    trigger: "reveal",
    label: "Décale ta prochaine carte jouée vers la gauche",
    text: "Révélation : quand tu joues ta prochaine carte, elle se déplace d'un lieu vers la gauche.",
  },
  "Iron Lad": {
    trigger: "reveal",
    label: "Copie le texte du dessus de ta pioche",
    text: "Révélation : copie le texte de la carte du dessus de ta pioche.",
  },
  "Iron Patriot": {
    trigger: "reveal",
    label: "Ajoute une grosse carte en main, moins chère si tu gagnes ici",
    text: "Révélation : ajoute à ta main une carte au hasard à 4 coûts ou plus. Si tu gagnes ici après le prochain tour, elle coûte {amount:3} de moins.",
  },
  "J. Jonah Jameson": {
    trigger: "ongoing",
    label: "Rend tes émotes plus impolies",
    text: "Permanent : tes émotes de texte sont plus grossières.",
  },
  "Jack Flag": {
    trigger: "ongoing",
    label: "Renforce encore tes cartes déjà renforcées ici",
    text: "Permanent : tes cartes ici dont la puissance a augmenté ont +{amount:2}.",
  },
  "Jane Foster Fractured Frontier": {
    trigger: "reveal",
    label: "Juge des cartes au hasard : bonus aux tiennes, malus aux adverses",
    text: "Révélation : juge 4 autres personnages au hasard : +{amount:1} aux tiens, −{amount2:1} aux adverses. Dégaine : juge à nouveau les dignes.",
  },
  "Jane Foster Mighty Thor": {
    trigger: "reveal",
    label: "Tire toutes les cartes à 0 coût de ta pioche",
    text: "Révélation : tire de ta pioche toutes les cartes qui coûtent 0.",
  },
  "Jeff the Baby Dolphin!?": {
    trigger: "ongoing",
    label: "Renforce tes cartes révélées ici, déplaçable une fois",
    text: "Permanent : tes cartes sont révélées ici avec +{amount:1}. Déplaçable une fois.",
  },
  "Jeff the Baby Land Shark": {
    trigger: "ongoing",
    label: "Déplaçable une fois, rien ne peut le bloquer",
    text: "Permanent : déplaçable une fois. Rien ne peut t'empêcher de le jouer ou de le déplacer vers n'importe quel lieu.",
  },
  "Jennifer Kale": {
    trigger: "activate",
    label: "Donne de l'énergie au prochain tour",
    text: "Activation : +{amount:1} d'énergie au prochain tour.",
  },
  "Jim Hammond Human Torch": {
    trigger: "start_of_turn",
    label: "Plus fort pour chaque point d'énergie bonus",
    text: "Début de tour : +{amount:1} pour chaque point d'énergie bonus dont tu disposes.",
  },
  "Joaquin Torres Falcon II": {
    trigger: "ongoing",
    label: "Double les effets Révélation de tes cartes à 1 coût ici",
    text: "Permanent : les effets Révélation de tes cartes à 1 coût ici se déclenchent deux fois.",
  },
  Jocasta: {
    trigger: "activate",
    label: "Active tes autres cartes ici sans les consommer",
    text: "Activation : active aussitôt tes autres cartes ici (sans consommer leur Activation).",
  },
  Jubilee: {
    trigger: "reveal",
    label: "Place ici la carte du dessus de ta pioche",
    text: "Révélation : place ici la carte du dessus de ta pioche.",
  },
  "Jubilee Silver Surfer": {
    trigger: "ongoing",
    label: "Transmet sa puissance aux cartes que tu pioches",
    text: "Permanent : chaque carte que tu pioches gagne autant de puissance que celle-ci.",
  },
  "Juggernaut Horseman of War": {
    trigger: "objective",
    label: "Grandit si tes autres cartes ont des puissances variées",
    text: "Objectif : aie 6 puissances différentes parmi tes autres cartes en jeu. Elle gagne alors +{amount:6}.",
  },
  Kahhori: {
    trigger: "reveal",
    label: "Renforce tes cartes en jeu pour chaque carte en main",
    text: "Révélation : chaque carte de ta main donne +{amount:1} à une autre de tes cartes en jeu.",
  },
  Kang: {
    trigger: "start_of_game",
    label: "Se change en plusieurs Kang aux textes variés",
    text: "Début de partie : se remplace par {count:4} Kang portant chacun le texte d'une carte au hasard à 3 coûts ou plus.",
  },
  "Karen Page": {
    trigger: "reveal",
    label: "Renforce une de tes cartes à 1, 2 et 3 coûts",
    text: "Révélation : +{amount:2} à une de tes cartes à 1 coût, une à 2 coûts et une à 3 coûts.",
  },
  Khonshu: {
    trigger: "discarded",
    label: "Revient sous une autre phase et ressuscite un personnage défaussé",
    text: "Défaussée : revient sous sa phase suivante. Révélation : ramène dans un autre lieu un personnage que tu as défaussé, avec sa puissance fixée à {amount:5}.",
  },
  "Kid Omega": {
    trigger: "activate",
    label: "Détruit ta prochaine carte jouée et prend sa puissance",
    text: "Activation : détruit la prochaine carte que tu joues ce tour et gagne sa puissance.",
  },
  "King Eitri": {
    trigger: "activate",
    label: "Tire une carte créée de ta pioche",
    text: "Activation : tire de ta pioche une carte créée.",
  },
  Kingpin: {
    trigger: "ongoing",
    label: "Affaiblit les cartes adverses qui arrivent ici",
    text: "Permanent : chaque carte adverse qui arrive ici subit −{amount:2}.",
  },
  "Kitty Pryde": {
    trigger: "start_of_turn",
    label: "Revient en main et grandit à chaque retour",
    text: "Début de tour : revient dans ta main. Chaque fois qu'elle y revient, +{amount:1}.",
  },
  Klaw: {
    trigger: "ongoing",
    label: "Donne de la puissance au lieu de droite",
    text: "Permanent : le lieu de droite a +{amount:6} de puissance.",
  },
  Kluh: {
    trigger: "reveal",
    label: "Réduit le coût d'une carte en main de chaque joueur",
    text: "Révélation : CHAQUE joueur donne à une carte au hasard de sa main −{amount:1} coût par coût différent parmi ses cartes en jeu.",
  },
  Knull: {
    trigger: "ongoing",
    label: "Absorbe la puissance de toutes les cartes détruites",
    text: "Permanent : a la puissance cumulée de toutes les cartes détruites dans la partie.",
  },
  Korg: {
    trigger: "reveal",
    label: "Mélange un rocher dans la pioche adverse",
    text: "Révélation : mélange un {name:Rocher} dans la pioche adverse.",
  },
  Kraglin: {
    trigger: "reveal",
    label: "Bannit le dessus de ta pioche pour de l'énergie ou de la puissance",
    text: "Révélation : bannit la carte du dessus de ta pioche. Si elle coûtait 4 ou plus, +{amount2:2} d'énergie au prochain tour ; sinon, +{amount:4}.",
  },
  Kraven: {
    trigger: "ongoing",
    label: "Grandit chaque fois qu'une carte arrive ici",
    text: "Permanent : chaque fois qu'une carte arrive ici, +{amount:2}.",
  },
  "Lady Bullseye": {
    trigger: "reveal",
    label: "Affaiblit des cartes adverses selon ton énergie restante",
    text: "Révélation : −{amount:2} à une carte adverse, puis recommence sur une autre carte adverse pour chaque point d'énergie que tu n'as pas dépensé.",
  },
  "Lady Sif": {
    trigger: "reveal",
    label: "Défausse la carte la plus chère de ta main",
    text: "Révélation : défausse la carte la plus chère de ta main.",
  },
  Lancelot: {
    trigger: "ongoing",
    label: "Renforce encore tes cartes déjà renforcées",
    text: "Permanent : tes cartes dont la puissance a augmenté ont +{amount:1}.",
  },
  Lasher: {
    trigger: "activate",
    label: "Affaiblit une carte adverse ici de sa propre puissance",
    text: "Activation : une carte adverse ici perd autant de puissance que celle-ci en a.",
  },
  Leech: {
    trigger: "reveal",
    label: "Retire le texte des grosses cartes de la main adverse",
    text: "Révélation : retire le texte des cartes à 6 coûts ou plus de la main adverse.",
  },
  Legion: {
    trigger: "reveal",
    label: "Transforme les autres lieux en copies de celui-ci",
    text: "Révélation : les autres lieux deviennent des copies de celui-ci.",
  },
  "Lin Lie Iron Fist": {
    trigger: "reveal",
    label: "Ajoute l'Épée de Fu Xi dans un autre lieu",
    text: "Révélation : ajoute une {name:Épée de Fu Xi} dans un autre lieu.",
  },
  Lizard: {
    trigger: "ongoing",
    label: "Plus faible si l'adversaire a 4 cartes ici",
    text: "Permanent : −{amount:4} si l'adversaire a 4 cartes ici.",
  },
  Lockheed: {
    trigger: "end_of_turn",
    label: "Affaiblit une carte adverse ici si tu as joué une 1 coût",
    text: "Fin de tour : si tu as joué une carte à 1 coût ce tour, −{amount:2} à une carte adverse ici.",
  },
  Lockjaw: {
    trigger: "activate",
    label: "Échange ton prochain personnage joué avec un de ta pioche",
    text: "Activation : quand tu joues ton prochain personnage, il est échangé avec un personnage de ta pioche.",
  },
  Loki: {
    trigger: "reveal",
    label: "Prend la pioche de départ adverse, moins chère",
    text: "Révélation : ta pioche est remplacée par la pioche de départ de l'adversaire ; ces cartes coûtent {amount:1} de moins.",
  },
  "Luke Cage": {
    trigger: "ongoing",
    label: "Protège tes cartes du premier rang contre les baisses",
    text: "Permanent : la puissance de tes cartes du premier rang ne peut pas baisser.",
  },
  "Luna Snow": {
    trigger: "reveal",
    label: "Ajoute un glaçon de chaque côté de ce lieu",
    text: "Révélation : ajoute un {name:Glaçon} de chaque côté de ce lieu.",
  },
  "M.O.D.O.K.": {
    trigger: "reveal",
    label: "Défausse toute ta main",
    text: "Révélation : défausse ta main.",
  },
  "M'Baku": {
    trigger: "end_of_game",
    label: "Surgit de ta pioche dans ton lieu le plus faible",
    text: "Fin de partie : saute de ta pioche vers le lieu où tu as le moins de puissance (s'il n'est pas plein).",
  },
  "Mad Thinker": {
    trigger: "start_of_turn",
    label: "Plus fort si ta main est pleine",
    text: "Début de tour : après la pioche, +{amount:2} si ta main est pleine.",
  },
  "Madame Web": {
    trigger: "ongoing",
    label: "Rend déplaçable une autre de tes cartes ici chaque tour",
    text: "Permanent : à chaque tour, une autre de tes cartes ici est déplaçable (au choix).",
  },
  Magik: {
    trigger: "reveal",
    label: "Transforme ce lieu en Limbes",
    text: "Révélation : remplace ce lieu par les {name:Limbes}. Ne fonctionne plus après le tour 5.",
  },
  Magus: {
    trigger: "activate",
    label: "Copie le texte d'un personnage de ta pioche selon ton énergie",
    text: "Activation : copie le texte d'un personnage de ta pioche dont le coût égale ton énergie non dépensée (sans son effet Révélation).",
  },
  "Majestic Wingbeat": {
    trigger: "reveal",
    label: "Renforce la carte la plus à gauche de ta main",
    text: "Révélation : +{amount:3} à la carte la plus à gauche de ta main ; si elle coûte 5 ou plus, elle coûte aussi {amount2:1} de moins.",
  },
  "Major Victory": {
    trigger: "reveal",
    label: "Ajoute des membres des Gardiens à ta main",
    text: "Révélation : ajoute à ta main {count:2} membres de l'équipage des Gardiens.",
  },
  Makkari: {
    trigger: "end_of_turn",
    label: "Fonce de ta main vers un lieu au hasard",
    text: "Fin de tour : quitte ta main pour un lieu au hasard (si possible).",
  },
  Malekith: {
    trigger: "reveal",
    label: "Place ici une petite carte de ta pioche, cachée jusqu'à la fin",
    text: "Révélation : place ici une carte à 3 coûts ou moins de ta pioche ; elle ne se révèle qu'à la fin de la partie.",
  },
  "Man-Spider": {
    trigger: "reveal",
    label: "Absorbe ta dernière carte jouée et double sa puissance",
    text: "Révélation : fusionne avec la dernière carte que tu as jouée. Quand elle fusionne, double sa puissance.",
  },
  Mantis: {
    trigger: "reveal",
    label: "Copie en main une carte jouée ici par l'adversaire",
    text: "Révélation : si l'adversaire a joué des cartes ici ce tour, ajoute à ta main une copie de l'une d'elles.",
  },
  "Maria Hill": {
    trigger: "reveal",
    label: "Ajoute une carte à 2 coûts à ta main",
    text: "Révélation : ajoute à ta main une carte au hasard à 2 coûts.",
  },
  Marrow: {
    trigger: "discarded",
    label: "Répartit un malus au hasard entre les cartes adverses",
    text: "Défaussée ou détruite : répartit au hasard −{amount:7} entre les cartes adverses.",
  },
  Martyr: {
    trigger: "end_of_game",
    label: "Se déplace vers un lieu qui te fait perdre",
    text: "Fin de partie : se déplace vers un lieu qui te fait perdre la partie (si possible).",
  },
  "Marvel Boy": {
    trigger: "end_of_turn",
    label: "Renforce plusieurs de tes cartes à 1 coût",
    text: "Fin de tour : +{amount:1} à {count:3} de tes cartes différentes à 1 coût.",
  },
  "Mary Jane": {
    trigger: "end_of_turn",
    label: "Renforce tes cartes qui se sont déplacées ce tour",
    text: "Fin de tour : +{amount:1} à chacune de tes cartes qui s'est déplacée ce tour.",
  },
  "Master Mold": {
    trigger: "reveal",
    label: "Ajoute des Sentinelles à la main adverse",
    text: "Révélation : ajoute à la main adverse {count:2} cartes {name:Sentinelle}.",
  },
  Maverick: {
    trigger: "activate",
    label: "Donne sa puissance à ta prochaine carte jouée",
    text: "Activation : ta prochaine carte jouée gagne autant de puissance que celle-ci.",
  },
  Maximus: {
    trigger: "reveal",
    label: "Fait piocher des cartes à l'adversaire",
    text: "Révélation : l'adversaire pioche {count:2} cartes.",
  },
  Medusa: {
    trigger: "reveal",
    label: "Plus forte si jouée au lieu du milieu",
    text: "Révélation : si elle est au lieu du milieu, +{amount:3}.",
  },
  Merlin: {
    trigger: "start_of_turn",
    label: "Ajoute une incantation à ta main à chaque tour",
    text: "Début de tour : ajoute une {name:Incantation} à ta main.",
  },
  "Merlin of Avalon": {
    trigger: "reveal",
    label: "Ajoute Le Grand Dessein à ta main",
    text: "Révélation : ajoute {name:Le Grand Dessein} à ta main.",
  },
  Miek: {
    trigger: "ongoing",
    label: "Grandit et devient déplaçable quand tu défausses",
    text: "Permanent : chaque fois que tu défausses une carte, +{amount:1} et déplaçable au prochain tour.",
  },
  "Miles Morales Spider-Man": {
    trigger: "hand",
    label: "Moins chère si une carte a bougé au tour précédent",
    text: "Coûte {cost:1} si une carte s'est déplacée au tour précédent.",
  },
  Mirage: {
    trigger: "reveal",
    label: "Copie la carte la moins chère de la main adverse",
    text: "Révélation : copie dans ta main la carte la moins chère de la main adverse, avec +{amount:2}.",
  },
  Misery: {
    trigger: "reveal",
    label: "Répète les Révélations de tes cartes ici puis les détruit",
    text: "Révélation : répète les effets Révélation de tes autres cartes ici, puis les détruit.",
  },
  "Mister Fantastic": {
    trigger: "ongoing",
    label: "Renforce les lieux voisins",
    text: "Permanent : +{amount:3} à ta puissance dans les lieux voisins.",
  },
  "Mister Fantastic First Steps": {
    trigger: "end_of_turn",
    label: "Améliore une carte de ta main à chaque tour",
    text: "Fin de tour : une carte de ta main coûte {amount:1} de moins ou gagne +{amount2:3}.",
  },
  "Misty Knight": {
    trigger: "none",
    label: "Aucune capacité (stats seules)",
    text: "Aucune capacité.",
  },
  "Mobius M. Mobius": {
    trigger: "ongoing",
    label: "Bloque la hausse de tes coûts et la baisse des siens",
    text: "Permanent : tes coûts ne peuvent pas augmenter, et ceux de l'adversaire ne peuvent pas baisser.",
  },
  Mockingbird: {
    trigger: "hand",
    label: "Moins chère pour chacune de tes cartes créées en jeu",
    text: "Coûte {amount:1} de moins pour chacune de tes cartes en jeu créées par un effet.",
  },
  "Moira X": {
    trigger: "destroyed",
    label: "Rend une copie de ta main de départ",
    text: "Détruite : ajoute à ta main une copie de ta main de départ.",
  },
  Monstro: {
    trigger: "hand",
    label: "Moins chère selon le coût du dessus de ta pioche",
    text: "Coûte autant de moins que le coût de la carte du dessus de ta pioche.",
  },
  "Moon Girl": {
    trigger: "reveal",
    label: "Duplique ta main",
    text: "Révélation : ajoute à ta main une copie de chaque carte de ta main.",
  },
  "Moon Knight": {
    trigger: "reveal",
    label: "Défausse une carte de coût pair de chaque main",
    text: "Révélation : chaque joueur défausse une carte de coût pair de sa main.",
  },
  Moondragon: {
    trigger: "end_of_turn",
    label: "Grandit si tu joues une seule carte avec toute ton énergie",
    text: "Fin de tour : si tu as joué une seule carte ce tour et dépensé toute ton énergie, +{amount:2}.",
  },
  Moonstone: {
    trigger: "ongoing",
    label: "Copie les effets Permanent de tes petites cartes ici",
    text: "Permanent : possède les effets Permanent de tes cartes à 3 coûts ou moins ici.",
  },
  Morbius: {
    trigger: "ongoing",
    label: "Plus forte pour chaque défausse de la partie",
    text: "Permanent : +{amount:2} pour chaque fois que tu as défaussé une carte dans la partie.",
  },
  "Morgan le Fay": {
    trigger: "reveal",
    label: "Ramène en main tes cartes défaussées et détruites",
    text: "Révélation : ramène dans ta main toutes tes cartes défaussées ou détruites, avec +{amount:3}.",
  },
  Morph: {
    trigger: "reveal",
    label: "Devient la copie d'une carte de la main adverse",
    text: "Révélation : devient une copie d'une carte de la main adverse.",
  },
  "Ms. Marvel": {
    trigger: "ongoing",
    label: "Renforce les lieux voisins aux coûts tous différents",
    text: "Permanent : +{amount:6} dans chaque lieu voisin où tu as au moins 2 cartes, toutes de coûts différents.",
  },
  "Multiple Man": {
    trigger: "moved",
    label: "Laisse une copie d'elle en se déplaçant",
    text: "Quand elle se déplace, laisse une copie d'elle à son ancien lieu.",
  },
  Mysterio: {
    trigger: "reveal",
    label: "Crée une illusion et peut échanger sa puissance avec elle",
    text: "Révélation : ajoute une {name:Illusion} dans un autre lieu. Activation : échange sa puissance avec celle de l'illusion.",
  },
  Mystique: {
    trigger: "reveal",
    label: "Copie le texte Permanent de ta dernière carte jouée",
    text: "Révélation : si ta dernière carte jouée a un effet Permanent, copie son texte (si possible).",
  },
  Namor: {
    trigger: "ongoing",
    label: "Plus forte si c'est ta seule carte ici",
    text: "Permanent : +{amount:5} si c'est ta seule carte ici.",
  },
  Namora: {
    trigger: "reveal",
    label: "Renforce tes cartes seules dans les autres lieux",
    text: "Révélation : +{amount:5} à chacune de tes cartes qui est seule de ton côté dans un autre lieu.",
  },
  Namorita: {
    trigger: "ongoing",
    label: "Rend moins chères tes cartes piochées si elle est seule ici",
    text: "Permanent : tant que c'est ta seule carte ici, chaque carte que tu pioches coûte {amount:1} de moins.",
  },
  Nebula: {
    trigger: "ongoing",
    label: "Grandit à chaque tour où l'adversaire ne joue pas ici",
    text: "Permanent : à chaque tour où l'adversaire ne joue aucune carte ici, +{amount:2} (sauf le tour où tu la joues).",
  },
  "Negasonic Teenage Warhead": {
    trigger: "ongoing",
    label: "Détruit le premier personnage adverse joué ici",
    text: "Permanent : après qu'un personnage adverse est joué ici, le détruit (une fois par partie).",
  },
  "Nicholas Scratch": {
    trigger: "ongoing",
    label: "Grandit chaque fois que tu joues une compétence",
    text: "Permanent : chaque fois que tu joues une compétence, +{amount:1}.",
  },
  "Nick Fury": {
    trigger: "reveal",
    label: "Ajoute des cartes à 6 coûts au hasard dans ta main",
    text: "Révélation : ajoute à ta main {count:3} cartes au hasard à 6 coûts.",
  },
  "Nico Minoru": {
    trigger: "reveal",
    label: "Lance un sort après ta prochaine carte jouée",
    text: "Révélation : après ta prochaine carte jouée, lance un sort (le sort change à chaque tour).",
  },
  Nightmare: {
    trigger: "reveal",
    label: "Remplace le texte des cartes de ta main au hasard",
    text: "Révélation : chaque carte de ta main prend le texte d'une carte au hasard de même coût.",
  },
  Nimrod: {
    trigger: "destroyed",
    label: "Se copie dans chaque autre lieu",
    text: "Détruite : ajoute une copie d'elle dans chaque autre lieu.",
  },
  Nocturne: {
    trigger: "moved",
    label: "Change son lieu au hasard en se déplaçant",
    text: "Quand elle se déplace, le lieu où elle se trouve est remplacé par un nouveau lieu au hasard. Déplaçable une fois.",
  },
  "Nova Frankie Raye": {
    trigger: "ongoing",
    label: "Double sa puissance après ta prochaine carte à 6 coûts",
    text: "Permanent : après la prochaine carte à 6 coûts que tu joues, cette carte double sa puissance.",
  },
  Okoye: {
    trigger: "reveal",
    label: "Renforce toutes les cartes de ta pioche",
    text: "Révélation : +{amount:1} à chaque carte de ta pioche.",
  },
  "Omega Red": {
    trigger: "ongoing",
    label: "Renforce les autres lieux si tu gagnes ici",
    text: "Permanent : si tu gagnes ici, +{amount:3} à ta puissance dans les autres lieux.",
  },
  "Omega Sentinel": {
    trigger: "activate",
    label: "Affaiblit la carte adverse la plus forte",
    text: "Activation : −{amount:7} à la carte adverse la plus forte.",
  },
  Onslaught: {
    trigger: "ongoing",
    label: "Applique une fois de plus tes effets Permanent ici",
    text: "Permanent : les effets Permanent de tes autres cartes ici s'appliquent une fois de plus.",
  },
  Orka: {
    trigger: "ongoing",
    label: "Plus forte si c'est ta seule carte ici",
    text: "Permanent : +{amount:7} si c'est ta seule carte ici.",
  },
  Ozymandias: {
    trigger: "ongoing",
    label: "Renforce tes rochers",
    text: "Permanent : tes cartes {name:Rocher} ont +{amount:3}.",
  },
  Patriot: {
    trigger: "ongoing",
    label: "Renforce tes cartes sans capacité",
    text: "Permanent : tes cartes sans capacité ont +{amount:2}.",
  },
  "Peni Parker": {
    trigger: "reveal",
    label: "Ajoute SP//dr à ta main, énergie en plus à la fusion",
    text: "Révélation : ajoute {name:SP//dr} à ta main. Quand cette carte fusionne, +{amount:1} d'énergie au prochain tour.",
  },
  Phastos: {
    trigger: "reveal",
    label: "Améliore chaque carte de ta pioche",
    text: "Révélation : chaque carte de ta pioche coûte {amount:1} de moins ou gagne +{amount2:2}.",
  },
  "Phoenix Force": {
    trigger: "reveal",
    label: "Ressuscite une de tes cartes détruites et fusionne avec",
    text: "Révélation : ressuscite une de tes cartes détruites et fusionne avec elle. Elle devient déplaçable.",
  },
  Pixie: {
    trigger: "reveal",
    label: "Mélange les coûts des cartes de ta pioche",
    text: "Révélation : redistribue au hasard les coûts de base des cartes de ta pioche qui y étaient dès le début.",
  },
  Polaris: {
    trigger: "reveal",
    label: "Attire ici une petite carte adverse",
    text: "Révélation : attire ici une carte adverse de 1 ou 2 coûts.",
  },
  "Polaris Horseman of Pestilence": {
    trigger: "objective",
    label: "Pose une carte de ta main ici après 5 d'affaiblissement",
    text: "Objectif : infliger au total −5 de puissance aux cartes en jeu. Alors, place ici une carte de ta main.",
  },
  Prodigy: {
    trigger: "reveal",
    label: "Copie le texte de ta carte placée devant elle",
    text: "Révélation : si elle est au second rang, copie le texte de ta carte placée devant elle.",
  },
  Prowler: {
    trigger: "reveal",
    label: "Ajoute des outils de voleur à ta main",
    text: "Révélation : ajoute {count:2} {name:Outils de voleur} à ta main. Ils coûtent 0 si une carte s'est déplacée au tour précédent.",
  },
  "Proxima Midnight": {
    trigger: "discarded",
    label: "Rejoint ton lieu le plus faible quand elle est défaussée",
    text: "Défaussée : rejoint le lieu où tu as le moins de puissance (s'il n'est pas plein).",
  },
  "Psylocke Fractured Frontier": {
    trigger: "reveal",
    label: "Réduit le coût des grosses cartes de ta main",
    text: "Révélation : les cartes à 5 coûts ou plus de ta main coûtent {amount:1} de moins. Si tu la joues le tour où tu la pioches : toute ta main à la place.",
  },
  "Punisher War Machine": {
    trigger: "objective",
    label: "Gagne le lieu marqué pour plus d'énergie maximum",
    text: "Objectif : gagner le lieu vide de ton côté qu'elle marque quand tu la pioches. Alors, +{amount:1} d'énergie maximum.",
  },
  Quake: {
    trigger: "reveal",
    label: "Échange de place les deux autres lieux",
    text: "Révélation : échange de place les deux autres lieux.",
  },
  Quicksand: {
    trigger: "ongoing",
    label: "Annule le prochain bonus d'énergie adverse",
    text: "Permanent : la prochaine fois que l'adversaire devrait commencer un tour avec de l'énergie en plus, il ne la reçoit pas.",
  },
  Quicksilver: {
    trigger: "start_of_game",
    label: "Commence toujours dans ta main de départ",
    text: "Début de partie : commence dans ta main de départ.",
  },
  Quinjet: {
    trigger: "ongoing",
    label: "Réduit le coût de tes cartes créées",
    text: "Permanent : tes cartes créées coûtent {amount:1} de moins (minimum 1).",
  },
  "Rama-Tut": {
    trigger: "reveal",
    label: "Utilise des Révélations de cartes anciennes",
    text: "Révélation : déclenche {count:3} effets Révélation de cartes sorties avant l'époque de Rama-Tut.",
  },
  "Ravonna Renslayer": {
    trigger: "ongoing",
    label: "Réduit le coût de tes cartes faibles",
    text: "Permanent : tes cartes de 1 de puissance ou moins coûtent {amount:1} de moins (minimum 1).",
  },
  "Red Hulk": {
    trigger: "end_of_turn",
    label: "Grandit si l'adversaire n'a pas dépensé toute son énergie",
    text: "Fin de tour : si l'adversaire n'a pas dépensé toute son énergie, +{amount:3} (en main comme en jeu).",
  },
  "Red Hulk Fractured Frontier": {
    trigger: "reveal",
    label: "Plus faible pour chaque carte adverse ici",
    text: "Révélation : −{amount:1} pour chaque carte adverse ici. Si tu la joues le tour où tu la pioches : +{amount2:1} par carte à la place.",
  },
  "Red Onslaught": {
    trigger: "ongoing",
    label: "Possède des capacités Permanent au hasard",
    text: "Permanent : possède {count:3} capacités Permanent au hasard.",
  },
  "Red Shift": {
    trigger: "reveal",
    label: "Échange la carte de gauche de ta main contre une autre",
    text: "Révélation : défausse la carte la plus à gauche de ta main et ajoute à ta main une carte au hasard de même coût.",
  },
  "Red Skull": {
    trigger: "ongoing",
    label: "Renforce les cartes adverses ici",
    text: "Permanent : les cartes adverses ici ont +{amount:2}.",
  },
  "Red Wolf Fractured Frontier": {
    trigger: "reveal",
    label: "Plus forte pour chaque carte de ta main",
    text: "Révélation : +{amount:1} pour chaque carte de ta main. Si tu la joues le tour où tu la pioches : +{amount2:1} aux cartes de ta main.",
  },
  Redwing: {
    trigger: "moved",
    label: "Pose une carte de ta main en partant",
    text: "Quand elle se déplace pour la première fois, place une carte de ta main à son ancien lieu.",
  },
  Rescue: {
    trigger: "reveal",
    label: "Grandit si tu joues ici au prochain tour",
    text: "Révélation : si tu joues une carte ici au prochain tour, +{amount:5}.",
  },
  Rhino: {
    trigger: "reveal",
    label: "Ajoute un rocher de ton côté ici",
    text: "Révélation : ajoute un {name:Rocher} de ton côté ici.",
  },
  "Rocket and Groot": {
    trigger: "ongoing",
    label: "Vole de la puissance aux cartes adverses jouées ici",
    text: "Permanent : déplaçable une fois. Chaque fois que l'adversaire joue une carte ici, lui vole {amount:1} de puissance.",
  },
  "Rocket Raccoon": {
    trigger: "reveal",
    label: "Grandit si l'adversaire a joué ici ce tour",
    text: "Révélation : si l'adversaire a joué une carte ici ce tour, +{amount:4}.",
  },
  Rockslide: {
    trigger: "reveal",
    label: "Mélange des rochers dans la pioche adverse",
    text: "Révélation : mélange {count:2} cartes {name:Rocher} dans la pioche adverse.",
  },
  Rogue: {
    trigger: "reveal",
    label: "Vole le texte d'une carte Permanent adverse ici",
    text: "Révélation : vole le texte d'une carte Permanent adverse ici.",
  },
  "Rogue Scion of Division": {
    trigger: "reveal",
    label: "Vole le texte de la carte la plus chère de la main adverse",
    text: "Révélation : vole le texte de la carte la plus chère de la main adverse.",
  },
  "Ronan the Accuser": {
    trigger: "ongoing",
    label: "Plus forte pour chaque carte de la main adverse",
    text: "Permanent : +{amount:2} pour chaque carte de la main adverse.",
  },
  Sabretooth: {
    trigger: "destroyed",
    label: "Revient dans ta main gratuitement",
    text: "Détruite : revient dans ta main et coûte 0.",
  },
  Sage: {
    trigger: "reveal",
    label: "Plus forte pour chaque puissance différente ici",
    text: "Révélation : +{amount:2} pour chaque valeur de puissance différente parmi les autres cartes ici.",
  },
  "Sam Wilson Captain America": {
    trigger: "reveal",
    label: "Ajoute le bouclier de Cap dans un autre lieu",
    text: "Révélation : ajoute le {name:Bouclier de Cap} dans un autre lieu. Permanent : le bouclier est déplaçable.",
  },
  Sandstorm: {
    trigger: "reveal",
    label: "Ajoute des rochers à ta main",
    text: "Révélation : ajoute {count:2} cartes {name:Rocher} à ta main, avec +{amount:1} pour chacune de tes cartes au premier rang.",
  },
  Sauron: {
    trigger: "reveal",
    label: "Retire les capacités des cartes Permanent de ta pioche",
    text: "Révélation : retire les capacités de toutes les cartes Permanent de ta pioche.",
  },
  "Scarlet Spider": {
    trigger: "activate",
    label: "Ajoute un clone d'elle dans un autre lieu",
    text: "Activation : ajoute un clone exact d'elle dans un autre lieu.",
  },
  "Scarlet Witch": {
    trigger: "reveal",
    label: "Remplace ce lieu par un nouveau",
    text: "Révélation : remplace ce lieu par un nouveau.",
  },
  "Scarlet Witch Queen of Chaos": {
    trigger: "start_of_turn",
    label: "Ajoute une compétence très aléatoire gratuite à ta main",
    text: "Début de tour : ajoute à ta main une compétence EXTRÊMEMENT aléatoire, qui coûte 0 ce tour.",
  },
  Scorn: {
    trigger: "discarded",
    label: "Revient quand elle est défaussée et renforce un allié",
    text: "Défaussée : revient dans ta main et donne +{amount:2} à elle-même et à une de tes cartes en jeu.",
  },
  Scorpion: {
    trigger: "reveal",
    label: "Affaiblit les cartes de la main adverse",
    text: "Révélation : −{amount:1} aux cartes de la main adverse.",
  },
  "Scorpion Brand New Day": {
    trigger: "ongoing",
    label: "Double les baisses de puissance des cartes adverses",
    text: "Permanent : les baisses de puissance subies par les cartes adverses sont doublées.",
  },
  Scream: {
    trigger: "ongoing",
    label: "Vole de la puissance aux cartes adverses qui bougent",
    text: "Permanent : chaque fois qu'une carte adverse se déplace, lui vole {amount:2} de puissance (une fois par tour).",
  },
  "Sebastian Shaw": {
    trigger: "ongoing",
    label: "Gagne un bonus en plus chaque fois qu'elle est renforcée",
    text: "Permanent : chaque fois qu'elle gagne de la puissance, +{amount:2} en plus (en main, dans ta pioche ou en jeu).",
  },
  Selene: {
    trigger: "reveal",
    label: "Affaiblit la carte la plus faible de chaque main",
    text: "Révélation : −{amount:3} à la carte la plus faible de la main de chaque joueur.",
  },
  "Selene Horseman of Famine": {
    trigger: "objective",
    label: "Vole de la puissance si tu as 3 cartes sans capacité",
    text: "Objectif : avoir en jeu 3 de tes cartes sans capacité. Alors, vole {amount:5} de puissance à une carte adverse ici.",
  },
  Sentry: {
    trigger: "reveal",
    label: "Ajoute un Vide qui affaiblit le lieu de droite",
    text: "Révélation : ajoute un {name:Vide} de −9 de puissance au lieu de droite. Ne peut pas être jouée au lieu de droite.",
  },
  Sersi: {
    trigger: "reveal",
    label: "Transforme tes cartes ici en cartes plus chères",
    text: "Révélation : transforme tes autres cartes ici en cartes au hasard qui coûtent {amount:1} de plus (si possible).",
  },
  "Shadowlands Daredevil": {
    trigger: "reveal",
    label: "Mélange des démons dans ta pioche et grandit en piochant",
    text: "Révélation : mélange {count:3} {name:Démon} dans ta pioche. Quand tu pioches une carte de 6 de puissance ou plus, +{amount:2}.",
  },
  "Shang-Chi, Master of the Rings": {
    trigger: "start_of_game",
    label: "Commence avec les Dix Anneaux en main",
    text: "Début de partie : {name:Les Dix Anneaux} commencent dans ta main. Révélation : libère leur potentiel.",
  },
  Shanna: {
    trigger: "reveal",
    label: "Ajoute un personnage à 1 coût dans chaque lieu",
    text: "Révélation : ajoute un personnage au hasard à 1 coût dans chaque lieu.",
  },
  "She-Hulk": {
    trigger: "hand",
    label: "Moins chère pour chaque énergie non dépensée",
    text: "Coûte {amount:1} de moins pour chaque énergie non dépensée au tour précédent.",
  },
  Shocker: {
    trigger: "none",
    label: "Aucune capacité (stats seules)",
    text: "Aucune capacité.",
  },
  "Shou-Lao the Undying": {
    trigger: "reveal",
    label: "Renforce ton dernier personnage joué",
    text: "Révélation : ton dernier personnage joué gagne +{amount:2} pour chaque tour où tu as joué au moins 2 cartes.",
  },
  Shuri: {
    trigger: "reveal",
    label: "Double la puissance de ta prochaine carte jouée ici",
    text: "Révélation : si tu joues ta prochaine carte ici, double sa puissance.",
  },
  "Silver Sable": {
    trigger: "reveal",
    label: "Vole de la puissance au haut de la pioche adverse",
    text: "Révélation : vole {amount:2} de puissance au premier personnage de la pioche adverse.",
  },
  "Silver Samurai": {
    trigger: "reveal",
    label: "Défausse le personnage le plus faible de chaque main",
    text: "Révélation : chaque joueur défausse le personnage le plus faible de sa main.",
  },
  "Silver Surfer": {
    trigger: "reveal",
    label: "Renforce tes autres cartes à 3 coûts",
    text: "Révélation : +{amount:2} à tes autres cartes à 3 coûts.",
  },
  "Silver Surfer First Steps": {
    trigger: "end_of_turn",
    label: "Copie le texte d'une carte Révélation qui gagne ici",
    text: "Fin de tour : si tu gagnes ce lieu avec une carte Révélation, copie son texte.",
  },
  "Sinister Six": {
    trigger: "start_of_game",
    label: "Fusionne avec tes 6 premiers personnages piochés",
    text: "Début de partie : tes 6 premiers personnages piochés deviennent MALÉFIQUES ! Une fois tous joués, ils fusionnent en cette carte, ajoutée au lieu du dernier.",
  },
  Snowguard: {
    trigger: "reveal",
    label: "Ajoute deux aurores animales à ta main",
    text: "Révélation : ajoute à ta main les aurores {name:Faucon} et {name2:Ours}.",
  },
  Sparky: {
    trigger: "activate",
    label: "Renforce et ramène ta dernière carte déplacée",
    text: "Activation : +{amount:2} à ta dernière carte déplacée, qui retourne à son lieu précédent.",
  },
  Spectrum: {
    trigger: "reveal",
    label: "Renforce tes cartes Permanent",
    text: "Révélation : +{amount:2} à tes cartes Permanent.",
  },
  Speed: {
    trigger: "ongoing",
    label: "Plus forte pour chaque tour où toute l'énergie est dépensée",
    text: "Permanent : +{amount:1} pour chaque tour où tu as dépensé toute ton énergie.",
  },
  "Spider-Ham": {
    trigger: "activate",
    label: "Remplace le texte d'une carte de la main adverse par « oink ! »",
    text: "Activation : le texte d'un personnage au hasard de la main adverse devient « oink ! ».",
  },
  "Spider-Man 2099": {
    trigger: "moved",
    label: "Affaiblit une carte adverse là où elle arrive",
    text: "Quand elle se déplace, −{amount:3} à une carte adverse dans son nouveau lieu. Déplaçable une fois.",
  },
  "Spider-Man Brand New Day": {
    trigger: "moved",
    label: "Renforce une de tes cartes là où elle arrive",
    text: "Quand elle se déplace, +{amount:1} à une autre de tes cartes dans son nouveau lieu (même non révélée). Déplaçable deux fois.",
  },
  "Spider-Man Noir": {
    trigger: "reveal",
    label: "Passe le haut de ta pioche à 8 et peut l'amener ici",
    text: "Révélation : le personnage du dessus de ta pioche passe à 8 de puissance. Si tes autres cartes en jeu coûtent exactement 8 au total, il arrive ici.",
  },
  "Spider-Punk": {
    trigger: "moved",
    label: "Vole de la puissance à la plus forte carte adverse où elle arrive",
    text: "Quand elle se déplace, vole {amount:2} de puissance à la carte adverse la plus forte de son nouveau lieu. Déplaçable une fois.",
  },
  "Squirrel Girl": {
    trigger: "reveal",
    label: "Ajoute un écureuil dans chaque autre lieu",
    text: "Révélation : ajoute un {name:Écureuil} de 1 de puissance dans chaque autre lieu.",
  },
  "Star-Lord": {
    trigger: "reveal",
    label: "Plus forte si l'adversaire a joué ici ce tour",
    text: "Révélation : si l'adversaire a joué une carte ici ce tour, +{amount:4}.",
  },
  "Star-Lord, Master of the Sun": {
    trigger: "reveal",
    label: "Donne de l'énergie pour chaque tour fini avec de l'énergie restante",
    text: "Révélation : au prochain tour, +{amount:1} d'énergie pour chaque tour que tu as fini sans dépenser toute ton énergie.",
  },
  Starbrand: {
    trigger: "ongoing",
    label: "Renforce l'adversaire dans les autres lieux",
    text: "Permanent : l'adversaire a +{amount:3} de puissance dans chaque autre lieu.",
  },
  Stardust: {
    trigger: "ongoing",
    label: "Empêche d'ajouter des cartes en jeu autrement qu'en les jouant",
    text: "Permanent : une carte ne peut arriver dans un lieu qu'en y étant jouée ou déplacée.",
  },
  Starhawk: {
    trigger: "reveal",
    label: "Renforce tes cartes à gauche ou à droite selon le tour",
    text: "Révélation : +{amount:1} à tes cartes du lieu de gauche si le tour est impair, sinon à celles du lieu de droite.",
  },
  Stature: {
    trigger: "hand",
    label: "Moins chère si l'adversaire a défaussé une carte",
    text: "Coûte {cost:1} si l'adversaire a défaussé une carte pendant la partie.",
  },
  "Storm Horseman of Famine": {
    trigger: "objective",
    label: "Renforce tes cartes en jeu et en main après 2 tours d'économie",
    text: "Objectif : finis 2 tours de suite sans dépenser toute ton énergie. Alors +{amount:2} à tes autres cartes ici et aux cartes de ta main.",
  },
  "Strange Supreme": {
    trigger: "end_of_turn",
    label: "Absorbe tes cartes créées et grandit à chaque fusion",
    text: "Fin de tour : fusionne en elle une de tes cartes créées. Chaque fusion lui donne +{amount:2} de plus.",
  },
  "Strong Guy": {
    trigger: "ongoing",
    label: "Plus forte si ta main est presque vide",
    text: "Permanent : +{amount:6} si tu as 1 carte ou moins en main.",
  },
  Stryfe: {
    trigger: "objective",
    label: "Utilise ta carte Révélation la plus chère après 3 Révélations",
    text: "Objectif : joue 3 cartes Révélation. Alors utilise la carte Révélation la plus chère de ta main.",
  },
  "Sub-Mariner": {
    trigger: "ongoing",
    label: "Ajoute une carte à 1 coût renforcée quand elle est renforcée",
    text: "Permanent : chaque fois qu'elle est renforcée (en main ou en jeu), ajoute à ta main un personnage au hasard à 1 coût, renforcé d'autant.",
  },
  Sunspot: {
    trigger: "end_of_turn",
    label: "Grandit avec l'énergie non dépensée",
    text: "Fin de tour : +{amount:1} pour chaque point d'énergie non dépensé.",
  },
  "Super-Adaptoid": {
    trigger: "reveal",
    label: "Vole le texte d'une carte Activation adverse ici",
    text: "Révélation : vole le texte d'une carte adverse à effet Activation ici.",
  },
  "Super-Skrull": {
    trigger: "ongoing",
    label: "Possède les effets Permanent des cartes adverses",
    text: "Permanent : possède les effets Permanent de toutes les cartes adverses.",
  },
  Supergiant: {
    trigger: "reveal",
    label: "Cache toutes les cartes jouées au prochain tour",
    text: "Révélation : les cartes jouées au prochain tour ne sont révélées qu'à la fin de la partie.",
  },
  "Superior Iron Man": {
    trigger: "ongoing",
    label: "Double les bonus de puissance et les baisses de coût reçus",
    text: "Permanent : les bonus de puissance qu'elle reçoit sont doublés. Les baisses de coût qu'elle reçoit sont aussi doublées.",
  },
  "Superior Spider-Man": {
    trigger: "start_of_turn",
    label: "Donne de l'énergie si une de tes cartes a été renforcée",
    text: "Début de tour : +{amount:1} d'énergie si une de tes cartes a une puissance augmentée.",
  },
  Surge: {
    trigger: "reveal",
    label: "Améliore le dessus de ta pioche, en chaîne",
    text: "Révélation : la carte du dessus de ta pioche coûte {amount:1} de moins et gagne +{amount2:1}. Quand tu la joues, l'effet se répète.",
  },
  Surtur: {
    trigger: "ongoing",
    label: "Grandit quand tu joues une carte de 10 de puissance ou plus",
    text: "Permanent : après que tu joues une carte de 10 de puissance ou plus, +{amount:2}.",
  },
  Swarm: {
    trigger: "discarded",
    label: "Ajoute deux copies gratuites à ta main quand défaussée",
    text: "Défaussée : ajoute à ta main deux copies d'elle qui coûtent 0.",
  },
  "Sword Master": {
    trigger: "reveal",
    label: "Défausse une carte de coût impair",
    text: "Révélation : défausse une carte de coût impair de ta main.",
  },
  "Symbiote Spider-Man": {
    trigger: "activate",
    label: "Absorbe ta carte la moins chère ici et copie son texte",
    text: "Activation : fusionne en elle ta carte la moins chère ici et copie son texte, comme si elle venait d'être révélée.",
  },
  Tarantula: {
    trigger: "end_of_turn",
    label: "Renforce elle et ta main si tu as la carte la plus forte",
    text: "Fin de tour : si tu as la carte la plus forte en jeu, +{amount:1} à elle et à {count:2} personnages de ta main.",
  },
  Taskmaster: {
    trigger: "reveal",
    label: "Copie la puissance de ta dernière carte jouée",
    text: "Révélation : prend la puissance de la dernière carte que tu as jouée (si possible).",
  },
  "Techno-Organic Virus": {
    trigger: "reveal",
    label: "Infecte tes cartes ici et revient dans ta main",
    text: "Révélation : infecte tes cartes ici (leur texte est remplacé). Ajoute une copie d'elle à ta main.",
  },
  "Terrax the Tamer": {
    trigger: "reveal",
    label: "Mélange un rocher dans la pioche du perdant de chaque lieu",
    text: "Révélation : pour chaque lieu, mélange un {name:Rocher} dans la pioche du joueur qui y perd.",
  },
  "Thaddeus Ross": {
    trigger: "end_of_turn",
    label: "Pioche une grosse carte si l'adversaire n'a pas tout dépensé",
    text: "Fin de tour : si l'adversaire n'a pas dépensé toute son énergie, pioche une carte de 10 de puissance ou plus.",
  },
  Thanos: {
    trigger: "start_of_game",
    label: "Mélange les six Pierres d'Infinité dans ta pioche",
    text: "Début de partie : mélange les six {name:Pierres d'Infinité} dans ta pioche.",
  },
  "Thanos Fractured Frontier": {
    trigger: "start_of_game",
    label: "Charge des Tirs d'Infinité puis les tire tous",
    text: "Début de partie : tes cartes gagnent « Dégainage : Thanos charge un {name:Tir d'Infinité} ». Révélation : tire tous les Tirs chargés.",
  },
  "The Ancient One": {
    trigger: "reveal",
    label: "Ajoute le Mandala de Tao à ta main",
    text: "Révélation : ajoute le {name:Mandala de Tao} à ta main.",
  },
  "The Collector": {
    trigger: "ongoing",
    label: "Grandit quand une carte arrive dans ta main hors pioche",
    text: "Permanent : chaque fois qu'une carte arrive dans ta main d'ailleurs que ta pioche, +{amount:1}.",
  },
  "The Fallen One": {
    trigger: "reveal",
    label: "Fixe ton énergie maximale à sa puissance",
    text: "Révélation : ton énergie maximale devient égale à sa puissance.",
  },
  "The First Ghost Rider": {
    trigger: "reveal",
    label: "Défausse ta carte la plus faible et perd sa puissance",
    text: "Révélation : défausse le personnage le plus faible de ta main et perd autant de puissance que lui.",
  },
  "The Hood": {
    trigger: "reveal",
    label: "Ajoute un démon à ta main",
    text: "Révélation : ajoute un {name:Démon} à ta main.",
  },
  "The Hunger": {
    trigger: "reveal",
    label: "Renforce ta Horde zombie",
    text: "Révélation : ta Horde zombie gagne +{amount:3} (elle arrive dans ta main si tu n'en as pas).",
  },
  "The Infinaut": {
    trigger: "hand",
    label: "Injouable si tu as joué une carte au tour précédent",
    text: "Injouable si tu as joué une carte au tour précédent.",
  },
  "The Inversion": {
    trigger: "reveal",
    label: "Inverse la puissance des cartes les plus faibles ici",
    text: "Révélation : inverse la puissance de la ou des cartes les plus faibles ici (le positif devient négatif, et inversement).",
  },
  "The Thing": {
    trigger: "none",
    label: "Aucune capacité (stats seules)",
    text: "Aucune capacité.",
  },
  "The Thing First Steps": {
    trigger: "end_of_turn",
    label: "Grandit chaque tour et peut détruire une carte adverse ici",
    text: "Fin de tour : +{amount:2}. Une fois par partie, si ton côté ici est plein, détruit une carte adverse ici moins forte qu'elle.",
  },
  Thena: {
    trigger: "end_of_turn",
    label: "Grandit si tu as joué exactement 2 cartes",
    text: "Fin de tour : +{amount:3} si tu as joué exactement 2 cartes ce tour.",
  },
  Thor: {
    trigger: "reveal",
    label: "Mélange un marteau dans ta pioche",
    text: "Révélation : mélange {name:Mjolnir} dans ta pioche. Quand tu le joues, cette carte gagne +{amount:7}.",
  },
  Titania: {
    trigger: "ongoing",
    label: "Change de camp après chaque carte jouée ici",
    text: "Permanent : après chaque carte jouée ici (par n'importe qui), change de camp.",
  },
  Tombstone: {
    trigger: "reveal",
    label: "Détruit ta carte la plus faible dans chaque autre lieu",
    text: "Révélation : détruit ta carte la plus faible dans chaque autre lieu.",
  },
  Topaz: {
    trigger: "ongoing",
    label: "Envoie au lieu du milieu les cartes que tu joues ici",
    text: "Permanent : après que tu joues une carte ici, elle part au lieu du milieu.",
  },
  "Toxie Doxie": {
    trigger: "reveal",
    label: "Renforce des cartes de ta main mais les bloque un tour",
    text: "Révélation : +{amount:2} à {count:2} personnages de ta main. Tu ne peux pas les jouer au prochain tour.",
  },
  Toxin: {
    trigger: "reveal",
    label: "Renvoie tes autres cartes ici en main et grandit pour chacune",
    text: "Révélation : renvoie tes autres cartes ici dans ta main, et +{amount:2} pour chacune.",
  },
  Triton: {
    trigger: "reveal",
    label: "Renforce la dernière carte jouée par chaque joueur",
    text: "Révélation : +{amount:3} à la dernière carte jouée par CHAQUE joueur au tour précédent.",
  },
  "Typhoid Mary": {
    trigger: "ongoing",
    label: "Affaiblit tes autres cartes ici",
    text: "Permanent : tes autres cartes ici ont −{amount:2}.",
  },
  "U.S. Agent": {
    trigger: "ongoing",
    label: "Affaiblit les cartes chères ici",
    text: "Permanent : les cartes à 4 coûts ou plus ici ont −{amount:3}.",
  },
  "Uatu the Watcher": {
    trigger: "start_of_game",
    label: "Dévoile les lieux non révélés",
    text: "Début de partie : tu vois les lieux non révélés.",
  },
  Ultron: {
    trigger: "reveal",
    label: "Déploie des drones dans les autres lieux",
    text: "Révélation : déploie {count:4} jetons {name:Drone} de 2 de puissance dans chaque autre lieu.",
  },
  "Uncle Ben": {
    trigger: "destroyed",
    label: "Laisse place à Spider-Man quand il est détruit",
    text: "Détruite : est remplacée par {name:Spider-Man}.",
  },
  Valentina: {
    trigger: "reveal",
    label: "Ajoute une carte à 6 coûts allégée à ta main",
    text: "Révélation : ajoute à ta main une carte au hasard à 6 coûts, qui coûte {amount:2} de moins et a −{amount2:2}.",
  },
  "Vampire Deacon Frost": {
    trigger: "objective",
    label: "Se transforme après 3 vols de puissance",
    text: "Objectif : 3 de tes cartes ont volé de la puissance. Alors se transforme en {name:Béhémoth Écarlate}.",
  },
  "Vampire Enchantress": {
    trigger: "reveal",
    label: "Vole de la puissance selon la variété de tes coûts",
    text: "Révélation : pour chaque coût différent parmi tes cartes, vole {amount:1} de puissance à une carte adverse ici.",
  },
  "Vampire Killmonger": {
    trigger: "end_of_turn",
    label: "Obtient une lance vampirique si toute l'énergie est dépensée",
    text: "Fin de tour : si tu as dépensé toute ton énergie, obtiens une {name:Lance vampirique}.",
  },
  Venom: {
    trigger: "reveal",
    label: "Dévore tes autres cartes ici et prend leur puissance",
    text: "Révélation : détruit tes autres cartes ici et gagne leur puissance.",
  },
  Venus: {
    trigger: "ongoing",
    label: "Amplifie les renforcements de tes cartes",
    text: "Permanent : quand tes cartes sont renforcées, elles gagnent +{amount:1} de plus.",
  },
  "Victoria Hand": {
    trigger: "ongoing",
    label: "Renforce tes cartes créées dans ta main",
    text: "Permanent : tes cartes créées dans ta main ont +{amount:2}.",
  },
  Viper: {
    trigger: "reveal",
    label: "Fait changer de camp ta carte la plus faible ici",
    text: "Révélation : ta carte la plus faible ici (hors elle) change de camp.",
  },
  Vision: {
    trigger: "ongoing",
    label: "Déplaçable à chaque tour",
    text: "Permanent : déplaçable à chaque tour.",
  },
  "Viv Vision": {
    trigger: "start_of_turn",
    label: "Renforce ta main si tu gagnes ici, sinon se déplace",
    text: "Début de tour : si tu gagnes ici, +{amount:1} aux cartes de ta main. Sinon, part dans un autre lieu.",
  },
  Vulture: {
    trigger: "moved",
    label: "Grandit quand elle se déplace",
    text: "Quand elle se déplace, +{amount:4}.",
  },
  "Wade Wilson": {
    trigger: "destroyed",
    label: "Remplacé par une carte à 1 coût renforcée quand il est détruit",
    text: "Détruite : est remplacée par une carte à 1 coût de ta main ou de ta pioche, avec +{amount:2}.",
  },
  "War Machine": {
    trigger: "ongoing",
    label: "Te laisse jouer tes cartes n'importe où",
    text: "Permanent : rien ne peut t'empêcher de jouer tes cartes où tu veux.",
  },
  Warlock: {
    trigger: "activate",
    label: "Convertit l'énergie restante en baisses de coût",
    text: "Activation : pour chaque point d'énergie non dépensé, une carte de ta main coûte {amount:1} de moins.",
  },
  Warpath: {
    trigger: "ongoing",
    label: "Plus forte si un de tes lieux est vide",
    text: "Permanent : +{amount:5} si un de tes lieux est vide.",
  },
  Wasp: {
    trigger: "none",
    label: "Aucune capacité (stats seules)",
    text: "Aucune capacité.",
  },
  "Weapon H": {
    trigger: "discarded",
    label: "Revient moins chère quand défaussée",
    text: "Défaussée : revient dans ta main en coûtant {amount:2} de moins.",
  },
  "Weapon X Wolverine": {
    trigger: "ongoing",
    label: "Grandit quand tes autres cartes sont détruites",
    text: "Permanent : après la destruction d'une autre de tes cartes, +{amount:1}. Toutes les 3 destructions, ce bonus augmente de 1.",
  },
  "Web Sling": {
    trigger: "reveal",
    label: "Rend une de tes cartes ici déplaçable au prochain tour",
    text: "Révélation : au prochain tour, une de tes cartes ici (au choix) est déplaçable et gagne +{amount:1} quand elle se déplace.",
  },
  "Werewolf By Night": {
    trigger: "ongoing",
    label: "Suit tes cartes Révélation et grandit",
    text: "Permanent : après que tu joues une carte Révélation, la rejoint et gagne +{amount:2}.",
  },
  "White Queen": {
    trigger: "reveal",
    label: "Copie la carte la plus chère de la main adverse",
    text: "Révélation : copie dans ta main la carte la plus chère de la main adverse.",
  },
  "White Widow": {
    trigger: "reveal",
    label: "Place un Baiser de la Veuve chez l'adversaire",
    text: "Révélation : ajoute un {name:Baiser de la Veuve} du côté adverse de ce lieu.",
  },
  Wiccan: {
    trigger: "reveal",
    label: "Augmente ton énergie maximale si tu as tout dépensé",
    text: "Révélation : si tu as dépensé toute ton énergie à chaque tour précédent, +{amount:2} d'énergie maximale.",
  },
  "Wild Child": {
    trigger: "ongoing",
    label: "Plus forte après une défausse et après une destruction",
    text: "Permanent : +{amount:4} si tu as défaussé une carte, et +{amount2:4} si une de tes cartes a été détruite.",
  },
  "Wilson Fisk": {
    trigger: "hand",
    label: "Moins chère si tu as la carte la plus forte en jeu",
    text: "Coûte {cost:3} si tu as la carte la plus forte en jeu.",
  },
  Wolverine: {
    trigger: "discarded",
    label: "Réapparaît plus forte quand défaussée ou détruite",
    text: "Défaussée ou détruite : réapparaît dans un lieu au hasard avec +{amount:2}.",
  },
  "Wolverine Horseman of War": {
    trigger: "objective",
    label: "Renforce une carte par lieu une fois à 6 de puissance",
    text: "Objectif : atteins 6 de puissance ou plus. Alors +{amount:4} à une de tes cartes dans chaque lieu.",
  },
  "X-23": {
    trigger: "discarded",
    label: "Réapparaît et donne de l'énergie quand défaussée ou détruite",
    text: "Défaussée ou détruite : réapparaît dans un lieu au hasard, et tu as +{amount:1} d'énergie au prochain tour.",
  },
  Yellowjacket: {
    trigger: "reveal",
    label: "Affaiblit tes autres cartes ici",
    text: "Révélation : −{amount:1} à tes autres cartes ici.",
  },
  Yondu: {
    trigger: "reveal",
    label: "Bannit la carte la moins chère de la pioche adverse",
    text: "Révélation : bannit la carte la moins chère de la pioche adverse.",
  },
  Zabu: {
    trigger: "reveal",
    label: "Réduit le coût des cartes à 4 coûts de ta pioche",
    text: "Révélation : les cartes à 4 coûts de ta pioche coûtent {amount:1} de moins.",
  },
  Zero: {
    trigger: "reveal",
    label: "Retire les capacités de ta prochaine carte jouée",
    text: "Révélation : retire les capacités de la prochaine carte que tu joues.",
  },
  "Zombie Black Cat": {
    trigger: "discarded",
    label: "Défausse une autre carte Défaussée et saute en jeu",
    text: "Défaussée : défausse une autre carte à effet Défaussée, puis saute vers ton lieu qui a le moins de cartes.",
  },
  "Zombie Blade": {
    trigger: "end_of_turn",
    label: "Ta Horde vole de la puissance à la main adverse",
    text: "Fin de tour : si tu as joué une carte Révélation, ta Horde zombie vole {amount:1} de puissance à un personnage de la main adverse (la Horde arrive d'abord dans ta main si besoin).",
  },
  "Zombie Captain Marvel": {
    trigger: "activate",
    label: "Dévore tes autres cartes ici puis part là où tu perds",
    text: "Activation : détruit tes autres cartes ici et gagne +{amount:3} pour chacune, puis part vers un lieu où tu perds.",
  },
  "Zombie Galacti": {
    trigger: "start_of_game",
    label: "Transforme des cartes choisies de ta pioche en copies d'elle",
    text: "Début de partie : choisis {count:6} autres personnages de ta pioche. Révélation : ils deviennent des copies de cette carte.",
  },
  "Zombie Giant-Man": {
    trigger: "reveal",
    label: "Renforce ta Horde puis prend sa puissance",
    text: "Révélation : ta Horde zombie gagne +{amount:2}, puis cette carte gagne autant de puissance que ta Horde.",
  },
  "Zombie Mister Fantastic": {
    trigger: "reveal",
    label: "Renforce ta Horde puis tes cartes créées",
    text: "Révélation : ta Horde zombie gagne +{amount:2}. Activation : +{amount2:1} à 4 de tes cartes créées.",
  },
  "Zombie Power Man": {
    trigger: "end_of_turn",
    label: "Défausse ta carte la plus à gauche si tu gagnes ici",
    text: "Fin de tour : si tu gagnes ici, défausse la carte la plus à gauche de ta main.",
  },
  "Zombie Scarlet Witch": {
    trigger: "ongoing",
    label: "Renforce ta Horde quand tu joues ici",
    text: "Permanent : après que tu joues une carte ici, ta Horde zombie gagne +{amount:2}.",
  },
  "Zombie Sentry": {
    trigger: "reveal",
    label: "Renforce ta Horde selon tes cartes au lieu de droite",
    text: "Révélation : ta Horde zombie gagne +{amount:1} pour chacune de tes cartes au lieu de droite.",
  },
  "Zombie Venom": {
    trigger: "reveal",
    label: "Détruit une de tes cartes ici et nourrit ta Horde",
    text: "Révélation : détruit ta première autre carte ici. Ensuite, après chaque destruction d'une autre de tes cartes, ta Horde zombie gagne +{amount:3}.",
  },
};
