import { describe, expect, it } from "vitest";
import {
  NEWSLETTERS,
  STEPS,
  daysUntil,
  isWeekend,
  newsletterState,
  nextSend,
  relativeDay,
  stepStates,
  toICalendar,
  toSpreadsheetText,
  upcomingDeadlines,
} from "@/lib/newsletter-calendar";

const byId = (id: string) => NEWSLETTERS.find((n) => n.id === id)!;
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe("newsletter calendar", () => {
  it("has six dated steps per newsletter, in order", () => {
    for (const n of NEWSLETTERS) {
      expect(n.dates).toHaveLength(STEPS.length);
      expect([...n.dates].sort()).toEqual(n.dates);
    }
  });

  it("counts whole days regardless of the time of day", () => {
    expect(daysUntil("2026-11-05", day(2026, 11, 2, 23))).toBe(3);
    expect(daysUntil("2026-11-02", day(2026, 11, 2, 0))).toBe(0);
    expect(relativeDay("2026-11-03", day(2026, 11, 2))).toBe("Demain");
  });

  it("marks past steps done, today's step, and the next one as upcoming", () => {
    const today = day(2026, 11, 2);
    expect(stepStates(byId("2026-11"), today)).toEqual([
      "done",
      "done",
      "done",
      "today",
      "upcoming",
      "upcoming",
    ]);
    expect(newsletterState(byId("2026-11"), today)).toBe("active");
    expect(newsletterState(byId("2026-10"), today)).toBe("sent");
    expect(newsletterState(byId("2026-12"), today)).toBe("upcoming");
  });

  it("points at the current step between two deadlines", () => {
    expect(stepStates(byId("2026-11"), day(2026, 10, 25))).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("lists the next deadlines across overlapping newsletters", () => {
    const next = upcomingDeadlines(day(2026, 11, 2)).slice(0, 4);
    expect(next.map((d) => `${d.newsletter.id} ${d.step.key} ${d.days}`)).toEqual([
      "2026-11 relecture 0",
      "2026-11 bat 1",
      "2026-11 envoi 3",
      "2026-12 proposition 16",
    ]);
    expect(nextSend(day(2026, 11, 2))?.id).toBe("2026-11");
    expect(nextSend(day(2026, 12, 4))).toBeNull();
  });

  it("flags weekend deadlines", () => {
    expect(isWeekend("2026-04-04")).toBe(true);
    expect(isWeekend("2026-11-02")).toBe(false);
  });

  it("exports to Excel and to calendar apps", () => {
    const tsv = toSpreadsheetText().split("\n");
    expect(tsv).toHaveLength(NEWSLETTERS.length + 1);
    expect(tsv[1].split("\t")[0]).toBe("Mars 2026");
    const ics = toICalendar();
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(NEWSLETTERS.length * STEPS.length);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261105\r\nDTEND;VALUE=DATE:20261106");
  });
});
