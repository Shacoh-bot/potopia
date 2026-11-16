import { CARD_IMAGE_SIZES, isBlurryWhenZoomed } from "../src/card-rules";

/** Un WebP déjà à la bonne taille et sous ce poids part tel quel. */
const SMALL_ENOUGH = 1.5 * 1024 * 1024;

/** Illustration prête à l'envoi : la grande, sa version réduite, et la taille de l'image envoyée. */
export type CardImages = {
  /** Côté long `CARD_IMAGE_SIZES.large` au plus : l'illustration gardée, pour la carte agrandie. */
  large: File;
  /** Côté long `CARD_IMAGE_SIZES.small` ; null : l'image est déjà assez petite (la grande sert). */
  small: File | null;
  /** Taille de l'image choisie (avant réduction). */
  width: number;
  height: number;
};

/** Réduit l'image (côté long `maxSide` au plus) et l'encode en WebP. */
async function encode(bitmap: ImageBitmap, maxSide: number, name: string): Promise<File> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (context) {
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.85));
  // Safari ancien : toBlob retombe sur du PNG quand il ne sait pas encoder le WebP
  if (!blob || blob.type !== "image/webp") {
    throw new Error("Ce navigateur ne sait pas convertir en WebP : essaie avec Chrome ou Firefox.");
  }
  return new File([blob], name, { type: "image/webp" });
}

/**
 * Prépare une illustration dans le navigateur avant son envoi (le stockage n'accepte que du WebP) :
 * la grande (2 400 px au plus de côté, nette en carte agrandie) et sa version réduite (800 px) que
 * chargent les petites cartes des planches. Un WebP déjà à la bonne taille et léger part tel quel.
 * Lève une erreur (message affichable) si le navigateur ne sait pas décoder l'image ou l'encoder en
 * WebP.
 */
export async function toCardImages(file: Blob, name = "illustration"): Promise<CardImages> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Image illisible : utilise un PNG, un JPEG ou un WebP.");
  }
  const base = name.replace(/\.[^.]*$/, "");
  const { width, height } = bitmap;
  const longSide = Math.max(width, height);
  try {
    const keep =
      longSide <= CARD_IMAGE_SIZES.large && file.type === "image/webp" && file.size <= SMALL_ENOUGH;
    const large = keep
      ? new File([file], `${base}.webp`, { type: "image/webp" })
      : await encode(bitmap, CARD_IMAGE_SIZES.large, `${base}.webp`);
    const small =
      longSide > CARD_IMAGE_SIZES.small
        ? await encode(bitmap, CARD_IMAGE_SIZES.small, `${base}-petite.webp`)
        : null;
    return { large, small, width, height };
  } finally {
    bitmap.close();
  }
}

/**
 * Avertissement à montrer après l'envoi d'une image trop petite pour rester nette en carte
 * agrandie (`CARD_IMAGE_SIZES.sharp`) ; null : rien à signaler. L'envoi n'est jamais bloqué.
 */
export function sizeWarning(size: { width: number; height: number }): string | null {
  if (!isBlurryWhenZoomed(size)) return null;
  return (
    `Attention : image de ${size.width} × ${size.height} px, elle sera floue en carte agrandie. ` +
    `Renvoie-la depuis son fichier d'origine si possible (${CARD_IMAGE_SIZES.sharp} px au moins ` +
    `de côté long).`
  );
}

/** URL d'envoi présignée (ou message d'erreur), demandée au serveur pour un fichier. */
export type UploadTarget = { key: string; url: string } | { error: string };

/**
 * Envoie l'illustration préparée au stockage : la grande, puis sa version réduite, chacune par sa
 * propre URL présignée. Renvoie leurs clés, à confirmer ensuite sur la carte, ou un message.
 */
export async function sendCardImages(
  images: CardImages,
  request: (contentType: string, size: number) => Promise<UploadTarget>,
): Promise<{ key: string; smallKey: string | null } | { error: string }> {
  const put = async (file: File) => {
    const target = await request(file.type, file.size);
    if ("error" in target) return target;
    const sent = await fetch(target.url, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type },
    }).catch(() => null);
    return sent?.ok ? { key: target.key } : { error: "L'envoi de l'image a échoué." };
  };
  const large = await put(images.large);
  if ("error" in large) return large;
  if (!images.small) return { key: large.key, smallKey: null };
  const small = await put(images.small);
  if ("error" in small) return small;
  return { key: large.key, smallKey: small.key };
}

/** Première image du presse-papiers d'un événement « coller ». */
export function pastedImage(data: DataTransfer | null): File | undefined {
  const item = [...(data?.items ?? [])].find(
    (i) => i.kind === "file" && i.type.startsWith("image/"),
  );
  return item?.getAsFile() ?? undefined;
}
