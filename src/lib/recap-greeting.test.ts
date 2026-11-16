import { describe, expect, it } from "vitest";
import { newYearGreeting } from "./recap-greeting";

describe("newYearGreeting", () => {
  it("only greets in the recap of December", () => {
    expect(newYearGreeting("2026-11", 40)).toBeNull();
    const g = newYearGreeting("2026-12", 42)!;
    expect(g.title).toBe("🎉 Bonne année 2027 !");
    expect(g.lines[1]).toContain("en 2026 : 42 articles publiés sur le blog sur toute l'année");
    expect(g.closing).toContain("Que 2027 soit");
  });
  it("handles a single article", () => {
    expect(newYearGreeting("2026-12", 1)!.lines[1]).toContain("1 article publié sur le blog");
  });
});
