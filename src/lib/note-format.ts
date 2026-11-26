/**
 * Light Markdown for Organisation notes: numbered and bulleted lists (nested by
 * indentation), [text](url) links, bare URLs, **bold**, *italic*, `code`,
 * # headings, > quotes and --- rules. Notes stay plain text in the database;
 * this module only parses them into a tree rendered with React elements, so no
 * HTML from a note is ever injected into the page.
 *
 * `htmlToMarkdown` turns rich clipboard content (web page, ChatGPT, Google
 * Docs, Word) into the same plain-text syntax when it is pasted.
 */
import { normalizeLink } from "@/lib/organisation";

export type Inline =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string };

export type ListItem = { number: number | null; lines: Inline[][]; children: Block[] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; content: Inline[] }
  /** A lone numbered line introducing what follows (« 1. Sélection des images »). */
  | { type: "section"; number: number; content: Inline[] }
  | { type: "para"; lines: Inline[][] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "quote"; lines: Inline[][] }
  | { type: "hr" };

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  euro: "€",
};

/** Decodes the HTML entities a copy sometimes leaves behind (&#39;, &amp;…). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff) return all;
      return n === 0xa0 ? " " : String.fromCodePoint(n);
    }
    return NAMED[code.toLowerCase()] ?? all;
  });
}

function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return url;
  return normalizeLink(url);
}

const INLINE_RE =
  /`([^`\n]+)`|\[([^\]\n]+)\]\(\s*<?([^()\s<>]+(?:\([^()\s]*\)[^()\s<>]*)*)>?\s*\)|((?:https?:\/\/|www\.)[^\s<>"]+)|\*\*(?!\s)([^\n]+?)(?<!\s)\*\*|__(?!\s)([^\n]+?)(?<!\s)__|(?<![\w*])\*(?![\s*])([^*\n]+?)(?<!\s)\*(?![\w*])|(?<![\w_])_(?![\s_])([^_\n]+?)(?<!\s)_(?![\w_])/g;

/** Parses one line of text into inline pieces. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const push = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last?.type === "text") last.text += t;
    else out.push({ type: "text", text: t });
  };
  const re = new RegExp(INLINE_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    let end = start + m[0].length;
    let node: Inline | null = null;
    if (m[1] !== undefined) node = { type: "code", text: m[1] };
    else if (m[2] !== undefined) {
      const href = safeHref(m[3]);
      node = href ? { type: "link", text: m[2].trim(), href } : { type: "text", text: m[0] };
    } else if (m[4] !== undefined) {
      let link = m[4];
      // Trailing punctuation belongs to the sentence, not the link.
      const trail = /[).,;:!?»'’*_]+$/.exec(link);
      if (trail && !(trail[0].startsWith(")") && link.includes("(")))
        link = link.slice(0, -trail[0].length);
      end = start + link.length;
      const href = safeHref(link);
      node = href ? { type: "link", text: link, href } : { type: "text", text: link };
    } else if (m[5] !== undefined || m[6] !== undefined)
      node = { type: "strong", children: parseInline(m[5] ?? m[6]) };
    else node = { type: "em", children: parseInline(m[7] ?? m[8]) };
    push(text.slice(last, start));
    if (node.type === "text") push(node.text);
    else out.push(node);
    last = end;
    re.lastIndex = end;
  }
  push(text.slice(last));
  return out;
}

const ITEM_RE = /^( *)(?:(\d{1,4})[.)]|([-*+•–]))[ \t]+(.*)$/;
const EMPTY_ITEM_RE = /^( *)(?:(\d{1,4})[.)]|([-*+•–]))$/;

type Line = { indent: number; text: string; blank: boolean };

function readItem(line: Line) {
  const m =
    ITEM_RE.exec(" ".repeat(line.indent) + line.text) ??
    EMPTY_ITEM_RE.exec(" ".repeat(line.indent) + line.text);
  if (!m) return null;
  // A line of dashes is a rule, not a bullet.
  if (m[3] && /^[-*_](\s*[-*_]){2,}\s*$/.test(line.text)) return null;
  return {
    ordered: m[2] !== undefined,
    number: m[2] !== undefined ? Number(m[2]) : null,
    text: m[4] ?? "",
    markerWidth: m[0].length - (m[4] ?? "").length - m[1].length,
  };
}

function parseList(lines: Line[]): Block[] {
  const blocks: Block[] = [];
  type Frame = { indent: number; item: ListItem };
  const stack: Frame[] = [];
  for (const line of lines) {
    if (line.blank) continue;
    const it = readItem(line);
    if (!it) {
      // Text under an item: a new line of that item.
      while (stack.length > 1 && line.indent <= stack[stack.length - 1].indent) stack.pop();
      const top = stack[stack.length - 1];
      if (top) top.item.lines.push(parseInline(line.text));
      continue;
    }
    while (stack.length && line.indent < stack[stack.length - 1].indent + 2) stack.pop();
    const item: ListItem = { number: it.number, lines: [parseInline(it.text)], children: [] };
    const host = stack.length ? stack[stack.length - 1].item.children : blocks;
    const prev = host[host.length - 1];
    if (prev?.type === "list" && prev.ordered === it.ordered) prev.items.push(item);
    else host.push({ type: "list", ordered: it.ordered, items: [item] });
    stack.push({ indent: line.indent, item });
  }
  return blocks;
}

const isLoneNumber = (b: Block | undefined) =>
  b?.type === "list" && b.ordered && b.items.length === 1 && b.items[0].children.length === 0;

/** Parses a whole note into blocks. */
export function parseNote(source: string): Block[] {
  const raw = decodeEntities(source).replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  const lines: Line[] = raw.split("\n").map((l) => {
    const text = l.replace(/\s+$/, "");
    const indent = /^ */.exec(text)![0].length;
    return { indent, text: text.slice(indent), blank: text.trim() === "" };
  });

  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.blank) {
      i++;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line.text);
    if (h) {
      blocks.push({
        type: "heading",
        level: Math.min(h[1].length, 3) as 1 | 2 | 3,
        content: parseInline(h[2].replace(/\s#+$/, "")),
      });
      i++;
      continue;
    }
    if (/^([-*_])(\s*\1){2,}$/.test(line.text)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (line.text.startsWith(">")) {
      const q: Inline[][] = [];
      while (i < lines.length && !lines[i].blank && lines[i].text.startsWith(">")) {
        q.push(parseInline(lines[i].text.replace(/^>\s?/, "")));
        i++;
      }
      blocks.push({ type: "quote", lines: q });
      continue;
    }
    if (readItem(line)) {
      const base = line.indent;
      const chunk: Line[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.blank) {
          // A blank line ends the list unless what follows is indented under it.
          let j = i + 1;
          while (j < lines.length && lines[j].blank) j++;
          if (j >= lines.length || lines[j].indent <= base) break;
          chunk.push(l);
          i++;
          continue;
        }
        if (chunk.length && l.indent <= base && !readItem(l)) break;
        chunk.push({ ...l, indent: Math.max(0, l.indent - base) });
        i++;
      }
      blocks.push(...parseList(chunk));
      continue;
    }
    const para: Inline[][] = [];
    while (i < lines.length && !lines[i].blank) {
      const l = lines[i];
      if (para.length && (readItem(l) || /^#{1,6}\s/.test(l.text) || l.text.startsWith(">"))) break;
      para.push(parseInline(l.text));
      i++;
    }
    blocks.push({ type: "para", lines: para });
  }

  // « 1. Titre » alone between blank lines, then a list or text: a section title.
  return blocks.map((b, k) => {
    if (!isLoneNumber(b) || b.type !== "list") return b;
    const next = blocks[k + 1];
    if (!next || isLoneNumber(next) || isLoneNumber(blocks[k - 1])) return b;
    if (next.type !== "list" && next.type !== "para") return b;
    const item = b.items[0];
    if (item.lines.length !== 1) return b;
    return { type: "section", number: item.number ?? 1, content: item.lines[0] };
  });
}

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.type === "strong" || n.type === "em" ? inlineText(n.children) : n.text))
    .join("");
}

/** The note as plain text, without Markdown signs (card previews, mails). */
export function plainNote(source: string): string {
  const parts: string[] = [];
  const walk = (blocks: Block[]) => {
    for (const b of blocks) {
      if (b.type === "heading") parts.push(inlineText(b.content));
      else if (b.type === "section") parts.push(`${b.number}. ${inlineText(b.content)}`);
      else if (b.type === "para" || b.type === "quote")
        parts.push(b.lines.map(inlineText).join("\n"));
      else if (b.type === "list")
        for (const item of b.items) {
          parts.push(
            `${item.number !== null ? `${item.number}.` : "•"} ${item.lines.map(inlineText).join("\n")}`,
          );
          walk(item.children);
        }
    }
  };
  walk(parseNote(source));
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/* Rich paste → Markdown                                                */
/* ------------------------------------------------------------------ */

const IND = "\u0001";
const SKIP = new Set([
  "SCRIPT",
  "STYLE",
  "HEAD",
  "META",
  "TITLE",
  "TEMPLATE",
  "NOSCRIPT",
  "SVG",
  "BUTTON",
  "IFRAME",
  "OBJECT",
  "LINK",
]);
const BLOCK = new Set([
  "P",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "ASIDE",
  "FIGURE",
  "FIGCAPTION",
  "DL",
  "DD",
  "DT",
  "ADDRESS",
  "FIELDSET",
  "FORM",
  "NAV",
]);

/** Does this clipboard HTML carry structure worth keeping (lists, links, titles, bold…)? */
export function htmlHasStructure(html: string): boolean {
  return (
    /<(ul|ol|li|a\s[^>]*href|h[1-6]|strong|b|em|blockquote|table)\b/i.test(html) ||
    /font-weight:\s*(bold|[6-9]00)/i.test(html)
  );
}

/** Converts pasted HTML (already parsed by DOMParser, scripts never run) to note Markdown. */
export function htmlToMarkdown(root: Node): string {
  const conv = (node: Node, pre = false): string => {
    if (node.nodeType === 3) {
      const t = node.textContent ?? "";
      return pre ? t : t.replace(/[ \t\r\n\f]+/g, " ");
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return "";
    const el = node as Element;
    const tag = node.nodeType === 1 ? el.tagName.toUpperCase() : "";
    if (SKIP.has(tag)) return "";
    const kids = (p = pre) =>
      Array.from(node.childNodes)
        .map((c) => conv(c, p))
        .join("");
    const style = (node.nodeType === 1 && el.getAttribute("style")) || "";
    switch (tag) {
      case "BR":
        return "\n";
      case "HR":
        return "\n\n---\n\n";
      case "IMG":
        return "";
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6": {
        const level = Math.min(Number(tag[1]), 3);
        const text = kids().replace(/\s+/g, " ").replace(/\*\*/g, "").trim();
        return text ? `\n\n${"#".repeat(level)} ${text}\n\n` : "";
      }
      case "A": {
        const text = kids().replace(/\s+/g, " ").trim();
        const href = safeHref(el.getAttribute("href") ?? "");
        if (!href) return kids();
        if (!text) return "";
        const same =
          text === href ||
          href.replace(/^https?:\/\//, "").replace(/\/$/, "") ===
            text.replace(/^https?:\/\//, "").replace(/\/$/, "");
        return same ? href : `[${text.replace(/[[\]]/g, "")}](${href})`;
      }
      case "STRONG":
      case "B":
        if (/font-weight:\s*(normal|[1-5]00)/i.test(style)) return kids();
        return wrap(kids(), "**");
      case "EM":
      case "I":
        return wrap(kids(), "*");
      case "CODE":
        return pre ? kids() : wrap(kids(), "`");
      case "PRE":
        return `\n\n${kids(true).replace(/\n+$/, "")}\n\n`;
      case "BLOCKQUOTE":
        return `\n\n${clean(kids())
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")}\n\n`;
      case "UL":
      case "OL": {
        const ordered = tag === "OL";
        let n = Number(el.getAttribute("start") ?? "1") || 1;
        const items = Array.from(el.children)
          .filter((c) => c.tagName.toUpperCase() === "LI")
          .map((li) => {
            const v = Number(li.getAttribute("value"));
            if (ordered && v) n = v;
            const marker = ordered ? `${n++}. ` : "- ";
            const body = clean(conv(li))
              .replace(/\n{2,}/g, "\n")
              .split("\n")
              .map((l, k) => (k === 0 ? marker + l : IND.repeat(marker.length) + l))
              .join("\n");
            return body;
          });
        return `\n\n${items.join("\n")}\n\n`;
      }
      case "LI":
        return kids();
      case "TR":
        return (
          Array.from(el.children)
            .map((c) => conv(c).replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .join(" · ") + "\n"
        );
      case "TABLE":
        return `\n\n${kids()}\n\n`;
      case "DIV":
        return `\n${kids()}\n`;
      case "SPAN": {
        const bold = /font-weight:\s*(bold|[6-9]00)/i.test(style);
        const italic = /font-style:\s*italic/i.test(style);
        let t = kids();
        if (bold) t = wrap(t, "**");
        if (italic) t = wrap(t, "*");
        return t;
      }
      default:
        if (BLOCK.has(tag)) return `\n\n${kids()}\n\n`;
        return kids();
    }
  };
  return clean(conv(root))
    .replace(new RegExp(IND, "g"), " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrap(text: string, mark: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  if (!m[2] || m[2].includes("\n")) return text;
  // Already marked (nested <b><strong>): keep a single pair.
  if (m[2].startsWith(mark) && m[2].endsWith(mark)) return text;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}

/** Trims spaces around each line while keeping list indentation markers. */
function clean(text: string): string {
  return text
    .split("\n")
    .map((l) => {
      const m = new RegExp(`^((?:[ \\t]*${IND})*)[ \\t]*(.*?)[ \\t]*$`).exec(l)!;
      const depth = (m[1].match(new RegExp(IND, "g")) ?? []).length;
      return m[2] ? IND.repeat(depth) + m[2] : "";
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

/* ------------------------------------------------------------------ */
/* Editor helpers                                                       */
/* ------------------------------------------------------------------ */

/** What Enter should insert to continue the list on `line`; `exit` when the item is empty. */
export function continueList(line: string): { insert: string } | { exit: true } | null {
  const m = /^( *)(?:(\d{1,4})([.)])|([-*+•–]))( +)(.*)$/.exec(line);
  if (!m) return null;
  if (!m[6].trim()) return { exit: true };
  const marker = m[2] !== undefined ? `${Number(m[2]) + 1}${m[3]}` : m[4];
  return { insert: `\n${m[1]}${marker}${m[5]}` };
}
