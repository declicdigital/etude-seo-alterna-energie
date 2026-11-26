import type { ClipboardEvent, KeyboardEvent, RefObject } from "react";
import { Bold, Link2, List, ListOrdered } from "lucide-react";
import { continueList, decodeEntities, htmlHasStructure, htmlToMarkdown } from "@/lib/note-format";
import { normalizeLink } from "@/lib/organisation";

/**
 * Replaces the textarea selection with `text`, through the browser's own
 * editing command when possible so Ctrl+Z still works, and selects
 * [selStart, selEnd] (offsets inside `text`) afterwards.
 */
function insert(
  el: HTMLTextAreaElement,
  text: string,
  onChange?: (v: string) => void,
  sel?: [number, number],
) {
  const start = el.selectionStart;
  el.focus();
  let done = false;
  try {
    done =
      text === ""
        ? document.execCommand("delete", false)
        : document.execCommand("insertText", false, text);
  } catch {
    done = false;
  }
  if (!done || el.value.slice(start, start + text.length) !== text) {
    el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
    // React picks the new value up from the input event.
    if (onChange) onChange(el.value);
    else el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (sel) el.setSelectionRange(start + sel[0], start + sel[1]);
}

/** Paste: rich content becomes lists / links; a URL over selected text becomes a link. */
export function onNotePaste(e: ClipboardEvent<HTMLTextAreaElement>, onChange: (v: string) => void) {
  const el = e.currentTarget;
  const html = e.clipboardData.getData("text/html");
  const plain = e.clipboardData.getData("text/plain");
  const selected = el.value.slice(el.selectionStart, el.selectionEnd);

  const url = plain.trim();
  if (selected.trim() && !selected.includes("\n") && normalizeLink(url) && !/\s/.test(url)) {
    e.preventDefault();
    insert(el, `[${selected.trim()}](${normalizeLink(url)})`, onChange);
    return;
  }

  let text: string | null = null;
  // Plain text that already holds Markdown links (copied from a .md file or a
  // chat's raw text) is kept as is; otherwise rich HTML is converted, so a
  // linked word copied from a page keeps its address.
  const plainIsMarkdown = /\]\(\s*<?(https?:|mailto:|www\.)/i.test(plain);
  if (html && htmlHasStructure(html) && !plainIsMarkdown) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const md = htmlToMarkdown(doc.body);
    if (md.trim()) text = md;
  }
  if (text === null && /&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(plain)) text = decodeEntities(plain);
  if (text === null) return;
  e.preventDefault();
  insert(el, text.replace(/\r\n?/g, "\n"), onChange);
}

const INDENT = "   ";

/** Enter continues a list, Tab / Shift+Tab indent a list item. */
export function onNoteKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget;
  const { value, selectionStart: start, selectionEnd: end } = el;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = value.indexOf("\n", start);
  const line = value.slice(lineStart, lineEndIdx === -1 ? value.length : lineEndIdx);

  if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && start === end) {
    if (e.nativeEvent.isComposing) return;
    const next = continueList(value.slice(lineStart, start));
    if (!next) return;
    e.preventDefault();
    if ("exit" in next) {
      // Enter on an empty item: leave the list.
      el.setSelectionRange(lineStart, lineStart + line.length);
      insert(el, "");
    } else insert(el, next.insert);
    return;
  }

  if (e.key === "Tab" && start === end && /^\s*(\d+[.)]|[-*+•–])(\s|$)/.test(line)) {
    e.preventDefault();
    const offset = start - lineStart;
    if (e.shiftKey) {
      const remove = Math.min(INDENT.length, /^ */.exec(line)![0].length);
      if (!remove) return;
      el.setSelectionRange(lineStart, lineStart + remove);
      insert(el, "");
      const pos = lineStart + Math.max(0, offset - remove);
      el.setSelectionRange(pos, pos);
    } else {
      el.setSelectionRange(lineStart, lineStart);
      insert(el, INDENT);
      const pos = lineStart + offset + INDENT.length;
      el.setSelectionRange(pos, pos);
    }
  }
}

/** Adds `prefix` at the start of each selected line (or the current one). */
function prefixLines(el: HTMLTextAreaElement, make: (i: number) => string) {
  const { value, selectionStart, selectionEnd } = el;
  const from = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const endIdx = value.indexOf("\n", selectionEnd);
  const to = endIdx === -1 ? value.length : endIdx;
  const lines = value.slice(from, to).split("\n");
  const out = lines
    .map((l, i) => {
      const m = /^(\s*)(?:(?:\d+[.)]|[-*+•–])\s+)?(.*)$/.exec(l)!;
      return `${m[1]}${make(i)}${m[2]}`;
    })
    .join("\n");
  el.setSelectionRange(from, to);
  insert(el, out, undefined, [out.length, out.length]);
}

/** Small formatting bar shown above the note while it is edited. */
export function NoteToolbar({ textRef }: { textRef: RefObject<HTMLTextAreaElement | null> }) {
  const run = (fn: (el: HTMLTextAreaElement) => void) => () => {
    const el = textRef.current;
    if (el) fn(el);
  };
  const actions = [
    {
      label: "Liste à puces",
      icon: List,
      fn: run((el) => prefixLines(el, () => "- ")),
    },
    {
      label: "Liste numérotée",
      icon: ListOrdered,
      fn: run((el) => prefixLines(el, (i) => `${i + 1}. `)),
    },
    {
      label: "Gras",
      icon: Bold,
      fn: run((el) => {
        const sel = el.value.slice(el.selectionStart, el.selectionEnd) || "texte en gras";
        insert(el, `**${sel}**`, undefined, [2, 2 + sel.length]);
      }),
    },
    {
      label: "Lien",
      icon: Link2,
      fn: run((el) => {
        const sel = el.value.slice(el.selectionStart, el.selectionEnd).trim() || "texte du lien";
        const text = `[${sel}](https://)`;
        // The address placeholder is selected: paste the link right away.
        insert(el, text, undefined, [sel.length + 3, text.length - 1]);
      }),
    },
  ];
  return (
    <div
      className="-mx-2 mb-2 flex flex-wrap items-center gap-1 px-0 py-1 font-sans text-xs text-muted-foreground"
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map(({ label, icon: Icon, fn }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          // Keep the focus in the note: leaving it closes the editor.
          onMouseDown={(e) => e.preventDefault()}
          onClick={fn}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 hover:bg-muted hover:text-foreground"
        >
          <Icon className="size-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
      <span className="ml-auto hidden text-[11px] text-muted-foreground/80 md:inline">
        « - » puce · « 1. » numéro · Tab pour décaler
      </span>
    </div>
  );
}
