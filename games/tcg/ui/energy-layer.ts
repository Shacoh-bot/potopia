/**
 * Couche de l'effet « énergie » (visual-effects.tsx, LivingEnergy) calculée UNE fois par
 * illustration : les pixels hors des zones vives et saturées deviennent transparents. Avant, ce
 * masque était un filtre SVG recalculé à chaque image (sa teinte tournait dans le filtre) ; il ne
 * change jamais, seule la teinte tourne (CSS, carte graphique).
 *
 * Même calcul que le filtre SVG (`colorInterpolationFilters="sRGB"`), canal par canal :
 * écart = min(1, k·|R−G|), min(1, k·|G−B|), min(1, k·|B−R|) (k = 1,2, les deux signes additionnés) ;
 * saturation = 0,6·Σ écarts − 0,3 ; luminosité = 0,9·R + 1,77·G + 0,33·B − 1,2 (chacune bornée à
 * [0, 1]) ; opacité gardée = opacité × saturation × luminosité.
 */

const K = 1.2;
const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Opacité (0-1) que le masque garde d'un pixel opaque (composantes 0-255). */
export function energyMaskAlpha(r: number, g: number, b: number): number {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const spread =
    Math.min(1, K * Math.abs(R - G)) +
    Math.min(1, K * Math.abs(G - B)) +
    Math.min(1, K * Math.abs(B - R));
  const sat = clamp(0.6 * spread - 0.3);
  const lum = clamp(0.9 * R + 1.77 * G + 0.33 * B - 1.2);
  return sat * lum;
}

/** Applique le masque sur place à des pixels RGBA (ImageData.data). */
export function applyEnergyMask(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    if (a === 0) continue;
    data[i + 3] = Math.round(a * energyMaskAlpha(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0));
  }
}

/** Plus grand côté de la couche calculée (au-delà, réduite : la couche est douce, floutée). */
const MAX_SIDE = 1024;
const cache = new Map<string, Promise<string | null>>();

/**
 * Adresse (blob:) de la couche masquée de l'illustration `src`, calculée une fois et partagée par
 * toutes les cartes qui la montrent ; `null` si le calcul est impossible (image d'un autre site
 * sans CORS, pas de canevas) : l'effet garde alors le filtre SVG (fixe).
 */
export function energyLayerUrl(src: string): Promise<string | null> {
  let p = cache.get(src);
  if (!p) {
    p = compute(src).catch(() => null);
    cache.set(src, p);
  }
  return p;
}

async function compute(src: string): Promise<string | null> {
  if (typeof document === "undefined") return null;
  // Image du stockage (autre origine, CORS GET autorisé pour le site) : relue en CORS sans le
  // cache HTTP, car Chrome resservirait la copie déjà chargée par la carte sans en-têtes CORS
  // (canevas alors illisible).
  const res = await fetch(src, { mode: "cors", credentials: "omit", cache: "no-store" });
  if (!res.ok) return null;
  const img = await createImageBitmap(await res.blob());
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  applyEnergyMask(pixels.data);
  ctx.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  return blob ? URL.createObjectURL(blob) : null;
}
