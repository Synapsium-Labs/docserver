// `./host`'s link classifier (docserver L3, Task 9; plan Reference §11.3; the first consumer's spec §4.4). A `navigate`
// the parser accepted is classified here before the host's onLink sees it. `./host` never navigates and never opens a
// window: it only hands the host a HostLink, or drops the link.
//
// Refused (null): an href that is empty or over BRIDGE_LIMITS.hrefMaxChars (4096) code units; a control (C0, DEL, C1),
// a hidden character of the copy check (the bidi controls and the zero-width characters, copy.ts) or white space of any
// kind anywhere; a backslash anywhere, raw or percent-encoded; a protocol-relative form (`//`); `javascript:`, `data:`,
// `vbscript:` and every scheme but http, https and mailto, in any case; an http or https link without its `//`, with
// nothing after it, or with no host; a mailto address whose domain the URL parser refuses, or that holds more than a
// host (a port, a path, a fragment), or that is ASCII and reads as another host (a percent escape).
//   fragment  `#id`: the id, percent-decoded, in the one fragment grammar (isFragmentId); otherwise refused
//   relative  a path with no scheme: the query is dropped; its fragment kept when it is a fragment id, else null
//   external  http and https, as the URL parser normalises them, with the host a browser would reach (an international
//             name in its ASCII form); mailto as written, its host the domain of its first address as the URL parser
//             reads it (lower case, an international name in its ASCII form), or '' when there is no address
// Pure and import-inert. The only built-in it calls beyond strings is the URL parser, for http, https and a mailto domain.
import { isFragmentId } from '../frame/fragment.js';
import { BRIDGE_LIMITS } from '../frame/protocol.js';
import { hasHiddenChar } from './copy.js';
import { hasControl } from './parse.js';

export type HostLink =
  | { readonly kind: 'fragment'; readonly id: string }
  | { readonly kind: 'relative'; readonly path: string; readonly fragment: string | null }
  | { readonly kind: 'external'; readonly url: string; readonly scheme: 'http' | 'https' | 'mailto'; readonly host: string };

/** A URL scheme and its colon, at the start (RFC 3986: a letter, then letters, digits, `+`, `-` and `.`). */
const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/;

/** White space of any kind (the ECMAScript class: Unicode spaces, line terminators, BOM). */
const WHITE_SPACE = /\s/u;

/** A backslash, raw or percent-encoded. */
const BACKSLASH = /\\|%5c/i;

/** The percent-decoded text of a fragment when it is a fragment id; null otherwise (empty, undecodable or outside). */
function fragmentId(raw: string): string | null {
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return isFragmentId(id) ? id : null;
}

/** Classifies one `navigate` href (Reference §11.3); null when it is refused. */
export function classifyLink(href: unknown): HostLink | null {
  if (typeof href !== 'string') return null;
  if (href.length < 1 || href.length > BRIDGE_LIMITS.hrefMaxChars) return null;
  if (hasControl(href) || hasHiddenChar(href) || WHITE_SPACE.test(href) || BACKSLASH.test(href)) return null;
  if (href.startsWith('//')) return null;

  const scheme = SCHEME.exec(href)?.[1]?.toLowerCase();
  if (scheme === 'http' || scheme === 'https') return external(href, scheme);
  if (scheme === 'mailto') {
    const address = href.slice('mailto:'.length).split('?')[0] ?? '';
    const at = address.split(',')[0] ?? '';
    const host = at.includes('@') ? mailHost(at.slice(at.lastIndexOf('@') + 1)) : '';
    return host === null ? null : { kind: 'external', url: href, scheme: 'mailto', host };
  }
  if (scheme !== undefined) return null;

  const hashAt = href.indexOf('#');
  const before = hashAt < 0 ? href : href.slice(0, hashAt);
  const fragment = hashAt < 0 ? null : fragmentId(href.slice(hashAt + 1));
  const queryAt = before.indexOf('?');
  const path = queryAt < 0 ? before : before.slice(0, queryAt);
  if (path === '') return fragment === null ? null : { kind: 'fragment', id: fragment };
  return { kind: 'relative', path, fragment };
}

/**
 * A mailto address's domain as the URL parser reads a host: null when it refuses it, when the domain holds more than a
 * host, or when an ASCII domain reads as another host (a percent escape); an international name comes back in its
 * ASCII form, as for http and https.
 */
function mailHost(domain: string): string | null {
  let url: URL;
  try {
    url = new URL(`http://${domain}`);
  } catch {
    return null;
  }
  const bare = url.username === '' && url.password === '' && url.port === '' && url.pathname === '/' && url.search === '' && url.hash === '';
  if (!bare || url.hostname === '') return null;
  if (/^[\x00-\x7f]*$/.test(domain) && url.hostname !== domain.toLowerCase()) return null;
  return url.hostname;
}

/** An http or https link: `//` and a host after the scheme, parsed by the URL parser. */
function external(href: string, scheme: 'http' | 'https'): HostLink | null {
  const rest = href.slice(scheme.length + 1);
  if (!rest.startsWith('//') || rest.length === 2 || rest[2] === '/') return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.hostname === '') return null;
  return { kind: 'external', url: url.href, scheme, host: url.host };
}
