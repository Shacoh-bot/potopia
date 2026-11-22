/**
 * Tailles de texte qui tiennent dans la carte (300 × 420) sans rien couper : pied de carte (set,
 * numéro, rareté, AA, « idée de … ») et texte d'effet. Calcul sans mesure du DOM (même rendu
 * côté serveur et client) : largeur estimée par caractère, volontairement large pour ne jamais
 * déborder.
 */

/** Numéro de la carte au pied : « S1 1/100 » ; hors set (réserve) : « S? », sans numéro. */
export function serialLabel(
  setCode: string | null | undefined,
  number: number | null,
  setSize?: number,
): string {
  if (number === null) return "S?";
  const code = setCode || "S?";
  return setSize ? `${code} ${number}/${setSize}` : `${code} ${number}`;
}

/** Largeur moyenne d'un caractère, en em (estimation large : police sans empattement). */
const CHAR_EM = 0.58;

/** Pied de carte : largeur libre entre le bord gauche et la pastille de puissance. */
export const FOOTER_WIDTH = 208;
export const FOOTER_GAP = 4;
const FOOTER_MAX = 8;
const FOOTER_MIN = 5;

export type FooterParts = {
  serial: string;
  /** Rareté abrégée (« SSR »). */
  rarity: string;
  stars: number;
  altArt: boolean;
  /** Auteur de l'idée ; absent : pas de « idée de … ». */
  author?: string;
};

/** Largeur estimée du pied pour une taille de police donnée (px). */
export function footerWidth(parts: FooterParts, size: number): number {
  const text = (s: string) => s.length * size * CHAR_EM;
  const items = [
    text(parts.serial),
    // Rareté et étoiles collées (étoiles 1 px plus grandes, 1 px d'écart entre elles).
    text(parts.rarity) + 2 + parts.stars * ((size + 1) * 0.9 + 1),
  ];
  // AA : 2 lettres grasses + 3 px de marge de chaque côté.
  if (parts.altArt) items.push(text("AA") * 1.15 + 6);
  if (parts.author) items.push(text(`idée de ${parts.author}`));
  return items.reduce((a, b) => a + b, 0) + FOOTER_GAP * (items.length - 1);
}

/** Plus grande taille (pas de 0,5 px, 8 px au plus) qui fait tenir tout le pied. */
export function footerFontSize(parts: FooterParts): number {
  for (let size = FOOTER_MAX; size > FOOTER_MIN; size -= 0.5) {
    if (footerWidth(parts, size) <= FOOTER_WIDTH) return size;
  }
  return FOOTER_MIN;
}

/** Zone du texte d'effet, intérieur (marges ôtées) : 300 − 2 × 18 − 12 − 40 de large. */
export const EFFECT_BOX = { width: 212, height: 92 };
const EFFECT_MAX = 13.5;
const EFFECT_MIN = 7;
/** Largeur moyenne d'un caractère de la police du texte d'effet (à empattements), en em. */
const EFFECT_CHAR_EM = 0.52;

/** Nombre de lignes d'un texte à une taille donnée (retours à la ligne gardés, mots entiers). */
function lineCount(text: string, size: number, width: number): number {
  const perLine = Math.max(1, Math.floor(width / (size * EFFECT_CHAR_EM)));
  return text.split("\n").reduce((total, paragraph) => {
    let lines = 1;
    let used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const len = word.length;
      if (used === 0) used = len;
      else if (used + 1 + len <= perLine) used += 1 + len;
      else {
        lines += 1;
        used = len;
      }
      // Mot plus long qu'une ligne : il passe sur plusieurs.
      while (used > perLine) {
        lines += 1;
        used -= perLine;
      }
    }
    return total + lines;
  }, 0);
}

export type EffectSize = {
  fontSize: number;
  lineHeight: number;
  flavorSize: number;
  flavorLine: number;
};

const lineFor = (size: number) => Math.round(size * 1.19 * 2) / 2;

/** Plus grande taille (13,5 px au plus) qui fait tenir l'effet et le texte d'ambiance. */
export function effectTextSize(effect: string, flavor?: string | null): EffectSize {
  for (let size = EFFECT_MAX; size >= EFFECT_MIN; size -= 0.5) {
    const s = sizesFor(size);
    let height = lineCount(effect, size, EFFECT_BOX.width) * s.lineHeight;
    if (flavor) height += 6 + lineCount(flavor, s.flavorSize, EFFECT_BOX.width) * s.flavorLine;
    if (height <= EFFECT_BOX.height) return s;
  }
  return sizesFor(EFFECT_MIN);
}

function sizesFor(size: number): EffectSize {
  // Texte d'ambiance 2 px plus petit (comme avant : 13,5 / 11,5).
  const flavorSize = Math.max(6, size - 2);
  return { fontSize: size, lineHeight: lineFor(size), flavorSize, flavorLine: lineFor(flavorSize) };
}
