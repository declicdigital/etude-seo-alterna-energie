import { describe, expect, it } from "vitest";
import { brevoRecipients, isPilot, routeMailRecipients } from "./digicom-team";

describe("pilotes Digicom", () => {
  it("Geoffrey et Matthieu admins sont pilotes, insensible à la casse", () => {
    expect(isPilot(true, "geoffrey.delabarre@alterna-energie.fr")).toBe(true);
    expect(isPilot(true, "MATTHIEU.ROUX@alterna-energie.fr")).toBe(true);
    expect(isPilot(false, "matthieu.roux@alterna-energie.fr")).toBe(false);
    expect(isPilot(true, "charlotte.places@alterna-energie.fr")).toBe(false);
  });
});

describe("Geoffrey ne reçoit plus aucun mail", () => {
  it("remplace ses deux adresses par Matthieu, en destinataire comme en copie", () => {
    const r = routeMailRecipients(["Geoffrey.Delabarre@alterna-energie.fr", "a@x.fr"], ["geoffrey.delabarre@gmail.com"]);
    expect(r.to).toEqual(["matthieu.roux@alterna-energie.fr", "a@x.fr"]);
    expect(r.cc).toEqual([]);
  });
  it("ne met pas Matthieu en copie s'il est déjà destinataire", () => {
    expect(brevoRecipients(["matthieu.roux@alterna-energie.fr"], ["matthieu.roux@alterna-energie.fr"])).toEqual({
      to: [{ email: "matthieu.roux@alterna-energie.fr" }],
    });
  });
  it("met Matthieu en copie des autres envois", () => {
    expect(brevoRecipients(["a@x.fr"], ["matthieu.roux@alterna-energie.fr"]).cc).toEqual([{ email: "matthieu.roux@alterna-energie.fr" }]);
  });
});
