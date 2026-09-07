const BLOCKED_LINK_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:"]);

/** Speichert/normalisiert einen externen Link (http/https oder anderes sicheres Schema). */
export function normalizeTaskLink(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
    const url = new URL(withScheme);
    if (BLOCKED_LINK_PROTOCOLS.has(url.protocol.toLowerCase())) return "";
    return url.href;
  } catch {
    return "";
  }
}

/** `null` wenn kein gültiger Link gesetzt ist. */
export function taskLinkHref(raw: string | undefined | null): string | null {
  const n = normalizeTaskLink(raw ?? "");
  return n || null;
}

function escapeMarkdownLinkText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

/** Markdown-Listeneintrag `- [Titel](url)`, oder `null` ohne gültigen Link. */
export function markdownLinkListItem(title: string, link: string | undefined | null): string | null {
  const href = taskLinkHref(link);
  if (!href) return null;
  const label = title.replace(/\r?\n/g, " ").trim() || href;
  return `- [${escapeMarkdownLinkText(label)}](${href})`;
}
