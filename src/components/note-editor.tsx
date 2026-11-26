import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Check, Link2, List, ListOrdered, Unlink, X } from "lucide-react";
import { decodeEntities, htmlToMarkdown, noteToHtml } from "@/lib/note-format";
import { normalizeLink } from "@/lib/organisation";
import { cn } from "@/lib/utils";

/** The editor's content back to the stored light Markdown. */
function toMarkdown(editor: Editor): string {
  if (editor.isEmpty) return "";
  const doc = new DOMParser().parseFromString(editor.getHTML(), "text/html");
  return htmlToMarkdown(doc.body);
}

/** Plain text that carries Markdown (links, lists, bold): shown formatted once pasted. */
const looksLikeMarkdown = (t: string) =>
  /\]\(\s*<?(https?:|mailto:|www\.)/i.test(t) ||
  /^\s*(\d+[.)]|[-*+•]) \S/m.test(t) ||
  /\*\*[^*\n]+\*\*/.test(t) ||
  /&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(t);

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  editorRef?: MutableRefObject<Editor | null>;
};

/**
 * Visual note editor: lists, links and bold are shown as such while typing,
 * never as Markdown signs. The note is still stored as light Markdown.
 */
export function NoteEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  autoFocus,
  editorRef,
}: Props) {
  const emitted = useRef(value);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        link: {
          openOnClick: true,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          protocols: ["mailto"],
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer", class: null },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: noteToHtml(value),
    editorProps: {
      attributes: { class: "note-rich outline-none", "aria-label": "Note" },
      handlePaste(view, event) {
        const data = event.clipboardData;
        if (!data) return false;
        const html = data.getData("text/html");
        const plain = data.getData("text/plain");
        // Raw Markdown (copied from a chat's text, a .md file…) is shown formatted.
        const rawMarkdown = /\]\(\s*<?(https?:|mailto:|www\.)/i.test(plain);
        if ((html && !rawMarkdown) || !plain || !looksLikeMarkdown(plain)) return false;
        const ed = editorRef?.current ?? current.current;
        if (!ed) return false;
        event.preventDefault();
        ed.commands.insertContent(noteToHtml(decodeEntities(plain).replace(/\r\n?/g, "\n")));
        return true;
      },
    },
    onUpdate({ editor }) {
      const md = toMarkdown(editor);
      if (md === emitted.current) return;
      emitted.current = md;
      onChangeRef.current(md);
    },
    onBlur() {
      onBlurRef.current?.();
    },
  });

  const current = useRef<Editor | null>(null);
  useEffect(() => {
    current.current = editor;
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  // Someone else changed the note: show their version.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(noteToHtml(value), { emitUpdate: false });
  }, [value, editor]);

  return (
    <div className={className}>
      {editor && <NoteToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function NoteToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      bold: e.isActive("bold"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      focused: e.isFocused,
    }),
  });
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linking) input.current?.focus();
  }, [linking]);

  function openLink() {
    setUrl(state.href);
    setLinking(true);
  }

  function applyLink() {
    const href = normalizeLink(url) ?? (/^mailto:\S+@\S+$/i.test(url.trim()) ? url.trim() : null);
    setLinking(false);
    if (!href) {
      editor.commands.focus();
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link"))
      chain
        .insertContent({
          type: "text",
          text: url.trim(),
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    else chain.setLink({ href }).run();
  }

  const btn = (on: boolean) =>
    cn(
      "inline-flex h-7 items-center gap-1 rounded-md px-2 transition-colors",
      on ? "bg-foreground/10 text-foreground" : "hover:bg-muted hover:text-foreground",
    );
  // Keep the focus (and the selection) in the note.
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      className="-mx-2 mb-2 flex min-h-9 flex-wrap items-center gap-1 px-0 py-1 font-sans text-xs text-muted-foreground"
      role="toolbar"
      aria-label="Mise en forme"
    >
      {linking ? (
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <Link2 className="ml-2 size-3.5 shrink-0" />
          <input
            ref={input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setLinking(false);
                editor.commands.focus();
              }
            }}
            placeholder="Colle l'adresse du lien puis Entrée"
            aria-label="Adresse du lien"
            className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-amber-700/50"
          />
          <button type="submit" className={btn(false)} aria-label="Valider le lien">
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            className={btn(false)}
            aria-label="Annuler"
            onClick={() => {
              setLinking(false);
              editor.commands.focus();
            }}
          >
            <X className="size-3.5" />
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            title="Liste à puces"
            aria-pressed={state.bullet}
            onMouseDown={keep}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={btn(state.bullet)}
          >
            <List className="size-3.5" />
            <span className="hidden sm:inline">Puces</span>
          </button>
          <button
            type="button"
            title="Liste numérotée"
            aria-pressed={state.ordered}
            onMouseDown={keep}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={btn(state.ordered)}
          >
            <ListOrdered className="size-3.5" />
            <span className="hidden sm:inline">Numéros</span>
          </button>
          <button
            type="button"
            title="Gras"
            aria-pressed={state.bold}
            onMouseDown={keep}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={btn(state.bold)}
          >
            <Bold className="size-3.5" />
            <span className="hidden sm:inline">Gras</span>
          </button>
          <button
            type="button"
            title={state.link ? "Modifier le lien" : "Ajouter un lien"}
            aria-pressed={state.link}
            onMouseDown={keep}
            onClick={openLink}
            className={btn(state.link)}
          >
            <Link2 className="size-3.5" />
            <span className="hidden sm:inline">Lien</span>
          </button>
          {state.link && (
            <button
              type="button"
              title="Retirer le lien"
              onMouseDown={keep}
              onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
              className={btn(false)}
            >
              <Unlink className="size-3.5" />
            </button>
          )}
          <span className="ml-auto hidden text-[11px] text-muted-foreground/70 md:inline">
            Tab : sous-liste · coller une adresse sur un mot : lien
          </span>
        </>
      )}
    </div>
  );
}
