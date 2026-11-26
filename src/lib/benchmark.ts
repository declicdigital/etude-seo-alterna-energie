import { BENCHMARK_EDITOR_EMAILS, isPilot } from "@/lib/digicom-team";

/**
 * Benchmark Énergie : tout le monde consulte, seuls les pilotes admin (PILOT_EMAILS) et les éditeurs approuvés de BENCHMARK_EDITOR_EMAILS modifient.
 * Le drapeau `editor` renvoyé par la route benchmark-months pilote
 * l'interface (lecture seule pour les autres).
 */
export function canEditBenchmark(isAdmin: boolean, email?: string | null, approved = false): boolean {
  if (isPilot(isAdmin, email)) return true;
  return approved && (BENCHMARK_EDITOR_EMAILS as readonly string[]).includes((email ?? "").trim().toLowerCase());
}
