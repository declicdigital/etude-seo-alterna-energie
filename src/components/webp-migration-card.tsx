import { useState } from "react";
import { ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  convertExistingImages,
  type MigrationProgress,
  type MigrationReport,
} from "@/lib/webp-migration";

/** Page « Demandes d'accès » (admins) : convertir une fois les images déjà présentes en WebP. */
export function WebpMigrationCard() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      setReport(await convertExistingImages(setProgress));
    } catch (e) {
      setError(e instanceof Error ? e.message : "La conversion s'est arrêtée. Relancez-la.");
    } finally {
      setRunning(false);
    }
  };

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <section className="mb-6 border-y border-border py-5">
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
        <ImageDown className="size-5" />
        Convertir les images existantes en WebP
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Les nouvelles images sont déjà converties à l'envoi. Ce bouton convertit une fois celles qui
        étaient déjà dans les suivis éditoriaux et dans Le Radar (même taille). À lancer depuis
        Chrome ou Edge ; on peut le relancer sans risque.
      </p>
      <Button onClick={() => void run()} disabled={running}>
        <ImageDown />
        {running ? "Conversion en cours…" : "Convertir les images"}
      </Button>
      {progress && running && (
        <div className="mt-3 space-y-1.5" role="status">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {progress.done} / {progress.total} · {progress.label}
          </p>
        </div>
      )}
      {report && (
        <div role="status" className="mt-3 space-y-1 text-sm">
          <p className="font-medium text-primary">
            ✓ {report.editorial} image{report.editorial > 1 ? "s" : ""} des suivis et {report.radar}{" "}
            du Radar converties en WebP.
          </p>
          {report.failed.length > 0 && (
            <p className="text-destructive">
              {report.failed.length} non converties : {report.failed.slice(0, 6).join(", ")}
              {report.failed.length > 6 ? "…" : ""}. Relancez la conversion.
            </p>
          )}
          {report.skipped.length > 0 && (
            <p className="text-muted-foreground">
              {report.skipped.length} introuvable{report.skipped.length > 1 ? "s" : ""} dans le
              stockage (ignorée
              {report.skipped.length > 1 ? "s" : ""}).
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
