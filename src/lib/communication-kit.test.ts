import { describe, expect, it } from "vitest";
import { kitResources } from "./communication-kit";
import { kitColors } from "@/components/communication-kit-view";

describe("communication kit", () => {
  it("includes all eight supplied files and six individual SVG variants", () => {
    expect(kitResources.filter(r => r.key.startsWith("resource-"))).toHaveLength(8);
    expect(kitResources.filter(r => r.group === "variants")).toHaveLength(6);
    expect(kitResources.filter(r => r.group === "complete")).toHaveLength(1);
    expect(kitResources.every(r => r.url.startsWith("/__l5e/assets-v1/"))).toBe(true);
  });
  for (const [name, hex] of [["Green renouvelable", "#003838"], ["Green énergie", "#54D89C"], ["Solaire", "#E1EC64"], ["Hydraulique", "#639AFF"], ["Beige / Blanc cassé", "#FFFBF4"]]) {
    it(`uses the supplied ${name} color`, () => {
      expect(kitColors.find(c => c.name === name)?.hex).toBe(hex);
    });
  }
});