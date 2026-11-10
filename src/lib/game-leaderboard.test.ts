import { describe, expect, it } from "vitest";
import {
  buildBoards,
  difficultyAt,
  earliestStart,
  formatClock,
  formatDuration,
  liveRank,
  periodStarts,
  pickDuoPair,
  plausibleScore,
  type LobbyPeer,
  type ScoreRow,
} from "./game-leaderboard";

const row = (p: Partial<ScoreRow> & { user_id: string; score: number; created_at: string }) =>
  ({ player_name: p.user_id, avatar: "digi", map: "bureau", ...p }) as ScoreRow;

describe("periodStarts (heure de Paris)", () => {
  it("hiver : minuit de Paris = 23 h UTC la veille, semaine au lundi", () => {
    // mercredi 11 novembre 2026, 10 h à Paris
    const s = periodStarts(new Date("2026-11-11T09:00:00Z"));
    expect(s.day.toISOString()).toBe("2026-11-10T23:00:00.000Z");
    expect(s.week.toISOString()).toBe("2026-11-08T23:00:00.000Z");
    expect(s.month.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("été : minuit de Paris = 22 h UTC", () => {
    const s = periodStarts(new Date("2026-07-15T12:00:00Z"));
    expect(s.day.toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(s.month.toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("juste après minuit à Paris, on est déjà le lendemain", () => {
    const s = periodStarts(new Date("2026-11-10T23:30:00Z"));
    expect(s.day.toISOString()).toBe("2026-11-10T23:00:00.000Z");
  });

  it("la semaine peut commencer le mois précédent", () => {
    const now = new Date("2026-12-02T10:00:00Z"); // mercredi 2 décembre
    expect(earliestStart(now).toISOString()).toBe("2026-11-29T23:00:00.000Z");
  });
});

describe("buildBoards", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  const rows = [
    row({ user_id: "a", score: 120, created_at: "2026-11-11T08:00:00Z" }),
    row({ user_id: "a", score: 300, created_at: "2026-11-09T08:00:00Z", map: "nuit" }),
    row({ user_id: "b", score: 200, created_at: "2026-11-11T09:00:00Z", map: "solaire" }),
    row({ user_id: "c", score: 500, created_at: "2026-11-02T09:00:00Z" }),
    row({ user_id: "d", score: 900, created_at: "2026-10-20T09:00:00Z" }),
  ];
  const boards = buildBoards(rows, now, "a");

  it("un seul record par personne et par période", () => {
    expect(boards.solo.day.all.map((e) => [e.name, e.score])).toEqual([
      ["b", 200],
      ["a", 120],
    ]);
    expect(boards.solo.week.all.map((e) => [e.name, e.score])).toEqual([
      ["a", 300],
      ["b", 200],
    ]);
    expect(boards.solo.month.all.map((e) => e.name)).toEqual(["c", "a", "b"]);
  });

  it("filtre par carte et marque la personne connectée", () => {
    expect(boards.solo.week.nuit).toEqual([
      expect.objectContaining({ name: "a", score: 300, map: "nuit", me: true }),
    ]);
    expect(boards.solo.day.solaire[0]).toMatchObject({ name: "b", me: false });
    expect(boards.solo.month.eolien).toEqual([]);
  });

  it("place en direct", () => {
    expect(liveRank(boards.solo.day.all, 0)).toBe(2);
    expect(liveRank(boards.solo.day.all, 250)).toBe(1);
    expect(liveRank(boards.solo.month.all, 100)).toBe(2);
  });
});

it("plausibleScore", () => {
  expect(plausibleScore(1200, 60)).toBe(true);
  expect(plausibleScore(999999, 10)).toBe(false);
  expect(plausibleScore(-5, 10)).toBe(false);
});

describe("difficultyAt", () => {
  it("accélère progressivement puis plafonne", () => {
    const d = [0, 30, 60, 120, 180, 400].map((t) => difficultyAt(t));
    for (let i = 1; i < d.length; i++) {
      expect(d[i].speed).toBeGreaterThan(d[i - 1].speed - 1e-9);
      expect(d[i].spawnGap).toBeLessThanOrEqual(d[i - 1].spawnGap);
    }
    expect(d[0]).toEqual({ speed: 1, spawnGap: 1.15, stage: 1 });
    expect(d[2].speed).toBeCloseTo(1.55, 2);
    expect(d[3].speed).toBeCloseTo(2.09, 2);
    expect(d[5].speed).toBe(2.8);
    expect(d[5].spawnGap).toBe(0.36);
    expect(d[2].stage).toBe(3);
  });
});

describe("temps de jeu", () => {
  it("compteur", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65.9)).toBe("01:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });
  it("en toutes lettres", () => {
    expect(formatDuration(1)).toBe("1 seconde");
    expect(formatDuration(45)).toBe("45 secondes");
    expect(formatDuration(60)).toBe("1 minute");
    expect(formatDuration(61)).toBe("1 minute et 1 seconde");
    expect(formatDuration(192)).toBe("3 minutes et 12 secondes");
  });
});

describe("mode duo", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  it("classement par binôme, séparé du solo", () => {
    const rows: ScoreRow[] = [
      row({ user_id: "a", score: 100, created_at: "2026-11-11T08:00:00Z" }),
      row({
        user_id: "a",
        partner_id: "b",
        partner_name: "b",
        partner_avatar: "volt",
        mode: "duo",
        score: 400,
        created_at: "2026-11-11T09:00:00Z",
      }),
      row({
        user_id: "b",
        partner_id: "a",
        partner_name: "a",
        mode: "duo",
        score: 600,
        created_at: "2026-11-11T10:00:00Z",
      }),
      row({
        user_id: "c",
        partner_id: "d",
        partner_name: "d",
        mode: "duo",
        score: 500,
        created_at: "2026-11-11T10:30:00Z",
      }),
    ];
    const boards = buildBoards(rows, now, "a");
    expect(boards.solo.day.all.map((e) => e.score)).toEqual([100]);
    expect(boards.duo.day.all.map((e) => [e.name, e.score, e.me])).toEqual([
      ["b & a", 600, true],
      ["c & d", 500, false],
    ]);
  });

  it("apparie les deux personnes qui attendent depuis le plus longtemps", () => {
    const p = (userId: string, since: number, status: LobbyPeer["status"] = "waiting") =>
      ({ userId, name: userId, avatar: "digi", map: "bureau", status, since }) as LobbyPeer;
    const peers = [p("zed", 30), p("bob", 10), p("amy", 20), p("idle", 1, "idle")];
    const forBob = pickDuoPair(peers, "bob");
    const forAmy = pickDuoPair(peers, "amy");
    expect(forBob).toMatchObject({ host: true, partner: { userId: "amy" } });
    expect(forAmy).toMatchObject({ host: false, partner: { userId: "bob" } });
    expect(forBob?.room).toBe(forAmy?.room);
    expect(pickDuoPair(peers, "zed")).toBeNull();
    expect(pickDuoPair([p("bob", 10)], "bob")).toBeNull();
  });

  it("score plausible doublé en duo", () => {
    expect(plausibleScore(40000, 60)).toBe(false);
    expect(plausibleScore(40000, 60, "duo")).toBe(true);
  });
});
