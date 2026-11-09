import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ArrowUp, Minus, X } from "lucide-react";
import { askAssistant } from "@/lib/assistant.functions";
import { localAnswer, zonesFor } from "@/lib/assistant-knowledge";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Comment créer un nouvel article ?",
  "Où ajouter les images ?",
  "Comment marchent les deadlines ?",
  "Je ne vois pas une rubrique",
];

/** Verre « liquide » : flou, saturation, reflet intérieur et liseré clair. */
const GLASS =
  "border border-white/60 bg-white/40 shadow-[0_18px_50px_-12px_rgba(15,40,35,0.35),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/15 dark:bg-slate-900/45 dark:shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]";

function RobotFace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="dg-bot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="0.55" stopColor="#10b981" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#dg-bot)" />
      <ellipse cx="17" cy="12" rx="9" ry="4.5" fill="#fff" opacity=".35" />
      <line x1="24" y1="7" x2="24" y2="12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="6" r="2.2" fill="#fff" />
      <rect x="11" y="13" width="26" height="21" rx="9" fill="#fff" opacity=".95" />
      <g className="dg-eyes">
        <rect x="16.5" y="20" width="4.5" height="6" rx="2.25" fill="#064e3b" />
        <rect x="27" y="20" width="4.5" height="6" rx="2.25" fill="#064e3b" />
      </g>
      <path
        d="M20 29.5c2.4 1.8 5.6 1.8 8 0"
        stroke="#064e3b"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Texte de réponse : gras **…**, listes et liens [libellé](/chemin) transformés en boutons de navigation. */
function MessageText({ text, onGo }: { text: string; onGo: (path: string) => void }) {
  const inline = (line: string, key: string): ReactNode[] => {
    const out: ReactNode[] = [];
    const re = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) out.push(line.slice(last, m.index));
      if (m[1]) {
        const path = m[2];
        out.push(
          <button
            key={`${key}-${i++}`}
            type="button"
            onClick={() => onGo(path)}
            className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-600/25 bg-emerald-50/80 px-2.5 py-0.5 align-baseline text-[13px] font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-200"
          >
            <span className="truncate">{m[1]}</span>
            <ArrowRight className="size-3 shrink-0" />
          </button>,
        );
      } else {
        out.push(<strong key={`${key}-${i++}`}>{m[3]}</strong>);
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  };
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, n) => {
        const t = line.trim();
        if (!t) return null;
        const item = /^(\d+[.)]|[-•→])\s+(.*)$/.exec(t);
        return item ? (
          <div key={n} className="flex gap-2">
            <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-300">
              {/^\d/.test(item[1]) ? item[1] : "•"}
            </span>
            <span>{inline(item[2], `l${n}`)}</span>
          </div>
        ) : (
          <p key={n}>{inline(t, `l${n}`)}</p>
        );
      })}
    </div>
  );
}

export function DigicomAssistant({
  name,
  allowed,
  isAdmin,
  page,
  onNavigate,
}: {
  name?: string | null;
  allowed: string[] | null;
  isAdmin: boolean;
  page?: string;
  onNavigate: (path: string) => void;
}) {
  const ask = useServerFn(askAssistant);
  const first = (name || "").trim().split(/\s+/)[0] || "";
  const zones = useMemo(() => zonesFor(allowed, isAdmin), [allowed, isAdmin]);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("dg-assistant-hint") === "0") setHint(false);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!msgs.length) {
      setMsgs([
        {
          role: "assistant",
          content: `Bonjour${first ? ` ${first}` : ""} 👋 Je suis l'assistant Digicom. Pose-moi ta question sur l'outil : créer un article, ajouter des images, les deadlines, les accès… Je peux aussi t'emmener directement au bon endroit.`,
        },
      ]);
    }
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(history);
    setInput("");
    setBusy(true);
    let reply = "";
    try {
      const res = await ask({
        data: {
          messages: history.filter((m, i) => !(i === 0 && m.role === "assistant")).slice(-12),
          page,
          name: first || undefined,
        },
      });
      if (res.ok) reply = res.reply;
    } catch {
      /* réponse de secours ci-dessous */
    }
    if (!reply) reply = localAnswer(q, zones, first || null);
    setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    setBusy(false);
  }

  function go(path: string) {
    onNavigate(path);
    if (window.matchMedia("(max-width: 640px)").matches) setOpen(false);
  }

  const showSuggestions = msgs.length <= 1 && !busy;

  return (
    <>
      <style>{`
        @keyframes dg-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes dg-blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(.1) } }
        @keyframes dg-pop { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes dg-dot { 0%,80%,100% { opacity: .25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }
        .dg-eyes { transform-origin: 24px 23px; animation: dg-blink 4.5s infinite; }
        .dg-float { animation: dg-float 3.6s ease-in-out 3; }
        .dg-pop { animation: dg-pop .28s cubic-bezier(.2,.8,.2,1); }
        .dg-dot { animation: dg-dot 1.1s infinite; }
        @media (prefers-reduced-motion: reduce) { .dg-eyes, .dg-float, .dg-pop, .dg-dot { animation: none } }
      `}</style>

      {open && (
        <section
          role="dialog"
          aria-label="Assistant Digicom"
          className={cn(
            "dg-pop fixed z-[60] flex flex-col overflow-hidden rounded-[28px] text-slate-800 dark:text-slate-100",
            "inset-x-3 bottom-3 top-16 sm:inset-x-auto sm:bottom-24 sm:right-6 sm:top-auto sm:h-[600px] sm:max-h-[calc(100vh-8rem)] sm:w-[400px]",
            GLASS,
          )}
        >
          {/* reflets du verre */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full bg-emerald-300/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -right-16 size-72 rounded-full bg-sky-300/25 blur-3xl"
          />

          <header className="relative flex items-center gap-3 border-b border-white/50 px-4 py-3 dark:border-white/10">
            <RobotFace className="size-10 drop-shadow-md" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold leading-tight">Assistant Digicom</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.2)]" />
                Répond à tes questions sur l'outil
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Réduire l'assistant"
              className="rounded-full p-2 text-slate-600 transition hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <Minus className="size-4" />
            </button>
          </header>

          <div
            ref={listRef}
            className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {msgs.map((m, i) =>
              m.role === "assistant" ? (
                <div key={i} className="flex items-end gap-2">
                  <RobotFace className="size-7 shrink-0" />
                  <div className="max-w-[85%] rounded-[20px] rounded-bl-md border border-white/70 bg-white/70 px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm dark:border-white/10 dark:bg-white/10">
                    <MessageText text={m.content} onGo={go} />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-gradient-to-br from-emerald-500 to-teal-600 px-3.5 py-2.5 text-[14px] leading-relaxed text-white shadow-[0_6px_18px_-6px_rgba(5,150,105,.6)]">
                    {m.content}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-end gap-2" aria-label="L'assistant écrit">
                <RobotFace className="size-7 shrink-0" />
                <div className="flex gap-1 rounded-[20px] rounded-bl-md border border-white/70 bg-white/70 px-4 py-3.5 dark:border-white/10 dark:bg-white/10">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="dg-dot size-1.5 rounded-full bg-emerald-600"
                      style={{ animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            {showSuggestions && (
              <div className="flex flex-wrap gap-2 pl-9">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80 dark:border-white/15 dark:bg-white/10 dark:text-slate-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="relative flex items-end gap-2 border-t border-white/50 p-3 dark:border-white/10"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Écris ta question…"
              aria-label="Ta question"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-white/70 bg-white/60 px-3.5 py-2.5 text-[14px] text-slate-800 shadow-inner outline-none placeholder:text-slate-500 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              aria-label="Envoyer"
              className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_8px_20px_-8px_rgba(5,150,105,.8)] transition hover:brightness-110 disabled:opacity-40"
            >
              <ArrowUp className="size-5" />
            </button>
          </form>
        </section>
      )}

      {!open && (
        <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-1 sm:bottom-6 sm:right-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir l'assistant : as-tu besoin d'aide ?"
            className={cn(
              "dg-float group flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 text-[14px] font-semibold text-slate-800 transition hover:-translate-y-0.5 dark:text-slate-100",
              hint ? "pr-4" : "pr-1.5",
              GLASS,
            )}
          >
            <RobotFace className="size-10 drop-shadow-md transition group-hover:scale-105" />
            {hint && <span className="whitespace-nowrap">As-tu besoin d'aide ?</span>}
          </button>
          {hint && (
            <button
              type="button"
              aria-label="Masquer le texte de l'assistant"
              title="Masquer le texte"
              onClick={() => {
                setHint(false);
                try {
                  localStorage.setItem("dg-assistant-hint", "0");
                } catch {
                  /* stockage indisponible */
                }
              }}
              className={cn(
                "grid size-6 place-items-center rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-300",
                GLASS,
              )}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
