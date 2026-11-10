import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Heart, Play, RotateCcw, Trophy, X } from "lucide-react";
import { RobotFace, RobotSvg, ROBOT_SKINS, type RobotSkin } from "@/components/digipote-robot";
import { getGameLeaderboard, submitGameScore } from "@/lib/game.functions";
import {
  BOARD_SIZE,
  GAME_AVATARS,
  GAME_MAPS,
  liveRank,
  PERIOD_LABELS,
  PERIODS,
  type BoardFilter,
  type Boards,
  type GameMapId,
  type Period,
} from "@/lib/game-leaderboard";
import { cn } from "@/lib/utils";

/**
 * « Bug Buster » : D.I.G.I.P.O.T.E se déplace en bas de l'écran et tire tout seul des bips
 * d'énergie sur les bugs qui tombent. 4 cartes, 4 robots, bonus (turbo, bouclier, gel, méga-bip),
 * méga-bugs, combos, et classements partagés (records du jour, de la semaine, du mois).
 * Clavier (← → / Q D, Espace), souris (bouger, cliquer) ou doigt (glisser, toucher).
 */

type MapDef = {
  name: string;
  emoji: string;
  level: "Facile" | "Normal" | "Expert";
  desc: string;
  enemies: string[];
  /** ennemi costaud (2 coups) propre à la carte */
  tough?: string;
  boss: string;
  speed: number;
  spawn: number;
  wind: number;
  scoreMult: number;
  starRate: number;
  popup: string;
  card: string;
};

const MAPS: Record<GameMapId, MapDef> = {
  bureau: {
    name: "Open space",
    emoji: "🏢",
    level: "Facile",
    desc: "Des bugs tranquilles entre les bureaux. Parfait pour s'échauffer.",
    enemies: ["🐛", "🪲"],
    boss: "🪳",
    speed: 0.8,
    spawn: 1.15,
    wind: 0,
    scoreMult: 1,
    starRate: 0.07,
    popup: "#0e7490",
    card: "from-sky-100 via-emerald-50 to-white",
  },
  solaire: {
    name: "Toit solaire",
    emoji: "☀️",
    level: "Normal",
    desc: "Les nuages ☁️ cachent le soleil : 2 bips pour les chasser.",
    enemies: ["🐛", "🦗"],
    tough: "☁️",
    boss: "🦂",
    speed: 0.92,
    spawn: 1.05,
    wind: 0,
    scoreMult: 1.2,
    starRate: 0.08,
    popup: "#c2410c",
    card: "from-amber-100 via-orange-50 to-sky-100",
  },
  eolien: {
    name: "Parc éolien",
    emoji: "🌬️",
    level: "Normal",
    desc: "Le vent souffle et pousse les bugs de côté. Anticipe !",
    enemies: ["🦟", "🪰", "🐞"],
    boss: "🦇",
    speed: 0.9,
    spawn: 1.05,
    wind: 55,
    scoreMult: 1.25,
    starRate: 0.08,
    popup: "#047857",
    card: "from-sky-200 via-sky-50 to-emerald-100",
  },
  nuit: {
    name: "Centrale de nuit",
    emoji: "🌙",
    level: "Expert",
    desc: "Plus rapide, mais les étoiles pleuvent et tout rapporte ×1,5.",
    enemies: ["👾", "🦠"],
    tough: "🛸",
    boss: "👹",
    speed: 1.05,
    spawn: 0.92,
    wind: 0,
    scoreMult: 1.5,
    starRate: 0.13,
    popup: "#67e8f9",
    card: "from-[#0b1026] via-[#151a3d] to-[#312e81]",
  },
};

type Kind = "bug" | "boss" | "star" | "coffee" | "turbo" | "shield" | "freeze" | "mega";
type Thing = {
  x: number;
  y: number;
  vy: number;
  vx: number;
  kind: Kind;
  emoji: string;
  r: number;
  wob: number;
  hp: number;
  maxHp: number;
  flash: number;
};
type Shot = { x: number; y: number; vx: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Popup = { x: number; y: number; text: string; life: number; color: string };
type Effects = { turbo: boolean; shield: boolean; freeze: boolean };

const POWER: Record<"turbo" | "shield" | "freeze" | "mega", { emoji: string; label: string }> = {
  turbo: { emoji: "⚡", label: "Turbo : triple bip" },
  shield: { emoji: "🛡️", label: "Bouclier" },
  freeze: { emoji: "❄️", label: "Gel des bugs" },
  mega: { emoji: "🔋", label: "Méga-bip" },
};
const MAX_LIVES = 5;
const ROBOT_W = 80;
const ROBOT_H = 100;
const LINES = {
  hit: ["Bip ! Touché !", "Bzzt ! Bug éliminé", "Boum ! 💥", "Mission accomplie"],
  star: ["Étoile captée ⭐", "Bip-boup, bonus !"],
  coffee: ["Café = énergie ☕", "Batterie rechargée !"],
  ouch: ["Aïe, un bug !", "Bzzt… ça pique", "Alerte bug ! 🚨"],
  combo: ["Combo ×2 ! 🔥", "Combo ×3 ! 🔥🔥", "Combo ×4 !!! 🚀"],
};
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
const BEST_KEY = "dg-game-best";
const PREFS_KEY = "dg-game-prefs";
const rankLabel = (n: number) => (n === 1 ? "1er" : `${n}e`);

export function DigipoteGame({ onClose, name }: { onClose: () => void; name?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const robotRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"setup" | "play" | "over">("setup");
  const [avatar, setAvatar] = useState<RobotSkin>("digi");
  const [map, setMap] = useState<GameMapId>("bureau");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [combo, setCombo] = useState(1);
  const [fx, setFx] = useState<Effects>({ turbo: false, shield: false, freeze: false });
  const [best, setBest] = useState(0);
  const [talk, setTalk] = useState<string | null>(null);
  const [mood, setMood] = useState<"ok" | "happy" | "ouch">("ok");
  const [boards, setBoards] = useState<Boards | null>(null);
  const [period, setPeriod] = useState<Period>("day");
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fetchBoards = useServerFn(getGameLeaderboard);
  const sendScore = useServerFn(submitGameScore);
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
    nextBoss: 40,
    score: 0,
    lives: MAX_LIVES,
    hits: 0,
    mult: 1,
    invulnUntil: 0,
    turboUntil: 0,
    shieldUntil: 0,
    freezeUntil: 0,
    running: false,
  });
  const fxRef = useRef<Effects>(fx);
  const talkTimer = useRef<number | undefined>(undefined);
  const moodTimer = useRef<number | undefined>(undefined);
  const def = MAPS[map];
  const skin = ROBOT_SKINS[avatar];

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") as {
        avatar?: string;
        map?: string;
      };
      if ((GAME_AVATARS as readonly string[]).includes(prefs.avatar ?? ""))
        setAvatar(prefs.avatar as RobotSkin);
      if ((GAME_MAPS as readonly string[]).includes(prefs.map ?? ""))
        setMap(prefs.map as GameMapId);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ avatar, map }));
    } catch {
      /* stockage indisponible */
    }
  }, [avatar, map]);

  // Classements : chargés à l'ouverture puis rafraîchis en continu (les parties des collègues
  // apparaissent au fur et à mesure).
  const refresh = useCallback(async () => {
    try {
      const res = await fetchBoards();
      if (res.ok) {
        setBoards(res.boards);
        // Le record perso suit aussi les parties enregistrées (autre ordinateur, etc.).
        const mine = res.boards.month.all.find((e) => e.me)?.score ?? 0;
        if (mine) setBest((b) => Math.max(b, mine));
      }
    } catch {
      /* classement indisponible pour l'instant */
    }
  }, [fetchBoards]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const say = useCallback((text: string, m: "happy" | "ouch") => {
    setTalk(text);
    setMood(m);
    window.clearTimeout(talkTimer.current);
    window.clearTimeout(moodTimer.current);
    talkTimer.current = window.setTimeout(() => setTalk(null), 1200);
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

  const fire = useCallback((minGap: number) => {
    const s = state.current;
    if (!s.running || s.elapsed - s.lastShot < minGap) return;
    s.lastShot = s.elapsed;
    const y = s.h - ROBOT_H + 6;
    if (s.elapsed < s.turboUntil) {
      s.shots.push({ x: s.x - 10, y, vx: -130 }, { x: s.x, y, vx: 0 }, { x: s.x + 10, y, vx: 130 });
    } else s.shots.push({ x: s.x, y, vx: 0 });
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
      spawnIn: 0.8,
      elapsed: 0,
      lastShot: -1,
      nextBoss: 40,
      score: 0,
      lives: MAX_LIVES,
      hits: 0,
      mult: 1,
      invulnUntil: 0,
      turboUntil: 0,
      shieldUntil: 4, // quelques secondes de protection au départ
      freezeUntil: 0,
      running: true,
    });
    setScore(0);
    setLives(MAX_LIVES);
    setCombo(1);
    setSaved("idle");
    setPhase("play");
    say("Bip-boup ! C'est parti 🤖", "happy");
  }, [say]);

  const finish = useCallback(
    async (finalScore: number, duration: number) => {
      setBest((b) => {
        const nb = Math.max(b, finalScore);
        try {
          localStorage.setItem(BEST_KEY, String(nb));
        } catch {
          /* stockage indisponible */
        }
        return nb;
      });
      if (finalScore <= 0) return;
      setSaved("saving");
      try {
        const res = await sendScore({
          data: { score: finalScore, avatar, map, duration: Math.round(duration) },
        });
        setSaved(res.ok ? "saved" : "error");
      } catch {
        setSaved("error");
      }
      await refresh();
    },
    [avatar, map, refresh, sendScore],
  );

  // Boucle de jeu.
  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    let last = performance.now();
    const ctx = canvasRef.current?.getContext("2d");
    const m = MAPS[map];
    const k = ROBOT_SKINS[avatar];
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
    const pop = (x: number, y: number, text: string, color = m.popup) =>
      state.current.popups.push({ x, y, text, life: 0.9, color });
    const addPoints = (base: number, x: number, y: number) => {
      const s = state.current;
      const pts = Math.round(base * s.mult * m.scoreMult);
      s.score += pts;
      setScore(s.score);
      pop(x, y, `+${pts}`);
    };
    const registerHit = () => {
      const s = state.current;
      s.hits += 1;
      const mult = Math.min(4, 1 + Math.floor(s.hits / 8));
      if (mult !== s.mult) {
        s.mult = mult;
        setCombo(mult);
        say(LINES.combo[mult - 2], "happy");
      }
    };
    const damage = (x: number, y: number, amount = 1) => {
      const s = state.current;
      if (s.elapsed < s.invulnUntil) return;
      if (s.elapsed < s.shieldUntil) {
        s.shieldUntil = 0;
        s.invulnUntil = s.elapsed + 0.6;
        burst(x, y, k.glow, 16);
        say("Bouclier ! 🛡️", "happy");
        return;
      }
      s.lives = Math.max(0, s.lives - amount);
      s.invulnUntil = s.elapsed + 1;
      s.hits = 0;
      if (s.mult !== 1) {
        s.mult = 1;
        setCombo(1);
      }
      setLives(s.lives);
      burst(x, y, "#f43f5e", 16);
      say(pick(LINES.ouch), "ouch");
      if (s.lives <= 0) {
        s.running = false;
        setPhase("over");
        void finish(s.score, s.elapsed);
      }
    };
    const megaBip = () => {
      const s = state.current;
      for (const t of s.things) {
        if (t.kind === "bug") {
          burst(t.x, t.y, k.led[1], 8);
          addPoints(10, t.x, t.y);
          registerHit();
          t.hp = 0;
        } else if (t.kind === "boss") {
          t.hp = Math.max(1, t.hp - 3);
          t.flash = 0.2;
        }
      }
      s.things = s.things.filter((t) => !(t.kind === "bug" && t.hp <= 0));
      say("MÉGA-BIP ! 🔋💥", "happy");
    };
    const spawn = () => {
      const s = state.current;
      const level = 1 + Math.min(1.3, s.elapsed / 70);
      const roll = Math.random();
      let kind: Kind = "bug";
      if (roll < m.starRate) kind = "star";
      else if (roll < m.starRate + 0.04 && s.lives < MAX_LIVES) kind = "coffee";
      else if (roll < m.starRate + 0.08) kind = pick(["turbo", "shield", "freeze", "mega"]) as Kind;
      const tough = kind === "bug" && !!m.tough && Math.random() < 0.22;
      const r = tough ? 19 : kind === "bug" ? 16 : 15;
      const bonus = kind !== "bug";
      s.things.push({
        x: r + Math.random() * (s.w - 2 * r),
        y: -r,
        vy: bonus ? 95 : (50 + Math.random() * 40) * level * m.speed * (tough ? 0.8 : 1),
        vx: bonus ? 0 : (Math.random() - 0.5) * 30 * level,
        kind,
        emoji:
          kind === "bug"
            ? tough
              ? m.tough!
              : pick(m.enemies)
            : kind === "star"
              ? "⭐"
              : kind === "coffee"
                ? "☕"
                : POWER[kind as keyof typeof POWER].emoji,
        r,
        wob: Math.random() * Math.PI * 2,
        hp: tough ? 2 : 1,
        maxHp: tough ? 2 : 1,
        flash: 0,
      });
    };
    const spawnBoss = () => {
      const s = state.current;
      const hp = 6 + Math.floor(s.elapsed / 45) * 2;
      s.things.push({
        x: s.w / 2,
        y: -30,
        vy: 20 * m.speed,
        vx: (Math.random() < 0.5 ? -1 : 1) * 70,
        kind: "boss",
        emoji: m.boss,
        r: 30,
        wob: 0,
        hp,
        maxHp: hp,
        flash: 0,
      });
      say("⚠️ Méga-bug en approche !", "ouch");
    };

    const frame = (now: number) => {
      const s = state.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!s.running) return;
      s.elapsed += dt;
      const frozen = s.elapsed < s.freezeUntil;
      const slow = frozen ? 0.35 : 1;
      const wind = m.wind ? Math.sin(s.elapsed * 0.45) * m.wind : 0;

      // Effets actifs → affichage (uniquement quand ça change).
      const nextFx = {
        turbo: s.elapsed < s.turboUntil,
        shield: s.elapsed < s.shieldUntil,
        freeze: frozen,
      };
      const prevFx = fxRef.current;
      if (
        nextFx.turbo !== prevFx.turbo ||
        nextFx.shield !== prevFx.shield ||
        nextFx.freeze !== prevFx.freeze
      ) {
        fxRef.current = nextFx;
        setFx(nextFx);
      }

      // Déplacement du robot (clavier ou pointeur).
      const dir = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
      if (dir) {
        s.targetX = null;
        s.vx = dir * 460;
      } else if (s.targetX !== null) {
        s.vx = (s.targetX - s.x) * 11;
      } else {
        s.vx *= 0.8;
      }
      s.x = Math.min(Math.max(s.x + s.vx * dt, ROBOT_W / 2), s.w - ROBOT_W / 2);
      const robotTop = s.h - ROBOT_H;
      if (robotRef.current) {
        const tilt = Math.max(-14, Math.min(14, s.vx / 35));
        robotRef.current.style.transform = `translate(${s.x - ROBOT_W / 2}px, ${robotTop}px) rotate(${tilt}deg)`;
        const blinking = s.elapsed < s.invulnUntil && s.elapsed >= s.shieldUntil;
        robotRef.current.style.opacity = blinking && Math.floor(s.elapsed * 12) % 2 ? "0.4" : "1";
      }

      // Tir automatique (plus rapide en turbo).
      fire(s.elapsed < s.turboUntil ? 0.2 : 0.3);

      // Apparitions.
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) {
        s.spawnIn = Math.max(0.5, 1.15 - s.elapsed / 110) * m.spawn * (0.7 + Math.random() * 0.6);
        spawn();
      }
      if (s.elapsed >= s.nextBoss && !s.things.some((t) => t.kind === "boss")) {
        s.nextBoss = s.elapsed + 45;
        spawnBoss();
      }

      // Bips lancés.
      for (const sh of s.shots) {
        sh.y -= 580 * dt;
        sh.x += sh.vx * dt;
      }
      s.shots = s.shots.filter((sh) => sh.y > -20 && sh.x > -20 && sh.x < s.w + 20);

      // Objets qui tombent, collisions.
      const keep: Thing[] = [];
      for (const t of s.things) {
        const enemy = t.kind === "bug" || t.kind === "boss";
        t.wob += dt * 4;
        t.flash = Math.max(0, t.flash - dt);
        t.y += t.vy * dt * (enemy ? slow : 1);
        t.x += (t.vx * (enemy ? slow : 1) + (enemy ? wind : 0)) * dt + Math.sin(t.wob) * 0.4;
        if (t.x < t.r) {
          t.x = t.r;
          t.vx = Math.abs(t.vx);
        } else if (t.x > s.w - t.r) {
          t.x = s.w - t.r;
          t.vx = -Math.abs(t.vx);
        }
        let gone = false;
        if (enemy) {
          const hit = s.shots.findIndex(
            (sh) => (sh.x - t.x) ** 2 + (sh.y - t.y) ** 2 < (t.r + 9) ** 2,
          );
          if (hit >= 0) {
            s.shots.splice(hit, 1);
            t.hp -= 1;
            t.flash = 0.12;
            if (t.hp <= 0) {
              gone = true;
              registerHit();
              if (t.kind === "boss") {
                burst(t.x, t.y, "#facc15", 40);
                burst(t.x, t.y, k.led[1], 30);
                addPoints(150, t.x, t.y);
                say("Méga-bug éliminé ! 🏆", "happy");
              } else {
                burst(t.x, t.y, k.led[1]);
                addPoints(t.maxHp > 1 ? 20 : 10, t.x, t.y);
                if (Math.random() < 0.3) say(pick(LINES.hit), "happy");
              }
            } else burst(t.x, t.y, "#ffffff", 5);
          }
        }
        const touchesRobot =
          !gone &&
          t.y + t.r > robotTop + 18 &&
          t.y - t.r < s.h &&
          Math.abs(t.x - s.x) < ROBOT_W / 2 + t.r - 8;
        if (touchesRobot) {
          gone = true;
          if (enemy) damage(t.x, t.y, t.kind === "boss" ? 2 : 1);
          else if (t.kind === "star") {
            burst(t.x, t.y, "#facc15", 16);
            addPoints(25, t.x, t.y);
            say(pick(LINES.star), "happy");
          } else if (t.kind === "coffee") {
            s.lives = Math.min(MAX_LIVES, s.lives + 1);
            setLives(s.lives);
            burst(t.x, t.y, "#f97316");
            pop(t.x, t.y, "+1 ❤", "#e11d48");
            say(pick(LINES.coffee), "happy");
          } else {
            burst(t.x, t.y, k.glow, 18);
            if (t.kind === "turbo") s.turboUntil = s.elapsed + 8;
            if (t.kind === "shield") s.shieldUntil = s.elapsed + 12;
            if (t.kind === "freeze") s.freezeUntil = s.elapsed + 5;
            if (t.kind === "mega") megaBip();
            else say(`${POWER[t.kind as keyof typeof POWER].label} !`, "happy");
          }
        }
        if (!gone && t.y - t.r > s.h) {
          gone = true;
          if (enemy) damage(t.x, s.h - 10, t.kind === "boss" ? 2 : 1);
        }
        if (!gone) keep.push(t);
        if (!s.running) break;
      }
      if (!s.running) return;
      s.things = keep.filter((t) => t.hp > 0);

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
          const g = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, 12);
          g.addColorStop(0, "rgba(255,255,255,1)");
          g.addColorStop(0.35, k.led[0]);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sh.x, sh.y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = k.led[1];
          ctx.fillRect(sh.x - 2, sh.y + 6, 4, 18);
          ctx.globalAlpha = 1;
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const t of s.things) {
          const enemy = t.kind === "bug" || t.kind === "boss";
          if (!enemy) {
            ctx.fillStyle =
              t.kind === "star"
                ? "rgba(250,204,21,.28)"
                : t.kind === "coffee"
                  ? "rgba(249,115,22,.24)"
                  : "rgba(167,139,250,.32)";
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r + 8 + Math.sin(t.wob * 2) * 2, 0, Math.PI * 2);
            ctx.fill();
          }
          if (t.kind === "boss") {
            ctx.fillStyle = "rgba(244,63,94,.18)";
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r + 10, 0, Math.PI * 2);
            ctx.fill();
          }
          if (frozen && enemy) {
            ctx.fillStyle = "rgba(186,230,253,.45)";
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r + 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = t.flash > 0 ? 0.45 : 1;
          ctx.fillStyle = "#000"; // les émojis prennent l'opacité de fillStyle
          ctx.font = `${t.r * 2}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
          ctx.save();
          ctx.translate(t.x, t.y);
          ctx.rotate(Math.sin(t.wob) * (t.kind === "boss" ? 0.12 : 0.25));
          ctx.fillText(t.emoji, 0, 1);
          ctx.restore();
          ctx.globalAlpha = 1;
          if (t.maxHp > 1) {
            const w = t.kind === "boss" ? 64 : 30;
            const y = t.y - t.r - 10;
            ctx.fillStyle = "rgba(15,23,42,.35)";
            ctx.fillRect(t.x - w / 2, y, w, 5);
            ctx.fillStyle = t.kind === "boss" ? "#f43f5e" : "#f59e0b";
            ctx.fillRect(t.x - w / 2, y, (w * Math.max(0, t.hp)) / t.maxHp, 5);
          }
        }
        for (const p of s.sparks) {
          ctx.globalAlpha = Math.max(0, p.life * 1.6);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.font = "800 15px Inter, system-ui, sans-serif";
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
  }, [phase, map, avatar, say, fire, finish]);

  // Clavier : flèches pendant la partie, Échap pour fermer.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = state.current;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (phase !== "play") return;
      if (["ArrowLeft", "a", "A", "q", "Q"].includes(e.key)) s.keys.left = true;
      else if (["ArrowRight", "d", "D"].includes(e.key)) s.keys.right = true;
      else if (e.key === " " || e.key === "ArrowUp") fire(0.12);
      else return;
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
  }, [phase, fire, onClose]);

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

  const dayRank = boards ? liveRank(boards.day.all, score) : null;
  const finalRanks = useMemo(() => {
    if (!boards || phase !== "over" || score <= 0) return null;
    return PERIODS.map((p) => {
      const board = boards[p].all;
      const mine = board.find((e) => e.me);
      return { p, rank: mine ? board.indexOf(mine) + 1 : null };
    });
  }, [boards, phase, score]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Mini-jeu D.I.G.I.P.O.T.E"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{GAME_CSS}</style>
      <div className="flex max-h-[96vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/90 shadow-[0_30px_80px_-20px_rgba(15,23,42,.6)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/80">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <div className="text-[15px] font-bold tracking-wide text-slate-800 dark:text-slate-100">
            Bug Buster{" "}
            <span className="font-medium text-slate-500">
              · {phase === "setup" ? "avec D.I.G.I.P.O.T.E" : `${def.emoji} ${def.name}`}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {phase !== "setup" && (
              <>
                <span className="flex items-center gap-0.5" aria-label={`${lives} vies`}>
                  {Array.from({ length: MAX_LIVES }, (_, i) => (
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
                {combo > 1 && (
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">
                    ×{combo}
                  </span>
                )}
                {phase === "play" && dayRank !== null && (
                  <span className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 sm:flex dark:bg-amber-400/15 dark:text-amber-200">
                    <Trophy className="size-3.5" />
                    {dayRank > BOARD_SIZE ? "hors top 10" : `${rankLabel(dayRank)} du jour`}
                  </span>
                )}
              </>
            )}
            <span className="hidden tabular-nums text-slate-500 md:inline">Ton record {best}</span>
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div
            ref={boxRef}
            className={cn(
              "relative h-[min(64vh,540px)] shrink-0 touch-none select-none overflow-hidden bg-gradient-to-b lg:h-[min(76vh,560px)] lg:flex-1",
              def.card,
            )}
            onPointerMove={(e) => {
              if (phase === "play") state.current.targetX = pointerX(e);
            }}
            onPointerDown={(e) => {
              if (phase !== "play") return;
              state.current.targetX = pointerX(e);
              fire(0.12);
            }}
          >
            <MapBackdrop map={map} />
            {fx.freeze && (
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-sky-200/25" />
            )}
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

            {phase === "play" && (fx.turbo || fx.shield || fx.freeze) && (
              <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
                {fx.turbo && <FxChip>⚡ Turbo</FxChip>}
                {fx.shield && <FxChip>🛡️ Bouclier</FxChip>}
                {fx.freeze && <FxChip>❄️ Gel</FxChip>}
              </div>
            )}

            <div
              ref={robotRef}
              className={cn(
                "absolute left-0 top-0",
                mood === "happy" && "dg-happy",
                mood === "ouch" && "dg-ouch",
                phase === "setup" && "invisible",
              )}
              style={{ width: ROBOT_W, height: ROBOT_H }}
            >
              {talk && phase === "play" && (
                <span className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-md dark:bg-slate-800 dark:text-slate-100">
                  {talk}
                </span>
              )}
              {fx.shield && phase === "play" && (
                <span
                  aria-hidden
                  className="dg-shield absolute -inset-3 rounded-full border-2"
                  style={{ borderColor: skin.glow, boxShadow: `0 0 18px ${skin.glow}` }}
                />
              )}
              <RobotSvg
                skin={avatar}
                className={cn(fx.turbo && "drop-shadow-[0_0_10px_rgba(250,204,21,.9)]")}
              />
            </div>

            {phase === "setup" && (
              <div className="absolute inset-0 overflow-y-auto p-3 sm:p-5">
                <div className="mx-auto w-full max-w-[560px] rounded-3xl border border-white/70 bg-white/85 p-4 shadow-xl backdrop-blur-xl sm:p-5 dark:border-white/10 dark:bg-slate-900/85">
                  <div className="text-center text-lg font-bold text-slate-800 dark:text-slate-100">
                    Bip-boup ! Des bugs envahissent Digicom 🐛
                  </div>
                  <p className="mt-1 text-center text-sm text-slate-600 dark:text-slate-300">
                    {name ? `${name}, choisis` : "Choisis"} ton robot et ta carte. Le robot tire
                    tout seul : déplace-le sous les bugs.
                  </p>

                  <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ton robot
                  </h3>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {GAME_AVATARS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={avatar === id}
                        onClick={() => setAvatar(id)}
                        className={cn(
                          "flex flex-col items-center rounded-2xl border px-1 pb-2 pt-1 transition",
                          avatar === id
                            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/40 dark:bg-emerald-500/10"
                            : "border-slate-200 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/5",
                        )}
                      >
                        <span className="block h-[74px] w-[60px]">
                          <RobotSvg skin={id} />
                        </span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {ROBOT_SKINS[id].name}
                        </span>
                        <span className="hidden text-center text-[10.5px] leading-tight text-slate-500 sm:block">
                          {ROBOT_SKINS[id].tagline}
                        </span>
                      </button>
                    ))}
                  </div>

                  <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    La carte
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {GAME_MAPS.map((id) => {
                      const d = MAPS[id];
                      const dark = id === "nuit";
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={map === id}
                          onClick={() => setMap(id)}
                          className={cn(
                            "rounded-2xl border bg-gradient-to-br p-2.5 text-left transition",
                            d.card,
                            map === id
                              ? "border-emerald-500 ring-2 ring-emerald-500/50"
                              : "border-slate-200 hover:border-slate-300 dark:border-white/10",
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="text-lg">{d.emoji}</span>
                            <span
                              className={cn(
                                "text-sm font-bold",
                                dark ? "text-white" : "text-slate-800",
                              )}
                            >
                              {d.name}
                            </span>
                            <span
                              className={cn(
                                "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                d.level === "Facile" && "bg-emerald-600 text-white",
                                d.level === "Normal" && "bg-amber-500 text-white",
                                d.level === "Expert" && "bg-rose-500 text-white",
                              )}
                            >
                              {d.level}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "mt-1 block text-[11.5px] leading-snug",
                              dark ? "text-indigo-100" : "text-slate-600",
                            )}
                          >
                            {d.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 rounded-2xl bg-slate-100/80 p-2.5 text-[11.5px] leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    ⭐ points · ☕ +1 vie · ⚡ triple bip · 🛡️ bouclier · ❄️ gel · 🔋 méga-bip qui
                    nettoie l'écran. Enchaîne sans te faire toucher pour un combo jusqu'à ×4, et
                    gare aux méga-bugs ! ← → ou souris / doigt pour bouger.
                  </div>

                  <div className="mt-4 flex justify-center">
                    <PlayButton onClick={start} icon={<Play className="size-4" />}>
                      Jouer avec {skin.name}
                    </PlayButton>
                  </div>
                </div>
              </div>
            )}

            {phase === "over" && (
              <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
                <div className="w-full max-w-sm rounded-3xl border border-white/70 bg-white/85 p-5 text-center shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
                  <RobotFace size={56} skin={avatar} className="mx-auto" />
                  <div className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">
                    Bzzt… batterie à plat 🪫
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Score : <strong>{score}</strong> pts
                    {score > 0 && score >= best ? " · nouveau record perso ! 🏆" : ""}
                  </p>
                  {score > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      {saved === "saving" && "Enregistrement au classement…"}
                      {saved === "error" && "Le score n'a pas pu être enregistré au classement."}
                      {saved === "saved" &&
                        finalRanks &&
                        finalRanks
                          .map(({ p, rank }) =>
                            rank
                              ? `${rankLabel(rank)} ${p === "day" ? "du jour" : p === "week" ? "de la semaine" : "du mois"}`
                              : null,
                          )
                          .filter(Boolean)
                          .join(" · ")}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <PlayButton onClick={start} icon={<RotateCcw className="size-4" />}>
                      Rejouer
                    </PlayButton>
                    <button
                      type="button"
                      onClick={() => setPhase("setup")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                    >
                      <ArrowLeft className="size-4" />
                      Robot ou carte
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Leaderboard
            boards={boards}
            period={period}
            setPeriod={setPeriod}
            filter={filter}
            setFilter={setFilter}
          />
        </div>
      </div>
    </div>
  );
}

function PlayButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(5,150,105,.8)] hover:brightness-110"
    >
      {icon}
      {children}
    </button>
  );
}

function FxChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow-sm backdrop-blur">
      {children}
    </span>
  );
}

/** Classements partagés : meilleur score de chaque joueur, mis à jour en continu. */
function Leaderboard({
  boards,
  period,
  setPeriod,
  filter,
  setFilter,
}: {
  boards: Boards | null;
  period: Period;
  setPeriod: (p: Period) => void;
  filter: BoardFilter;
  setFilter: (f: BoardFilter) => void;
}) {
  const list = boards?.[period][filter] ?? [];
  const empty =
    period === "day"
      ? "Personne n'a encore joué aujourd'hui : à toi d'ouvrir le bal !"
      : period === "week"
        ? "Aucun score cette semaine pour l'instant."
        : "Aucun score ce mois-ci pour l'instant.";
  return (
    <aside className="flex shrink-0 flex-col border-t border-slate-200/70 p-3 lg:w-[300px] lg:overflow-y-auto lg:border-l lg:border-t-0 dark:border-white/10">
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-amber-500" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Classements</h3>
        <span className="ml-auto flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600">
          <span className="dg-live size-1.5 rounded-full bg-emerald-500" />
          en direct
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 rounded-full bg-slate-100 p-0.5 text-xs font-semibold dark:bg-white/5">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-full py-1.5 transition",
              period === p
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(["all", ...GAME_MAPS] as BoardFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            title={f === "all" ? "Toutes les cartes" : MAPS[f].name}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11.5px] font-semibold transition",
              filter === f
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300",
            )}
          >
            {f === "all" ? "Toutes" : `${MAPS[f].emoji} ${MAPS[f].name}`}
          </button>
        ))}
      </div>
      <ol className="mt-3 space-y-1">
        {!boards && <li className="py-6 text-center text-xs text-slate-500">Chargement…</li>}
        {boards && list.length === 0 && (
          <li className="py-6 text-center text-xs leading-relaxed text-slate-500">{empty}</li>
        )}
        {list.map((e, i) => (
          <li
            key={`${e.name}-${e.at}`}
            className={cn(
              "flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm",
              e.me
                ? "bg-emerald-50 ring-1 ring-emerald-400/60 dark:bg-emerald-500/10"
                : "bg-white/60 dark:bg-white/5",
            )}
          >
            <span className="w-6 text-center text-xs font-bold tabular-nums text-slate-500">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <RobotFace size={22} skin={e.avatar} />
            <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
              {e.name}
              {e.me && <span className="text-emerald-700 dark:text-emerald-300"> (toi)</span>}
            </span>
            <span title={MAPS[e.map].name}>{MAPS[e.map].emoji}</span>
            <span className="w-12 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {e.score}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">
        Meilleur score de chaque joueur (heure de Paris). Chaque partie est enregistrée à ton nom
        Digicom.
      </p>
    </aside>
  );
}

/** Décor de chaque carte (derrière le terrain de jeu). */
function MapBackdrop({ map }: { map: GameMapId }) {
  if (map === "solaire")
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="dg-sun absolute right-[8%] top-[7%] size-24 rounded-full bg-[radial-gradient(circle_at_40%_40%,#fff7d6,#fde047_45%,#f59e0b)] shadow-[0_0_70px_20px_rgba(253,224,71,.55)]" />
        <svg
          className="absolute bottom-0 left-0 h-[90px] w-full opacity-60"
          preserveAspectRatio="none"
          viewBox="0 0 400 90"
        >
          <defs>
            <pattern id="dg-panels" width="40" height="90" patternUnits="userSpaceOnUse">
              <path d="M6 30h30l-4 56H2z" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="1" />
              <path d="M19 30l-2 56M4 58h30" stroke="#60a5fa" strokeWidth=".7" />
            </pattern>
          </defs>
          <rect width="400" height="90" fill="url(#dg-panels)" />
        </svg>
      </div>
    );
  if (map === "eolien")
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {[
          { left: "8%", h: 230, d: "3.2s" },
          { left: "46%", h: 170, d: "2.6s" },
          { left: "76%", h: 260, d: "3.8s" },
        ].map((t) => (
          <svg
            key={t.left}
            className="absolute bottom-6 opacity-70"
            style={{ left: t.left, height: t.h, width: t.h / 2 }}
            viewBox="0 0 100 200"
          >
            <path d="M47 50h6l3 150H44z" fill="#f8fafc" stroke="#cbd5e1" />
            <g className="dg-turbine" style={{ animationDuration: t.d }}>
              {[0, 120, 240].map((a) => (
                <path
                  key={a}
                  d="M50 50c-4-8-3-38 0-46 3 8 4 38 0 46z"
                  fill="#ffffff"
                  stroke="#cbd5e1"
                  transform={`rotate(${a} 50 50)`}
                />
              ))}
            </g>
            <circle cx="50" cy="50" r="4" fill="#e2e8f0" stroke="#94a3b8" />
          </svg>
        ))}
        <svg
          className="absolute bottom-0 left-0 h-[70px] w-full"
          preserveAspectRatio="none"
          viewBox="0 0 400 70"
        >
          <path d="M0 40C80 10 150 50 220 30S350 20 400 35V70H0z" fill="#86efac" opacity=".7" />
          <path d="M0 55C90 35 170 65 260 48S360 45 400 52V70H0z" fill="#4ade80" opacity=".6" />
        </svg>
      </div>
    );
  if (map === "nuit")
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STARS.map(([x, y, s, d], i) => (
          <span
            key={i}
            className="dg-twinkle absolute rounded-full bg-white"
            style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${d}s` }}
          />
        ))}
        <div className="absolute left-[7%] top-[8%] size-16 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fefce8,#e0e7ff_60%,#a5b4fc)] shadow-[0_0_50px_10px_rgba(199,210,254,.35)]" />
        <svg
          className="absolute bottom-0 left-0 h-[110px] w-full"
          preserveAspectRatio="none"
          viewBox="0 0 400 110"
        >
          <path
            d="M0 110V70h40V50h30v20h30V35h12v35h40V60h50V40h14v30h50V55h40v15h50V45h44v65z"
            fill="#0f172a"
          />
          {[
            [48, 58],
            [58, 74],
            [108, 46],
            [150, 66],
            [168, 80],
            [205, 52],
            [262, 64],
            [312, 52],
            [360, 72],
            [372, 56],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="5" height="4" fill="#fde68a" opacity=".85" />
          ))}
        </svg>
      </div>
    );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(14,116,144,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(14,116,144,.07)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute -left-16 top-10 size-56 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="absolute -right-10 bottom-16 size-56 rounded-full bg-violet-300/30 blur-3xl" />
    </div>
  );
}

// Étoiles du ciel de nuit (positions fixes : x %, y %, taille px, délai s).
const STARS: [number, number, number, number][] = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  return [r(1) * 100, r(2) * 70, 1 + Math.round(r(3) * 2), Math.round(r(4) * 30) / 10];
});

const GAME_CSS = `
  .dg-turbine { transform-box: view-box; transform-origin: 50px 50px; animation: dg-spin 3s linear infinite; }
  .dg-sun { animation: dg-pulse 4s ease-in-out infinite; }
  .dg-twinkle { animation: dg-pulse 2.6s ease-in-out infinite; }
  .dg-live { animation: dg-pulse 1.4s ease-in-out infinite; }
  .dg-shield { animation: dg-pulse 1.2s ease-in-out infinite; }
  @keyframes dg-spin { to { transform: rotate(360deg) } }
  @media (prefers-reduced-motion: reduce) {
    .dg-turbine, .dg-sun, .dg-twinkle, .dg-live, .dg-shield { animation: none }
  }
`;
