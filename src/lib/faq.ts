import { ficheLink } from "./slugs";
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

export function canValidateFaqRequests(
  isAdmin: boolean,
  email: string | null | undefined,
): boolean {
  return isAdmin || FAQ_VALIDATOR_EMAILS.includes((email ?? "").trim().toLowerCase());
}

/**
 * Comptes qui, en plus des administrateurs (Geoffrey), suppriment les commentaires et pièces
 * jointes de n'importe qui : Matthieu. Même règle côté base (`can_moderate_faq`, migration 0017).
 */
export const FAQ_MODERATOR_EMAILS = ["matthieu.roux@alterna-energie.fr"];

export function canModerateFaq(isAdmin: boolean, email: string | null | undefined): boolean {
  return isAdmin || FAQ_MODERATOR_EMAILS.includes((email ?? "").trim().toLowerCase());
}

/** Supprimer un commentaire ou une pièce jointe : son auteur, ou un modérateur. */
export function canDeleteFaqItem(
  authorEmail: string | null | undefined,
  myEmail: string | null | undefined,
  moderator: boolean,
): boolean {
  if (moderator) return true;
  const me = (myEmail ?? "").trim().toLowerCase();
  return !!me && (authorEmail ?? "").trim().toLowerCase() === me;
}

/**
 * Pièce jointe : les nouvelles sont dans le bucket privé « faq-files » (`path`), les anciennes
 * gardent leur contenu dans `dataUrl`.
 */
export type FaqAttachment = {
  id?: string;
  name: string;
  type: string;
  dataUrl?: string;
  path?: string;
  size?: number;
  addedBy?: string;
  addedByEmail?: string;
  addedAt?: string;
};

const catKey = (c: string) =>
  c
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Catégories proposées : la liste de base, puis les nouvelles catégories gardées (validées par
 * Geoffrey ou Matthieu), sans doublon de casse ni d'accent ; la plus ancienne orthographe gagne.
 */
export function faqCategories(requests: FaqRequest[]): string[] {
  const out = [...FAQ_CATEGORIES];
  const seen = new Set(out.map(catKey));
  const accepted = requests
    .filter((r) => r.newCategory && r.categoryAcceptedAt && r.category?.trim())
    .sort((a, b) => (a.categoryAcceptedAt ?? "").localeCompare(b.categoryAcceptedAt ?? ""));
  for (const r of accepted) {
    const k = catKey(r.category);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r.category.trim().replace(/\s+/g, " "));
  }
  return out;
}

/** Une « nouvelle » catégorie qui existe déjà (casse ou accents près) reprend l'orthographe connue. */
export function matchFaqCategory(name: string, categories: string[]): string | null {
  const k = catKey(name);
  return categories.find((c) => catKey(c) === k) ?? null;
}

/** Où en est la demande : en cours → validée → réalisée (publiée, avec son lien). */
export type FaqStatus = "en-cours" | "validee" | "realisee";
export function faqStatus(r: Pick<FaqRequest, "validatedAt" | "approvedAt">): FaqStatus {
  if (r.validatedAt) return "realisee";
  if (r.approvedAt) return "validee";
  return "en-cours";
}

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
  /** Réalisée : la FAQ est en ligne (question finale + lien). */
  validatedAt?: string;
  validatedBy?: string;
  /** Validée : la demande est acceptée, la FAQ reste à réaliser. */
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  /** Pièces jointes de la demande (hors commentaires). */
  files?: FaqAttachment[];
  /**
   * Nouvelle catégorie gardée : posé quand Geoffrey (admin) ou Matthieu valident la demande
   * (ou la marquent réalisée). La catégorie rejoint alors la liste proposée à tout le monde.
   */
  categoryAcceptedAt?: string;
  target: string;
  /** Zendesk ou Site Web (absent sur les demandes créées avant ce choix). */
  channel?: string;
  category: string;
  newCategory: boolean;
  comments: FaqComment[];
  createdAt: string;
};

export function faqLink(id?: string, title?: string): string {
  return id ? ficheLink("SUIVI FAQ", "demandes", id, title) : appUrl("faq/demandes");
}

export function canValidateFaq(question: string, link: string): boolean {
  if (!question.trim()) return false;
  try {
    const url = new URL(link.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validatedFaqForTarget(requests: FaqRequest[], target: string): FaqRequest[] {
  return requests
    .filter((r) => !!r.validatedAt && r.target === target)
    .sort((a, b) => (b.validatedAt ?? "").localeCompare(a.validatedAt ?? ""));
}
