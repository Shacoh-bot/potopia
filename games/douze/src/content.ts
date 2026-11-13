// Contenu des épreuves de DOUZE : questions, mots, calculs, horloges. Les réponses sont calculées
// par le code quand c'est possible (longueur des mots, valeur des calculs), pour ne jamais se
// tromper sur ce qui fait 12.

/** « Douze ou pas douze ? » : la réponse est-elle 12 ? `answer` : la vraie réponse, affichée après. */
export type QuizQuestion = { id: string; text: string; answer: number };

export const QUIZ: readonly QuizQuestion[] = [
  { id: "hercule", text: "Travaux d'Hercule", answer: 12 },
  { id: "zodiaque", text: "Signes du zodiaque", answer: 12 },
  { id: "zodiaque-chinois", text: "Animaux du zodiaque chinois", answer: 12 },
  { id: "apotres", text: "Apôtres de Jésus", answer: 12 },
  { id: "mois", text: "Mois dans une année", answer: 12 },
  { id: "demi-tons", text: "Demi-tons dans une octave", answer: 12 },
  { id: "magnesium", text: "Numéro atomique du magnésium", answer: 12 },
  { id: "carbone", text: "Numéro atomique du carbone", answer: 6 },
  { id: "dodecaedre-faces", text: "Faces d'un dodécaèdre", answer: 12 },
  { id: "dodecaedre-sommets", text: "Sommets d'un dodécaèdre", answer: 20 },
  { id: "cube-aretes", text: "Arêtes d'un cube", answer: 12 },
  { id: "cube-faces", text: "Faces d'un cube", answer: 6 },
  { id: "icosaedre-sommets", text: "Sommets d'un icosaèdre", answer: 12 },
  { id: "icosaedre-faces", text: "Faces d'un icosaèdre", answer: 20 },
  { id: "douzaine", text: "Œufs dans une douzaine", answer: 12 },
  { id: "colere", text: "Hommes en colère (le film de Sidney Lumet)", answer: 12 },
  { id: "singes", text: "Singes de L'Armée des singes (Terry Gilliam)", answer: 12 },
  { id: "asterix", text: "Travaux d'Astérix (le dessin animé de 1976)", answer: 12 },
  { id: "olympe", text: "Grands dieux de l'Olympe", answer: 12 },
  { id: "chevaliers-or", text: "Chevaliers d'or dans Saint Seiya", answer: 12 },
  { id: "europe", text: "Étoiles du drapeau européen", answer: 12 },
  { id: "cadran", text: "Heures sur un cadran d'horloge", answer: 12 },
  { id: "pouces", text: "Pouces dans un pied", answer: 12 },
  { id: "nerfs", text: "Paires de nerfs crâniens", answer: 12 },
  { id: "ballon", text: "Pentagones d'un ballon de foot classique", answer: 12 },
  { id: "araignee", text: "Pattes d'une araignée", answer: 8 },
  { id: "cotes", text: "Côtes chez l'humain", answer: 24 },
  { id: "foot", text: "Joueurs d'une équipe de foot sur le terrain", answer: 11 },
  { id: "rugby", text: "Joueurs d'une équipe de rugby à XV sur le terrain", answer: 15 },
  { id: "volley", text: "Joueurs d'une équipe de volley sur le terrain", answer: 6 },
  { id: "nains", text: "Nains de Blanche-Neige", answer: 7 },
  { id: "arc-en-ciel", text: "Couleurs de l'arc-en-ciel", answer: 7 },
  { id: "planetes", text: "Planètes du système solaire", answer: 8 },
  { id: "heures", text: "Heures dans une journée", answer: 24 },
  { id: "echecs", text: "Pièces d'un joueur aux échecs", answer: 16 },
  { id: "dames", text: "Pions d'un joueur aux dames (damier de 10 × 10)", answer: 20 },
  { id: "touches-noires", text: "Touches noires par octave sur un piano", answer: 5 },
  {
    id: "mousquetaires",
    text: "Mousquetaires dans Les Trois Mousquetaires, d'Artagnan compris",
    answer: 4,
  },
  { id: "morpion", text: "Cases d'une grille de morpion", answer: 9 },
  { id: "semaine", text: "Jours dans une semaine", answer: 7 },
  { id: "douze-lettres", text: "Lettres dans le mot « DOUZE »", answer: 5 },
  { id: "mois-31", text: "Mois de 31 jours dans une année", answer: 7 },
];

/**
 * L'Oracle (toujours la 12e épreuve) : une question dont la vraie réponse n'est pas 12. La bonne
 * réponse, c'est 12. Toujours. `real` : la réponse que tout le monde choisit la première fois.
 */
export type OracleQuestion = { id: string; text: string; real: number; others: [number, number] };

export const ORACLE: readonly OracleQuestion[] = [
  { id: "araignee", text: "Combien de pattes a une araignée ?", real: 8, others: [6, 10] },
  { id: "semaine", text: "Combien de jours dans une semaine ?", real: 7, others: [5, 8] },
  { id: "saisons", text: "Combien de saisons dans une année ?", real: 4, others: [3, 5] },
  { id: "doigts", text: "Combien de doigts sur une main ?", real: 5, others: [4, 6] },
  { id: "deux-deux", text: "Combien font 2 + 2 ?", real: 4, others: [3, 22] },
  { id: "sept-six", text: "Combien font 7 + 6 ?", real: 13, others: [11, 14] },
  { id: "de", text: "Combien de faces a un dé classique ?", real: 6, others: [4, 8] },
  {
    id: "foot",
    text: "Combien de joueurs par équipe sur un terrain de foot ?",
    real: 11,
    others: [10, 9],
  },
  { id: "heures", text: "Combien d'heures dans une journée ?", real: 24, others: [20, 48] },
  { id: "minutes", text: "Combien de minutes dans une heure ?", real: 60, others: [100, 30] },
  { id: "drapeau", text: "Combien de couleurs sur le drapeau français ?", real: 3, others: [2, 4] },
  { id: "nains", text: "Combien de nains chez Blanche-Neige ?", real: 7, others: [6, 8] },
  {
    id: "planetes",
    text: "Combien de planètes dans le système solaire ?",
    real: 8,
    others: [9, 7],
  },
  { id: "triangle", text: "Combien de côtés a un triangle ?", real: 3, others: [2, 4] },
  { id: "roues", text: "Combien de roues a un vélo ?", real: 2, others: [1, 3] },
  {
    id: "trois",
    text: "Combien de mots à trouver chaque jour dans TROIS ?",
    real: 3,
    others: [2, 5],
  },
  { id: "pi", text: "Combien vaut π, à peu près ?", real: 3.14, others: [2.72, 1.41] },
  { id: "chat", text: "Combien de vies a un chat ?", real: 7, others: [9, 1] },
  { id: "zero", text: "Combien font 0 × 12 ?", real: 0, others: [1, 120] },
  {
    id: "quarante-deux",
    text: "Quelle est la réponse à la grande question sur la vie, l'univers et le reste ?",
    real: 42,
    others: [7, 0],
  },
];

/** Mots pour « Lequel a 12 lettres ? ». La longueur est comptée par le code (lettres seules). */
export const WORDS: readonly string[] = [
  // 12 lettres
  "DÉMÉNAGEMENT",
  "ENCYCLOPÉDIE",
  "TÉLÉPHONIQUE",
  "VOCIFÉRATION",
  "XYLOPHONISTE",
  "DOUZIÈMEMENT",
  "CHRYSANTHÈME",
  "PAMPLEMOUSSE",
  "TYRANNOSAURE",
  "VÉLOCIRAPTOR",
  "PTÉRODACTYLE",
  "SALTIMBANQUE",
  "BIBLIOTHÈQUE",
  "CHOCOLATERIE",
  "CHAUVE-SOURIS",
  // 11 lettres
  "BOULANGERIE",
  "CHAMPIGNONS",
  "GRENOUILLES",
  "HIPPOPOTAME",
  "LABORATOIRE",
  "QUINQUENNAT",
  "ÉPOUVANTAIL",
  "BRONTOSAURE",
  "MARSUPILAMI",
  "ABRACADABRA",
  "FARFADETTES",
  "PARACÉTAMOL",
  "SPÉLÉOLOGUE",
  "ARCHÉOLOGUE",
  // 13 lettres
  "ORNITHORYNQUE",
  "UNIVERSITAIRE",
  "ABRACADABRANT",
  "TINTINNABULER",
  "ACCORDÉONISTE",
  "ROCAMBOLESQUE",
  "CHAMBOULEMENT",
  "ASTRONAUTIQUE",
  "TRAMPOLINISTE",
  "CROQUEMITAINE",
];

/** Nombre de lettres d'un mot, sans accents, tirets ni espaces. */
export function letterCount(word: string): number {
  return [...word.normalize("NFD")].filter((c) => /\p{L}/u.test(c)).length;
}

/** Calculs pour « Coche tout ce qui fait 12 ». La valeur est calculée, jamais recopiée. */
export type Calc = { text: string; value: number };

export const CALCS: readonly Calc[] = [
  // font 12
  { text: "3 × 4", value: 3 * 4 },
  { text: "√144", value: Math.sqrt(144) },
  { text: "144 ÷ 12", value: 144 / 12 },
  { text: "0,12 × 100", value: 0.12 * 100 },
  { text: "2⁴ − 4", value: 2 ** 4 - 4 },
  { text: "5! ÷ 10", value: (5 * 4 * 3 * 2 * 1) / 10 },
  { text: "24 ÷ 2", value: 24 / 2 },
  { text: "7 + 5", value: 7 + 5 },
  { text: "3² + 3", value: 3 ** 2 + 3 },
  { text: "XII", value: 12 },
  { text: "une douzaine", value: 12 },
  { text: "0xC", value: 0xc },
  { text: "1100 en binaire", value: 0b1100 },
  { text: "6 + 6", value: 6 + 6 },
  { text: "100 − 88", value: 100 - 88 },
  // ne font pas 12
  { text: "99 ÷ 9", value: 99 / 9 },
  { text: "6 + 7", value: 6 + 7 },
  { text: "2 × 7", value: 2 * 7 },
  { text: "√121", value: Math.sqrt(121) },
  { text: "2³ + 3", value: 2 ** 3 + 3 },
  { text: "11 + 0,99", value: 11 + 0.99 },
  { text: "4 × π", value: 4 * Math.PI },
  { text: "XI", value: 11 },
  { text: "21", value: 21 },
  { text: "1 + 2", value: 1 + 2 },
  { text: "1,2", value: 1.2 },
  { text: "120 ÷ 12", value: 120 / 12 },
  { text: "une demi-douzaine", value: 6 },
  { text: "13 − 0", value: 13 },
  { text: "4 × 3,5", value: 4 * 3.5 },
];

/** Un calcul fait-il 12 (à l'arrondi près des nombres à virgule) ? */
export const isTwelve = (value: number) => Math.abs(value - 12) < 1e-9;

/** Horloges : l'heure à trouver et des heures qui y ressemblent (heures de 1 à 12, minutes). */
export type ClockTime = { h: number; m: number };
export type ClockRiddle = { label: string; target: ClockTime; decoys: ClockTime[] };

export const CLOCKS: readonly ClockRiddle[] = [
  {
    label: "12 h 12",
    target: { h: 12, m: 12 },
    decoys: [
      { h: 2, m: 12 },
      { h: 12, m: 24 },
      { h: 11, m: 12 },
      { h: 1, m: 12 },
      { h: 12, m: 10 },
    ],
  },
  {
    label: "midi pile",
    target: { h: 12, m: 0 },
    decoys: [
      { h: 11, m: 58 },
      { h: 12, m: 2 },
      { h: 11, m: 55 },
      { h: 12, m: 5 },
      { h: 1, m: 0 },
    ],
  },
  {
    label: "minuit moins douze",
    target: { h: 11, m: 48 },
    decoys: [
      { h: 12, m: 12 },
      { h: 11, m: 12 },
      { h: 12, m: 48 },
      { h: 10, m: 48 },
      { h: 11, m: 36 },
    ],
  },
  {
    label: "1 h moins 48",
    target: { h: 12, m: 12 },
    decoys: [
      { h: 12, m: 48 },
      { h: 1, m: 48 },
      { h: 11, m: 12 },
      { h: 1, m: 12 },
      { h: 12, m: 36 },
    ],
  },
];

/** Faux 12 pour « Trouve le vrai 12 » (un seul vrai par grille). */
export const FAKE_TWELVES: readonly string[] = ["I2", "l2", "|2", "1Z", "21", "lZ", "IZ", "1S"];

/** Ce qui défile au compteur fou : des sosies de 12, et le vrai de temps en temps. */
export const COUNTER_LOOKALIKES: readonly string[] = [
  "21",
  "11",
  "13",
  "112",
  "120",
  "1,2",
  "2",
  "22",
  "1",
  "122",
  "212",
];

/** Ce qu'on compte : l'objet et son sosie (qui ne compte pas). */
export const COUNTABLES: readonly { item: string; decoy: string; label: string }[] = [
  { item: "🦆", decoy: "🐤", label: "canards" },
  { item: "🥚", decoy: "🥔", label: "œufs" },
  { item: "🐑", decoy: "🐐", label: "moutons" },
  { item: "🍩", decoy: "🥯", label: "donuts" },
  { item: "🐸", decoy: "🐢", label: "grenouilles" },
  { item: "🌵", decoy: "🌲", label: "cactus" },
];
