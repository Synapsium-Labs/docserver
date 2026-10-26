// The byte rules of an inlined asset (docserver L3; design §5.3): what a script or the stylesheet may not hold, because
// it would end its element early, open another, or change what the browser hashes. Run at build time by
// scripts/build-frame.mjs and again by frameDocument, behind the build. Pure.
//
// Prototype scope: the `<!--` and `-->` token scanner (an HTML-like comment outside a literal starts a comment in a
// classic script) is the plan's.

/** The hazards of a script's text, by name; empty when it may be inlined. */
export function scriptHazards(text: string): string[] {
  const out: string[] = [];
  if (/<\/?script/i.test(text)) out.push('script tag');
  if (text.includes('\0')) out.push('NUL');
  if (text.includes('\r')) out.push('CR');
  if (text.includes('\uFEFF')) out.push('BOM');
  return out;
}

/** The only `url(` the stylesheet may hold: an inlined woff2 font. */
export const CSS_URL_PREFIX = 'url(data:font/woff2;base64,';

/** The hazards of the stylesheet's text, by name; empty when it may be inlined. */
export function cssHazards(text: string): string[] {
  const out: string[] = [];
  if (/<\/style/i.test(text)) out.push('style end tag');
  if (/@import/i.test(text)) out.push('@import');
  if (text.includes('\0')) out.push('NUL');
  if (text.includes('\r')) out.push('CR');
  if (text.includes('\uFEFF')) out.push('BOM');
  const urls = text.match(/url\(/gi) ?? [];
  let ok = 0;
  for (let at = text.indexOf(CSS_URL_PREFIX); at >= 0; at = text.indexOf(CSS_URL_PREFIX, at + 1)) ok++;
  if (urls.length !== ok) out.push('url( other than an inlined woff2 font');
  return out;
}
