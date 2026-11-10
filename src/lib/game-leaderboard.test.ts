import { describe, expect, it } from "vitest";
import {
  buildBoards,
  earliestStart,
  liveRank,
  periodStarts,
  plausibleScore,
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
    expect(boards.day.all.map((e) => [e.name, e.score])).toEqual([
      ["b", 200],
      ["a", 120],
    ]);
    expect(boards.week.all.map((e) => [e.name, e.score])).toEqual([
      ["a", 300],
      ["b", 200],
    ]);
    expect(boards.month.all.map((e) => e.name)).toEqual(["c", "a", "b"]);
  });

  it("filtre par carte et marque la personne connectée", () => {
    expect(boards.week.nuit).toEqual([
      expect.objectContaining({ name: "a", score: 300, map: "nuit", me: true }),
    ]);
    expect(boards.day.solaire[0]).toMatchObject({ name: "b", me: false });
    expect(boards.month.eolien).toEqual([]);
  });

  it("place en direct", () => {
    expect(liveRank(boards.day.all, 0)).toBe(2);
    expect(liveRank(boards.day.all, 250)).toBe(1);
    expect(liveRank(boards.month.all, 100)).toBe(2);
  });
});

it("plausibleScore", () => {
  expect(plausibleScore(1200, 60)).toBe(true);
  expect(plausibleScore(999999, 10)).toBe(false);
  expect(plausibleScore(-5, 10)).toBe(false);
});
