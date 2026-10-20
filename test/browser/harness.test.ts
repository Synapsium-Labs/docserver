// The real-browser harness (test/browser/harness.ts; docserver L2, Task 6). Pinned: the browser selection and how an
// excluded browser is reported; that a browser that cannot start names the install command; that the test process
// opens no socket (the browser is driven over a pipe); that each selected browser starts in its block's hook; that a
// page loads from its own origin only, enhanced, with the fonts, under either policy and with no violation; that an
// unserved path is counted as missing (a favicon request never reaches the route); that a routed request to another
// origin is aborted and counted; that one let past the route reaches no host, by name or by address (a listener on
// this machine sees no connection, where a browser without the wall connects to it); and what each policy refuses.
import dgram from 'node:dgram';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BROWSERS,
  CLOSED_PORT,
  INSTALL,
  ORIGIN,
  SELECTION,
  closeBrowsers,
  describeBrowsers,
  excludedTitle,
  isLaunched,
  launch,
  launchOptions,
  openDoc,
  parseSelection,
} from './harness.js';

const DOC = ['# Example', '', '**Spec** · 2026-10-20 · Status: Draft', '', '## 1. One', '', 'Text.', '', '## 2. Two', '', 'More.', '', '## 3. Three', '', 'End.', ''].join('\n');

afterAll(closeBrowsers);

describe('the browser selection (DOCREADER_BROWSERS)', () => {
  it('unset runs both browsers and excludes none', () => {
    expect(parseSelection(undefined)).toEqual({ run: ['chromium', 'webkit'], excluded: [], setting: null });
  });

  it('a list runs the browsers it names, in a fixed order, and reports the rest as excluded', () => {
    expect(parseSelection('chromium')).toEqual({ run: ['chromium'], excluded: ['webkit'], setting: 'chromium' });
    expect(parseSelection(' webkit , chromium ')).toEqual({ run: ['chromium', 'webkit'], excluded: [], setting: ' webkit , chromium ' });
  });

  it('an unknown name or an empty entry is an error, never a silent skip', () => {
    for (const bad of ['', 'firefox', 'chromium,', 'chromium,firefox', 'Chromium']) {
      expect(() => parseSelection(bad)).toThrow('name one or more of chromium, webkit');
    }
  });

  it('an excluded browser\'s title names the setting', () => {
    expect(excludedTitle('webkit', parseSelection('chromium'))).toBe('webkit: excluded by DOCREADER_BROWSERS=chromium');
  });

  it('this file has one block per browser: a selected one runs, an excluded one is skipped under its title', ({ task }) => {
    const suites = task.file.tasks.filter((t) => t.type === 'suite').map((t) => [t.name, t.mode]);
    for (const b of BROWSERS) {
      if (SELECTION.run.includes(b)) expect(suites).toContainEqual([b, 'run']);
      else expect(suites).toContainEqual([excludedTitle(b, SELECTION), 'skip']);
    }
  });
});

describe('launching', () => {
  it('a browser that cannot start is an error naming the install command', async () => {
    const executablePath = path.join(tmpdir(), 'docreader-no-such-browser', 'chrome');
    await expect(launch('chromium', { executablePath })).rejects.toThrow(INSTALL);
  });

  it('each browser is kept off the network: Chromium resolves no name, WebKit proxies to a closed loopback port', () => {
    expect(launchOptions('chromium')).toEqual({ args: ['--host-resolver-rules=MAP * ~NOTFOUND'] });
    expect(launchOptions('webkit')).toEqual({ proxy: { server: `http://127.0.0.1:${String(CLOSED_PORT)}` } });
  });

  it.skipIf(SELECTION.run.length === 0)('the test process opens no socket: the browser is driven over a pipe', async () => {
    const counts = { connect: 0, listen: 0, udp: 0 };
    const connect = net.Socket.prototype.connect;
    const listen = net.Server.prototype.listen;
    const bind = dgram.Socket.prototype.bind;
    net.Socket.prototype.connect = function counted(this: net.Socket, ...args: unknown[]) {
      counts.connect += 1;
      return (connect as (...a: unknown[]) => net.Socket).apply(this, args);
    } as typeof connect;
    net.Server.prototype.listen = function counted(this: net.Server, ...args: unknown[]) {
      counts.listen += 1;
      return (listen as (...a: unknown[]) => net.Server).apply(this, args);
    } as typeof listen;
    dgram.Socket.prototype.bind = function counted(this: dgram.Socket, ...args: unknown[]) {
      counts.udp += 1;
      return (bind as (...a: unknown[]) => dgram.Socket).apply(this, args);
    } as typeof bind;
    let resources: string[] = [];
    try {
      await closeBrowsers(); // so the browser below is launched inside the window
      const doc = await openDoc(DOC, {}, { browser: SELECTION.run[0] as (typeof BROWSERS)[number] });
      resources = process.getActiveResourcesInfo();
      await doc.close();
      await closeBrowsers();
    } finally {
      net.Socket.prototype.connect = connect;
      net.Server.prototype.listen = listen;
      dgram.Socket.prototype.bind = bind;
    }
    expect(counts).toEqual({ connect: 0, listen: 0, udp: 0 });
    expect(resources.filter((r) => /TCP|UDP/.test(r))).toEqual([]);
  });
});

describeBrowsers((browser) => {
  it('the browser was started in the block\'s hook, before its first test', () => {
    expect(isLaunched(browser)).toBe(true);
  });

  it('opens a page from its own origin, enhanced, with the fonts, nothing missing, aborted or refused', async () => {
    const doc = await openDoc(DOC, {}, { browser });
    try {
      const state = await doc.page.evaluate(async () => {
        // WebKit may not have started a face's load when the page settles (font-display: swap), so ask for the
        // serif face explicitly; a face that cannot be fetched or decoded then stays out of the loaded list.
        await document.fonts.load('16px "Docreader Serif"').catch(() => []);
        await document.fonts.ready;
        return {
          origin: location.origin,
          enhanced: document.querySelector('main[data-harness-root]')?.hasAttribute('data-docreader-root') ?? false,
          // The package's own faces that loaded (the local fallbacks depend on the machine's fonts, so they are left out).
          faces: [...document.fonts]
            .filter((f) => f.status === 'loaded' && !f.family.includes('Fallback'))
            .map((f) => `${f.family.replaceAll('"', '')} ${f.style}`),
        };
      });
      expect(state).toMatchObject({ origin: ORIGIN, enhanced: true });
      expect(state.faces).toContain('Docreader Serif normal');
      expect(await doc.violations()).toEqual([]);
      expect([doc.aborted, doc.missing]).toEqual([[], []]);
    } finally {
      await doc.close();
    }
  });

  it('a routed request to another origin is aborted and counted', async () => {
    const doc = await openDoc(DOC, {}, { browser });
    try {
      const failed = await doc.page.goto('https://elsewhere.example/page').then(() => 'loaded', (e: unknown) => String(e));
      expect(failed).not.toBe('loaded');
      expect(doc.aborted).toEqual(['https://elsewhere.example/page']);
    } finally {
      await doc.close();
    }
  });

  it('an unserved path on the page\'s origin is counted as missing; a favicon request never reaches the route', async () => {
    // playwright-core aborts every request for a path ending in /favicon.ico before routing it, so the harness needs
    // no exemption for a browser's own favicon request; this pins that, should a later version route it.
    const links = '<link rel="stylesheet" href="/favicon.ico"><link rel="stylesheet" href="/nope.css">';
    const doc = await openDoc(DOC, {}, { browser, html: (h) => `${links}${h}` });
    try {
      expect([...doc.missing].sort()).toEqual(['/nope.css']);
      expect(doc.aborted).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('a request let past the route reaches no host: neither a name nor an address on this machine', async () => {
    // A listener on loopback: a browser without the wall connects to it by name (unrouted.localhost resolves to
    // loopback) and by address. With the wall, Chromium resolves nothing and WebKit's proxy is a closed port.
    const connections: string[] = [];
    const listener = net.createServer((socket) => {
      connections.push(String(socket.remotePort));
      socket.destroy();
    });
    await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
    const port = String((listener.address() as net.AddressInfo).port);
    const doc = await openDoc(DOC, {}, { browser, unrouted: ['unrouted.localhost', '127.0.0.1'] });
    try {
      const results: string[] = [];
      for (const url of [`http://unrouted.localhost:${port}/`, `http://127.0.0.1:${port}/`]) {
        results.push(await doc.page.goto(url).then(() => 'loaded', (e: unknown) => String(e)));
      }
      expect(results.filter((r) => r === 'loaded')).toEqual([]);
      expect(connections).toEqual([]);
      // Chromium's resolver maps every name, and every address, to "not found".
      if (browser === 'chromium') for (const r of results) expect(r).toContain('net::ERR_NAME_NOT_RESOLVED');
      expect(doc.aborted).toEqual([]);
    } finally {
      await doc.close();
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
  });

  for (const csp of ['strict', 'reader'] as const) {
    it(`${csp}: no eval or Function, no fetch, ${csp === 'strict' ? 'no' : 'but'} inline styles`, async () => {
      const doc = await openDoc(DOC, {}, { browser, csp, enhance: false });
      try {
        const got = await doc.page.evaluate(async () => {
          const run = (f: () => unknown): string => {
            try {
              f();
              return 'ran';
            } catch (e) {
              return e instanceof Error ? e.name : 'thrown';
            }
          };
          const el = document.createElement('p');
          el.textContent = 'styled';
          document.body.append(el);
          el.setAttribute('style', 'color: rgb(255, 0, 0)');
          const sheet = document.createElement('style');
          sheet.textContent = 'p.inline-sheet { color: rgb(0, 0, 255); }';
          document.head.append(sheet);
          el.classList.add('inline-sheet');
          const fetched = await fetch('/page.css').then(() => 'fetched', () => 'refused');
          await new Promise((r) => setTimeout(r, 50)); // the violation events are queued
          return {
            evaluated: run(() => (0, eval)('1')),
            constructed: run(() => new Function('return 1')),
            fetched,
            color: getComputedStyle(el).color,
          };
        });
        expect(got).toEqual({
          evaluated: 'EvalError',
          constructed: 'EvalError',
          fetched: 'refused',
          color: csp === 'strict' ? 'rgb(0, 0, 0)' : 'rgb(255, 0, 0)',
        });
        // Each refusal is reported; a browser may name a directive's -attr or -elem form, so the family is compared. The
        // reports arrive as events, later under load, so the case waits for them rather than for a fixed time.
        const families = async (): Promise<string[]> =>
          [...new Set((await doc.violations()).map((v) => (v.split(' ')[0] ?? '').replace(/-(?:attr|elem)$/, '')))].sort();
        await expect.poll(families, { timeout: 10_000 }).toEqual(csp === 'strict' ? ['connect-src', 'script-src', 'style-src'] : ['connect-src', 'script-src']);
      } finally {
        await doc.close();
      }
    });
  }
});
