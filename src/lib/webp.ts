/**
 * Images ajoutées dans Digicom : converties automatiquement en WebP dans le navigateur, avant
 * l'envoi, pour que le fichier stocké (et téléchargé ensuite) soit déjà au bon format.
 * Gardés tels quels : WebP déjà, GIF (animations), SVG, formats que le navigateur ne sait pas
 * lire, et navigateurs qui ne savent pas produire de WebP (le fichier d'origine part alors).
 * Même logique copiée dans public/suivi-editorial.html et public/planning-integre.html.
 */
export const WEBP_QUALITY = 0.9;
const CONVERTIBLE = /^image\/(jpeg|jpg|pjpeg|png|bmp|x-ms-bmp|avif)$/i;

export function webpName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}.webp`;
}

export async function toWebp(file: File, quality = WEBP_QUALITY): Promise<File> {
  if (!CONVERTIBLE.test(file.type) || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    // Certains navigateurs (Safari) renvoient du PNG au lieu du WebP : on garde alors l'original.
    if (!blob || blob.type !== "image/webp") return file;
    return new File([blob], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}
