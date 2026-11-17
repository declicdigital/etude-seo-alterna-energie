import { describe, expect, it } from "vitest";
import { toWebp, webpName } from "./webp";

describe("WebP", () => {
  it("renomme en .webp", () => {
    expect(webpName("Visuel PAC 1500x700.PNG")).toBe("Visuel PAC 1500x700.webp");
    expect(webpName("photo.jpeg")).toBe("photo.webp");
    expect(webpName("sans-extension")).toBe("sans-extension.webp");
  });
  it("laisse passer GIF, SVG, PDF et WebP sans conversion", async () => {
    for (const type of ["image/gif", "image/svg+xml", "application/pdf", "image/webp"]) {
      const f = new File(["x"], "f", { type });
      expect(await toWebp(f)).toBe(f);
    }
  });
});
