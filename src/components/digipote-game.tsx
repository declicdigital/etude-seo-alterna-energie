import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Play, RotateCcw, X } from "lucide-react";
import { RobotSvg } from "@/components/digipote-robot";
import { cn } from "@/lib/utils";

/**
 * « Bug Buster » : D.I.G.I.P.O.T.E se déplace en bas de l'écran et lance des bips d'énergie sur
 * les bugs qui tombent. Les étoiles rapportent des points, les cafés redonnent une vie.
 * Clavier (← → / A D, Espace), souris (bouger, cliquer) ou doigt (glisser, toucher).
 */

type Kind = "bug" | "star" | "coffee";
type Thing = {
  x: number;
  y: number;
  vy: number;
  vx: number;
  kind: Kind;
  emoji: string;
  r: number;
  wob: number;
};
type Shot = { x: number; y: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Popup = { x: number; y: number; text: string; life: number; color: string };

const BUGS = ["🐛", "🪲", "👾", "🦠"];
const ROBOT_W = 80;
const ROBOT_H = 100;
const LINES = {
  hit: ["Bip ! Touché !", "Bzzt ! Bug éliminé", "Boum ! 💥", "Mission accomplie"],
  star: ["Étoile captée ⭐", "Bip-boup, bonus !"],
  coffee: ["Café = énergie ☕", "Batterie rechargée !"],
  ouch: ["Aïe, un bug !", "Bzzt… ça pique", "Alerte bug ! 🚨"],
};
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
const BEST_KEY = "dg-game-best";

export function DigipoteGame({ onClose }: { onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const robotRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"intro" | "play" | "over">("intro");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState(0);
  const [talk, setTalk] = useState<string | null>(null);
  const [mood, setMood] = useState<"ok" | "happy" | "ouch">("ok");
  const state = useRef({
    w: 600,
    h: 420,
    x: 300,
    targetX: null as number | null,
    vx: 0,
    keys: { left: false, right: false },
    things: [] as Thing[],
    shots: [] as Shot[],
    sparks: [] as Spark[],
    popups: [] as Popup[],
    spawnIn: 0,
    elapsed: 0,
    lastShot: 0,
    score: 0,
    lives: 3,
    running: false,
  });
  const talkTimer = useRef<number | undefined>(undefined);
  const moodTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const say = useCallback((text: string, m: "happy" | "ouch") => {
    setTalk(text);
    setMood(m);
    window.clearTimeout(talkTimer.current);
    window.clearTimeout(moodTimer.current);
    talkTimer.current = window.setTimeout(() => setTalk(null), 1100);
    moodTimer.current = window.setTimeout(() => setMood("ok"), 700);
  }, []);

  // Taille du terrain = taille de la boîte, en pixels nets sur écran Retina.
  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const resize = () => {
      const r = box.getBoundingClientRect();
      const s = state.current;
      if (!s.running && s.w === 600) s.x = r.width / 2;
      s.w = r.width;
      s.h = r.height;
      s.x = Math.min(Math.max(s.x, ROBOT_W / 2), s.w - ROBOT_W / 2);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (robotRef.current && !s.running)
        robotRef.current.style.transform = `translate(${s.x - ROBOT_W / 2}px, ${s.h - ROBOT_H}px)`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const shoot = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    if (s.elapsed - s.lastShot < 0.22) return;
    s.lastShot = s.elapsed;
    s.shots.push({ x: s.x, y: s.h - ROBOT_H + 6 });
  }, []);

  const start = useCallback(() => {
    const s = state.current;
    Object.assign(s, {
      x: s.w / 2,
      targetX: null,
      vx: 0,
      things: [],
      shots: [],
      sparks: [],
      popups: [],
      spawnIn: 0.6,
      elapsed: 0,
      lastShot: -1,
      score: 0,
      lives: 3,
      running: true,
    });
    setScore(0);
    setLives(3);
    setPhase("play");
    say("Bip-boup ! C'est parti 🤖", "happy");
  }, [say]);

  // Boucle de jeu.
  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    let last = performance.now();
    const ctx = canvasRef.current?.getContext("2d");
    const burst = (x: number, y: number, color: string, n = 12) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 60 + Math.random() * 160;
        state.current.sparks.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0.5 + Math.random() * 0.3,
          color,
        });
      }
    };
    const pop = (x: number, y: number, text: string, color: string) =>
      state.current.popups.push({ x, y, text, life: 0.9, color });
    const loseLife = (x: number, y: number) => {
      const s = state.current;
      s.lives -= 1;
      setLives(s.lives);
      burst(x, y, "#f43f5e", 16);
      say(pick(LINES.ouch), "ouch");
      if (s.lives <= 0) {
        s.running = false;
        setPhase("over");
        setBest((b) => {
          const nb = Math.max(b, s.score);
          try {
            localStorage.setItem(BEST_KEY, String(nb));
          } catch {
            /* stockage indisponible */
          }
          return nb;
        });
      }
    };

    const frame = (now: number) => {
      const s = state.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!s.running) return;
      s.elapsed += dt;
      const level = 1 + s.elapsed / 25; // la difficulté monte doucement

      // Déplacement du robot (clavier ou pointeur).
      const dir = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
      if (dir) {
        s.targetX = null;
        s.vx = dir * 430;
      } else if (s.targetX !== null) {
        s.vx = (s.targetX - s.x) * 10;
      } else {
        s.vx *= 0.8;
      }
      s.x = Math.min(Math.max(s.x + s.vx * dt, ROBOT_W / 2), s.w - ROBOT_W / 2);
      const robotTop = s.h - ROBOT_H;
      if (robotRef.current) {
        const tilt = Math.max(-14, Math.min(14, s.vx / 35));
        robotRef.current.style.transform = `translate(${s.x - ROBOT_W / 2}px, ${robotTop}px) rotate(${tilt}deg)`;
      }

      // Apparitions.
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) {
        s.spawnIn = Math.max(0.32, 0.95 - s.elapsed / 70) * (0.7 + Math.random() * 0.6);
        const roll = Math.random();
        const kind: Kind = roll < 0.08 ? "star" : roll < 0.12 && s.lives < 3 ? "coffee" : "bug";
        const r = kind === "bug" ? 16 : 15;
        s.things.push({
          x: r + Math.random() * (s.w - 2 * r),
          y: -r,
          vy: (kind === "bug" ? 70 + Math.random() * 60 : 110) * level,
          vx: kind === "bug" ? (Math.random() - 0.5) * 40 * level : 0,
          kind,
          emoji: kind === "bug" ? pick(BUGS) : kind === "star" ? "⭐" : "☕",
          r,
          wob: Math.random() * Math.PI * 2,
        });
      }

      // Bips lancés.
      for (const sh of s.shots) sh.y -= 560 * dt;
      s.shots = s.shots.filter((sh) => sh.y > -20);

      // Objets qui tombent, collisions.
      const keep: Thing[] = [];
      for (const t of s.things) {
        t.wob += dt * 4;
        t.y += t.vy * dt;
        t.x += t.vx * dt + Math.sin(t.wob) * 0.4;
        if (t.x < t.r || t.x > s.w - t.r) t.vx *= -1;
        let gone = false;
        if (t.kind === "bug") {
          const hit = s.shots.findIndex(
            (sh) => (sh.x - t.x) ** 2 + (sh.y - t.y) ** 2 < (t.r + 7) ** 2,
          );
          if (hit >= 0) {
            s.shots.splice(hit, 1);
            s.score += 10;
            setScore(s.score);
            burst(t.x, t.y, "#22d3ee");
            pop(t.x, t.y, "+10", "#0891b2");
            if (Math.random() < 0.35) say(pick(LINES.hit), "happy");
            gone = true;
          }
        }
        const touchesRobot =
          !gone &&
          t.y + t.r > robotTop + 18 &&
          t.y - t.r < s.h &&
          Math.abs(t.x - s.x) < ROBOT_W / 2 + t.r - 6;
        if (touchesRobot) {
          gone = true;
          if (t.kind === "bug") loseLife(t.x, t.y);
          else if (t.kind === "star") {
            s.score += 25;
            setScore(s.score);
            burst(t.x, t.y, "#facc15", 16);
            pop(t.x, t.y, "+25", "#ca8a04");
            say(pick(LINES.star), "happy");
          } else {
            s.lives = Math.min(3, s.lives + 1);
            setLives(s.lives);
            burst(t.x, t.y, "#f97316");
            pop(t.x, t.y, "+1 ❤", "#e11d48");
            say(pick(LINES.coffee), "happy");
          }
        }
        if (!gone && t.y - t.r > s.h) {
          gone = true;
          if (t.kind === "bug") loseLife(t.x, s.h - 10);
        }
        if (!gone) keep.push(t);
      }
      s.things = keep;

      for (const p of s.sparks) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
        p.life -= dt;
      }
      s.sparks = s.sparks.filter((p) => p.life > 0);
      for (const p of s.popups) {
        p.y -= 40 * dt;
        p.life -= dt;
      }
      s.popups = s.popups.filter((p) => p.life > 0);

      // Dessin.
      if (ctx) {
        ctx.clearRect(0, 0, s.w, s.h);
        for (const sh of s.shots) {
          const g = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, 10);
          g.addColorStop(0, "rgba(255,255,255,1)");
          g.addColorStop(0.35, "rgba(103,232,249,.95)");
          g.addColorStop(1, "rgba(34,211,238,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sh.x, sh.y, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(103,232,249,.25)";
          ctx.fillRect(sh.x - 1.5, sh.y + 6, 3, 14);
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 1;
        for (const t of s.things) {
          if (t.kind !== "bug") {
            ctx.fillStyle = t.kind === "star" ? "rgba(250,204,21,.25)" : "rgba(249,115,22,.22)";
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r + 7, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "#000"; // les émojis prennent l'opacité de fillStyle
          ctx.font = `${t.r * 2}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
          ctx.save();
          ctx.translate(t.x, t.y);
          ctx.rotate(Math.sin(t.wob) * 0.25);
          ctx.fillText(t.emoji, 0, 1);
          ctx.restore();
        }
        for (const p of s.sparks) {
          ctx.globalAlpha = Math.max(0, p.life * 1.6);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.font = "700 15px Inter, system-ui, sans-serif";
        for (const p of s.popups) {
          ctx.globalAlpha = Math.min(1, p.life * 1.5);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y - 18);
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, say]);

  // Clavier.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = state.current;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (["ArrowLeft", "a", "A", "q", "Q"].includes(e.key)) s.keys.left = true;
      else if (["ArrowRight", "d", "D"].includes(e.key)) s.keys.right = true;
      else if (e.key === " " || e.key === "ArrowUp" || e.key === "Enter") {
        if (phase === "play") shoot();
        else start();
      } else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const s = state.current;
      if (["ArrowLeft", "a", "A", "q", "Q"].includes(e.key)) s.keys.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) s.keys.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, shoot, start, onClose]);

  // Souris / doigt : le robot suit, un clic ou un toucher lance un bip.
  const pointerX = (e: React.PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect();
    return r ? e.clientX - r.left : 0;
  };

  useEffect(
    () => () => {
      window.clearTimeout(talkTimer.current);
      window.clearTimeout(moodTimer.current);
    },
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Mini-jeu D.I.G.I.P.O.T.E"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-[760px] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/90 shadow-[0_30px_80px_-20px_rgba(15,23,42,.6)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/70">
        <header className="flex items-center gap-3 px-4 py-3">
          <div className="text-[15px] font-bold tracking-wide text-slate-800 dark:text-slate-100">
            Bug Buster <span className="font-medium text-slate-500">· avec D.I.G.I.P.O.T.E</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-0.5" aria-label={`${lives} vies`}>
              {[0, 1, 2].map((i) => (
                <Heart
                  key={i}
                  className={cn(
                    "size-4",
                    i < lives ? "fill-rose-500 text-rose-500" : "text-slate-300",
                  )}
                />
              ))}
            </span>
            <span className="tabular-nums">{score} pts</span>
            <span className="hidden tabular-nums text-slate-500 sm:inline">Record {best}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le jeu"
            className="rounded-full p-1.5 text-slate-500 hover:bg-white/60 dark:hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </header>

        <div
          ref={boxRef}
          className="relative h-[min(68vh,480px)] touch-none select-none overflow-hidden bg-gradient-to-b from-sky-100 via-emerald-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
          onPointerMove={(e) => {
            if (phase === "play") state.current.targetX = pointerX(e);
          }}
          onPointerDown={(e) => {
            if (phase !== "play") return;
            state.current.targetX = pointerX(e);
            shoot();
          }}
        >
          {/* décor : grille légère et halos */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(14,116,144,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(14,116,144,.07)_1px,transparent_1px)] [background-size:28px_28px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 top-10 size-56 rounded-full bg-cyan-300/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 bottom-16 size-56 rounded-full bg-violet-300/30 blur-3xl"
          />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          <div
            ref={robotRef}
            className={cn(
              "dg-game-bot absolute left-0 top-0",
              mood === "happy" && "dg-happy",
              mood === "ouch" && "dg-ouch",
            )}
            style={{ width: ROBOT_W, height: ROBOT_H }}
          >
            {talk && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-md dark:bg-slate-800 dark:text-slate-100">
                {talk}
              </span>
            )}
            <RobotSvg />
          </div>

          {phase !== "play" && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-3xl border border-white/70 bg-white/80 p-5 text-center shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80">
                {phase === "intro" ? (
                  <>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      Bip-boup ! Des bugs envahissent Digicom 🐛
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      Aide D.I.G.I.P.O.T.E à les éliminer avant qu'ils touchent le sol. Attrape les
                      ⭐ pour des points et les ☕ pour regagner une vie.
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Clavier : ← → pour bouger, Espace pour lancer un bip. Souris ou doigt : bouge,
                      clique pour lancer.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      Bzzt… batterie à plat 🪫
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Score : <strong>{score}</strong> pts
                      {score > 0 && score >= best
                        ? " · nouveau record ! 🏆"
                        : ` · record : ${best}`}
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={start}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(5,150,105,.8)] hover:brightness-110"
                >
                  {phase === "intro" ? (
                    <Play className="size-4" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  {phase === "intro" ? "Jouer" : "Rejouer"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
