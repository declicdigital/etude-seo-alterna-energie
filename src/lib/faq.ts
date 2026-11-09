import { ficheLink } from './slugs';
import { appUrl } from "@/lib/app-url";
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
  question?: string;
  answer?: string;
  link?: string;
  validatedAt?: string;
  validatedBy?: string;
  target: string;
  category: string;
  newCategory: boolean;
  comments: FaqComment[];
  createdAt: string;
};

export function faqLink(id?: string, title?: string): string {
  return id ? ficheLink('SUIVI FAQ', 'demandes', id, title) : appUrl('faq/demandes');
}

export function canValidateFaq(question: string, link: string): boolean {
  if (!question.trim()) return false;
  try {
    const url = new URL(link.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch { return false; }
}

export function validatedFaqForTarget(requests: FaqRequest[], target: string): FaqRequest[] {
  return requests.filter((r) => !!r.validatedAt && r.target === target)
    .sort((a, b) => (b.validatedAt ?? "").localeCompare(a.validatedAt ?? ""));
}
