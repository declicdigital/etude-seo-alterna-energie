/**
 * Tous les mails de Digicom sont signés par Digipote (D.I.G.I.P.O.T.E, le robot de l'outil).
 * `signHtml` ajoute la signature juste avant le pied de page gris (ou en fin de contenu si le
 * mail n'en a pas) ; `signText` l'ajoute à la fin de la version texte. Les deux ne signent
 * qu'une fois.
 */
const MARK = "<!--digipote-signature-->";
const SIGNATURE_HTML = `${MARK}<tr><td style="padding:0 28px 26px">
<p style="margin:0;font-size:15px;line-height:1.5;color:#1f2937">Bip-boup !<br><strong>Digipote</strong> 🤖<br><span style="font-size:13px;color:#6b7280">L'assistant de Digicom</span></p>
</td></tr>`;
const SIGNATURE_TEXT = "Bip-boup !\r\nDigipote 🤖\r\nL'assistant de Digicom";

export function signHtml(html: string): string {
  if (html.includes(MARK)) return html;
  const footer = html.indexOf('<tr><td style="padding:16px 28px;background:#f9fafb');
  if (footer !== -1) return html.slice(0, footer) + SIGNATURE_HTML + "\n" + html.slice(footer);
  // Pas de pied de page : fin de la carte (dernière ligne du tableau principal).
  const end = html.lastIndexOf("</table></td></tr></table></body>");
  if (end !== -1) {
    const lastRowEnd = html.lastIndexOf("</td></tr>", end);
    if (lastRowEnd !== -1) {
      const at = lastRowEnd + "</td></tr>".length;
      return html.slice(0, at) + SIGNATURE_HTML + html.slice(at);
    }
  }
  return html.replace("</body>", `<p style="font-family:Arial,sans-serif;font-size:15px">Bip-boup !<br><strong>Digipote</strong> 🤖</p>${MARK}</body>`);
}

export function signText(text: string): string {
  if (text.includes("Digipote 🤖")) return text;
  return `${text.replace(/\s+$/, "")}\r\n\r\n${SIGNATURE_TEXT}`;
}
