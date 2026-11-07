/** Côté le plus long d'une illustration envoyée : assez pour une carte agrandie, écran haute densité. */
const MAX_SIDE = 1200;
/** Un WebP déjà à la bonne taille et sous ce poids part tel quel. */
const SMALL_ENOUGH = 400 * 1024;

/**
 * Convertit une illustration en WebP dans le navigateur avant son envoi (1 200 px au plus de côté) :
 * le stockage n'accepte que du WebP, et les planches chargent des dizaines d'images. Un WebP déjà
 * petit part tel quel. Lève une erreur (message affichable) si le navigateur ne sait pas décoder
 * l'image ou l'encoder en WebP.
 */
export async function toCardWebp(file: Blob, name = "illustration"): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Image illisible : utilise un PNG, un JPEG ou un WebP.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const base = name.replace(/\.[^.]*$/, "");
  if (scale === 1 && file.type === "image/webp" && file.size <= SMALL_ENOUGH) {
    bitmap.close();
    return new File([file], `${base}.webp`, { type: "image/webp" });
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.85));
  // Safari ancien : toBlob retombe sur du PNG quand il ne sait pas encoder le WebP
  if (!blob || blob.type !== "image/webp") {
    throw new Error("Ce navigateur ne sait pas convertir en WebP : essaie avec Chrome ou Firefox.");
  }
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

/** Première image du presse-papiers d'un événement « coller ». */
export function pastedImage(data: DataTransfer | null): File | undefined {
  const item = [...(data?.items ?? [])].find(
    (i) => i.kind === "file" && i.type.startsWith("image/"),
  );
  return item?.getAsFile() ?? undefined;
}
