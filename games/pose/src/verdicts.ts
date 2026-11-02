import type { grade } from "./score";

type Grade = ReturnType<typeof grade>;

// Répliques selon la note, tirées au hasard. Références des parties 1 à 6 seulement (rien de
// Steel Ball Run ni d'après : pas de spoilers).
const VERDICTS: Record<Grade, readonly string[]> = {
  Z: [
    "ZA WARUDO… Le temps s'est arrêté devant une pose parfaite.",
    "Araki en ferait une couverture. Tout de suite.",
    "Même DIO en resterait sans voix.",
    "Requiem pour tous les autres joueurs.",
    "Le Hamon le plus pur qu'on ait jamais vu.",
    "Speedwagon ne peut plus retenir ses larmes.",
    "Parfait. Absolument parfait. ゴゴゴゴゴゴ.",
    "Made in Heaven : l'univers a été créé pour cette pose.",
  ],
  S: [
    "Yare yare daze… Presque parfait.",
    "Bizarre, bizarre… et magnifique.",
    "Star Platinum lui-même n'aurait pas été plus précis.",
    "Ça, c'est une case de manga.",
    "Giorno a fait un rêve : c'était ta pose.",
    "ゴゴゴゴ… Le monde entier retient son souffle.",
    "Tu as l'aura d'un Joestar.",
    "Puissance : S. Précision : S. Pose : S.",
  ],
  A: [
    "Très belle pose. Jotaro hausse un sourcil.",
    "Puissance : A. Précision : A. Pose : A.",
    "Speedwagon verse une larme de fierté.",
    "Le Hamon coule dans tes veines.",
    "Polnareff en lâche son épée.",
    "Kakyoin approuve. Même la cerise est impressionnée.",
    "Joseph l'avait prévu : « Ta prochaine pose sera parfaite ! »",
    "Digne d'un Stand de type rapproché.",
    "Un vrai membre de la Passione.",
    "Avdol confirme : « Yes, I am… impressionné. »",
  ],
  B: [
    "Pas mal du tout. Bizarre, même.",
    "Presque digne de Jotaro.",
    "Polnareff applaudit. Un peu trop fort.",
    "Ton Stand s'éveille.",
    "Un poil de plus, et c'était légendaire.",
    "Ton Stand prend forme.",
    "Kakyoin approuve d'un « rero rero » satisfait.",
    "Bucciarati sent que tu ne mens pas.",
    "Josuke trouve ta coiffure… enfin, ta pose, très réussie.",
    "Belle tenue. Lisa Lisa hoche la tête.",
  ],
  C: [
    "Ça ressemble à quelque chose…",
    "Koichi y croit encore.",
    "Correct. Mais DIO ne tremble pas.",
    "Okuyasu a mis du temps à comprendre, mais il valide.",
    "Ton Stand est encore à l'état de flèche.",
    "Moyen. Comme un mardi à Morioh.",
    "Les Hommes du Pilier sourient… pas pour te féliciter.",
    "Mista compte tes erreurs. Il en voit quatre. Mauvais présage.",
    "Avdol t'accorde un « Yes I am » timide.",
  ],
  D: [
    "Même Speedwagon aurait fait mieux.",
    "Rohan refuse de te dessiner.",
    "Ton Stand est parti en vacances.",
    "Ça manque de « ゴゴゴ ».",
    "Tu poses comme un figurant du Caire.",
    "Hol Horse n'est pas impressionné. Et c'est Hol Horse.",
    "Fugo commence à s'énerver…",
    "Kira préférerait une vie tranquille, loin de cette pose.",
    "Zeppeli soupire : il faudra plus de Hamon.",
  ],
  E: [
    "WRYYY ?!",
    "NANI ?!",
    "To Be Continued…",
    "Même un rouleau compresseur pose mieux.",
    "« Mais c'était moi, DIO ! » Et c'était raté.",
    "Speedwagon s'en va… avec élégance.",
    "Polnareff ne comprend pas ce qui vient de se passer.",
    "Ta pose a été effacée par The Hand.",
    "Requiem pour cette pose.",
    "Pucci y voit un signe : il faut tout recommencer.",
  ],
};

/** Une réplique au hasard pour cette note (`pick` : tirage entre 0 et 1, pour les tests). */
export function verdict(g: Grade, pick: number = Math.random()): string {
  const lines = VERDICTS[g];
  return lines[Math.min(lines.length - 1, Math.floor(pick * lines.length))] ?? "";
}

/** Toutes les répliques d'une note (tests). */
export const verdictsFor = (g: Grade): readonly string[] => VERDICTS[g];
