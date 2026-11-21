// `./host`'s link classifier (docserver L3, Task 9; plan Reference §11.3, row L3.H6). classifyLink turns a `navigate`
// href into a HostLink or refuses it (null): `javascript:`, `data:`, `vbscript:` and every scheme outside http, https and
// mailto; protocol-relative forms; backslashes, raw or percent-encoded; controls and white space; and more than 4096 code
// units. A relative link loses its query; a fragment-only link is a fragment; an http, https or mailto link is external,
// with its scheme and host named for the host's own sheet. `./host` never navigates: it only hands the link to onLink.
import { describe, expect, it } from 'vitest';
import { isItemHref } from '../src/frame/items.js';
import { BRIDGE_LIMITS } from '../src/frame/protocol.js';
import { classifyLink } from '../src/host/links.js';

describe('L3.H6 refused: script-bearing and unknown schemes', () => {
  it('javascript:, data: and vbscript:, in any case', () => {
    for (const href of ['javascript:alert(1)', 'JavaScript:alert(1)', 'JAVASCRIPT:x', 'data:text/html,<b>x</b>', 'DATA:,x', 'vbscript:msgbox(1)', 'VBScript:x']) {
      expect(classifyLink(href), href).toBeNull();
    }
  });

  it('every other scheme: file, ftp, blob, intent, about, chrome, a made-up one, and a scheme with a dot or a plus', () => {
    for (const href of ['file:///etc/passwd', 'ftp://example.com/x', 'blob:https://example.com/x', 'intent://x#Intent;end', 'about:blank', 'chrome://settings', 'x-app:open', 'a.b:c', 'svn+ssh://h/x', 'tel:123', 'sms:1']) {
      expect(classifyLink(href), href).toBeNull();
    }
  });
});

describe('L3.H6 refused: protocol-relative and backslash forms', () => {
  it("//h/x, and every slash-and-backslash spelling of it", () => {
    for (const href of ['//h/x', '//example.com', '///x', '\\\\h\\x', '/\\h/x', '\\/h/x']) expect(classifyLink(href), href).toBeNull();
  });

  it('a backslash anywhere, raw or percent-encoded in either case', () => {
    for (const href of ['a\\b.md', 'https://example.com\\@evil.test/', 'docs\\x.md', 'a%5Cb.md', 'a%5cb.md', 'https://example.com/%5C']) {
      expect(classifyLink(href), href).toBeNull();
    }
  });

  it('an http or https link without its two slashes, or with no host', () => {
    for (const href of ['https:example.com', 'http:/example.com', 'https://', 'https:///x', 'http://:80/']) expect(classifyLink(href), href).toBeNull();
  });
});

describe('L3.H6 refused: controls, white space and length', () => {
  it('every C0 control, DEL and every C1 control, anywhere', () => {
    for (let cp = 0; cp <= 0x9f; cp += 1) {
      if (cp >= 0x20 && cp < 0x7f) continue;
      const ch = String.fromCharCode(cp);
      for (const href of [`${ch}a.md`, `a${ch}.md`, `https://example.com/${ch}`, `java${ch}script:alert(1)`]) {
        expect(classifyLink(href), `${cp.toString(16)} in ${JSON.stringify(href)}`).toBeNull();
      }
    }
  });

  it('white space of any kind, leading, inside or trailing', () => {
    for (const ws of [' ', '\u00a0', '\u1680', '\u2000', '\u2028', '\u2029', '\u3000', '\u205f', '\u202f']) {
      for (const href of [`${ws}a.md`, `a${ws}b.md`, `https://example.com/${ws}`, `${ws}javascript:alert(1)`]) {
        expect(classifyLink(href), `${ws.charCodeAt(0).toString(16)} in ${JSON.stringify(href)}`).toBeNull();
      }
    }
  });

  it("the copy check's bidi controls and zero-width characters, anywhere, in every kind of link", () => {
    for (const cp of [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]) {
      const ch = String.fromCharCode(cp);
      for (const href of [`docs/${ch}txt.exe`, `a.md${ch}`, `mailto:a@evil.example${ch}moc.knab`, `mailto:a${ch}b@example.com`, `mailto:a@x.example${ch}good.example`, `https://example.com/${ch}`, `#a${ch}b`]) {
        expect(classifyLink(href), `${cp.toString(16)} in ${JSON.stringify(href)}`).toBeNull();
      }
    }
  });

  it("the copy check's directional marks and tag characters, anywhere, in every kind of link (ledger C103)", () => {
    for (const ch of ['\u200e', '\u200f', '\u061c', '\u{E0041}']) {
      for (const href of [`docs/${ch}txt.exe`, `a.md${ch}`, `mailto:a${ch}b@example.com`, `https://example.com/${ch}`, `#a${ch}b`]) {
        expect(classifyLink(href), `${ch.codePointAt(0)?.toString(16)} in ${JSON.stringify(href)}`).toBeNull();
      }
    }
  });

  it('a mark right after U+FFFF (one code unit, no step of two) is refused (ledger C103)', () => {
    for (const href of ['docs/\uffff\u200etxt.exe', 'a.md\uffff\u200e', 'https://example.com/\uffff\u200e', '#a\uffff\u200e']) {
      expect(classifyLink(href), JSON.stringify(href)).toBeNull();
    }
  });

  it('4097 code units are refused; 4096 pass', () => {
    const at = `https://example.com/${'a'.repeat(BRIDGE_LIMITS.hrefMaxChars - 20)}`;
    expect(at.length).toBe(4096);
    expect(classifyLink(at)).toMatchObject({ kind: 'external' });
    expect(classifyLink(`${at}a`)).toBeNull();
    const rel = 'a'.repeat(4097);
    expect(classifyLink(rel)).toBeNull();
    expect(classifyLink(rel.slice(1))).toMatchObject({ kind: 'relative' });
  });

  it('an empty href and a value that is not a string are refused', () => {
    for (const v of ['', null, undefined, 1, {}, ['a.md']]) expect(classifyLink(v), String(v)).toBeNull();
  });
});

describe('L3.H6 accepted: relative links, with the query dropped', () => {
  it('a relative path keeps its path and fragment; its query is dropped', () => {
    expect(classifyLink('../plans/other.md#task-1')).toEqual({ kind: 'relative', path: '../plans/other.md', fragment: 'task-1' });
    expect(classifyLink('other.md?x=1&y=2')).toEqual({ kind: 'relative', path: 'other.md', fragment: null });
    expect(classifyLink('other.md?x=1#part')).toEqual({ kind: 'relative', path: 'other.md', fragment: 'part' });
    expect(classifyLink('./a/b.md')).toEqual({ kind: 'relative', path: './a/b.md', fragment: null });
    expect(classifyLink('/docs/a.md')).toEqual({ kind: 'relative', path: '/docs/a.md', fragment: null });
    expect(classifyLink('a.md#')).toEqual({ kind: 'relative', path: 'a.md', fragment: null });
  });

  it('a fragment outside the fragment grammar is dropped, a percent-encoded one inside it is decoded', () => {
    expect(classifyLink('a.md#a%2Fb')).toEqual({ kind: 'relative', path: 'a.md', fragment: null });
    expect(classifyLink('a.md#%E4%B8%AD')).toEqual({ kind: 'relative', path: 'a.md', fragment: '\u4e2d' });
    expect(classifyLink('a.md#%')).toEqual({ kind: 'relative', path: 'a.md', fragment: null });
  });

  it('a colon after the first slash, query or fragment is no scheme', () => {
    expect(classifyLink('a/b:c.md')).toEqual({ kind: 'relative', path: 'a/b:c.md', fragment: null });
    expect(classifyLink('a.md?x=javascript:1')).toEqual({ kind: 'relative', path: 'a.md', fragment: null });
    expect(classifyLink('a.md#fnref1:1')).toEqual({ kind: 'relative', path: 'a.md', fragment: 'fnref1:1' });
  });
});

describe('L3.H6 accepted: fragments', () => {
  it('a fragment-only link is a fragment, in the fragment grammar', () => {
    expect(classifyLink('#fn1')).toEqual({ kind: 'fragment', id: 'fn1' });
    expect(classifyLink('#D2.1a')).toEqual({ kind: 'fragment', id: 'D2.1a' });
    expect(classifyLink('#%E4%B8%AD%E6%96%87')).toEqual({ kind: 'fragment', id: '\u4e2d\u6587' });
    expect(classifyLink('?q=1#part')).toEqual({ kind: 'fragment', id: 'part' });
  });

  it('a fragment-only link outside the grammar, or empty, is refused', () => {
    for (const href of ['#', '#a/b', '#a%20b', '#%', '?q=1', `#${'x'.repeat(257)}`]) expect(classifyLink(href), href).toBeNull();
  });
});

describe('L3.H6 accepted: external links', () => {
  it('http and https, with the scheme and host named and the query kept', () => {
    expect(classifyLink('https://example.com/a/b.md?x=1#part')).toEqual({ kind: 'external', url: 'https://example.com/a/b.md?x=1#part', scheme: 'https', host: 'example.com' });
    expect(classifyLink('http://Example.COM:8080/x')).toEqual({ kind: 'external', url: 'http://example.com:8080/x', scheme: 'http', host: 'example.com:8080' });
    expect(classifyLink('HTTPS://example.com')).toEqual({ kind: 'external', url: 'https://example.com/', scheme: 'https', host: 'example.com' });
  });

  it('the host is the one a browser would reach, credentials and an international name included', () => {
    expect(classifyLink('https://example.com@evil.example/x')).toMatchObject({ kind: 'external', host: 'evil.example' });
    expect(classifyLink('https://b\u00fccher.example/')).toMatchObject({ kind: 'external', host: 'xn--bcher-kva.example' });
  });

  it('mailto: is external, its host the domain of the address', () => {
    expect(classifyLink('mailto:reader@example.com')).toEqual({ kind: 'external', url: 'mailto:reader@example.com', scheme: 'mailto', host: 'example.com' });
    expect(classifyLink('MAILTO:a@Example.ORG?subject=x')).toEqual({ kind: 'external', url: 'MAILTO:a@Example.ORG?subject=x', scheme: 'mailto', host: 'example.org' });
    expect(classifyLink('mailto:')).toEqual({ kind: 'external', url: 'mailto:', scheme: 'mailto', host: '' });
  });

  it('a mailto host is the domain as the URL parser reads it: an international name in its ASCII form', () => {
    expect(classifyLink('mailto:a@b\u00fccher.example')).toEqual({ kind: 'external', url: 'mailto:a@b\u00fccher.example', scheme: 'mailto', host: 'xn--bcher-kva.example' });
    expect(classifyLink('mailto:a@evil.example\u00adx')).toEqual({ kind: 'external', url: 'mailto:a@evil.example\u00adx', scheme: 'mailto', host: 'evil.examplex' });
    expect(classifyLink('mailto:a@example.com,b@other.example')).toMatchObject({ kind: 'external', host: 'example.com' });
  });

  it('a mailto domain the URL parser refuses, or one that holds more than a host or reads as another host, is refused', () => {
    for (const href of ['mailto:a@', 'mailto:a@example.com/x', 'mailto:a@example.com:25', 'mailto:a@example.com#x', 'mailto:a@ex%61mple.com', 'mailto:a@exa%mple.com', 'mailto:a@b\u00fccher.example/x', 'mailto:a@exa<mple.com', 'mailto:a@exa|mple.com']) {
      expect(classifyLink(href), href).toBeNull();
    }
  });
});

describe('the frame\'s item-href grammar and the host\'s agree on characters (review 3081 F7)', () => {
  // An item link is drawn only when the frame's isItemHref takes it, and its click is kept only when classifyLink takes it, so
  // a character one refuses and the other admits draws a link whose click is dropped. The two files cannot import each other
  // (src/frame/items.ts is import-free), so the grammars are held equal here, over every code point but the lone surrogates (which
  // have their own case below), in the three places an href carries free text: the path, the query and the fragment. The
  // hidden-character and white-space classes are also placed in the host part (below); the rest of the host part is the host's.
  // A lone surrogate: the path, query and fragment agree (both admit it, the host reads an external link); in the host part the
  // frame admits it and the host's URL parser refuses it (U+FFFD is no host code point), the host grammar's own difference.
  const SURROGATE_VERDICTS = [0xd800, 0xdbff, 0xdc00, 0xdfff].flatMap(() => ['true/null', 'true/external', 'true/external', 'true/external']);
  const places = (c: string): string[] => [`https://tracker.example/a${c}b`, `https://tracker.example/?a${c}b`, `https://tracker.example/#a${c}b`];

  it('the bidi controls, directional marks and zero-width characters are refused by both', () => {
    for (const code of [0x202e, 0x202a, 0x202b, 0x202c, 0x202d, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f, 0x061c, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x2028, 0x2029, 0xe0041, 0xe007f]) {
      for (const href of places(String.fromCodePoint(code))) {
        expect(isItemHref(href), `${code.toString(16)} in ${href.length}`).toBe(false);
        expect(classifyLink(href), code.toString(16)).toBeNull();
      }
    }
    expect(isItemHref('https://tracker.example/AB-1\u202e')).toBe(false);
  });

  it('over every code point, in each place, isItemHref admits exactly what classifyLink reads as an external https link', () => {
    const differ: string[] = [];
    for (let code = 0; code <= 0x10ffff; code += 1) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      for (const href of places(String.fromCodePoint(code))) {
        const link = classifyLink(href);
        const host = link !== null && link.kind === 'external' && link.scheme === 'https';
        if (isItemHref(href) !== host) differ.push(`${code.toString(16)}: ${href.slice(0, 22)}`);
      }
    }
    expect(differ).toEqual([]);
  }, 120000);

  it('a percent-encoded backslash, %5c in either case, is refused by both, in the host part, path, query and fragment, and frame-accepted implies host external https (review 3088 F5)', () => {
    const hrefs: string[] = [];
    for (const esc of ['%5c', '%5C', '%5c%5C', 'a%5cb', '%255c']) {
      hrefs.push(`https://tracker.example/${esc}`, `https://tracker.example/a${esc}b`, `https://tracker.example/?q=${esc}`, `https://tracker.example/?${esc}`, `https://tracker.example/#${esc}`, `https://tracker.example/#a${esc}b`);
      // In the host part "%25" is a percent escape the host's URL parser decodes, a host difference the host's grammar owns.
      if (esc !== '%255c') hrefs.push(`https://tracker${esc}.example/`, `https://tracker.example${esc}/x`);
    }
    const refused = hrefs.filter((href) => /%5c/i.test(href));
    expect(refused.length).toBeGreaterThan(30);
    for (const href of hrefs) {
      const accepted = isItemHref(href);
      const link = classifyLink(href);
      if (/%5c/i.test(href)) {
        expect(accepted, href).toBe(false);
        expect(link, href).toBeNull();
      } else {
        // %255c is a percent sign and "5c": no backslash in either grammar's reading.
        expect(accepted, href).toBe(true);
        expect(link, href).toMatchObject({ kind: 'external', scheme: 'https' });
      }
      if (accepted) expect(link !== null && link.kind === 'external' && link.scheme === 'https', href).toBe(true);
    }
  });

  it('the hidden-character and white-space classes are refused by both in the host part too, and lone surrogates agree outside it (review 3088 M1)', () => {
    // A code point the frame refuses in the path is one of the shared classes (white space, controls, hidden characters); each
    // is placed in the host part, where the frame refuses it by the same table and the host by its own checks. Lone surrogates are below.
    const shared: number[] = [];
    for (let code = 0; code <= 0x10ffff; code += 1) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      if (!isItemHref(`https://tracker.example/a${String.fromCodePoint(code)}b`)) shared.push(code);
    }
    expect(shared.length).toBeGreaterThan(100);
    const differ: string[] = [];
    for (const code of shared) {
      const c = String.fromCodePoint(code);
      for (const href of [`https://tracker${c}b.example/`, `https://${c}tracker.example/`, `https://tracker.example${c}/x`]) {
        if (isItemHref(href) || classifyLink(href) !== null) differ.push(`${code.toString(16)}: ${href.slice(0, 22)}`);
      }
    }
    expect(differ).toEqual([]);
    // Lone surrogates, in the four places, host first: what each grammar says is pinned, so a change in either shows.
    const verdicts = new Map<string, string>();
    for (const code of [0xd800, 0xdbff, 0xdc00, 0xdfff]) {
      const c = String.fromCharCode(code);
      const hosts = [`https://tracker${c}b.example/`, `https://tracker.example/a${c}b`, `https://tracker.example/?a${c}b`, `https://tracker.example/#a${c}b`];
      for (const href of hosts) {
        const link = classifyLink(href);
        verdicts.set(`${code.toString(16)} ${href.includes('?') ? 'query' : href.includes('#') ? 'fragment' : href.endsWith('/') ? 'host' : 'path'}`, `${String(isItemHref(href))}/${link === null ? 'null' : link.kind}`);
      }
    }
    expect([...verdicts.values()]).toEqual(SURROGATE_VERDICTS);
  });

  it('an ordinary absolute https URL, and a path in another script, are still admitted by both', () => {
    for (const href of ['https://tracker.example/AB-1', 'https://tracker.example/browse/AB-1?x=1#top', 'https://tracker.example/\u0434\u043e\u043a', 'https://tracker.example/%E2%80%AE']) {
      expect(isItemHref(href), href).toBe(true);
      expect(classifyLink(href), href).not.toBeNull();
    }
  });

  it('the scheme is read as the host reads it, with no Unicode case folding: HTTPS is admitted, a long s is not (review 3081 round 2, I1)', () => {
    const LONG_S = String.fromCharCode(0x17f);
    for (const href of ['HTTPS://tracker.example/AB-1', 'Https://tracker.example/AB-1', 'hTtPs://tracker.example/AB-1']) {
      expect(isItemHref(href), href).toBe(true);
      expect(classifyLink(href), href).toMatchObject({ kind: 'external', scheme: 'https' });
    }
    for (const href of [`http${LONG_S}://tracker.example/AB-1`, `HTTP${LONG_S}://tracker.example/AB-1`, `http${LONG_S}://tracker.example/`, 'http://tracker.example/AB-1', 'ftp://tracker.example/AB-1', 'https:/tracker.example/AB-1']) {
      expect(isItemHref(href), href).toBe(false);
    }
    // The long s is relative to the host: it is no external link at all.
    expect(classifyLink(`http${LONG_S}://tracker.example/AB-1`)?.kind).not.toBe('external');
  });
});
