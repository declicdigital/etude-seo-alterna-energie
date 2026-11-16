import { supabase } from "@/integrations/supabase/client";
import type { FaqAttachment } from "@/lib/faq";

/** Pièces jointes des demandes FAQ : bucket privé « faq-files » (migration 0017). */
const BUCKET = "faq-files";
export const FAQ_FILE_MAX = 25 * 1024 * 1024;

const safeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120) || "fichier";

export async function uploadFaqFile(
  file: File,
  by: { name: string; email: string },
): Promise<FaqAttachment> {
  if (file.size > FAQ_FILE_MAX) throw new Error(`« ${file.name} » dépasse 25 Mo.`);
  const id = crypto.randomUUID();
  const path = `${id}/${safeName(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(`« ${file.name} » n'a pas pu être envoyé.`);
  return {
    id,
    name: file.name,
    type: file.type || "application/octet-stream",
    path,
    size: file.size,
    addedBy: by.name,
    addedByEmail: by.email,
    addedAt: new Date().toISOString(),
  };
}

export async function removeFaqFiles(files: FaqAttachment[]) {
  const paths = files.map((f) => f.path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

export async function faqFileUrl(f: FaqAttachment, download = false): Promise<string | null> {
  if (f.dataUrl) return f.dataUrl;
  if (!f.path) return null;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(f.path, 3600, download ? { download: f.name } : undefined);
  return data?.signedUrl ?? null;
}
