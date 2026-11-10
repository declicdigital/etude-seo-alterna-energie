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

/** Où la FAQ sera publiée : dans l'aide Zendesk ou sur le site web. */
export const FAQ_CHANNELS = ["Zendesk", "Site Web"];

/** Les catégories ne concernent que les FAQ Zendesk : une FAQ « Site Web » n'en a pas. */
export const faqNeedsCategory = (channel: string | undefined) => channel !== "Site Web";

/**
 * Comptes qui, en plus des administrateurs (Geoffrey), valident les demandes FAQ et en
 * renseignent les liens : Matthieu et Marick. Même liste dans le garde-fou SQL
 * `can_validate_faq` (migration 0013).
 */
export const FAQ_VALIDATOR_EMAILS = [
  "matthieu.roux@alterna-energie.fr",
  "marick.navarro@soregies.fr",
  "marick.navarro.ext@soregies.fr",
];

export function canValidateFaqRequests(isAdmin: boolean, email: string | null | undefined): boolean {
  return isAdmin || FAQ_VALIDATOR_EMAILS.includes((email ?? "").trim().toLowerCase());
}

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
  /** Zendesk ou Site Web (absent sur les demandes créées avant ce choix). */
  channel?: string;
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
