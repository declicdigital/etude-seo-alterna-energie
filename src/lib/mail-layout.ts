/**
 * Shared look of the editorial mails (article steps and manual reminders):
 * green « Digicom · space » banner, intro, labelled fields, green button, footer.
 */
export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type MailField = [label: string, value: string | null | undefined];

export function editorialMailHtml(opts: {
  heading: string;
  /** Trusted HTML (already escaped); may use <strong> and <br>. */
  introHtml: string;
  fields: MailField[];
  cta: { label: string; url: string };
}): string {
  const row = ([label, value]: MailField) =>
    value
      ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(label)}</p><p style="margin:0 0 14px;font-size:15px">${escapeHtml(value)}</p>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#047857;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">${escapeHtml(opts.heading)}</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 18px;font-size:16px">${opts.introHtml}</p>
${opts.fields.map(row).join("\n")}
<a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">${escapeHtml(opts.cta.label)}</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#9ca3af">Notification automatique de Digicom. Merci de ne pas répondre à ce mail.</td></tr>
</table></td></tr></table></body></html>`;
}
