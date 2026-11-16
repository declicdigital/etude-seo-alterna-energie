import { useEffect, useState } from "react";
import { Download, Eye, FileText, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { faqFileUrl } from "@/lib/faq-files";
import type { FaqAttachment } from "@/lib/faq";

/**
 * Pièces jointes des demandes FAQ : envoi dans le bucket privé « faq-files », ouverture en
 * lecture seule (aperçu dans Digicom : images, PDF, textes, vidéos ; les autres formats se
 * téléchargent), suppression par l'auteur ou un modérateur.
 */
type Kind = "image" | "pdf" | "text" | "video" | "audio" | "other";
const kindOf = (f: FaqAttachment): Kind => {
  const t = f.type.toLowerCase();
  const n = f.name.toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (t.startsWith("text/") || /\.(txt|csv|md)$/.test(n)) return "text";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  return "other";
};

async function download(f: FaqAttachment) {
  const url = await faqFileUrl(f, true);
  if (!url) return alert("Ce fichier n'est plus disponible.");
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Aperçu en lecture seule d'une pièce jointe. */
export function FaqFileViewer({
  file,
  onClose,
}: {
  file: FaqAttachment | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!file) return;
    let alive = true;
    void faqFileUrl(file).then((u) => {
      if (!alive) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [file]);
  const kind = file ? kindOf(file) : "other";
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(1100px,96vw)] max-w-none flex-col gap-3 p-4 sm:max-w-none">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 pr-8">
          <DialogTitle className="truncate text-base">{file?.name}</DialogTitle>
          {file && (
            <button
              type="button"
              onClick={() => void download(file)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Download className="size-3.5" /> Télécharger
            </button>
          )}
        </DialogHeader>
        <div className="flex min-h-[50vh] flex-1 items-center justify-center overflow-auto rounded-lg bg-muted/40">
          {failed ? (
            <p className="text-sm text-muted-foreground">Ce fichier n'est plus disponible.</p>
          ) : !url ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : kind === "image" ? (
            <img src={url} alt={file?.name} className="max-h-[78vh] max-w-full object-contain" />
          ) : kind === "pdf" || kind === "text" ? (
            <iframe
              src={url}
              title={file?.name}
              className="h-[78vh] w-full rounded-lg border-0 bg-white"
            />
          ) : kind === "video" ? (
            <video src={url} controls className="max-h-[78vh] max-w-full" />
          ) : kind === "audio" ? (
            <audio src={url} controls />
          ) : (
            <div className="space-y-3 p-6 text-center">
              <FileText className="mx-auto size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Pas d'aperçu possible pour ce format : télécharge-le pour l'ouvrir.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Liste de pièces jointes : clic = aperçu en lecture seule ; corbeille si on peut supprimer. */
export function FaqAttachmentList({
  files,
  canDelete,
  onDelete,
}: {
  files: FaqAttachment[];
  canDelete?: (f: FaqAttachment) => boolean;
  onDelete?: (f: FaqAttachment) => void;
}) {
  const [viewing, setViewing] = useState<FaqAttachment | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    for (const f of files)
      if (kindOf(f) === "image" && !thumbs[f.path ?? f.name])
        void faqFileUrl(f).then(
          (u) => alive && u && setThumbs((t) => ({ ...t, [f.path ?? f.name]: u })),
        );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);
  if (!files.length) return null;
  return (
    <>
      <div className="mt-2 flex flex-wrap items-start gap-2">
        {files.map((f, i) => {
          const thumb = thumbs[f.path ?? f.name];
          const deletable = !!onDelete && !!canDelete?.(f);
          return (
            <span key={f.id ?? `${f.name}-${i}`} className="group relative inline-flex">
              {kindOf(f) === "image" && thumb ? (
                <button
                  type="button"
                  onClick={() => setViewing(f)}
                  className="relative size-20 overflow-hidden rounded-md border"
                  title={`${f.name} · voir`}
                >
                  <img src={thumb} alt={f.name} className="size-full object-cover" />
                  <span className="absolute inset-0 m-auto flex size-8 items-center justify-center rounded-full bg-background/90 shadow transition-transform group-hover:scale-110">
                    <Eye className="size-4" />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setViewing(f)}
                  className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted"
                  title={`${f.name} · voir`}
                >
                  <Eye className="size-3 shrink-0" /> <span className="truncate">{f.name}</span>
                </button>
              )}
              {deletable && (
                <button
                  type="button"
                  onClick={() => onDelete!(f)}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Supprimer ${f.name}`}
                  title="Supprimer la pièce jointe"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
      <FaqFileViewer file={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
