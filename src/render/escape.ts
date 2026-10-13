// The two escapers of the port (docserver L1; architecture section C, global constraint 5). Each is used
// exactly where the reference renderer used its counterpart, because the two differ on the apostrophe:
// - escapeHtml is markdown-it's text escaper (& < > "), for everything markdown-it itself would escape;
// - pyEscape is Python's html.escape(s, quote=True) (& < > " and ' as &#x27;), for the places the reference
//   called html.escape: the failure fallback, summary text, Mermaid source, front-matter dt and dd.

const MD_SPECIAL = /[&<>"]/g;
const MD_ESCAPED: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

const PY_SPECIAL = /[&<>"']/g;
const PY_ESCAPED: Readonly<Record<string, string>> = { ...MD_ESCAPED, "'": '&#x27;' };

/** markdown-it's escapeHtml: & < > " become entities; an apostrophe stays as it is. */
export function escapeHtml(s: string): string {
  return s.replace(MD_SPECIAL, (c) => MD_ESCAPED[c] ?? c);
}

/** Python's html.escape(s, quote=True): & < > " become entities, and ' becomes &#x27;. */
export function pyEscape(s: string): string {
  return s.replace(PY_SPECIAL, (c) => PY_ESCAPED[c] ?? c);
}
