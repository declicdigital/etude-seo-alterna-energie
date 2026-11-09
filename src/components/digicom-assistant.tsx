import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
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

/** Coque blanche brillante, visière sombre et yeux lumineux : partagés par l'avatar et le grand robot. */
function RobotDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.6" stopColor="#eef2f7" />
        <stop offset="1" stopColor="#cbd5e1" />
      </linearGradient>
      <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#0f172a" />
        <stop offset="1" stopColor="#134e4a" />
      </linearGradient>
      <linearGradient id={`${id}-accent`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#34d399" />
        <stop offset="1" stopColor="#0ea5e9" />
      </linearGradient>
      <radialGradient id={`${id}-jet`} cx="0.5" cy="0.3" r="0.7">
        <stop offset="0" stopColor="#a7f3d0" stopOpacity="0.95" />
        <stop offset="0.45" stopColor="#2dd4bf" stopOpacity="0.55" />
        <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/** Tête du robot (avatar du chat). */
function RobotFace({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <RobotDefs id={id} />
      <line x1="24" y1="4.5" x2="24" y2="10" stroke="#94a3b8" strokeWidth="1.6" />
      <circle cx="24" cy="4.5" r="2.6" fill={`url(#${id}-accent)`} />
      <rect x="2.5" y="21" width="5" height="10" rx="2.5" fill={`url(#${id}-accent)`} />
      <rect x="40.5" y="21" width="5" height="10" rx="2.5" fill={`url(#${id}-accent)`} />
      <rect
        x="5.5"
        y="10"
        width="37"
        height="32"
        rx="14"
        fill={`url(#${id}-shell)`}
        stroke="#fff"
      />
      <rect x="10" y="15.5" width="28" height="20" rx="9.5" fill={`url(#${id}-visor)`} />
      <g className="dg-blink" filter={`url(#${id}-glow)`}>
        <rect x="16" y="20.5" width="4.4" height="6.5" rx="2.2" fill="#5eead4" />
        <rect x="27.6" y="20.5" width="4.4" height="6.5" rx="2.2" fill="#5eead4" />
      </g>
      <path
        d="M21 30.5q3 2.2 6 0"
        stroke="#5eead4"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Le petit robot flottant (bouton d'ouverture) : il plane, cligne des yeux, regarde la souris et fait coucou. */
function FloatingRobot({ eyesRef }: { eyesRef: Ref<SVGGElement> }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 140" aria-hidden="true" className="h-full w-full overflow-visible">
      <RobotDefs id={id} />
      {/* réacteur sous le robot */}
      <ellipse className="dg-jet" cx="60" cy="131" rx="15" ry="9" fill={`url(#${id}-jet)`} />
      {/* antenne */}
      <line
        x1="60"
        y1="13"
        x2="60"
        y2="28"
        stroke="#94a3b8"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        className="dg-antenna"
        cx="60"
        cy="11"
        r="6"
        fill={`url(#${id}-accent)`}
        filter={`url(#${id}-glow)`}
      />
      {/* bras gauche */}
      <g>
        <rect
          x="21"
          y="93"
          width="11"
          height="22"
          rx="5.5"
          fill={`url(#${id}-shell)`}
          stroke="#e2e8f0"
          transform="rotate(14 27 95)"
        />
        <circle cx="23" cy="117" r="5.5" fill={`url(#${id}-accent)`} />
      </g>
      {/* bras droit qui fait coucou */}
      <g className="dg-wave">
        <rect
          x="88"
          y="93"
          width="11"
          height="22"
          rx="5.5"
          fill={`url(#${id}-shell)`}
          stroke="#e2e8f0"
          transform="rotate(-14 93 95)"
        />
        <circle cx="97" cy="117" r="5.5" fill={`url(#${id}-accent)`} />
      </g>
      {/* corps */}
      <rect x="51" y="82" width="18" height="8" rx="3" fill="#cbd5e1" />
      <rect
        x="35"
        y="87"
        width="50"
        height="38"
        rx="19"
        fill={`url(#${id}-shell)`}
        stroke="#fff"
        strokeWidth="1.5"
      />
      <ellipse cx="50" cy="96" rx="9" ry="4" fill="#fff" opacity=".8" />
      <circle
        className="dg-core"
        cx="60"
        cy="106"
        r="6"
        fill={`url(#${id}-accent)`}
        filter={`url(#${id}-glow)`}
      />
      {/* oreilles */}
      <rect x="11" y="44" width="11" height="24" rx="5.5" fill={`url(#${id}-accent)`} />
      <rect x="98" y="44" width="11" height="24" rx="5.5" fill={`url(#${id}-accent)`} />
      {/* tête */}
      <rect
        x="18"
        y="26"
        width="84"
        height="60"
        rx="28"
        fill={`url(#${id}-shell)`}
        stroke="#fff"
        strokeWidth="1.5"
      />
      <path
        d="M34 34q14-6 34-3"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity=".9"
      />
      {/* visière */}
      <rect x="27" y="38" width="66" height="40" rx="19" fill={`url(#${id}-visor)`} />
      <path
        d="M35 44q12-4 26-3"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity=".18"
      />
      <g ref={eyesRef} style={{ transition: "transform .18s ease-out" }}>
        <g className="dg-blink" filter={`url(#${id}-glow)`}>
          <rect x="42" y="49" width="10" height="14" rx="5" fill="#5eead4" />
          <rect x="68" y="49" width="10" height="14" rx="5" fill="#5eead4" />
        </g>
        <path
          d="M53 68q7 5.5 14 0"
          stroke="#5eead4"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          filter={`url(#${id}-glow)`}
        />
        <ellipse cx="37" cy="66" rx="4.5" ry="2.4" fill="#f472b6" opacity=".55" />
        <ellipse cx="83" cy="66" rx="4.5" ry="2.4" fill="#f472b6" opacity=".55" />
      </g>
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
  const botRef = useRef<HTMLButtonElement>(null);
  const eyesRef = useRef<SVGGElement>(null);

  // Le robot suit le pointeur du regard.
  useEffect(() => {
    if (open) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bot = botRef.current;
        const eyes = eyesRef.current;
        if (!bot || !eyes) return;
        const r = bot.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.4);
        const len = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, len / 220);
        eyes.style.transform = `translate(${((dx / len) * 5 * k).toFixed(2)}px, ${((dy / len) * 3.5 * k).toFixed(2)}px)`;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [open]);

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
        @keyframes dg-hover { 0%,100% { transform: translateY(0) rotate(-1.5deg) } 50% { transform: translateY(-9px) rotate(1.5deg) } }
        @keyframes dg-shadow { 0%,100% { transform: scaleX(1); opacity: .45 } 50% { transform: scaleX(.72); opacity: .22 } }
        @keyframes dg-blink { 0%,93%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
        @keyframes dg-wave { 0%,62%,100% { transform: rotate(0) } 68% { transform: rotate(-150deg) } 73% { transform: rotate(-115deg) } 78% { transform: rotate(-150deg) } 83% { transform: rotate(-115deg) } 88% { transform: rotate(-150deg) } 94% { transform: rotate(0) } }
        @keyframes dg-jet { 0%,100% { opacity: .9; transform: scale(1) } 50% { opacity: .55; transform: scale(.82, .7) } }
        @keyframes dg-pulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
        @keyframes dg-pop { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes dg-bubble { from { opacity: 0; transform: translateX(10px) scale(.9) } to { opacity: 1; transform: none } }
        @keyframes dg-dot { 0%,80%,100% { opacity: .25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }
        .dg-blink { transform-box: fill-box; transform-origin: center; animation: dg-blink 4.5s infinite; }
        .dg-hover { animation: dg-hover 3.4s ease-in-out infinite; }
        .dg-shadow { animation: dg-shadow 3.4s ease-in-out infinite; }
        .dg-wave { transform-box: view-box; transform-origin: 93px 95px; animation: dg-wave 7s ease-in-out 1.2s infinite; }
        .dg-jet { transform-box: fill-box; transform-origin: center top; animation: dg-jet .7s ease-in-out infinite; }
        .dg-antenna, .dg-core { animation: dg-pulse 1.8s ease-in-out infinite; }
        .dg-bot:hover .dg-wave, .dg-bot:focus-visible .dg-wave { animation-duration: 2.2s; animation-delay: 0s; }
        .dg-pop { animation: dg-pop .28s cubic-bezier(.2,.8,.2,1); }
        .dg-bubble { animation: dg-bubble .35s cubic-bezier(.2,.8,.2,1) .6s both; }
        .dg-dot { animation: dg-dot 1.1s infinite; }
        @media (prefers-reduced-motion: reduce) { .dg-blink, .dg-hover, .dg-shadow, .dg-wave, .dg-jet, .dg-antenna, .dg-core, .dg-pop, .dg-bubble, .dg-dot { animation: none } }
      `}</style>

      {open && (
        <section
          role="dialog"
          aria-label="Assistant Digicom"
          className={cn(
            "dg-pop fixed z-[60] flex flex-col overflow-hidden rounded-[28px] text-slate-800 dark:text-slate-100",
            "inset-x-3 bottom-3 top-16 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:h-[600px] sm:max-h-[calc(100vh-3rem)] sm:w-[400px]",
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
        <div className="fixed bottom-3 right-3 z-[60] flex items-end gap-1 sm:bottom-5 sm:right-5 print:hidden">
          {hint && (
            <div className="dg-bubble relative -mr-2 mb-[52px] sm:mb-[62px]">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                  "relative rounded-[20px] rounded-br-md px-4 py-2.5 text-left text-[14px] font-semibold leading-snug text-slate-800 transition hover:-translate-y-0.5 dark:text-slate-100",
                  GLASS,
                )}
              >
                <span className="block whitespace-nowrap">As-tu besoin d'aide ?</span>
                <span
                  aria-hidden
                  className="absolute -right-[5px] bottom-3 size-3 rotate-45 rounded-[3px] border-r border-t border-white/60 bg-white/60 backdrop-blur-2xl dark:border-white/15 dark:bg-slate-900/50"
                />
              </button>
              <button
                type="button"
                aria-label="Masquer la bulle de l'assistant"
                title="Masquer la bulle"
                onClick={() => {
                  setHint(false);
                  try {
                    localStorage.setItem("dg-assistant-hint", "0");
                  } catch {
                    /* stockage indisponible */
                  }
                }}
                className={cn(
                  "absolute -left-2 -top-2 grid size-5 place-items-center rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-300",
                  GLASS,
                )}
              >
                <X className="size-3" />
              </button>
            </div>
          )}
          <button
            ref={botRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir l'assistant Digicom : as-tu besoin d'aide ?"
            title="As-tu besoin d'aide ?"
            className="dg-bot relative h-[104px] w-[90px] shrink-0 rounded-3xl outline-none transition-transform duration-200 hover:scale-[1.06] focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:h-[124px] sm:w-[108px]"
          >
            <span
              aria-hidden
              className="dg-shadow absolute bottom-0 left-1/2 -ml-[22px] h-2.5 w-11 rounded-[50%] bg-slate-900/30 blur-[3px] dark:bg-black/60"
            />
            <span className="dg-hover absolute inset-x-0 bottom-3 top-0 block drop-shadow-[0_10px_14px_rgba(15,40,35,0.28)]">
              <FloatingRobot eyesRef={eyesRef} />
            </span>
          </button>
        </div>
      )}
    </>
  );
}
