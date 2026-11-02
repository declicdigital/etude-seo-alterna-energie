import { describe, expect, it } from "vitest";
import {
  B2C,
  B2C_CADENCE,
  GRANDS_COMPTES,
  GRANDS_COMPTES_CADENCE,
  INTERNE,
  INTERNE_CADENCE,
  generateNewsletters,
  isPublicHoliday,
  isWorkingDay,
  NEWSLETTER_CALENDARS,
  daysUntil,
  isWeekend,
  newsletterState,
  nextSend,
  relativeDay,
  stepFlow,
  stepStates,
  toICalendar,
  toSpreadsheetText,
  upcomingDeadlines,
  type NewsletterCalendar,
} from "@/lib/newsletter-calendar";
import { sheetAllowed } from "@/lib/sections";

const byId = (cal: NewsletterCalendar, id: string) => cal.newsletters.find((n) => n.id === id)!;
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe("newsletter calendars", () => {
  it.each(NEWSLETTER_CALENDARS)("$title: one date per step, in order, known actors", (cal) => {
    for (const n of cal.newsletters) {
      expect(n.dates).toHaveLength(cal.steps.length);
      expect([...n.dates].sort()).toEqual(n.dates);
    }
    for (const s of cal.steps) {
      expect(cal.actors[s.from]).toBeDefined();
      if (s.to) expect(cal.actors[s.to]).toBeDefined();
    }
    for (const t of cal.team) expect(cal.steps[t.step]).toBeDefined();
  });

  it("counts whole days regardless of the time of day", () => {
    expect(daysUntil("2026-11-05", day(2026, 11, 2, 23))).toBe(3);
    expect(daysUntil("2026-11-02", day(2026, 11, 2, 0))).toBe(0);
    expect(relativeDay("2026-11-03", day(2026, 11, 2))).toBe("Demain");
  });

  it("marks past steps done, today's step, and the next one as upcoming", () => {
    const today = day(2026, 11, 2);
    expect(stepStates(byId(GRANDS_COMPTES, "2026-11"), today)).toEqual([
      "done",
      "done",
      "done",
      "today",
      "upcoming",
      "upcoming",
    ]);
    expect(newsletterState(byId(GRANDS_COMPTES, "2026-11"), today)).toBe("active");
    expect(newsletterState(byId(GRANDS_COMPTES, "2026-10"), today)).toBe("sent");
    expect(newsletterState(byId(GRANDS_COMPTES, "2026-12"), today)).toBe("upcoming");
  });

  it("points at the current step between two deadlines", () => {
    expect(stepStates(byId(GRANDS_COMPTES, "2026-11"), day(2026, 10, 25))).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("lists the next deadlines across overlapping newsletters", () => {
    const next = upcomingDeadlines(GRANDS_COMPTES, day(2026, 11, 2)).slice(0, 4);
    expect(next.map((d) => `${d.newsletter.id} ${d.step.key} ${d.days}`)).toEqual([
      "2026-11 relecture 0",
      "2026-11 bat 1",
      "2026-11 envoi 3",
      "2026-12 proposition 16",
    ]);
    expect(nextSend(GRANDS_COMPTES, day(2026, 11, 2))?.id).toBe("2026-11");
    expect(nextSend(GRANDS_COMPTES, day(2026, 12, 4))?.id).toBe("2027-01");
    expect(nextSend(GRANDS_COMPTES, day(2027, 12, 10))).toBeNull();
  });

  it("follows the internal newsletter's quarterly cycle", () => {
    const today = day(2026, 11, 2);
    expect(nextSend(INTERNE, today)?.id).toBe("2026-11");
    expect(newsletterState(byId(INTERNE, "2026-11"), today)).toBe("upcoming");
    expect(newsletterState(byId(INTERNE, "2026-08"), today)).toBe("sent");
    expect(upcomingDeadlines(INTERNE, today)[0]).toMatchObject({ date: "2026-11-06", days: 4 });
  });

  it("describes who hands over to whom", () => {
    expect(stepFlow(INTERNE, INTERNE.steps[3])).toBe("Communication → Géraldine");
    expect(stepFlow(INTERNE, INTERNE.steps[1])).toBe("Communication");
    expect(stepFlow(GRANDS_COMPTES, GRANDS_COMPTES.steps[3], true)).toBe("B2B → Comm.");
  });

  it("flags weekend deadlines", () => {
    expect(isWeekend("2026-04-04")).toBe(true);
    expect(isWeekend("2026-11-02")).toBe(false);
  });

  it("exports to Excel and to calendar apps", () => {
    const tsv = toSpreadsheetText(INTERNE).split("\n");
    expect(tsv).toHaveLength(INTERNE.newsletters.length + 1);
    expect(tsv[1].split("\t")[0]).toBe("Février 2026");
    const ics = toICalendar(GRANDS_COMPTES);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(
      GRANDS_COMPTES.newsletters.length * GRANDS_COMPTES.steps.length,
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261105\r\nDTEND;VALUE=DATE:20261106");
    expect(toICalendar(INTERNE)).toContain("UID:newsletter-interne-2026-11-bat-final@digicom");
  });

  it("keeps access to the internal calendar for existing accounts unless refused", () => {
    expect(sheetAllowed("NEWSLETTER INTERNE", ["Blog"])).toBe(true);
    expect(sheetAllowed("NEWSLETTER INTERNE", ["Blog", "!Calendriers newsletters/Interne"])).toBe(
      false,
    );
    expect(
      sheetAllowed("NEWSLETTER GRANDS COMPTES", ["Blog", "!Calendriers newsletters/Interne"]),
    ).toBe(true);
  });

  describe("2027, generated from the cadences", () => {
    const of2027 = (cal: NewsletterCalendar) => cal.newsletters.filter((n) => n.year === 2027);

    it("continues every month for Grands Comptes and every quarter for Interne", () => {
      expect(of2027(GRANDS_COMPTES).map((n) => n.month)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);
      expect(of2027(INTERNE).map((n) => n.month)).toEqual([2, 5, 8, 11]);
      expect(of2027(B2C).map((n) => n.month)).toEqual([1, 4, 7, 10]);
    });

    it.each(NEWSLETTER_CALENDARS)("$title: only working days, steps in order", (cal) => {
      for (const n of of2027(cal)) {
        for (const d of n.dates) expect(isWorkingDay(d), `${n.id} ${d}`).toBe(true);
        expect([...n.dates].sort()).toEqual(n.dates);
      }
    });

    it("uses the same rules that produced the 2026 plan", () => {
      // Interne: every 2026 date, including the 8 May and 11 Nov shifts.
      expect(generateNewsletters(INTERNE_CADENCE, 2026, [2, 5, 8, 11]).map((n) => n.dates)).toEqual(
        INTERNE.newsletters.filter((n) => n.year === 2026).map((n) => n.dates),
      );
      // Grands Comptes: the regular 2026 months.
      for (const month of [6, 8, 10, 11]) {
        const [n] = generateNewsletters(GRANDS_COMPTES_CADENCE, 2026, [month]);
        expect(n.dates).toEqual(byId(GRANDS_COMPTES, n.id).dates);
      }
    });

    it("moves deadlines off public holidays", () => {
      expect(isPublicHoliday("2027-05-06")).toBe(true); // Ascension
      expect(isPublicHoliday("2027-05-17")).toBe(true); // Lundi de Pentecôte
      expect(isPublicHoliday("2027-03-29")).toBe(true); // Lundi de Pâques
      expect(isPublicHoliday("2027-05-05")).toBe(false);
      expect(byId(GRANDS_COMPTES, "2027-05").dates.at(-1)).toBe("2027-05-05");
      expect(byId(GRANDS_COMPTES, "2027-11").dates[3]).toBe("2027-10-29");
      expect(byId(INTERNE, "2027-05").dates.at(-1)).toBe("2027-05-14");
    });
  });

  describe("B2C", () => {
    it("generates 2027 with the rhythm of April, July and October 2026", () => {
      for (const month of [4, 7, 10]) {
        const [n] = generateNewsletters(B2C_CADENCE, 2026, [month]);
        expect(n.dates).toEqual(byId(B2C, n.id).dates);
      }
      expect(of2027B2C()).toEqual([
        ["2027-01-13", "2027-01-18", "2027-01-21"],
        ["2027-04-07", "2027-04-12", "2027-04-15"],
        ["2027-07-07", "2027-07-12", "2027-07-15"],
        ["2027-10-13", "2027-10-18", "2027-10-21"],
      ]);
    });

    it("shows writing as an in-team step and is open by default", () => {
      expect(stepFlow(B2C, B2C.steps[0])).toBe("Communication");
      expect(stepFlow(B2C, B2C.steps[1])).toBe("Communication → B2C");
      expect(sheetAllowed("NEWSLETTER B2C", ["Blog"])).toBe(true);
      expect(sheetAllowed("NEWSLETTER B2C", ["Blog", "!Calendriers newsletters/B2C"])).toBe(false);
    });
  });
});

function of2027B2C() {
  return B2C.newsletters.filter((n) => n.year === 2027).map((n) => n.dates);
}
