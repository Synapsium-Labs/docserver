// `./host`'s link classifier (docserver L3, Task 9; plan Reference §11.3, row L3.H6). classifyLink turns a `navigate`
// href into a HostLink or refuses it (null): `javascript:`, `data:`, `vbscript:` and every scheme outside http, https and
// mailto; protocol-relative forms; backslashes, raw or percent-encoded; controls and white space; and more than 4096 code
// units. A relative link loses its query; a fragment-only link is a fragment; an http, https or mailto link is external,
// with its scheme and host named for the host's own sheet. `./host` never navigates: it only hands the link to onLink.
import { describe, expect, it } from 'vitest';
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
