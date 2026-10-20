import { describe, expect, it } from "vitest";
import { kitResources } from "./communication-kit";
import { kitColors } from "@/components/communication-kit-view";

describe("communication kit", () => {
  it("includes all nine supplied files and six individual SVG variants", () => {
    expect(kitResources.filter(r => r.key.startsWith("resource-"))).toHaveLength(9);
    expect(kitResources.filter(r => r.group === "variants")).toHaveLength(6);
    expect(kitResources.filter(r => r.group === "complete")).toHaveLength(1);
    expect(kitResources.every(r => r.url.startsWith("/__l5e/assets-v1/"))).toBe(true);
  });
  it("lists the brand guidelines PDF under its own name", () => {
    const pdf = kitResources.find(r => r.filename === "Brand-Guidelines-Alterna-Energie.pdf");
    expect(pdf?.group).toBe("documents");
    expect(pdf?.size).toBe(20440764);
  });
  it("does not date the charte graphique title", () => {
    const charte = kitResources.find(r => r.filename === "12.24_-_Charte_graphique_Alterna_énergie.pdf");
    expect(charte?.title).toBe("Charte graphique");
  });
  for (const [name, hex] of [["Green renouvelable", "#003838"], ["Green énergie", "#54D89C"], ["Solaire", "#E1EC64"], ["Hydraulique", "#639AFF"], ["Beige / Blanc cassé", "#FFFBF4"]]) {
    it(`uses the supplied ${name} color`, () => {
      expect(kitColors.find(c => c.name === name)?.hex).toBe(hex);
    });
  }
});