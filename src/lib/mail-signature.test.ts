import { describe, expect, it } from "vitest";
import { signHtml, signText } from "./mail-signature";
import { editorialMailHtml } from "./mail-layout";

describe("signature Digipote", () => {
  it("signs before the grey footer, once", () => {
    const html = editorialMailHtml({ heading: "Digicom · Blog", introHtml: "Bonjour", fields: [], cta: { label: "Ouvrir", url: "https://digicom.life" } });
    const signed = signHtml(html);
    expect(signed.indexOf("<strong>D.I.G.I.P.O.T.E</strong>")).toBeGreaterThan(0);
    expect(signed.indexOf("<strong>D.I.G.I.P.O.T.E</strong>")).toBeLessThan(signed.indexOf("Notification automatique de Digicom"));
    expect(signHtml(signed)).toBe(signed);
  });
  it("signs mails without footer at the end of the card", () => {
    const html = `<!doctype html><html><body><table><tr><td><table><tr><td>Titre</td></tr>
<tr><td>Contenu</td></tr></table></td></tr></table></body></html>`;
    const signed = signHtml(html);
    expect(signed).toMatch(/Contenu<\/td><\/tr><!--digipote-signature--><tr><td[^>]*>\n<p[^>]*>Bip-boup !/);
  });
  it("signs the text version", () => {
    expect(signText("Bonjour,\r\n\r\nUn message.\r\n")).toBe("Bonjour,\r\n\r\nUn message.\r\n\r\nBip-boup !\r\nD.I.G.I.P.O.T.E 🤖\r\nL'assistant de Digicom");
  });
});
