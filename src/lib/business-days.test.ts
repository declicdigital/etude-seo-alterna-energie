import { describe, expect, it } from "vitest";
import { firstBusinessDay, frenchHolidays, isBusinessDay, parisToday } from "./business-days";

describe("jours ouvrés", () => {
  it("connaît les fériés mobiles", () => {
    const h = frenchHolidays(2027);
    expect(h.has("2027-03-29")).toBe(true); // lundi de Pâques 2027
    expect(h.has("2027-05-06")).toBe(true); // Ascension 2027
    expect(h.has("2027-05-17")).toBe(true); // lundi de Pentecôte 2027
  });
  it("écarte week-ends et fériés", () => {
    expect(isBusinessDay("2026-11-02")).toBe(true);
    expect(isBusinessDay("2026-11-01")).toBe(false); // dimanche + Toussaint
    expect(isBusinessDay("2026-11-11")).toBe(false); // Armistice
  });
  it("donne le premier jour ouvré du mois", () => {
    expect(firstBusinessDay("2026-11")).toBe("2026-11-02"); // dimanche 1er férié → lundi 2
    expect(firstBusinessDay("2026-12")).toBe("2026-12-01"); // mardi
    expect(firstBusinessDay("2027-01")).toBe("2027-01-04"); // ven. 1er férié, week-end → lundi 4
    expect(firstBusinessDay("2027-05")).toBe("2027-05-03"); // sam. 1er mai → lundi 3
    expect(firstBusinessDay("2026-08")).toBe("2026-08-03"); // sam. 1er → lundi 3
  });
  it("lit la date de Paris", () => {
    expect(parisToday(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12-01");
  });
});
