import { describe, expect, it } from "vitest";
import { RECAP_FIXED_CC, recapCc } from "./monthly-recap-cc";

describe("recapCc", () => {
  it("always copies Christophe and Géraldine", () => {
    expect(RECAP_FIXED_CC).toEqual([
      "christophe.castel@alterna-energie.fr",
      "geraldine.deiber@alterna-energie.fr",
    ]);
    expect(recapCc(["geoffrey.delabarre@alterna-energie.fr"])).toEqual([
      "christophe.castel@alterna-energie.fr",
      "geraldine.deiber@alterna-energie.fr",
    ]);
  });

  it("does not copy someone who already receives the recap directly", () => {
    expect(recapCc(["Christophe.Castel@alterna-energie.fr", "geoffrey.delabarre@alterna-energie.fr"])).toEqual([
      "geraldine.deiber@alterna-energie.fr",
    ]);
  });

  it("keeps extra test copies without duplicating the fixed ones", () => {
    expect(
      recapCc(["geoffrey.delabarre@alterna-energie.fr"], ["test@example.org", RECAP_FIXED_CC[0]]),
    ).toEqual(["christophe.castel@alterna-energie.fr", "geraldine.deiber@alterna-energie.fr", "test@example.org"]);
  });
});
