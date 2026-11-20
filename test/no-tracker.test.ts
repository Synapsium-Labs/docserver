// No default tracker anywhere in the library (docserver parity, Task 4): the library carries no tracker, so an item link comes
// only from what a host seeds. A scan of every source under src/ and of the built frame assets (the exact texts the build
// writes, but the Mermaid build, a third party's, whose own bug-report link is held apart) for the host name of a well-known issue
// tracker, and for the shape of an issue URL, finds none. `tracker.example`,
// the placeholder host the tests use, is no tracker. The scan's control plants each name and shape in a string.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { stop } from 'esbuild';
import { buildFrame } from '../scripts/build-frame.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The host names of well-known trackers, and the shape of an issue URL: a path of issues, tickets or `browse/KEY-n`. */
const TRACKERS: readonly RegExp[] = [
  /linear\.app/i,
  /atlassian\.(?:net|com)/i,
  /jira/i,
  /youtrack/i,
  /clubhouse\.io/i,
  /shortcut\.com/i,
  /asana\.com/i,
  /trello\.com/i,
  /monday\.com/i,
  /notion\.so/i,
  /dev\.azure\.com/i,
  /visualstudio\.com/i,
  /bitbucket\.org/i,
  /gitlab\.com/i,
  /github\.com\/[^\s'"`)]*\/(?:issues|pull)\b/i,
  /\/issues?\/(?:\d|new|\$|\{)/i,
  /\/browse\/(?:[A-Z][A-Z0-9]+-|\$\{)/,
  /\/tickets?\/(?:\d|\$|\{)/i,
];

const hits = (text: string): string[] => TRACKERS.filter((re) => re.test(text)).map((re) => String(re));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sources(p) : e.name.endsWith('.ts') || e.name.endsWith('.js') || e.name.endsWith('.css') ? [p] : [];
  });
}

describe('the scan: what it finds', () => {
  it('finds every well-known tracker host and issue URL shape, in any case, and not the tests\' placeholder host', () => {
    for (const planted of [
      'https://linear.app/team/issue/AB-1', 'https://acme.atlassian.net/browse/AB-12', 'https://JIRA.example.org/', 'https://x.youtrack.cloud/issue/AB-1',
      'api.clubhouse.io', 'app.shortcut.com', 'app.asana.com/0/1', 'trello.com/c/x', 'x.monday.com', 'notion.so/x', 'dev.azure.com/org/_workitems',
      'org.visualstudio.com', 'bitbucket.org/a/b', 'gitlab.com/a/b', 'https://github.com/o/r/issues/1', 'https://github.com/o/r/pull/2',
      'https://host.example/issues/12', 'https://host.example/browse/AB-12', 'https://host.example/tickets/7', '`${base}/browse/${key}`', '`${base}/issues/${n}`',
    ]) {
      expect(hits(planted), planted).not.toEqual([]);
    }
    for (const fine of ['https://tracker.example/AB-12', 'https://items.example/AB-1', 'an issue tracker', 'issues: none', 'https://github.com/o/r', '/browse/']) {
      expect(hits(fine), fine).toEqual([]);
    }
  });
});

describe('no default tracker anywhere in the library', () => {
  it('src/ names no tracker host and no issue URL template', () => {
    const files = sources(path.join(ROOT, 'src'));
    expect(files.length).toBeGreaterThan(100);
    const found = files.flatMap((f) => hits(readFileSync(f, 'utf8')).map((re) => `${path.relative(ROOT, f)}: ${re}`));
    expect(found).toEqual([]);
  });

  describe('the built frame assets', () => {
    let texts: Record<string, string>;
    beforeAll(async () => {
      const built = await buildFrame();
      texts = Object.fromEntries(Object.entries(built.files).map(([name, f]) => [name, (f as { text: string }).text]));
      await stop();
    }, 300_000);

    it('the guard, the bootstrap, the reader and its stylesheet name none', () => {
      expect(Object.keys(texts).sort()).toEqual(['bootstrap', 'css', 'enhance', 'guard', 'mermaid']);
      const found = ['guard', 'bootstrap', 'enhance', 'css'].flatMap((name) => hits(texts[name] ?? '').map((re) => `${name}: ${re}`));
      expect(found).toEqual([]);
    });

    it("the Mermaid build is a third party's, and names the issue page of Mermaid's own project (a bug-report link) and nothing else of the kind", () => {
      // Not an item link: nothing in it is read as one. Held so that a change of what it names is seen.
      const named = hits(texts['mermaid'] ?? '').sort();
      expect(named).toEqual([String(TRACKERS[14]), String(TRACKERS[15])].sort());
    });
  });
});
