import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ArrowUp, Inbox, Minus, X } from "lucide-react";
import { askAssistant, countOpenQuestions, logAssistantExchange } from "@/lib/assistant.functions";
import { localAnswerResult, zonesFor } from "@/lib/assistant-knowledge";
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

/**
 * Tête de verre : coque translucide (on voit la page floutée à travers), écran fumé,
 * yeux lumineux et petits capteurs latéraux. Dessinée à 92×62 px puis mise à l'échelle.
 */
function GlassHead({ eyesRef }: { eyesRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="dg-glass absolute left-0 top-0 h-[62px] w-[92px] rounded-[26px]">
      <span aria-hidden className="dg-sheen" />
      <span aria-hidden className="dg-ear left-[-5px]" />
      <span aria-hidden className="dg-ear right-[-5px]" />
      <div className="dg-screen absolute inset-[8px] rounded-[18px]">
        <div ref={eyesRef} className="dg-face absolute inset-0">
          <span className="dg-eye left-[22px]" />
          <span className="dg-eye right-[22px]" />
          <span className="dg-mouth" />
        </div>
      </div>
    </div>
  );
}

/** Avatar du chat : la même tête de verre en miniature (size en px). */
function RobotFace({ size, className }: { size: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute left-1/2 top-1/2 block h-[62px] w-[92px]"
        style={{ transform: `translate(-50%, -50%) scale(${(size / 96).toFixed(3)})` }}
      >
        <GlassHead />
      </span>
    </span>
  );
}

/**
 * Le robot flottant : tête et corps de verre détachés, cœur d'énergie qui tourne,
 * anneau orbital, mains flottantes (la droite fait coucou), regard qui suit le pointeur.
 */
function FloatingRobot({ eyesRef }: { eyesRef: Ref<HTMLDivElement> }) {
  return (
    <span className="absolute left-1/2 top-0 block h-[132px] w-[108px] origin-top [transform:translateX(-50%)_scale(var(--dg-s,1))]">
      <span aria-hidden className="dg-aura" />
      <span aria-hidden className="dg-spark" />
      <span className="absolute left-[8px] top-[16px] block h-[62px] w-[92px]">
        <GlassHead eyesRef={eyesRef} />
      </span>
      {/* corps : anneau arrière, sphère de verre, cœur, anneau avant */}
      <span aria-hidden className="dg-ring dg-ring-back" />
      <span aria-hidden className="dg-glass dg-body">
        <span className="dg-sheen" />
        <span className="dg-core" />
      </span>
      <span aria-hidden className="dg-ring dg-ring-front" />
      {/* cravate orange */}
      <span aria-hidden className="dg-tie">
        <span className="dg-tie-knot" />
        <span className="dg-tie-blade" />
      </span>
      <span aria-hidden className="dg-glass dg-hand dg-hand-l" />
      <span aria-hidden className="dg-glass dg-hand dg-hand-r" />
    </span>
  );
}

const ROBOT_CSS = `
  .dg-glass {
    background: linear-gradient(140deg, rgba(255,255,255,.62) 0%, rgba(255,255,255,.16) 46%, rgba(167,243,208,.14) 100%);
    border: 1px solid rgba(255,255,255,.75);
    -webkit-backdrop-filter: blur(9px) saturate(1.7);
    backdrop-filter: blur(9px) saturate(1.7);
    box-shadow: inset 0 1.5px 1px rgba(255,255,255,.95), inset 0 -10px 18px rgba(20,184,166,.16),
      inset 0 0 0 1px rgba(255,255,255,.12), 0 14px 28px -12px rgba(15,40,35,.38);
  }
  .dark .dg-glass { background: linear-gradient(140deg, rgba(255,255,255,.28), rgba(255,255,255,.06) 50%, rgba(45,212,191,.1)); border-color: rgba(255,255,255,.3); }
  .dg-sheen { position:absolute; left:12%; top:7%; width:46%; height:22%; border-radius:999px; pointer-events:none;
    background: linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,0)); filter: blur(.4px); }
  .dg-screen { background: linear-gradient(165deg, rgba(10,18,36,.84), rgba(17,72,70,.74)); overflow:hidden;
    box-shadow: inset 0 2px 6px rgba(0,0,0,.45), inset 0 -1px 0 rgba(94,234,212,.25), 0 0 0 1px rgba(255,255,255,.25); }
  .dg-screen::after { content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
    background: linear-gradient(115deg, rgba(255,255,255,.16) 0 28%, transparent 28.5%); }
  .dg-face { transition: transform .2s ease-out; }
  .dg-eye { position:absolute; top:11px; width:9px; height:15px; border-radius:6px; background:#7ef7e4;
    box-shadow: 0 0 6px #2dd4bf, 0 0 14px rgba(45,212,191,.75); animation: dg-blink 4.6s infinite;
    transition: height .2s, top .2s, border-radius .2s; }
  .dg-mouth { position:absolute; left:50%; bottom:8px; width:12px; height:5px; margin-left:-6px; border-radius:0 0 8px 8px;
    border:2px solid #7ef7e4; border-top:0; box-shadow: 0 3px 8px -2px rgba(45,212,191,.8); transition: width .2s, margin .2s; }
  .dg-bot:hover .dg-eye, .dg-bot:focus-visible .dg-eye { height:7px; top:15px; border-radius:8px 8px 2px 2px; animation:none; }
  .dg-bot:hover .dg-mouth, .dg-bot:focus-visible .dg-mouth { width:16px; margin-left:-8px; }
  .dg-ear { position:absolute; top:20px; width:6px; height:22px; border-radius:4px;
    background: linear-gradient(180deg, #5eead4, #38bdf8); box-shadow: 0 0 10px rgba(56,189,248,.7); }
  .dg-aura { position:absolute; left:50%; top:52%; width:96px; height:96px; margin:-48px 0 0 -48px; border-radius:50%;
    background: radial-gradient(circle, rgba(45,212,191,.42), rgba(56,189,248,.22) 45%, transparent 70%); filter: blur(10px);
    animation: dg-pulse 3.4s ease-in-out infinite; }
  .dg-spark { position:absolute; left:50%; top:0; width:9px; height:9px; margin-left:-4.5px; border-radius:50%;
    background: radial-gradient(circle at 35% 35%, #fff, #5eead4 45%, #0ea5e9);
    box-shadow: 0 0 10px #2dd4bf, 0 0 20px rgba(14,165,233,.6); animation: dg-spark 2.6s ease-in-out infinite; }
  .dg-body { position:absolute; left:50%; top:84px; width:44px; height:44px; margin-left:-22px; border-radius:50%; overflow:hidden; }
  .dg-core { position:absolute; left:50%; top:50%; width:20px; height:20px; margin:-10px 0 0 -10px; border-radius:50%;
    background: conic-gradient(from 0deg, #34d399, #38bdf8, #a78bfa, #34d399); filter: blur(1.5px);
    box-shadow: 0 0 14px rgba(45,212,191,.9); animation: dg-spin 3s linear infinite; }
  .dg-ring { position:absolute; left:50%; top:100px; width:76px; height:16px; margin-left:-38px; border-radius:50%;
    border:2px solid rgba(94,234,212,.75); filter: drop-shadow(0 0 4px rgba(45,212,191,.7)); }
  .dg-ring-back { clip-path: inset(0 0 50% 0); opacity:.55; }
  .dg-ring-front { clip-path: inset(50% 0 0 0); }
  .dg-tie { position:absolute; left:50%; top:78px; width:18px; height:38px; margin-left:-9px; z-index:2;
    filter: drop-shadow(0 2px 3px rgba(154,52,18,.35)); }
  .dg-tie-knot { position:absolute; left:3.5px; top:0; width:11px; height:9px; border-radius:3px 3px 4px 4px;
    background: repeating-linear-gradient(0deg, rgba(124,45,18,.35) 0 2px, transparent 2px 4px), repeating-linear-gradient(90deg, rgba(124,45,18,.35) 0 2px, transparent 2px 4px), linear-gradient(180deg, #fdba74, #f97316); box-shadow: inset 0 1px 0 rgba(255,255,255,.6); }
  .dg-tie-blade { position:absolute; left:1px; top:8px; width:16px; height:29px;
    background: linear-gradient(160deg, #fb923c 0%, #f97316 45%, #ea580c 100%);
    clip-path: polygon(30% 0, 70% 0, 100% 72%, 50% 100%, 0 72%);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .dg-tie-blade::after { content:""; position:absolute; inset:0;
    background:
      repeating-linear-gradient(0deg, rgba(124,45,18,.38) 0 2px, transparent 2px 4px, rgba(255,255,255,.28) 4px 5px, transparent 5px 8px),
      repeating-linear-gradient(90deg, rgba(124,45,18,.38) 0 2px, transparent 2px 4px, rgba(255,255,255,.28) 4px 5px, transparent 5px 8px); }
  .dg-hand { position:absolute; top:96px; width:15px; height:15px; border-radius:50%; }
  .dg-hand-l { left:4px; animation: dg-hand 3.4s ease-in-out .4s infinite; }
  .dg-hand-r { right:4px; animation: dg-wave 7s ease-in-out 1.2s infinite; }
  .dg-bot:hover .dg-hand-r { animation-duration: 2.2s; animation-delay: 0s; }

  @keyframes dg-hover { 0%,100% { transform: translateY(0) rotate(-1.5deg) } 50% { transform: translateY(-9px) rotate(1.5deg) } }
  @keyframes dg-shadow { 0%,100% { transform: scaleX(1); opacity: .45 } 50% { transform: scaleX(.7); opacity: .2 } }
  @keyframes dg-blink { 0%,93%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
  @keyframes dg-wave { 0%,62%,100% { transform: translate(0,0) } 67% { transform: translate(6px,-44px) } 71% { transform: translate(12px,-40px) }
    75% { transform: translate(4px,-46px) } 79% { transform: translate(12px,-40px) } 83% { transform: translate(4px,-46px) } 92% { transform: translate(0,0) } }
  @keyframes dg-hand { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
  @keyframes dg-spark { 0%,100% { transform: translateY(0); opacity: 1 } 50% { transform: translateY(-4px); opacity: .6 } }
  @keyframes dg-spin { to { transform: rotate(360deg) } }
  @keyframes dg-pulse { 0%,100% { opacity: 1 } 50% { opacity: .6 } }
  @keyframes dg-pop { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
  @keyframes dg-bubble { from { opacity: 0; transform: translateY(8px) scale(.9) } to { opacity: 1; transform: none } }
  @keyframes dg-dot { 0%,80%,100% { opacity: .25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }
  .dg-hover { animation: dg-hover 3.4s ease-in-out infinite; }
  .dg-shadow { animation: dg-shadow 3.4s ease-in-out infinite; }
  .dg-pop { animation: dg-pop .28s cubic-bezier(.2,.8,.2,1); }
  .dg-bubble { transform-origin: 80% 100%; animation: dg-bubble .35s cubic-bezier(.2,.8,.2,1) .6s both; }
  .dg-dot { animation: dg-dot 1.1s infinite; }
  @media (prefers-reduced-motion: reduce) {
    .dg-eye, .dg-hover, .dg-shadow, .dg-hand, .dg-spark, .dg-core, .dg-aura, .dg-pop, .dg-bubble, .dg-dot { animation: none }
  }
`;

/** Texte de réponse : gras **…**, listes et liens [libellé](/chemin) transformés en boutons de navigation. */
export function MessageText({ text, onGo }: { text: string; onGo: (path: string) => void }) {
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
    <div className="space-y-3">
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
  canSeeDigipote = false,
}: {
  name?: string | null;
  allowed: string[] | null;
  isAdmin: boolean;
  page?: string;
  onNavigate: (path: string) => void;
  /** Geoffrey : bouton vers « Digipote » et pastille des questions sans réponse. */
  canSeeDigipote?: boolean;
}) {
  const ask = useServerFn(askAssistant);
  const logExchange = useServerFn(logAssistantExchange);
  const countOpen = useServerFn(countOpenQuestions);
  const first = (name || "").trim().split(/\s+/)[0] || "";
  const zones = useMemo(() => zonesFor(allowed, isAdmin), [allowed, isAdmin]);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(true);
  const [openCount, setOpenCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const botRef = useRef<HTMLButtonElement>(null);
  const eyesRef = useRef<HTMLDivElement>(null);

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

  // Geoffrey : nombre de questions sans réponse à traiter dans « Digipote ».
  async function refreshCount() {
    if (!canSeeDigipote) return;
    try {
      setOpenCount(await countOpen());
    } catch {
      /* compteur indisponible */
    }
  }
  useEffect(() => {
    void refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeDigipote, open]);

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
          content: `Bonjour${first ? ` ${first}` : ""} 👋 Bip-boup ! Ici D.I.G.I.P.O.T.E, ton robot assistant Digicom. Systèmes en ligne ✅\n\nPose-moi ta question sur l'outil : créer un article, ajouter des images, les deadlines, les accès… Je peux aussi te téléporter directement au bon endroit 🤖`,
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
    let unanswered = false;
    try {
      const res = await ask({
        data: {
          messages: history.filter((m, i) => !(i === 0 && m.role === "assistant")).slice(-12),
          page,
          name: first || undefined,
        },
      });
      if (res.ok) {
        reply = res.reply;
        unanswered = res.unanswered;
      }
    } catch {
      /* réponse de secours ci-dessous */
    }
    if (!reply) {
      // le message d'accueil a déjà dit « Bonjour »
      const local = localAnswerResult(q, zones, first || null, { greet: false });
      reply = local.text;
      unanswered = !local.answered;
      void logExchange({
        data: { question: q.slice(0, 2000), reply: reply.slice(0, 4000), page, unanswered },
      }).catch(() => undefined);
    }
    setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    setBusy(false);
    if (unanswered) void refreshCount();
  }

  function go(path: string) {
    onNavigate(path);
    if (window.matchMedia("(max-width: 640px)").matches) setOpen(false);
  }

  const showSuggestions = msgs.length <= 1 && !busy;

  return (
    <>
      <style>{ROBOT_CSS}</style>

      {open && (
        <section
          role="dialog"
          aria-label="D.I.G.I.P.O.T.E, assistant Digicom"
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
            <RobotFace size={42} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold leading-tight tracking-[0.08em]">
                D.I.G.I.P.O.T.E
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.2)]" />
                Ton assistant Digicom
              </div>
            </div>
            {canSeeDigipote && (
              <button
                type="button"
                onClick={() => go("/digipote")}
                aria-label="Ouvrir Digipote : toutes les questions posées"
                title="Digipote : toutes les questions posées"
                className="relative rounded-full p-2 text-slate-600 transition hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <Inbox className="size-4" />
                {openCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {openCount > 99 ? "99+" : openCount}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Réduire D.I.G.I.P.O.T.E"
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
                  <RobotFace size={30} />
                  <div className="max-w-[85%] rounded-[20px] rounded-bl-md border border-white/70 bg-white/70 px-4 py-3 text-[14px] leading-[1.7] shadow-sm dark:border-white/10 dark:bg-white/10">
                    <MessageText text={m.content} onGo={go} />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-3 text-[14px] leading-[1.7] text-white shadow-[0_6px_18px_-6px_rgba(5,150,105,.6)]">
                    {m.content}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-end gap-2" aria-label="D.I.G.I.P.O.T.E écrit">
                <RobotFace size={30} />
                <div className="flex items-center gap-2 rounded-[20px] rounded-bl-md border border-white/70 bg-white/70 px-3.5 py-2.5 text-[13px] italic text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                  <span>Bip… calcul en cours</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="dg-dot size-1.5 rounded-full bg-emerald-600"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </span>
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
        <div className="fixed bottom-3 right-3 z-[60] flex flex-col items-end gap-3.5 sm:bottom-5 sm:right-5 print:hidden">
          {hint && (
            <div className="dg-bubble relative">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="relative rounded-[20px] border border-slate-200 bg-white px-4 py-2.5 text-left text-[14px] font-semibold leading-snug text-slate-800 shadow-[0_14px_32px_-12px_rgba(15,40,35,0.35)] transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                  D.I.G.I.P.O.T.E
                </span>
                <span className="block whitespace-nowrap">As-tu besoin d'aide ?</span>
                <span
                  aria-hidden
                  className="absolute -bottom-[7px] right-[44px] size-3.5 rotate-45 rounded-[3px] border-b border-r border-slate-200 bg-white sm:right-[48px] dark:border-slate-700 dark:bg-slate-900"
                />
              </button>
              <button
                type="button"
                aria-label="Masquer la bulle de D.I.G.I.P.O.T.E"
                title="Masquer la bulle"
                onClick={() => {
                  setHint(false);
                  try {
                    localStorage.setItem("dg-assistant-hint", "0");
                  } catch {
                    /* stockage indisponible */
                  }
                }}
                className="absolute -left-2 -top-2 grid size-5 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
          <button
            ref={botRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir D.I.G.I.P.O.T.E : as-tu besoin d'aide ?"
            title="D.I.G.I.P.O.T.E · As-tu besoin d'aide ?"
            className="dg-bot relative h-[124px] w-[94px] shrink-0 rounded-3xl outline-none transition-transform duration-200 [--dg-s:0.86] hover:scale-[1.05] focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:h-[146px] sm:w-[110px] sm:[--dg-s:1]"
          >
            <span
              aria-hidden
              className="dg-shadow absolute bottom-0 left-1/2 -ml-[22px] h-2.5 w-11 rounded-[50%] bg-slate-900/30 blur-[3px] dark:bg-black/60"
            />
            <span className="dg-hover absolute inset-0 block">
              <FloatingRobot eyesRef={eyesRef} />
            </span>
            {canSeeDigipote && openCount > 0 && (
              <span
                title={`${openCount} question${openCount > 1 ? "s" : ""} sans réponse`}
                className="absolute right-0 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-md ring-2 ring-white"
              >
                {openCount > 99 ? "99+" : openCount}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
}
