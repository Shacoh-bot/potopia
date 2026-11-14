/**
 * Sons du jeu (`apps/web/public/audio/trois/<nom>.mp3`) : bips de cases de Motus, sons
 * d'interface de Pokémon TCG Pocket pour le reste, sons « mèmes » de myinstants pour le mode
 * Boobzilla (sources : `Trois assets/sons/sources.csv`, hors dépôt).
 */
export const TROIS_SOUNDS = [
  "key", // lettre tapée
  "back", // lettre effacée
  "click", // bouton
  "error", // mot refusé
  "tile-correct", // case retournée : lettre bien placée
  "tile-present", // mal placée
  "tile-absent", // absente
  "win", // mot trouvé
  "perfect", // 3 sur 3
  "lose", // mot perdu
  "success", // résultat copié
  // mode Boobzilla : sons « mèmes »
  "silly-roar",
  "silly-airhorn",
  "silly-fart-1",
  "silly-fart-2",
  "silly-boing",
  "silly-squeak",
  "silly-quack",
  "silly-slide",
  "silly-trombone",
] as const;

export type SoundName = (typeof TROIS_SOUNDS)[number];
