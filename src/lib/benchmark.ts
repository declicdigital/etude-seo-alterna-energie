import { GEOFFREY_EMAIL } from "@/lib/step-reminders";

/**
 * Benchmark Énergie : tout le monde consulte, seul Geoffrey modifie.
 * Le drapeau `editor` renvoyé par la route benchmark-months pilote
 * l'interface (lecture seule pour les autres).
 */
export function canEditBenchmark(isAdmin: boolean, email?: string | null): boolean {
  return isAdmin && email?.toLowerCase() === GEOFFREY_EMAIL;
}
