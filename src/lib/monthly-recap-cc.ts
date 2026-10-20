/** People always copied on the monthly recap, even without an account in the tool. */
export const RECAP_FIXED_CC = [
  "christophe.castel@alterna-energie.fr",
  "geraldine.deiber@alterna-energie.fr",
] as const;

/** Always-CC people plus extra test copies, dropping anyone already addressed directly. */
export function recapCc(recipients: readonly string[], extraCc: readonly string[] = []): string[] {
  const direct = new Set(recipients.map((e) => e.trim().toLowerCase()));
  return [...new Set<string>([...RECAP_FIXED_CC, ...extraCc])]
    .map((e) => e.trim())
    .filter((e) => e !== "" && !direct.has(e.toLowerCase()));
}
