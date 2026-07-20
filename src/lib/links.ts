const WEB_ADDRESS_RE = /(?:https?:\/\/)?(?:[a-z0-9-]+[.,])+(?:fr|com|org|net|io|eu)(?:\/[^\s<>"')]+)?/gi;

function cleanAddress(address: string) {
  const trailing = address.match(/[.!?;:]+$/)?.[0] ?? "";
  const raw = trailing ? address.slice(0, -trailing.length) : address;
  const protocol = raw.match(/^https?:\/\//i)?.[0] ?? "";
  const withoutProtocol = raw.slice(protocol.length);
  const slash = withoutProtocol.indexOf("/");
  const host = slash === -1 ? withoutProtocol : withoutProtocol.slice(0, slash);
  const path = slash === -1 ? "" : withoutProtocol.slice(slash);
  const normalizedHost = host.replaceAll(",", ".");
  const normalizedPath = path.replace(/,(html?|php)(?=([?#]|$))/gi, ".$1");

  return {
    text: raw,
    href: `${protocol || "https://"}${normalizedHost}${normalizedPath}`,
    trailing,
  };
}

export function linkify(value: string): Array<{ text: string; href?: string }> {
  const segments: Array<{ text: string; href?: string }> = [];
  let last = 0;

  for (const match of value.matchAll(WEB_ADDRESS_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: value.slice(last, index) });
    const cleaned = cleanAddress(match[0]);
    segments.push({ text: cleaned.text, href: cleaned.href });
    if (cleaned.trailing) segments.push({ text: cleaned.trailing });
    last = index + match[0].length;
  }

  if (last < value.length) segments.push({ text: value.slice(last) });
  return segments;
}

export function linkHref(value: string) {
  const trimmed = value.trim();
  const segments = linkify(trimmed);
  return segments.length === 1 && segments[0].href && segments[0].text === trimmed
    ? segments[0].href
    : null;
}