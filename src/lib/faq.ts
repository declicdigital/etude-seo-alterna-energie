export const FAQ_CATEGORIES = [
  "Souscription",
  "Offres & contrats",
  "Factures & paiements",
  "Déménagement & résiliation",
  "Assistance & dépannage",
  "B.a-ba de l'énergie",
  "Engagement responsable",
];

export type FaqAttachment = { name: string; type: string; dataUrl: string };

export type FaqComment = {
  id: string;
  authorName: string;
  authorEmail: string;
  body: string;
  mentions: string[];
  attachments: FaqAttachment[];
  createdAt: string;
};

export type FaqRequest = {
  id: string;
  requester: string;
  requesterEmail: string;
  type: string;
  subject: string;
  content: string;
  target: string;
  category: string;
  newCategory: boolean;
  comments: FaqComment[];
  createdAt: string;
};

export function faqLink(id?: string): string {
  const base = "https://etude-seo-alterna-energie.lovable.app/?sheet=SUIVI+FAQ";
  return id ? `${base}#faq-${encodeURIComponent(id)}` : base;
}
