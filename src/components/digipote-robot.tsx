import { useId, type Ref } from "react";
import { cn } from "@/lib/utils";

/**
 * D.I.G.I.P.O.T.E dessiné en SVG : tête et corps en verre liquide, visière noire à yeux LED,
 * liseré irisé, anneau orbital, mains flottantes, cravate orange à carreaux.
 * Partagé par le chat, l'avatar et le mini-jeu. `variant="head"` ne montre que la tête.
 */
export function RobotSvg({
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
        <radialGradient id={`${id}-shell`} cx="0.36" cy="0.28" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#f4f6fb" />
          <stop offset="0.82" stopColor="#dfe5f0" />
          <stop offset="1" stopColor="#c7d0e2" />
        </radialGradient>
        <linearGradient id={`${id}-iris`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        {/* verre liquide : remplissage translucide teinté, liseré lumineux, lumière interne */}
        <radialGradient id={`${id}-glass`} cx="0.32" cy="0.22" r="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.62" />
          <stop offset="0.45" stopColor="#f5f7ff" stopOpacity="0.26" />
          <stop offset="0.8" stopColor="#c7d2fe" stopOpacity="0.22" />
          <stop offset="1" stopColor="#99f6e4" stopOpacity="0.4" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.65" stopColor="#c4b5fd" stopOpacity="0.35" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={`${id}-caustic`} cx="0.5" cy="1" r="0.7">
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0.45" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={`${id}-sweep`}
          x1="0"
          y1="0"
          x2="1"
          y2="0"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
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
          <stop offset="0" stopColor="#1e2433" />
          <stop offset="0.5" stopColor="#080c16" />
          <stop offset="1" stopColor="#03050b" />
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
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.4" stopColor="#a5f3fc" />
          <stop offset="1" stopColor="#22d3ee" />
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
          <ellipse className="dg-jet" cx="60" cy="139" rx="12" ry="7" fill={u("jet")} />
          {/* anneau orbital (moitié arrière) */}
          <path
            d="M23 112a37 8.5 0 0 1 74 0"
            fill="none"
            stroke={u("iris")}
            strokeWidth="1.6"
            opacity=".45"
          />
          {/* lévitation entre tête et corps */}
          <ellipse
            className="dg-core-led"
            cx="60"
            cy="81.5"
            rx="11"
            ry="2.4"
            fill="#67e8f9"
            opacity=".7"
            filter={u("glow")}
          />
          {/* corps : sphère nacrée, ligne d'équateur lumineuse, socle */}
          <circle cx="60" cy="108" r="24" fill={u("glass")} filter={u("plastic")} />
          <circle cx="60" cy="108" r="24" fill={u("caustic")} />
          <circle cx="60" cy="108" r="23.4" fill="none" stroke={u("rim")} strokeWidth="1.1" />
          <path
            d="M45 93.5a20 20 0 0 1 14-6"
            stroke="#ffffff"
            strokeOpacity=".95"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M37.5 111.5c9 4.2 36 4.2 45 0"
            fill="none"
            stroke={u("iris")}
            strokeWidth="1.1"
            filter={u("glow")}
          />
          <ellipse cx="60" cy="131.2" rx="8.5" ry="2.3" fill="#1f2937" />
          <ellipse
            className="dg-core-led"
            cx="60"
            cy="131"
            rx="5.5"
            ry="1.1"
            fill="#a5f3fc"
            filter={u("glow")}
          />
          {/* anneau orbital (moitié avant) */}
          <path
            d="M97 112a37 8.5 0 0 1-74 0"
            fill="none"
            stroke={u("iris")}
            strokeWidth="1.9"
            filter={u("glow")}
          />
          {/* cravate à carreaux */}
          <g>
            <path
              d="M56.6 85.5h6.8l-1 5h-4.8z"
              fill={u("plaid")}
              stroke="#c2410c"
              strokeWidth=".45"
            />
            <path
              d="M57.5 90.5h5l3.2 13-5.7 6-5.7-6z"
              fill={u("plaid")}
              stroke="#c2410c"
              strokeWidth=".45"
            />
            <path d="M57.5 90.5h5l3.2 13-5.7 6-5.7-6z" fill={u("tieShade")} />
          </g>
          {/* mains flottantes (la droite fait coucou) */}
          <g className="dg-arm-l">
            <rect
              x="20"
              y="100"
              width="9"
              height="18"
              rx="4.5"
              fill={u("glass")}
              stroke={u("rim")}
              strokeWidth=".9"
              filter={u("plastic")}
              transform="rotate(14 24.5 109)"
            />
            <rect
              x="22.6"
              y="104"
              width="1.4"
              height="9"
              rx=".7"
              fill={u("iris")}
              transform="rotate(14 24.5 109)"
            />
          </g>
          <g className="dg-arm-r">
            <rect
              x="91"
              y="100"
              width="9"
              height="18"
              rx="4.5"
              fill={u("glass")}
              stroke={u("rim")}
              strokeWidth=".9"
              filter={u("plastic")}
              transform="rotate(-14 95.5 109)"
            />
            <rect
              x="96"
              y="104"
              width="1.4"
              height="9"
              rx=".7"
              fill={u("iris")}
              transform="rotate(-14 95.5 109)"
            />
          </g>
        </>
      )}

      {/* orbe lumineux et halo au-dessus de la tête */}
      <ellipse
        cx="60"
        cy="13.5"
        rx="7"
        ry="1.7"
        fill="none"
        stroke={u("iris")}
        strokeWidth=".9"
        opacity=".8"
      />
      <circle className="dg-antenna" cx="60" cy="8.5" r="3.2" fill={u("led")} filter={u("glow")} />

      {/* tête : coque nacrée sans couture, bandes LED latérales */}
      <rect x="15.2" y="38" width="3" height="20" rx="1.5" fill={u("iris")} filter={u("glow")} />
      <rect x="101.8" y="38" width="3" height="20" rx="1.5" fill={u("iris")} filter={u("glow")} />
      <rect x="18" y="20" width="84" height="56" rx="26" fill={u("glass")} filter={u("plastic")} />
      <rect x="18" y="20" width="84" height="56" rx="26" fill={u("caustic")} />
      <rect
        x="18.6"
        y="20.6"
        width="82.8"
        height="54.8"
        rx="25.4"
        fill="none"
        stroke={u("rim")}
        strokeWidth="1.2"
      />
      <path
        d="M35 25c13-3 37-3 50 0"
        stroke="#ffffff"
        strokeOpacity=".9"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* visière en verre noir, liseré irisé */}
      <rect
        x="24.5"
        y="27"
        width="71"
        height="42"
        rx="20"
        fill={u("visor")}
        fillOpacity=".88"
        stroke={u("iris")}
        strokeWidth="1.3"
      />
      <g ref={eyesRef} style={{ transition: "transform .2s ease-out" }}>
        <g className="dg-eyes-open" filter={u("glow")}>
          <rect
            className="dg-blink"
            x="38"
            y="44"
            width="15"
            height="6.5"
            rx="3.25"
            fill={u("led")}
          />
          <rect
            className="dg-blink"
            x="67"
            y="44"
            width="15"
            height="6.5"
            rx="3.25"
            fill={u("led")}
          />
        </g>
        <g className="dg-eyes-happy" filter={u("glow")}>
          <path
            d="M39 50q6.5-7 13 0"
            stroke="#a5f3fc"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M68 50q6.5-7 13 0"
            stroke="#a5f3fc"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </g>
        <path
          className="dg-smile"
          d="M55 59.5q5 3 10 0"
          stroke="#a5f3fc"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          filter={u("glow")}
        />
      </g>
      {/* reflets du verre */}
      <path
        d="M30 34c9-4.2 25-4.6 37-3.6L50 63c-9 .4-16-1.4-19.4-5C28 50 27.4 39.5 30 34z"
        fill="#ffffff"
        opacity=".08"
      />
      <path
        d="M33 33.4c6-2.4 14-3 21-2.9"
        stroke="#ffffff"
        strokeOpacity=".4"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <rect className="dg-sweep" x="24.5" y="27" width="71" height="42" rx="20" fill={u("sweep")} />
    </svg>
  );
}

/** Avatar du chat : la tête seule (size en px). */
export function RobotFace({ size, className }: { size: number; className?: string }) {
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
export function FloatingRobot({ eyesRef }: { eyesRef: Ref<SVGGElement> }) {
  return (
    <span className="absolute left-1/2 top-0 block h-[150px] w-[120px] origin-top [transform:translateX(-50%)_scale(var(--dg-s,1))]">
      <span className="dg-rig absolute inset-0 block">
        {/* halo coloré + vraies couches de verre (flou de ce qu'il y a derrière) sous le dessin */}
        <span aria-hidden className="dg-aura" />
        <span
          aria-hidden
          className="dg-lg left-[18px] top-[20px] h-[56px] w-[84px] rounded-[26px]"
        />
        <span aria-hidden className="dg-lg left-[36px] top-[84px] h-[48px] w-[48px] rounded-full" />
        <RobotSvg eyesRef={eyesRef} className="absolute inset-0" />
      </span>
    </span>
  );
}

export const ROBOT_CSS = `
  .dg-rig { transform: perspective(460px) rotateY(calc(var(--dg-x, 0) * 18deg)) rotateX(calc(var(--dg-y, 0) * -12deg));
    transition: transform .25s ease-out; }
  .dg-lg { position:absolute; -webkit-backdrop-filter: blur(7px) saturate(1.9) brightness(1.05); backdrop-filter: blur(7px) saturate(1.9) brightness(1.05);
    background: rgba(255,255,255,.06); box-shadow: 0 14px 22px -10px rgba(15,23,42,.35), 0 2px 6px rgba(15,23,42,.08); }
  .dg-aura { position:absolute; left:50%; top:46%; width:110px; height:110px; margin:-55px 0 0 -55px; border-radius:50%; pointer-events:none;
    background: radial-gradient(circle at 35% 40%, rgba(103,232,249,.45), transparent 55%), radial-gradient(circle at 70% 60%, rgba(167,139,250,.38), transparent 55%),
      radial-gradient(circle at 50% 85%, rgba(52,211,153,.3), transparent 50%);
    filter: blur(12px); animation: dg-pulse 3.4s ease-in-out infinite; }
  .dg-blink { transform-box: fill-box; transform-origin: center; animation: dg-blink 4.6s infinite; }
  .dg-eyes-happy { opacity: 0; transition: opacity .15s; }
  .dg-eyes-open { transition: opacity .15s; }
  .dg-bot:hover .dg-eyes-happy, .dg-bot:focus-visible .dg-eyes-happy { opacity: 1; }
  .dg-bot:hover .dg-eyes-open, .dg-bot:focus-visible .dg-eyes-open { opacity: 0; }
  .dg-antenna, .dg-status, .dg-core-led { animation: dg-pulse 1.8s ease-in-out infinite; }
  .dg-jet { transform-box: fill-box; transform-origin: center top; animation: dg-jet .7s ease-in-out infinite; }
  .dg-arm-l { animation: dg-handfloat 3.4s ease-in-out .4s infinite; }
  .dg-arm-r { transform-box: view-box; transform-origin: 95px 109px; animation: dg-wave 7s ease-in-out 1.2s infinite; }
  .dg-sweep { animation: dg-sweep 5s ease-in-out 1s infinite; }
  .dg-bot:hover .dg-arm-r { animation-duration: 2.2s; animation-delay: 0s; }

  .dg-happy .dg-eyes-happy { opacity: 1; } .dg-happy .dg-eyes-open { opacity: 0; }
  .dg-ouch { animation: dg-ouch .35s ease-in-out; } .dg-ouch svg { filter: drop-shadow(0 0 6px rgba(244,63,94,.8)); }
  @keyframes dg-ouch { 0%,100% { margin-left: 0 } 25% { margin-left: -5px } 75% { margin-left: 5px } }
  @keyframes dg-hover { 0%,100% { transform: translateY(0) rotate(-1.5deg) } 50% { transform: translateY(-9px) rotate(1.5deg) } }
  @keyframes dg-shadow { 0%,100% { transform: scaleX(1); opacity: .45 } 50% { transform: scaleX(.7); opacity: .2 } }
  @keyframes dg-blink { 0%,93%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
  @keyframes dg-wave { 0%,62%,100% { transform: translate(0,0) rotate(0) } 67% { transform: translate(4px,-32px) rotate(-20deg) }
    71% { transform: translate(5px,-32px) rotate(8deg) } 75% { transform: translate(4px,-33px) rotate(-20deg) } 79% { transform: translate(5px,-32px) rotate(8deg) }
    83% { transform: translate(4px,-33px) rotate(-20deg) } 92% { transform: translate(0,0) rotate(0) } }
  @keyframes dg-handfloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
  @keyframes dg-sweep { 0%,70% { transform: translateX(-60px); opacity: 0 } 75% { opacity: 1 } 100% { transform: translateX(60px); opacity: 0 } }
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
    .dg-blink, .dg-hover, .dg-shadow, .dg-arm-l, .dg-arm-r, .dg-sweep, .dg-aura, .dg-jet, .dg-antenna, .dg-status, .dg-core-led, .dg-pop, .dg-bubble, .dg-dot { animation: none }
    .dg-rig { transition: none }
  }
`;
