/**
 * Rubrique « Organisation » : tableau de fiches façon Trello.
 * Données dans public.org_columns / public.org_cards (accès contrôlé en base
 * par can_use_organisation). Ce module ne contient que de la logique pure.
 */

export const ORGANISATION_SHEET = "ORGANISATION";

export type OrgColumn = { id: string; title: string; position: number };

export type OrgCard = {
  id: string;
  column_id: string;
  title: string;
  content: string;
  position: number;
  assignee_id: string | null;
  tagged_ids: string[];
  due_date: string | null;
  /** Links and files attached to the card (files live in the « org-files » bucket). */
  attachments: OrgAttachment[];
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type OrgAttachment = {
  id: string;
  kind: "link" | "file";
  name: string;
  /** Link target (kind « link »). */
  url?: string;
  /** Path in the « org-files » bucket (kind « file »). */
  path?: string;
  size?: number;
  mime?: string;
  added_by?: string | null;
  added_at: string;
};

export const ORG_FILES_BUCKET = "org-files";
/** Same limit as the bucket (50 MB). */
export const ORG_FILE_MAX_BYTES = 50 * 1024 * 1024;

export type OrgMember = { id: string; full_name: string | null; email: string };

const STEP = 1000;

/** Position for an item dropped between two neighbours (either may be missing). */
export function positionBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return STEP;
  if (before == null) return (after as number) - STEP;
  if (after == null) return before + STEP;
  return (before + after) / 2;
}

export function sortByPosition<T extends { position: number; created_at?: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) => a.position - b.position || (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
}

/**
 * Position for a card moved to `index` within `target` column. `cards` is the
 * whole board; the moved card itself is ignored when picking neighbours.
 */
export function positionForDrop(
  cards: OrgCard[],
  cardId: string,
  target: string,
  index: number,
): number {
  const list = sortByPosition(cards.filter((c) => c.column_id === target && c.id !== cardId));
  const i = Math.max(0, Math.min(index, list.length));
  return positionBetween(list[i - 1]?.position ?? null, list[i]?.position ?? null);
}

export function memberName(m: OrgMember | undefined | null): string {
  if (!m) return "Ancien membre";
  return m.full_name?.trim() || m.email.split("@")[0];
}

export function initials(m: OrgMember | undefined | null): string {
  const name = memberName(m);
  const parts = name
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Stable pastel colour per person, so avatars are recognisable. */
const AVATAR_COLOURS = [
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-800",
  "bg-orange-100 text-orange-800",
];
export function avatarColour(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

export type DueState = "overdue" | "today" | "soon" | "later";

/** Due state relative to today (local days); "soon" = within 3 days. */
export function dueState(due: string, today: Date): DueState {
  const [y, m, d] = due.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = Math.round((target - start) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "later";
}

export type CardFilter = "all" | "mine" | "tagged";

export function matchesFilter(
  card: OrgCard,
  filter: CardFilter,
  me: string | null,
  query: string,
): boolean {
  if (filter === "mine" && card.assignee_id !== me) return false;
  if (filter === "tagged" && !(me && card.tagged_ids.includes(me))) return false;
  const q = query.trim().toLocaleLowerCase("fr");
  if (!q) return true;
  return `${card.title}\n${card.content}`.toLocaleLowerCase("fr").includes(q);
}

/** First lines of the note, for the card preview. */
export function excerpt(content: string, max = 140): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** People to notify after a change: newly assigned and newly tagged, never the author. */
export function newlyInvolved(
  before: Pick<OrgCard, "assignee_id" | "tagged_ids"> | null,
  after: Pick<OrgCard, "assignee_id" | "tagged_ids">,
  me: string | null,
): { assigned: string[]; tagged: string[] } {
  const assigned =
    after.assignee_id && after.assignee_id !== before?.assignee_id && after.assignee_id !== me
      ? [after.assignee_id]
      : [];
  const prev = new Set(before?.tagged_ids ?? []);
  const tagged = after.tagged_ids.filter(
    (id) => !prev.has(id) && id !== me && !assigned.includes(id),
  );
  return { assigned, tagged };
}

export function cardHash(id: string): string {
  return `#card-${id}`;
}

export function cardIdFromHash(hash: string): string | null {
  const m = /^#card-([0-9a-f-]{36})$/i.exec(hash);
  return m ? m[1] : null;
}

/** Attachments of a card, tolerant of a missing or malformed column. */
export function attachmentsOf(card: { attachments?: unknown }): OrgAttachment[] {
  const list = Array.isArray(card.attachments) ? card.attachments : [];
  return list.filter(
    (a): a is OrgAttachment =>
      !!a &&
      typeof a === "object" &&
      typeof (a as OrgAttachment).id === "string" &&
      ((a as OrgAttachment).kind === "link" || (a as OrgAttachment).kind === "file"),
  );
}

/** A typed link made usable: adds https:// when missing, refuses anything but http(s). */
export function normalizeLink(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Short label for a link: host and path, without the scheme. */
export function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const rest = `${u.pathname === "/" ? "" : u.pathname}${u.search}`;
    const label = `${u.hostname.replace(/^www\./, "")}${rest}`;
    return label.length > 60 ? `${label.slice(0, 59)}…` : label;
  } catch {
    return url;
  }
}

export type NoteSegment = { text: string; href?: string };

/** Splits a note into text and links (http(s)://… or www.…), for clickable display. */
export function linkify(text: string): NoteSegment[] {
  const out: NoteSegment[] = [];
  const re = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
  let last = 0;
  for (const m of text.matchAll(re)) {
    let link = m[0];
    // Trailing punctuation belongs to the sentence, not the link.
    const trail = /[).,;:!?»'’]+$/.exec(link);
    if (trail && !(trail[0].startsWith(")") && link.includes("(")))
      link = link.slice(0, -trail[0].length);
    const start = m.index ?? 0;
    const href = normalizeLink(link);
    if (!href) continue;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: link, href });
    last = start + link.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Storage key for an uploaded file: ASCII only, keeps the extension. */
export function storageName(fileName: string): string {
  const base = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return (base || "fichier").slice(-100);
}
