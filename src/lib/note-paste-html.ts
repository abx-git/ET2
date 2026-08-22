/**
 * MDXEditor wandelt jedes HTML-`<pre>` in einen CodeBlockNode um.
 * Fehlt `language-*` / `data-language`, ist language leer — ohne registrierten
 * Editor crasht das mit „No CodeBlockEditor registered for language= meta=“.
 */

const PRE_OPEN_TAG = /<pre\b[^>]*>/gi;

export function htmlWouldCreateUnlanguagedCodeBlock(html: string): boolean {
  if (!html || !/<pre[\s>]/i.test(html)) return false;
  const opens = html.match(PRE_OPEN_TAG) ?? [];
  return opens.some(
    (tag) => !/language-[\w-]+/i.test(tag) && !/data-language\s*=/i.test(tag),
  );
}
