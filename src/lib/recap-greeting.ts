/**
 * Récap mensuel : le mail envoyé début janvier (récap de décembre) souhaite la bonne année
 * et rappelle le total de l'année écoulée.
 */
export type NewYearGreeting = { year: number; title: string; lines: string[]; closing: string };

export function newYearGreeting(recapMonth: string, yearTotal: number): NewYearGreeting | null {
  const [y, m] = recapMonth.split("-").map(Number);
  if (m !== 12) return null;
  const year = y + 1;
  return {
    year,
    title: `🎉 Bonne année ${year} !`,
    lines: [
      `Toute l'équipe Digicom vous souhaite une très belle année ${year} : de la réussite, de beaux projets et plein de nouveaux contenus à publier ensemble.`,
      `Merci à chacune et chacun pour le travail accompli en ${y}${
        yearTotal > 0
          ? ` : ${yearTotal} article${yearTotal > 1 ? "s" : ""} publié${yearTotal > 1 ? "s" : ""} sur le blog sur toute l'année, bravo !`
          : "."
      }`,
    ],
    closing: `Que ${year} soit encore plus riche en articles et en belles idées. Belle année à toutes et à tous !`,
  };
}
