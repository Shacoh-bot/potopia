/**
 * Répliques JoJo jouées au hasard pendant la partie (voix de l'anime ou des jeux officiels, servies
 * par apps/web/public/audio/pose). Parties 1 à 6 seulement : rien de Steel Ball Run ni d'après.
 *
 * Chaque réplique dit quand elle peut sortir (`on`) :
 * - `good` : une pose réussie (A ou B) ; `mid` : moyenne (C) ; `bad` : ratée (D ou E) ;
 * - `reset` : on remet le pantin droit ; `idle` : on hésite depuis un moment ; `start` : début de
 *   la partie du jour.
 */
export type LineEvent = "good" | "mid" | "bad" | "reset" | "idle" | "start";

export type JojoLine = {
  id: string;
  /** Qui parle (affiché en petit). */
  who: string;
  /** Ce qui s'affiche en grand, façon onomatopée de manga. */
  text: string;
  /** Le sens en français, en dessous (absent si le texte se suffit). */
  sub?: string;
  /** Fichier son (apps/web/public). */
  sound: string;
  on: readonly LineEvent[];
};

export const LINES: readonly JojoLine[] = [
  {
    id: "joseph-oh-no",
    who: "Joseph Joestar",
    text: "OH NOOOOO !",
    sound: "/audio/pose/joseph-oh-no.mp3",
    on: ["bad"],
  },
  {
    id: "joseph-old-oh-no",
    who: "Joseph Joestar",
    text: "OH NOOOO !",
    sound: "/audio/pose/joseph-old-oh-no.mp3",
    on: ["bad"],
  },
  {
    id: "joseph-oh-my-god",
    who: "Joseph Joestar",
    text: "OH MY GOD !",
    sound: "/audio/pose/joseph-oh-my-god.mp3",
    on: ["bad", "mid"],
  },
  {
    id: "joseph-holy-shit",
    who: "Joseph Joestar",
    text: "HOLY SHIT !",
    sound: "/audio/pose/joseph-holy-shit.mp3",
    on: ["bad", "good"],
  },
  {
    id: "joseph-oh-shit",
    who: "Joseph Joestar",
    text: "OH SHIT !",
    sound: "/audio/pose/joseph-oh-shit.mp3",
    on: ["bad"],
  },
  {
    id: "joseph-son-of-a-bitch",
    who: "Joseph Joestar",
    text: "SON OF A BITCH !",
    sound: "/audio/pose/joseph-son-of-a-bitch.mp3",
    on: ["bad"],
  },
  {
    id: "joseph-yes-yes-yes-omg",
    who: "Joseph Joestar",
    text: "YES ! YES ! YES !",
    sound: "/audio/pose/joseph-yes-yes-yes-omg.mp3",
    on: ["good"],
  },
  {
    id: "joseph-nice",
    who: "Joseph Joestar",
    text: "NICE !",
    sound: "/audio/pose/joseph-nice.mp3",
    on: ["good"],
  },
  {
    id: "joseph-shiza",
    who: "Joseph Joestar",
    text: "SHIZAAA !",
    sound: "/audio/pose/joseph-shiza.mp3",
    on: ["idle"],
  },
  {
    id: "joseph-nigerundayo",
    who: "Joseph Joestar",
    text: "NIGERUNDAYO !",
    sub: "On se tire !",
    sound: "/audio/pose/joseph-nigerundayo.mp3",
    on: ["reset"],
  },
  {
    id: "dio-wryyy",
    who: "DIO",
    text: "WRYYYYY !",
    sound: "/audio/pose/dio-wryyy.mp3",
    on: ["good", "idle"],
  },
  {
    id: "dio-kono-dio-da",
    who: "DIO",
    text: "KONO DIO DA !",
    sub: "C'était moi, DIO !",
    sound: "/audio/pose/dio-kono-dio-da.mp3",
    on: ["start", "idle"],
  },
  {
    id: "dio-hinjaku-hinjaku",
    who: "DIO",
    text: "HINJAKU HINJAKU !",
    sub: "Faible, faible !",
    sound: "/audio/pose/dio-hinjaku-hinjaku.mp3",
    on: ["bad"],
  },
  {
    id: "dio-za-warudo-short",
    who: "DIO",
    text: "ZA WARUDO !",
    sound: "/audio/pose/dio-za-warudo-short.mp3",
    on: ["reset"],
  },
  {
    id: "dio-toki-wo-tomare",
    who: "DIO",
    text: "TOKI WO TOMARE !",
    sub: "Que le temps s'arrête !",
    sound: "/audio/pose/dio-toki-wo-tomare.mp3",
    on: ["idle"],
  },
  {
    id: "jotaro-ora",
    who: "Jotaro Kujo",
    text: "ORA !",
    sound: "/audio/pose/jotaro-ora.mp3",
    on: ["good"],
  },
  {
    id: "jotaro-star-platinum",
    who: "Jotaro Kujo",
    text: "STAR PLATINUM !",
    sound: "/audio/pose/jotaro-star-platinum.mp3",
    on: ["start", "good"],
  },
  {
    id: "kakyoin-rero-rero",
    who: "Noriaki Kakyoin",
    text: "RERO RERO RERO",
    sound: "/audio/pose/kakyoin-rero-rero.mp3",
    on: ["idle", "mid"],
  },
  {
    id: "kakyoin-emerald-splash",
    who: "Noriaki Kakyoin",
    text: "EMERALD SPLASH !",
    sound: "/audio/pose/kakyoin-emerald-splash.mp3",
    on: ["good"],
  },
  {
    id: "avdol-yes-i-am",
    who: "Mohammed Avdol",
    text: "YES, I AM !",
    sound: "/audio/pose/avdol-yes-i-am.mp3",
    on: ["good", "start"],
  },
  {
    id: "polnareff-silver-chariot",
    who: "Jean-Pierre Polnareff",
    text: "SILVER CHARIOT !",
    sound: "/audio/pose/polnareff-silver-chariot.mp3",
    on: ["start", "mid"],
  },
  {
    id: "polnareff-bravo",
    who: "Jean-Pierre Polnareff",
    text: "BRAVO ! OH, BRAVO !",
    sound: "/audio/pose/polnareff-bravo.mp3",
    on: ["good"],
  },
  {
    id: "josuke-dorarara",
    who: "Josuke Higashikata",
    text: "DORARARARA !",
    sound: "/audio/pose/josuke-dorarara.mp3",
    on: ["good"],
  },
  {
    id: "josuke-great",
    who: "Josuke Higashikata",
    text: "GREAT !",
    sound: "/audio/pose/josuke-great.mp3",
    on: ["good", "mid"],
  },
  {
    id: "okuyasu-za-hando",
    who: "Okuyasu Nijimura",
    text: "ZA HANDO !",
    sub: "The Hand efface tout !",
    sound: "/audio/pose/okuyasu-za-hando.mp3",
    on: ["reset", "bad"],
  },
  {
    id: "koichi-act3-freeze",
    who: "Koichi Hirose",
    text: "ACT 3 FREEZE !",
    sound: "/audio/pose/koichi-act3-freeze.mp3",
    on: ["reset", "mid"],
  },
  {
    id: "kira-bites-the-dust",
    who: "Yoshikage Kira",
    text: "BITES THE DUST",
    sound: "/audio/pose/kira-bites-the-dust.mp3",
    on: ["reset"],
  },
  {
    id: "kira-killer-queen",
    who: "Yoshikage Kira",
    text: "KILLER QUEEN !",
    sound: "/audio/pose/kira-killer-queen.mp3",
    on: ["idle", "bad"],
  },
  {
    id: "rohan-daga-kotowaru",
    who: "Rohan Kishibe",
    text: "DAGA KOTOWARU",
    sub: "Mais je refuse.",
    sound: "/audio/pose/rohan-daga-kotowaru.mp3",
    on: ["mid", "idle"],
  },
  {
    id: "giorno-muda",
    who: "Giorno Giovanna",
    text: "MUDA !",
    sub: "Inutile !",
    sound: "/audio/pose/giorno-muda.mp3",
    on: ["bad"],
  },
  {
    id: "giorno-gold-experience",
    who: "Giorno Giovanna",
    text: "GOLD EXPERIENCE !",
    sound: "/audio/pose/giorno-gold-experience.mp3",
    on: ["start", "idle"],
  },
  {
    id: "bucciarati-arrivederci",
    who: "Bruno Bucciarati",
    text: "ARRIVEDERCI !",
    sound: "/audio/pose/bucciarati-arrivederci.mp3",
    on: ["bad", "mid"],
  },
  {
    id: "narancia-aerosmith",
    who: "Narancia Ghirga",
    text: "AEROSMITH !",
    sound: "/audio/pose/narancia-aerosmith.mp3",
    on: ["idle"],
  },
  {
    id: "jolyne-ora-ora",
    who: "Jolyne Cujoh",
    text: "ORA ORA ORA !",
    sound: "/audio/pose/jolyne-ora-ora.mp3",
    on: ["good"],
  },
  {
    id: "pucci-made-in-heaven",
    who: "Enrico Pucci",
    text: "MADE IN HEAVEN",
    sub: "Tout recommence…",
    sound: "/audio/pose/pucci-made-in-heaven.mp3",
    on: ["reset", "bad"],
  },
];

/**
 * Une réplique au hasard pour cet évènement, jamais deux fois la même d'affilée (`last`) ;
 * `rand` : tirage entre 0 et 1 (tests).
 */
export function pickLine(
  event: LineEvent,
  last: string | null = null,
  rand: () => number = Math.random,
  lines: readonly JojoLine[] = LINES,
): JojoLine | null {
  const all = lines.filter((l) => l.on.includes(event));
  const pool = all.length > 1 ? all.filter((l) => l.id !== last) : all;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))] ?? null;
}
