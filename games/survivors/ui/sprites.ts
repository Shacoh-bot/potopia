/** Dessins originaux, composés à la main. Chaque caractère représente un pixel. */
import type { EnemyFamily } from "../src/bestiary";
export const PALETTE: Record<string, string> = {
  o: "#171c29",
  s: "#6e8190",
  S: "#b9ced0",
  w: "#edf1d8",
  g: "#a77b3c",
  G: "#eac373",
  Y: "#fff0af",
  b: "#263e69",
  B: "#48658c",
  h: "#b88464",
  H: "#e4b88b",
  d: "#444c40",
  m: "#7a8760",
  M: "#a9b58a",
  p: "#433453",
  P: "#8c6fa0",
  r: "#8f4e4b",
  R: "#dc836c",
  t: "#3f827d",
  T: "#70b9b1",
  f: "#c37b50",
  F: "#e69b64",
  c: "#6d4933",
  C: "#a8784a",
  e: "#b7bdaf",
  E: "#e5e7c6",
  n: "#394047",
  N: "#84949d",
  v: "#574561",
  V: "#a58ab8",
  k: "#9d7750",
  K: "#cbaa71",
  a: "#6b552f",
  A: "#b79350",
  j: "#495765",
  J: "#8e9ea8",
  i: "#c5c9b8",
  l: "#514338",
  L: "#b5b2a0",
  u: "#182b49",
  U: "#2b4567",
  q: "#885f46",
  Q: "#b58b67",
  z: "#d1b18c",
  I: "#272627",
  D: "#5d8194",
};
export const HERO_WIDTH = 32;
export const HERO_HEIGHT = 40;

function drawPaladin(): string[] {
  const pixels = Array.from({ length: HERO_HEIGHT }, () => Array<string>(HERO_WIDTH).fill("."));
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++) {
        const row = pixels[py];
        if (row && px >= 0 && px < HERO_WIDTH) row[px] = color;
      }
  };
  // Cape et pans d'étoffe, derrière l'armure. Les couleurs restent mates.
  rect(10, 10, 16, 17, "o");
  rect(12, 11, 15, 17, "u");
  rect(21, 17, 8, 13, "u");
  rect(23, 24, 7, 13, "u");
  rect(25, 30, 6, 7, "u");
  rect(22, 36, 7, 3, "u");
  rect(25, 19, 2, 14, "U");
  rect(28, 29, 2, 6, "U");
  rect(23, 33, 2, 4, "b");
  // Jambières épaisses et bottes, avec deux pieds bien séparés.
  for (const x of [10, 19]) {
    rect(x - 1, 26, 7, 12, "o");
    rect(x, 27, 5, 10, "j");
    rect(x, 28, 3, 8, "J");
    rect(x, 30, 5, 3, "a");
    rect(x, 30, 4, 2, "A");
    rect(x, 34, 1, 3, "i");
    rect(x - 2, 37, 8, 3, "o");
    rect(x - 1, 37, 6, 2, "a");
    rect(x - 1, 37, 4, 1, "A");
  }
  // Cuirasse d'acier, bordures d'or et ceinturon.
  rect(9, 11, 15, 16, "o");
  rect(10, 12, 13, 13, "j");
  rect(11, 13, 10, 7, "J");
  rect(11, 14, 3, 4, "i");
  rect(11, 20, 11, 5, "a");
  rect(12, 20, 2, 3, "A");
  rect(16, 20, 2, 3, "A");
  rect(20, 20, 2, 3, "A");
  rect(10, 24, 14, 3, "a");
  rect(11, 24, 12, 1, "A");
  rect(15, 23, 5, 5, "a");
  rect(16, 24, 3, 3, "A");
  rect(17, 25, 1, 1, "D");
  // Grandes épaulières asymétriques ; la gauche forme une silhouette en pointe.
  rect(3, 10, 8, 8, "o");
  rect(2, 12, 10, 7, "o");
  rect(1, 16, 5, 4, "a");
  rect(3, 11, 8, 6, "a");
  rect(3, 12, 7, 3, "A");
  rect(4, 11, 5, 1, "G");
  rect(4, 15, 5, 3, "j");
  rect(4, 15, 3, 1, "J");
  rect(2, 17, 3, 2, "A");
  rect(8, 11, 2, 3, "A");
  rect(8, 12, 1, 1, "D");
  rect(22, 11, 8, 8, "o");
  rect(23, 12, 6, 6, "a");
  rect(23, 12, 5, 2, "A");
  rect(25, 14, 4, 3, "J");
  rect(28, 14, 1, 4, "A");
  // Avant-bras et mains ; le bras gauche saisit le manche du marteau.
  rect(3, 18, 7, 8, "o");
  rect(4, 18, 5, 4, "j");
  rect(4, 19, 3, 2, "J");
  rect(4, 22, 5, 4, "a");
  rect(4, 23, 4, 2, "J");
  rect(5, 25, 4, 3, "q");
  rect(5, 25, 3, 2, "Q");
  rect(24, 18, 5, 8, "o");
  rect(25, 19, 3, 5, "J");
  rect(25, 24, 3, 3, "q");
  // Col et étoffe bleu nuit traversant le haut du torse.
  rect(10, 9, 3, 6, "a");
  rect(11, 9, 1, 4, "A");
  rect(13, 10, 9, 3, "u");
  rect(15, 12, 9, 3, "u");
  rect(18, 14, 7, 3, "u");
  rect(14, 11, 7, 1, "U");
  rect(17, 13, 6, 1, "U");
  rect(20, 15, 4, 1, "U");
  rect(12, 13, 3, 4, "a");
  rect(13, 14, 1, 2, "D");
  // Cheveux bruns et mèches argentées, sourcils sombres et barbe grisonnante.
  rect(12, 0, 8, 2, "o");
  rect(11, 1, 10, 8, "o");
  rect(10, 3, 12, 5, "l");
  rect(12, 1, 8, 3, "l");
  rect(11, 3, 10, 2, "L");
  rect(14, 2, 7, 1, "L");
  rect(19, 1, 4, 1, "L");
  rect(21, 2, 3, 1, "L");
  rect(13, 4, 7, 5, "q");
  rect(14, 4, 5, 4, "Q");
  rect(15, 4, 2, 1, "z");
  rect(13, 5, 2, 1, "l");
  rect(17, 5, 2, 1, "l");
  rect(14, 6, 1, 1, "I");
  rect(18, 6, 1, 1, "I");
  rect(16, 6, 1, 2, "z");
  rect(13, 8, 7, 2, "l");
  rect(14, 9, 5, 2, "L");
  rect(14, 8, 2, 1, "L");
  rect(17, 8, 2, 1, "L");
  rect(16, 8, 1, 1, "q");
  // Petit livre relié : pages mates et couverture bleue, sans lumière émise.
  rect(23, 22, 8, 7, "o");
  rect(24, 22, 6, 2, "E");
  rect(24, 23, 6, 1, "k");
  rect(24, 24, 6, 4, "u");
  rect(24, 24, 1, 4, "A");
  rect(29, 24, 1, 4, "a");
  rect(26, 25, 2, 2, "A");
  rect(28, 27, 2, 2, "Q");
  return pixels.map((row) => row.join(""));
}
export const HERO = drawPaladin();

function walkingFrame(liftLeft: boolean): string[] {
  const pixels = HERO.map((row) => [...row]);
  const x0 = liftLeft ? 8 : 17;
  for (let y = 31; y < HERO_HEIGHT; y++)
    for (let x = x0; x < x0 + 8; x++) {
      const row = pixels[y];
      if (row) row[x] = ".";
    }
  for (let y = 31; y < HERO_HEIGHT; y++)
    for (let x = x0; x < x0 + 8; x++) {
      const row = pixels[y - 1],
        color = HERO[y]?.[x];
      if (row && color) row[x] = color;
    }
  return pixels.map((row) => row.join(""));
}
export const HERO_WALK_FRAMES = [walkingFrame(true), walkingFrame(false)] as const;
/** Marteau compact relié à la main : même couche de pixels pour le jeu et le portrait. */
export const HERO_HAMMER_OFFSET = { x: 0, y: 23 };
export const HERO_HAMMER = [
  ".......ao...",
  "......ao....",
  ".....oQQo...",
  ".....ao.....",
  "....ao......",
  "....ao......",
  ".aAAAAAAAa..",
  "oaJJJJJJJAo.",
  "oaJiJJJJJAo.",
  "oaJJDDJJJAo.",
  "oaJJJJJJJAo.",
  ".aAAAAAAAa..",
  "..ooooooo...",
];
export const ENEMY_SPRITES: Record<EnemyFamily, readonly string[]> = {
  bandit: [
    ".......oooooo.......",
    "......orrrrrro......",
    ".....orRRrrrrro.....",
    ".....orHHHHHrro.....",
    ".....ooHoHHoHoo.....",
    "......orrrrrro......",
    ".......orrrro.......",
    ".....oobbbbboo......",
    "....obBBbbBBbbo.....",
    "....obBbbbbBbhho..S.",
    "....ohhbGggbHHo.SSS.",
    ".....ooGGGgboo...S..",
    "......obbbbo.....g..",
    "......obobbo........",
    ".....ocooocco.......",
    ".....occoocco.......",
    "....oooo.oooo.......",
  ],
  wolf: [
    "..............o..o......",
    ".............oNNoNo.....",
    "...o........oNNEENo.....",
    "..oNooooooooNNNEoENoo...",
    ".oNNNNNNNNNNNNNEEEENno..",
    "oNNNnnNNNNNNNnnEEEEnooo.",
    "oNNoNNNNNNNNNnnEEEooEo..",
    ".ooNNNNNNNNNNNnEEoooo...",
    "..oNNNnnnnnnNNnNo.......",
    "..oNNooooooooNNNo.......",
    "..oNNo......oNNo........",
    "..oNNo......oNNo........",
    "..oooo......oooo........",
  ],
  boar: [
    ".........ooo............",
    "........occco..oo.......",
    "....oooocCCccoocCo......",
    "..oocCCCCCCCCCccco......",
    ".ocCCCCCCCCCCCCcECo.....",
    "ocCCCCccccCCCCCCCCCooo..",
    "ocCCCCccccCCCCCCCCCCrro.",
    "ocCCCCccccCCCCCCCECCrro.",
    ".ocCCCCCCCCCCCCCEoCCoo..",
    "..ocCCcoooooocCCo.Eo....",
    "..ocCco.....ocCco.......",
    "..occco.....occco.......",
    "..ooooo.....ooooo.......",
  ],
  murloc: [
    "..........F.........",
    ".........oFF........",
    "........otTFo.......",
    ".......otTTTto......",
    ".....ooTToTTToo.....",
    "....otYEoToEYtFo....",
    "....otYEoToEYtFFo...",
    "....otTTTTTTTtFo....",
    ".....otrrrrrto......",
    "......otTTTto.......",
    ".....otTTTTTtoo.....",
    "...ootTTTTTTTTto....",
    "..otTtTTTTTTtTTo....",
    "..otToTTTTTToTTo....",
    "...oo.tTTTTt.oo.....",
    "......otTTto........",
    ".....otTToTTo.......",
    "....otTTo.oTTo......",
    "...ooooo...ooooo....",
  ],
  spider: [
    "..o................o....",
    "..ov..............vo....",
    "...ov....oooo....vo.....",
    "....ov..ovVVvo..vo......",
    ".oo..ovovVVVVvovo..oo...",
    "...oooovVVVVVVvoooo.....",
    "......ovVVVVVVvo........",
    ".oooooovvVVVVvvoooooo...",
    "ov.....ovvvvvo.....vo...",
    "o....ooovRVVRvooo....o..",
    "...ov..ovRVVRvo..vo.....",
    "..ov....ovvvvo....vo....",
    "..o......oEEo......o....",
    ".........oooo...........",
  ],
  gnoll: [
    ".....oo......oo.........",
    "....ocCo....oCco........",
    "....ocCCooooCCco........",
    ".....oCKKKKKKCo.........",
    ".....oKoKKKoKCo.........",
    ".....oKKcccKKCo.........",
    "......oKEnEKCo..........",
    "......occccCo.....ooo...",
    ".....ooCCccooo...ogGgo..",
    "...oocCCcCCccco..ogGgo..",
    "..ocCKCCcCCCKCco..ogo...",
    "..ocCKcbbbbcKCco..ogo...",
    "..ocCCcbbbbcCCco..ogo...",
    "...ooocGggGcooo...ogo...",
    "......occccCo....ocCo...",
    "......ocCoCCo...........",
    ".....ocCo.oCCo..........",
    ".....occ o.occo.........".replace(" ", ""),
    "....ooooo.ooooo.........",
  ],
  kobold: [
    "..........Y.........",
    ".........oYo........",
    ".........oGo........",
    ".........oEo........",
    "......ooocccoo......",
    ".....ocKKKKKcco.....",
    "....ocKoKKKoKcco....",
    "....ocKKKKKKcccco...",
    ".....ocKKrrrcco.....",
    "......occcco........",
    ".....oocbbcoo..SSS..",
    "....ocKcbbccKo..S...",
    "....ocKcGgcKco..g...",
    ".....ooccccooo..g...",
    "......ococCo........",
    ".....ocCo.cCo.......",
    ".....oooo.oooo......",
  ],
  bear: [
    "...............oo.oo.......",
    "..............ocCocCo......",
    ".....ooooooo.oCCCCCCo......",
    "...oocCCCCCCoCCCCCCCCo.....",
    "..ocCCCCCCCCCCCCoCCoCoo....",
    ".ocCCCCCCCCCCCCCKKKKKCCo...",
    "ocCCCCCCCCCCCCCCKKcncKCo...",
    "ocCCCCCCCCCCCCCCKKKKKCco...",
    "ocCCCCCCCCCCCCCCCCCCCCo....",
    ".ocCCCCCCccccCCCCCCCCo.....",
    "..ocCCCCcoooocCCCCCCo......",
    "..ocCCCCo...ocCCCCCo.......",
    "..ocCCcco....ocCCcco.......",
    "..ooooooo....ooooooo.......",
  ],
};
export function paintPixels(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  x: number,
  y: number,
  scale: number,
) {
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    if (!line) continue;
    for (let col = 0; col < line.length; col++) {
      const color = PALETTE[line[col] ?? ""];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }
  }
}
export function createSprites() {
  const sprites: Record<string, HTMLCanvasElement> = {};
  for (const [name, rows] of Object.entries({
    hero: HERO,
    "hero-walk-0": HERO_WALK_FRAMES[0],
    "hero-walk-1": HERO_WALK_FRAMES[1],
    ...ENEMY_SPRITES,
  })) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(...rows.map((row) => row.length));
    canvas.height = rows.length;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      paintPixels(ctx, rows, 0, 0, 1);
      if (name.startsWith("hero")) {
        paintPixels(ctx, HERO_HAMMER, HERO_HAMMER_OFFSET.x, HERO_HAMMER_OFFSET.y, 1);
      }
    }
    sprites[name] = canvas;
  }
  return sprites;
}
