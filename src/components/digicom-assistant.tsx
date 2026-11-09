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
import { ArrowRight, ArrowUp, Gamepad2, Inbox, Minus, X } from "lucide-react";
import { askAssistant, countOpenQuestions, logAssistantExchange } from "@/lib/assistant.functions";
import { localAnswerResult, zonesFor } from "@/lib/assistant-knowledge";
import { cn } from "@/lib/utils";
import { FloatingRobot, ROBOT_CSS, RobotFace } from "@/components/digipote-robot";
import { DigipoteGame } from "@/components/digipote-game";

type Msg = { role: "user" | "assistant"; content: string };

/** Suggestions et exemples d'accueil limités aux rubriques ouvertes à la personne. */
function suggestionsFor(ids: Set<string>): string[] {
  const out: string[] = [];
  if (ids.has("blog-suivi") || ids.has("pac-suivi") || ids.has("planete-suivi"))
    out.push("Comment créer un nouvel article ?");
  if (ids.has("blog-suivi") || ids.has("pac-suivi"))
    out.push("Où ajouter les images ?", "Comment marchent les deadlines ?");
  if (ids.has("faq-demandes")) out.push("Comment demander une FAQ ?");
  if (ids.has("benchmark")) out.push("Comment lire le Benchmark ?");
  if ([...ids].some((id) => id.startsWith("nl-"))) out.push("Quand part la prochaine newsletter ?");
  if (ids.has("organisation")) out.push("Comment ajouter une fiche ?");
  out.push("Je ne vois pas une rubrique");
  return out.slice(0, 4);
}
function greetingTopics(ids: Set<string>): string {
  const t: string[] = [];
  if (ids.has("blog-suivi") || ids.has("pac-suivi") || ids.has("planete-suivi"))
    t.push("créer un article", "les deadlines");
  if (ids.has("blog-suivi") || ids.has("pac-suivi")) t.push("ajouter des images");
  if ([...ids].some((id) => id.startsWith("faq-"))) t.push("la FAQ");
  if (ids.has("benchmark")) t.push("le benchmark");
  if ([...ids].some((id) => id.startsWith("nl-"))) t.push("les newsletters");
  if (ids.has("organisation")) t.push("tes tâches");
  t.push("les accès");
  return t.join(", ");
}

/** Verre « liquide » : flou, saturation, reflet intérieur et liseré clair. */
const GLASS =
  "border border-white/60 bg-white/40 shadow-[0_18px_50px_-12px_rgba(15,40,35,0.35),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/15 dark:bg-slate-900/45 dark:shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]";

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
  const zoneIds = useMemo(() => new Set(zones.map((z) => z.id)), [zones]);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(true);
  const [openCount, setOpenCount] = useState(0);
  const [game, setGame] = useState(false);
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
        // Inclinaison 3D du robot vers le pointeur (plus douce de loin).
        const far = Math.min(1, len / 600);
        bot.style.setProperty("--dg-x", ((dx / len) * far).toFixed(3));
        bot.style.setProperty("--dg-y", ((dy / len) * far).toFixed(3));
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
          content: `Bonjour${first ? ` ${first}` : ""} 👋 Bip-boup ! Ici D.I.G.I.P.O.T.E, ton robot assistant Digicom. Systèmes en ligne ✅\n\nPose-moi ta question sur l'outil : ${greetingTopics(zoneIds)}… Je peux aussi te téléporter directement au bon endroit 🤖`,
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
      {game && <DigipoteGame onClose={() => setGame(false)} />}

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
            <button
              type="button"
              onClick={() => setGame(true)}
              aria-label="Jouer avec D.I.G.I.P.O.T.E"
              title="Mini-jeu : Bug Buster"
              className="rounded-full p-2 text-slate-600 transition hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <Gamepad2 className="size-4" />
            </button>
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
                {suggestionsFor(zoneIds).map((s) => (
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
                  className="absolute -bottom-[7px] right-[43px] size-3.5 rotate-45 rounded-[3px] border-b border-r border-slate-200 bg-white sm:right-[53px] dark:border-slate-700 dark:bg-slate-900"
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
            className="dg-bot relative h-[132px] w-[100px] shrink-0 rounded-3xl outline-none transition-transform duration-200 [--dg-s:0.84] hover:scale-[1.05] focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:h-[156px] sm:w-[120px] sm:[--dg-s:1]"
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
