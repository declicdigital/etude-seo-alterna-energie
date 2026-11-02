import { describe, expect, it } from "vitest";
import { ALL_SECTION_KEYS, grantedSections, serializeSections, sheetAllowed } from "@/lib/sections";

const CALENDAR = "NEWSLETTER GRANDS COMPTES";

describe("section access", () => {
  it("keeps Benchmark and the newsletter calendar for lists saved before they existed", () => {
    const legacy = ["Blog", "Blog/Particulier"];
    expect(sheetAllowed("BENCHMARK", legacy)).toBe(true);
    expect(sheetAllowed(CALENDAR, legacy)).toBe(true);
    // Original sections still follow "absent = refused".
    expect(sheetAllowed("STRATEGIE - ARTICLES", legacy)).toBe(false);
  });

  it("honours an explicit refusal of a newer section", () => {
    const granted = grantedSections(["Blog"]);
    granted.delete("Benchmark");
    granted.delete("Calendriers newsletters/Grands Comptes");
    const stored = serializeSections(granted);
    expect(sheetAllowed("BENCHMARK", stored)).toBe(false);
    expect(sheetAllowed(CALENDAR, stored)).toBe(false);
    expect(grantedSections(stored).has("Calendriers newsletters")).toBe(true);
  });

  it("closes a calendar when its whole category is refused", () => {
    const granted = new Set(ALL_SECTION_KEYS);
    granted.delete("Calendriers newsletters");
    expect(sheetAllowed(CALENDAR, serializeSections(granted))).toBe(false);
  });

  it("round-trips through the stored form", () => {
    const granted = new Set(["Blog", "Blog/Professionnel", "Benchmark"]);
    expect(grantedSections(serializeSections(granted))).toEqual(granted);
    expect(grantedSections(serializeSections(new Set()))).toEqual(new Set());
  });

  it("gives everything when no list is set", () => {
    expect(grantedSections(null)).toEqual(new Set(ALL_SECTION_KEYS));
    expect(sheetAllowed("BENCHMARK", null)).toBe(true);
  });
});
