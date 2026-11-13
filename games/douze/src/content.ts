// Contenu des épreuves de DOUZE : questions, mots, calculs, horloges. Les réponses sont calculées
// par le code quand c'est possible (longueur des mots, valeur des calculs, géométrie, diviseurs),
// pour ne jamais se tromper sur ce qui fait 12. Les réserves sont assez grandes pour plus d'un
// mois sans revoir la même réponse (voir `rotation` dans trials.ts et les tests).

/** Nombre de lettres d'un mot, sans accents, tirets ni espaces. */
export function letterCount(word: string): number {
  return [...word.normalize("NFD")].filter((c) => /\p{L}/u.test(c)).length;
}

/** « Douze ou pas douze ? » : la réponse est-elle 12 ? `answer` : la vraie réponse, affichée après. */
export type QuizQuestion = { id: string; text: string; answer: number };

/** Faits vérifiés un par un. */
const QUIZ_FACTS: readonly QuizQuestion[] = [
  // font 12
  { id: "hercule", text: "Travaux d'Hercule", answer: 12 },
  { id: "zodiaque", text: "Signes du zodiaque", answer: 12 },
  { id: "zodiaque-chinois", text: "Animaux du zodiaque chinois", answer: 12 },
  { id: "apotres", text: "Apôtres de Jésus", answer: 12 },
  { id: "mois", text: "Mois dans une année", answer: 12 },
  { id: "mois-bissextile", text: "Mois dans une année bissextile", answer: 12 },
  { id: "demi-tons", text: "Demi-tons dans une octave", answer: 12 },
  { id: "magnesium", text: "Numéro atomique du magnésium", answer: 12 },
  { id: "dodecaedre-faces", text: "Faces d'un dodécaèdre", answer: 12 },
  { id: "cube-aretes", text: "Arêtes d'un cube", answer: 12 },
  { id: "icosaedre-sommets", text: "Sommets d'un icosaèdre", answer: 12 },
  { id: "octaedre-aretes", text: "Arêtes d'un octaèdre", answer: 12 },
  { id: "cuboctaedre-sommets", text: "Sommets d'un cuboctaèdre", answer: 12 },
  { id: "d12", text: "Faces d'un dé à douze faces", answer: 12 },
  { id: "douzaine", text: "Œufs dans une douzaine", answer: 12 },
  { id: "colere", text: "Hommes en colère (le film de Sidney Lumet)", answer: 12 },
  { id: "singes", text: "Singes de L'Armée des singes (Terry Gilliam)", answer: 12 },
  { id: "asterix", text: "Travaux d'Astérix (le dessin animé de 1976)", answer: 12 },
  { id: "salopards", text: "Salopards dans le film de Robert Aldrich (1967)", answer: 12 },
  { id: "princesses", text: "Princesses dansantes du conte des frères Grimm", answer: 12 },
  { id: "olympe", text: "Grands dieux de l'Olympe", answer: 12 },
  {
    id: "titans",
    text: "Titans et Titanides, enfants d'Ouranos et Gaïa selon Hésiode",
    answer: 12,
  },
  { id: "chevaliers-or", text: "Chevaliers d'or dans Saint Seiya", answer: 12 },
  { id: "jedi", text: "Membres du Haut Conseil Jedi", answer: 12 },
  { id: "europe", text: "Étoiles du drapeau européen", answer: 12 },
  { id: "cadran", text: "Heures sur un cadran d'horloge", answer: 12 },
  { id: "minuit", text: "Coups de l'horloge à minuit", answer: 12 },
  { id: "midi-minuit", text: "Heures entre midi et minuit", answer: 12 },
  { id: "pouces", text: "Pouces dans un pied", answer: 12 },
  { id: "pence", text: "Pence dans un shilling (avant 1971)", answer: 12 },
  { id: "deniers", text: "Deniers dans un sou, sous l'Ancien Régime", answer: 12 },
  {
    id: "livre-sterling",
    text: "Côtés de la pièce d'une livre sterling (depuis 2017)",
    answer: 12,
  },
  { id: "nerfs", text: "Paires de nerfs crâniens", answer: 12 },
  { id: "paires-cotes", text: "Paires de côtes chez l'humain", answer: 12 },
  { id: "vertebres", text: "Vertèbres thoraciques chez l'humain", answer: 12 },
  { id: "molaires", text: "Molaires d'un adulte, dents de sagesse comprises", answer: 12 },
  { id: "ballon", text: "Pentagones d'un ballon de foot classique", answer: 12 },
  { id: "tribus", text: "Tribus d'Israël", answer: 12 },
  { id: "noel", text: "Jours de Noël dans la chanson anglaise", answer: 12 },
  { id: "cesars", text: "Césars dans le livre de Suétone", answer: 12 },
  { id: "pairs", text: "Pairs de Charlemagne dans les chansons de geste", answer: 12 },
  { id: "jury", text: "Jurés d'un jury pénal américain", answer: 12 },
  { id: "lune", text: "Humains ayant marché sur la Lune", answer: 12 },
  { id: "republicain", text: "Mois du calendrier républicain français", answer: 12 },
  { id: "maisons", text: "Maisons du thème astral", answer: 12 },
  {
    id: "dames-anglaises",
    text: "Pions de chaque joueur aux dames sur un damier de 8 × 8",
    answer: 12,
  },
  { id: "figures", text: "Figures (valets, dames, rois) dans un jeu de 52 cartes", answer: 12 },
  { id: "douze-tables", text: "Tables de la loi romaine des Douze Tables", answer: 12 },
  // ne font pas 12
  { id: "carbone", text: "Numéro atomique du carbone", answer: 6 },
  { id: "dodecaedre-sommets", text: "Sommets d'un dodécaèdre", answer: 20 },
  { id: "dodecaedre-aretes", text: "Arêtes d'un dodécaèdre", answer: 30 },
  { id: "icosaedre-faces", text: "Faces d'un icosaèdre", answer: 20 },
  { id: "octaedre-faces", text: "Faces d'un octaèdre", answer: 8 },
  { id: "cube-sommets", text: "Sommets d'un cube", answer: 8 },
  { id: "araignee", text: "Pattes d'une araignée", answer: 8 },
  { id: "cotes", text: "Côtes chez l'humain", answer: 24 },
  { id: "dents-lait", text: "Dents de lait d'un enfant", answer: 20 },
  { id: "ophiuchus", text: "Signes du zodiaque si l'on compte Ophiuchus", answer: 13 },
  { id: "couleur-cartes", text: "Cartes d'une même couleur dans un jeu de 52", answer: 13 },
  { id: "demi-douzaine", text: "Œufs dans une demi-douzaine", answer: 6 },
  { id: "semestre", text: "Mois dans un semestre", answer: 6 },
  { id: "trimestre-semaines", text: "Semaines dans un trimestre", answer: 13 },
  { id: "foot", text: "Joueurs d'une équipe de foot sur le terrain", answer: 11 },
  { id: "rugby", text: "Joueurs d'une équipe de rugby à XV sur le terrain", answer: 15 },
  { id: "rugby-xiii", text: "Joueurs d'une équipe de rugby à XIII sur le terrain", answer: 13 },
  { id: "volley", text: "Joueurs d'une équipe de volley sur le terrain", answer: 6 },
  { id: "nains", text: "Nains de Blanche-Neige", answer: 7 },
  { id: "arc-en-ciel", text: "Couleurs de l'arc-en-ciel", answer: 7 },
  { id: "planetes", text: "Planètes du système solaire", answer: 8 },
  { id: "heures", text: "Heures dans une journée", answer: 24 },
  { id: "echecs", text: "Pièces d'un joueur aux échecs", answer: 16 },
  { id: "dames", text: "Pions d'un joueur aux dames sur un damier de 10 × 10", answer: 20 },
  { id: "touches-noires", text: "Touches noires par octave sur un piano", answer: 5 },
  {
    id: "mousquetaires",
    text: "Mousquetaires dans Les Trois Mousquetaires, d'Artagnan compris",
    answer: 4,
  },
  { id: "morpion", text: "Cases d'une grille de morpion", answer: 9 },
  { id: "semaine", text: "Jours dans une semaine", answer: 7 },
  { id: "mois-31", text: "Mois de 31 jours dans une année", answer: 7 },
  { id: "yard", text: "Pieds dans un yard", answer: 3 },
];

/** Bases des prismes et pyramides (nombre de côtés → nom). */
const BASES: readonly [number, string][] = [
  [3, "triangulaire"],
  [4, "carrée"],
  [5, "pentagonale"],
  [6, "hexagonale"],
  [7, "heptagonale"],
  [8, "octogonale"],
  [9, "ennéagonale"],
  [10, "décagonale"],
  [11, "hendécagonale"],
  [12, "dodécagonale"],
];

/** Géométrie calculée : faces, arêtes et sommets des prismes et pyramides. */
const QUIZ_SOLIDS: QuizQuestion[] = BASES.flatMap(([n, base]) => [
  { id: `prisme-faces-${n}`, text: `Faces d'un prisme à base ${base}`, answer: n + 2 },
  { id: `prisme-aretes-${n}`, text: `Arêtes d'un prisme à base ${base}`, answer: 3 * n },
  { id: `prisme-sommets-${n}`, text: `Sommets d'un prisme à base ${base}`, answer: 2 * n },
  { id: `pyramide-faces-${n}`, text: `Faces d'une pyramide à base ${base}`, answer: n + 1 },
  { id: `pyramide-aretes-${n}`, text: `Arêtes d'une pyramide à base ${base}`, answer: 2 * n },
  { id: `pyramide-sommets-${n}`, text: `Sommets d'une pyramide à base ${base}`, answer: n + 1 },
]);

const divisorCount = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0).length;

/** Nombre de diviseurs, calculé. */
const QUIZ_DIVISORS: QuizQuestion[] = [60, 72, 84, 90, 96, 30, 36, 48, 64, 100, 120].map((n) => ({
  id: `diviseurs-${n}`,
  text: `Diviseurs de ${n} (1 et ${n} compris)`,
  answer: divisorCount(n),
}));

/** Lettres d'un mot, comptées par le code. */
const QUIZ_LETTERS: QuizQuestion[] = [
  "PAMPLEMOUSSE",
  "ANNIVERSAIRE",
  "HÉLICOPTÈRES",
  "MONTGOLFIÈRE",
  "KALÉIDOSCOPE",
  "TROTTINETTES",
  "MARIONNETTES",
  "PHOTOGRAPHIE",
  "PORTE-MONNAIE",
  "CHAUVE-SOURIS",
  "HIPPOPOTAME",
  "RATATOUILLE",
  "CHAUSSETTES",
  "ORNITHORYNQUE",
  "BOUILLABAISSE",
  "RÉFRIGÉRATEUR",
  "SAPEUR-POMPIER",
  "ANTICONSTITUTIONNELLEMENT",
  "DOUZE",
].map((word) => ({
  id: `lettres-${word.toLowerCase()}`,
  text: `Lettres dans le mot « ${word} »`,
  answer: letterCount(word),
}));

export const QUIZ: readonly QuizQuestion[] = [
  ...QUIZ_FACTS,
  ...QUIZ_SOLIDS,
  ...QUIZ_DIVISORS,
  ...QUIZ_LETTERS,
];

/**
 * L'Oracle (toujours la 12e épreuve) : une question dont la vraie réponse n'est pas 12. La bonne
 * réponse, c'est 12. Toujours. `real` : la réponse que tout le monde choisit la première fois.
 */
export type OracleQuestion = { id: string; text: string; real: number; others: [number, number] };

export const ORACLE: readonly OracleQuestion[] = [
  { id: "araignee", text: "Combien de pattes a une araignée ?", real: 8, others: [6, 10] },
  { id: "insecte", text: "Combien de pattes a un insecte ?", real: 6, others: [4, 8] },
  { id: "pieuvre", text: "Combien de bras a une pieuvre ?", real: 8, others: [10, 6] },
  { id: "coeurs", text: "Combien de cœurs a une pieuvre ?", real: 3, others: [1, 2] },
  { id: "semaine", text: "Combien de jours dans une semaine ?", real: 7, others: [5, 8] },
  { id: "saisons", text: "Combien de saisons dans une année ?", real: 4, others: [3, 5] },
  {
    id: "fevrier",
    text: "Combien de jours en février, une année normale ?",
    real: 28,
    others: [29, 30],
  },
  { id: "doigts", text: "Combien de doigts sur une main ?", real: 5, others: [4, 6] },
  { id: "deux-deux", text: "Combien font 2 + 2 ?", real: 4, others: [3, 22] },
  { id: "sept-six", text: "Combien font 7 + 6 ?", real: 13, others: [11, 14] },
  { id: "trois-trois", text: "Combien font 3 × 3 ?", real: 9, others: [6, 8] },
  { id: "six-sept", text: "Combien font 6 × 7 ?", real: 42, others: [36, 48] },
  { id: "dix-un", text: "Combien font 10 + 1 ?", real: 11, others: [10, 13] },
  { id: "zero", text: "Combien font 0 × 12 ?", real: 0, others: [1, 120] },
  { id: "de", text: "Combien de faces a un dé classique ?", real: 6, others: [4, 8] },
  { id: "cube", text: "Combien de faces a un cube ?", real: 6, others: [8, 4] },
  { id: "triangle", text: "Combien de côtés a un triangle ?", real: 3, others: [2, 4] },
  { id: "hexagone", text: "Combien de côtés a un hexagone ?", real: 6, others: [5, 8] },
  { id: "roues", text: "Combien de roues a un vélo ?", real: 2, others: [1, 3] },
  {
    id: "foot",
    text: "Combien de joueurs par équipe sur un terrain de foot ?",
    real: 11,
    others: [10, 9],
  },
  {
    id: "basket",
    text: "Combien de joueurs par équipe sur un terrain de basket ?",
    real: 5,
    others: [6, 4],
  },
  {
    id: "handball",
    text: "Combien de joueurs par équipe sur un terrain de handball ?",
    real: 7,
    others: [6, 11],
  },
  { id: "echecs", text: "Combien de cases sur un échiquier ?", real: 64, others: [60, 81] },
  {
    id: "joueurs-echecs",
    text: "Combien de joueurs dans une partie d'échecs ?",
    real: 2,
    others: [1, 4],
  },
  { id: "heures", text: "Combien d'heures dans une journée ?", real: 24, others: [20, 48] },
  { id: "minutes", text: "Combien de minutes dans une heure ?", real: 60, others: [100, 30] },
  { id: "secondes", text: "Combien de secondes dans une minute ?", real: 60, others: [100, 30] },
  {
    id: "quart-heure",
    text: "Combien de minutes dans un quart d'heure ?",
    real: 15,
    others: [10, 20],
  },
  { id: "drapeau", text: "Combien de couleurs sur le drapeau français ?", real: 3, others: [2, 4] },
  { id: "anneaux", text: "Combien d'anneaux sur le drapeau olympique ?", real: 5, others: [4, 6] },
  {
    id: "usa",
    text: "Combien d'étoiles sur le drapeau des États-Unis ?",
    real: 50,
    others: [52, 48],
  },
  { id: "alphabet", text: "Combien de lettres dans l'alphabet ?", real: 26, others: [24, 27] },
  {
    id: "notes",
    text: "Combien de notes dans la gamme do, ré, mi, fa, sol, la, si ?",
    real: 7,
    others: [8, 5],
  },
  { id: "guitare", text: "Combien de cordes a une guitare classique ?", real: 6, others: [4, 7] },
  { id: "million", text: "Combien de zéros dans un million ?", real: 6, others: [5, 7] },
  { id: "nains", text: "Combien de nains chez Blanche-Neige ?", real: 7, others: [6, 8] },
  { id: "cochons", text: "Combien de petits cochons dans le conte ?", real: 3, others: [2, 4] },
  { id: "dalton", text: "Combien de frères Dalton ?", real: 4, others: [3, 5] },
  { id: "tortues", text: "Combien de Tortues Ninja ?", real: 4, others: [3, 5] },
  { id: "beatles", text: "Combien de Beatles ?", real: 4, others: [5, 3] },
  {
    id: "mousquetaires",
    text: "Combien de mousquetaires dans le titre du roman de Dumas ?",
    real: 3,
    others: [4, 2],
  },
  {
    id: "planetes",
    text: "Combien de planètes dans le système solaire ?",
    real: 8,
    others: [9, 7],
  },
  {
    id: "trois",
    text: "Combien de mots à trouver chaque jour dans TROIS ?",
    real: 3,
    others: [2, 5],
  },
  { id: "pi", text: "Combien vaut π, à peu près ?", real: 3.14, others: [2.72, 1.41] },
  { id: "chat", text: "Combien de vies a un chat ?", real: 7, others: [9, 1] },
  {
    id: "bougies",
    text: "Combien de bougies sur le gâteau d'un enfant de 11 ans ?",
    real: 11,
    others: [10, 13],
  },
  {
    id: "quarante-deux",
    text: "Quelle est la réponse à la grande question sur la vie, l'univers et le reste ?",
    real: 42,
    others: [7, 0],
  },
  { id: "douze", text: "Combien de lettres dans le mot « douze » ?", real: 5, others: [4, 6] },
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
  "ASTRONOMIQUE",
  "PHOTOGRAPHIE",
  "MÉTÉOROLOGIE",
  "INTERMINABLE",
  "MAGNIFICENCE",
  "ANNIVERSAIRE",
  "BOULEVERSANT",
  "MATHÉMATIQUE",
  "GÉOGRAPHIQUE",
  "HÉLICOPTÈRES",
  "PARACHUTISTE",
  "ARCHÉOPTÉRYX",
  "KALÉIDOSCOPE",
  "ÉQUILIBRISTE",
  "VENTRILOQUES",
  "MARIONNETTES",
  "TROTTINETTES",
  "MONTGOLFIÈRE",
  "OBSERVATOIRE",
  "SPATIONAUTES",
  "MÉLANCOLIQUE",
  "PORTE-MONNAIE",
  "RHINOCÉROSES",
  "ÉPOUVANTAILS",
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
  "GASTRONOMIE",
  "RATATOUILLE",
  "CARAMBOLAGE",
  "CHAMPIONNAT",
  "PHILOSOPHIE",
  "TRICÉRATOPS",
  "PLANÉTARIUM",
  "ASTRONAUTES",
  "CHAUSSETTES",
  "MAGICIENNES",
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
  "CROQUEMBOUCHE",
  "BOUILLABAISSE",
  "ÉPOUSTOUFLANT",
  "RÉFRIGÉRATEUR",
  "CONSTELLATION",
  "CHAMBOULE-TOUT",
  "SAPEUR-POMPIER",
  "CARNAVALESQUE",
];

/** Calculs pour « Coche tout ce qui fait 12 ». La valeur est calculée, jamais recopiée. */
export type Calc = { text: string; value: number };

/** Un calcul fait-il 12 (à l'arrondi près des nombres à virgule) ? */
export const isTwelve = (value: number) => Math.abs(value - 12) < 1e-9;

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const fr = (n: number) => String(n).replace(".", ",");
const sum = (a: number, b: number): Calc => ({ text: `${a} + ${b}`, value: a + b });
const diff = (a: number, b: number): Calc => ({ text: `${a} − ${b}`, value: a - b });
const prod = (a: number, b: number): Calc => ({ text: `${fr(a)} × ${fr(b)}`, value: a * b });
const quot = (a: number, b: number): Calc => ({ text: `${a} ÷ ${b}`, value: a / b });
const pct = (p: number, n: number): Calc => ({ text: `${p} % de ${n}`, value: (p * n) / 100 });
const sq = (a: number, b: number): Calc =>
  b >= 0 ? { text: `${a}² + ${b}`, value: a * a + b } : { text: `${a}² − ${-b}`, value: a * a + b };

/** Les calculs « à la main », pour le plaisir (chiffres romains, hexadécimal…). */
const CALC_CURATED: readonly Calc[] = [
  { text: "√144", value: Math.sqrt(144) },
  { text: "5! ÷ 10", value: (5 * 4 * 3 * 2 * 1) / 10 },
  { text: "0,12 × 100", value: 0.12 * 100 },
  { text: "XII", value: 12 },
  { text: "une douzaine", value: 12 },
  { text: "0xC", value: 0xc },
  { text: "1100 en binaire", value: 0b1100 },
  { text: "2 × 3 × 2", value: 2 * 3 * 2 },
  { text: "√121", value: Math.sqrt(121) },
  { text: "√169", value: Math.sqrt(169) },
  { text: "4 × π", value: 4 * Math.PI },
  { text: "XI", value: 11 },
  { text: "XIII", value: 13 },
  { text: "XXI", value: 21 },
  { text: "1,2", value: 1.2 },
  { text: "21", value: 21 },
  { text: "une demi-douzaine", value: 6 },
  { text: "une treizaine", value: 13 },
  { text: "0xD", value: 0xd },
  { text: "1011 en binaire", value: 0b1011 },
  { text: "11 + 0,99", value: 11 + 0.99 },
  { text: "4! ÷ 3", value: (4 * 3 * 2 * 1) / 3 },
];

/** Tous les calculs : ceux qui font 12 et des sosies qui tombent à côté (11, 13, 10…). */
export const CALCS: readonly Calc[] = [
  ...CALC_CURATED,
  ...range(1, 11).map((a) => sum(a, 12 - a)),
  ...range(13, 40).map((a) => diff(a, a - 12)),
  ...[
    [5, 3, 3],
    [4, 4, 4],
    [7, 2, 2],
    [2, 8, 4],
    [6, 3, 6],
    [9, 2, 6],
    [10, 2, 8],
    [3, 7, 9],
  ].map(([a = 0, b = 0, c = 0]) => ({ text: `${a} × ${b} − ${c}`, value: a * b - c })),
  ...[1, 2, 3, 4, 6, 12].map((a) => prod(a, 12 / a)),
  ...range(2, 12).map((b) => quot(12 * b, b)),
  ...[
    [50, 24],
    [25, 48],
    [10, 120],
    [20, 60],
    [75, 16],
    [30, 40],
    [40, 30],
    [60, 20],
    [150, 8],
    [200, 6],
  ].map(([p = 0, n = 0]) => pct(p, n)),
  ...[4, 5, 6, 7, 8, 9].map((a) => sq(a, 12 - a * a)),
  ...[
    [2, 4, 6],
    [3, 4, 5],
    [1, 5, 6],
    [2, 3, 7],
    [1, 2, 9],
    [4, 4, 4],
  ].map(([a = 0, b = 0, c = 0]) => ({ text: `${a} + ${b} + ${c}`, value: a + b + c })),
  // sosies
  ...[10, 11, 13, 14].flatMap((s) =>
    range(1, s - 1)
      .filter((a) => a <= s - a)
      .map((a) => sum(a, s - a)),
  ),
  ...range(14, 25).flatMap((a) => [diff(a, a - 11), diff(a, a - 13)]),
  ...[
    [2, 7],
    [3, 5],
    [2, 5],
    [3, 3],
    [4, 4],
    [2, 8],
    [5, 2],
    [7, 2],
    [13, 1],
    [11, 1],
    [2.5, 4],
    [3, 4.5],
  ].map(([a = 0, b = 0]) => prod(a, b)),
  ...range(2, 9).flatMap((b) => [quot(11 * b, b), quot(13 * b, b)]),
  ...[
    [50, 26],
    [25, 44],
    [10, 130],
    [20, 55],
    [75, 20],
    [30, 30],
  ].map(([p = 0, n = 0]) => pct(p, n)),
  ...[4, 5, 6].map((a) => sq(a, 13 - a * a)),
];

/** Horloges : l'heure à trouver et des heures qui y ressemblent (heures de 1 à 12, minutes). */
export type ClockTime = { h: number; m: number };
export type ClockRiddle = { label: string; target: ClockTime };

/** Heure normalisée sur un cadran (1 à 12 h, 0 à 59 min), à partir d'un nombre de minutes. */
export function clockTime(minutes: number): ClockTime {
  const total = ((minutes % 720) + 720) % 720;
  return { h: Math.floor(total / 60) || 12, m: total % 60 };
}
const toMinutes = ({ h, m }: ClockTime) => (h % 12) * 60 + m;

/** Libellé d'une heure : « 3 h 24 », « midi pile », « 4 h moins 12 »… */
function clockLabel({ h, m }: ClockTime): string {
  const next = (h % 12) + 1;
  const name = (hour: number) => (hour === 12 ? "midi" : `${hour} h`);
  if (h === 11 && m === 48) return "minuit moins douze";
  if (h === 12 && m === 12) return "12 h 12";
  if (m === 0) return `${name(h)} pile`;
  if (m === 48 && h % 2 === 0) return `${name(next)} moins 12`;
  return `${h} h ${m}`;
}

/** 60 heures autour du 12 : toutes les heures, pile ou à 12, 24, 36 et 48 minutes. */
export const CLOCKS: readonly ClockRiddle[] = range(1, 12).flatMap((h) =>
  [0, 12, 24, 36, 48].map((m) => ({ label: clockLabel({ h, m }), target: { h, m } })),
);

/**
 * Horloges leurres d'une heure : 12 minutes ou une heure d'écart, son reflet dans un miroir,
 * deux minutes à côté… Jamais l'heure elle-même.
 */
export function clockDecoys(target: ClockTime): ClockTime[] {
  const t = toMinutes(target);
  const candidates = [
    t + 12,
    t - 12,
    t + 60,
    t - 60,
    720 - t,
    t + 2,
    t - 2,
    t + 72,
    t - 48,
    t + 120,
  ].map(clockTime);
  const seen = new Set([t]);
  return candidates.filter((c) => {
    const key = toMinutes(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
  { item: "🍎", decoy: "🍅", label: "pommes" },
  { item: "🐝", decoy: "🪰", label: "abeilles" },
  { item: "🐙", decoy: "🦑", label: "pieuvres" },
  { item: "⚽", decoy: "🏐", label: "ballons de foot" },
  { item: "🚗", decoy: "🚙", label: "voitures rouges" },
  { item: "🐧", decoy: "🐦", label: "manchots" },
  { item: "🍌", decoy: "🌽", label: "bananes" },
  { item: "🦀", decoy: "🦞", label: "crabes" },
  { item: "🐌", decoy: "🐛", label: "escargots" },
  { item: "🎃", decoy: "🍊", label: "citrouilles" },
];
