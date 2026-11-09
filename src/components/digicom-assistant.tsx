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
 * D.I.G.I.P.O.T.E, dessiné comme un vrai petit robot : coque en plastique blanc mat éclairée
 * (filtre d'éclairage SVG), visière en verre noir à yeux LED, oreilles et cou en métal brossé,
 * bras articulés, réacteur de lévitation, cravate orange à carreaux.
 * `variant="head"` ne montre que la tête (avatar du chat).
 */
function RobotSvg({
  variant = "full",
  eyesRef,
  className,
}: {
  variant?: "full" | "head";
  eyesRef?: Ref<SVGGElement>;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const u = (name: string) => `url(#${id}-${name})`;
  const head = variant === "head";
  return (
    <svg
      viewBox={head ? "4 2 112 78" : "0 0 120 150"}
      aria-hidden="true"
      className={cn("block h-full w-full overflow-visible", className)}
    >
      <defs>
        {/* plastique blanc : volume par dégradé + reflet spéculaire calculé */}
        <radialGradient id={`${id}-shell`} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#eef2f6" />
          <stop offset="0.85" stopColor="#cfd8e1" />
          <stop offset="1" stopColor="#aab6c2" />
        </radialGradient>
        <filter id={`${id}-plastic`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="blur" />
          <feSpecularLighting
            in="blur"
            surfaceScale="4"
            specularConstant="0.75"
            specularExponent="18"
            lightingColor="#ffffff"
            result="spec"
          >
            <fePointLight x="20" y="-30" z="90" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feComposite
            in="SourceGraphic"
            in2="specIn"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="0.55"
            k4="0"
          />
        </filter>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2937" />
          <stop offset="0.45" stopColor="#0b1220" />
          <stop offset="1" stopColor="#050a14" />
        </linearGradient>
        <linearGradient id={`${id}-visorEdge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#64748b" />
          <stop offset="0.25" stopColor="#e2e8f0" />
          <stop offset="0.5" stopColor="#94a3b8" />
          <stop offset="0.75" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <radialGradient id={`${id}-joint`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="0.5" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#334155" />
        </radialGradient>
        <radialGradient id={`${id}-led`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ecfeff" />
          <stop offset="0.35" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0891b2" />
        </radialGradient>
        <pattern id={`${id}-scan`} width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="1" fill="rgba(0,0,0,.28)" />
        </pattern>
        <filter id={`${id}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`${id}-jet`} cx="0.5" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#cffafe" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-plaid`} width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="#f97316" />
          <rect width="5" height="1.6" fill="rgba(124,45,18,.42)" />
          <rect width="1.6" height="5" fill="rgba(124,45,18,.42)" />
          <rect y="3.2" width="5" height=".6" fill="rgba(255,255,255,.4)" />
          <rect x="3.2" width=".6" height="5" fill="rgba(255,255,255,.4)" />
        </pattern>
        <linearGradient id={`${id}-tieShade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#7c2d12" stopOpacity="0.3" />
          <stop offset="1" stopColor="#7c2d12" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {!head && (
        <>
          {/* réacteur de lévitation */}
          <ellipse className="dg-jet" cx="60" cy="139" rx="13" ry="8" fill={u("jet")} />
          {/* bras gauche */}
          <g className="dg-arm-l">
            <rect
              x="25"
              y="96"
              width="9"
              height="21"
              rx="4.5"
              fill={u("shell")}
              filter={u("plastic")}
              transform="rotate(20 30 98)"
            />
            <circle cx="30" cy="98" r="4.2" fill={u("joint")} />
            <circle cx="22.5" cy="118" r="5.6" fill={u("shell")} filter={u("plastic")} />
            <path d="M19 120.5a4 4 0 0 0 7 0" stroke="#94a3b8" strokeWidth=".8" fill="none" />
          </g>
          {/* bras droit (fait coucou) */}
          <g className="dg-arm-r">
            <rect
              x="86"
              y="96"
              width="9"
              height="21"
              rx="4.5"
              fill={u("shell")}
              filter={u("plastic")}
              transform="rotate(-20 90 98)"
            />
            <circle cx="90" cy="98" r="4.2" fill={u("joint")} />
            <circle cx="97.5" cy="118" r="5.6" fill={u("shell")} filter={u("plastic")} />
            <path d="M94 120.5a4 4 0 0 0 7 0" stroke="#94a3b8" strokeWidth=".8" fill="none" />
          </g>
          {/* cou en métal brossé */}
          <rect x="52" y="74" width="16" height="10" rx="3" fill={u("metal")} />
          <path d="M52 77.5h16M52 80.5h16" stroke="rgba(15,23,42,.25)" strokeWidth=".6" />
          {/* corps */}
          <ellipse cx="60" cy="107" rx="27" ry="25" fill={u("shell")} filter={u("plastic")} />
          <path
            d="M37 102c7 5 39 5 46 0"
            stroke="rgba(15,23,42,.12)"
            strokeWidth=".9"
            fill="none"
          />
          <ellipse cx="60" cy="130" rx="12" ry="3.4" fill="#475569" />
          <ellipse cx="60" cy="129.4" rx="9" ry="2.2" fill="#0f172a" />
          <ellipse
            className="dg-core-led"
            cx="60"
            cy="129.4"
            rx="6"
            ry="1.2"
            fill="#67e8f9"
            filter={u("glow")}
          />
          <circle
            className="dg-status"
            cx="77"
            cy="102"
            r="1.7"
            fill="#2dd4bf"
            filter={u("glow")}
          />
          {/* cravate à carreaux */}
          <g>
            <path d="M56.5 84h7l-1 5.5h-5z" fill={u("plaid")} stroke="#c2410c" strokeWidth=".5" />
            <path
              d="M57.4 89.5h5.2l3.4 14-6 6.5-6-6.5z"
              fill={u("plaid")}
              stroke="#c2410c"
              strokeWidth=".5"
            />
            <path d="M57.4 89.5h5.2l3.4 14-6 6.5-6-6.5z" fill={u("tieShade")} />
          </g>
        </>
      )}

      {/* antenne */}
      <rect x="58.6" y="9" width="2.8" height="11" rx="1.4" fill={u("metal")} />
      <circle className="dg-antenna" cx="60" cy="8" r="3.6" fill={u("led")} filter={u("glow")} />

      {/* oreilles métal + anneau lumineux */}
      <circle cx="16" cy="47" r="8.5" fill={u("joint")} />
      <circle cx="16" cy="47" r="5.4" fill="#0f172a" />
      <circle
        cx="16"
        cy="47"
        r="3.6"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.3"
        filter={u("glow")}
      />
      <circle cx="104" cy="47" r="8.5" fill={u("joint")} />
      <circle cx="104" cy="47" r="5.4" fill="#0f172a" />
      <circle
        cx="104"
        cy="47"
        r="3.6"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.3"
        filter={u("glow")}
      />

      {/* tête */}
      <rect x="18" y="18" width="84" height="58" rx="24" fill={u("shell")} filter={u("plastic")} />
      <rect
        x="21.5"
        y="21.5"
        width="77"
        height="51"
        rx="21"
        fill="none"
        stroke="rgba(15,23,42,.08)"
        strokeWidth=".8"
      />
      {/* visière en verre noir */}
      <rect x="26" y="28" width="68" height="40" rx="17" fill={u("visorEdge")} />
      <rect x="27.3" y="29.3" width="65.4" height="37.4" rx="15.8" fill={u("visor")} />
      <circle cx="60" cy="32.6" r="1.5" fill="#1e293b" stroke="#475569" strokeWidth=".5" />
      <circle cx="59.6" cy="32.2" r=".45" fill="#e2e8f0" />
      <g ref={eyesRef} style={{ transition: "transform .2s ease-out" }}>
        <g className="dg-eyes-open" filter={u("glow")}>
          <rect
            className="dg-blink"
            x="41"
            y="40"
            width="11"
            height="15"
            rx="5.5"
            fill={u("led")}
          />
          <rect
            className="dg-blink"
            x="68"
            y="40"
            width="11"
            height="15"
            rx="5.5"
            fill={u("led")}
          />
        </g>
        <g className="dg-eyes-happy" filter={u("glow")}>
          <path
            d="M41 50q5.5-8 11 0"
            stroke="#67e8f9"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M68 50q5.5-8 11 0"
            stroke="#67e8f9"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </g>
        <path
          className="dg-smile"
          d="M54 60q6 4.5 12 0"
          stroke="#67e8f9"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          filter={u("glow")}
        />
      </g>
      <rect x="27.3" y="29.3" width="65.4" height="37.4" rx="15.8" fill={u("scan")} opacity=".5" />
      {/* reflet sur le verre */}
      <path
        d="M32 33c8-3.5 22-4 33-3.2l-15 30c-8 .5-14-1-17.5-4.5C30 48 29.5 38 32 33z"
        fill="#ffffff"
        opacity=".1"
      />
      <path
        d="M34 34.5c5-2 12-2.6 18-2.5"
        stroke="#ffffff"
        strokeOpacity=".35"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Avatar du chat : la tête seule (size en px). */
function RobotFace({ size, className }: { size: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <RobotSvg variant="head" />
    </span>
  );
}

/** Le robot flottant : plane, cligne des yeux, suit le pointeur, s'incline en 3D et fait coucou. */
function FloatingRobot({ eyesRef }: { eyesRef: Ref<SVGGElement> }) {
  return (
    <span className="absolute left-1/2 top-0 block h-[150px] w-[120px] origin-top [transform:translateX(-50%)_scale(var(--dg-s,1))]">
      <span className="dg-rig absolute inset-0 block">
        <RobotSvg eyesRef={eyesRef} />
      </span>
    </span>
  );
}

const ROBOT_CSS = `
  .dg-rig { transform: perspective(460px) rotateY(calc(var(--dg-x, 0) * 18deg)) rotateX(calc(var(--dg-y, 0) * -12deg));
    transition: transform .25s ease-out; filter: drop-shadow(0 12px 12px rgba(15,23,42,.22)); }
  .dg-blink { transform-box: fill-box; transform-origin: center; animation: dg-blink 4.6s infinite; }
  .dg-eyes-happy { opacity: 0; transition: opacity .15s; }
  .dg-eyes-open { transition: opacity .15s; }
  .dg-bot:hover .dg-eyes-happy, .dg-bot:focus-visible .dg-eyes-happy { opacity: 1; }
  .dg-bot:hover .dg-eyes-open, .dg-bot:focus-visible .dg-eyes-open { opacity: 0; }
  .dg-antenna, .dg-status, .dg-core-led { animation: dg-pulse 1.8s ease-in-out infinite; }
  .dg-jet { transform-box: fill-box; transform-origin: center top; animation: dg-jet .7s ease-in-out infinite; }
  .dg-arm-l { transform-box: view-box; transform-origin: 30px 98px; animation: dg-arm 3.4s ease-in-out .4s infinite; }
  .dg-arm-r { transform-box: view-box; transform-origin: 90px 98px; animation: dg-wave 7s ease-in-out 1.2s infinite; }
  .dg-bot:hover .dg-arm-r { animation-duration: 2.2s; animation-delay: 0s; }

  @keyframes dg-hover { 0%,100% { transform: translateY(0) rotate(-1.5deg) } 50% { transform: translateY(-9px) rotate(1.5deg) } }
  @keyframes dg-shadow { 0%,100% { transform: scaleX(1); opacity: .45 } 50% { transform: scaleX(.7); opacity: .2 } }
  @keyframes dg-blink { 0%,93%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
  @keyframes dg-wave { 0%,62%,100% { transform: rotate(0) } 67% { transform: rotate(-145deg) } 71% { transform: rotate(-120deg) }
    75% { transform: rotate(-145deg) } 79% { transform: rotate(-120deg) } 83% { transform: rotate(-145deg) } 92% { transform: rotate(0) } }
  @keyframes dg-arm { 0%,100% { transform: rotate(0) } 50% { transform: rotate(6deg) } }
  @keyframes dg-jet { 0%,100% { opacity: .95; transform: scale(1) } 50% { opacity: .6; transform: scale(.85, .7) } }
  @keyframes dg-pulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
  @keyframes dg-pop { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
  @keyframes dg-bubble { from { opacity: 0; transform: translateY(8px) scale(.9) } to { opacity: 1; transform: none } }
  @keyframes dg-dot { 0%,80%,100% { opacity: .25; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }
  .dg-hover { animation: dg-hover 3.4s ease-in-out infinite; }
  .dg-shadow { animation: dg-shadow 3.4s ease-in-out infinite; }
  .dg-pop { animation: dg-pop .28s cubic-bezier(.2,.8,.2,1); }
  .dg-bubble { transform-origin: 80% 100%; animation: dg-bubble .35s cubic-bezier(.2,.8,.2,1) .6s both; }
  .dg-dot { animation: dg-dot 1.1s infinite; }
  @media (prefers-reduced-motion: reduce) {
    .dg-blink, .dg-hover, .dg-shadow, .dg-arm-l, .dg-arm-r, .dg-jet, .dg-antenna, .dg-status, .dg-core-led, .dg-pop, .dg-bubble, .dg-dot { animation: none }
    .dg-rig { transition: none }
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
