// Browser parity of `./render` (docserver L1, Task 12; architecture section F T12, global constraint 3).
// esbuild bundles src/render/index.ts for the browser as one script that defines the global R, and the script
// runs in a fresh VM context: V8's own built-ins and nothing a host adds (no process, require, fetch, timers,
// DOM, storage or TextEncoder). The context's sandbox object has a null prototype: a plain {} hands the context
// the outer realm's Object.prototype, and through its constructor chain the outer Function and with it process.
// There the bundle must pass the whole corpus, and for every case its render()
// and scanRefs() results must equal the Node import's, byte for byte. A host API reached at run time, however
// it was reached, fails here: it is missing in the context (the render fails), or it answers differently there
// (the results differ). The static walls are test/purity.test.ts. Time is not what this file judges: the Node
// corpus run (test/corpus.test.ts) holds every maxMs at scale 1, so this second run of the same code scales
// them by TIME_SCALE and stays a parity check when the machine is busy.
// Arguments cross the boundary too: every options object a case passes to the bundle is created inside the
// context (its JSON literal evaluated there), so no outer-realm object, and no host Function through its
// constructor chain, reaches the sandboxed code.
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadCorpus, runCorpus, type CorpusRun } from '../src/conformance/index.js';
import * as node from '../src/render/index.js';

type RenderApi = typeof node;

const ENTRY = fileURLToPath(new URL('../src/render/index.ts', import.meta.url));
const TIME_SCALE = 10;

/** Host globals a browser page or Node would add; none may exist in the context. */
const HOST_GLOBALS = [
  'process', 'require', 'module', 'Buffer', 'fetch', 'XMLHttpRequest', 'WebSocket', 'window', 'self', 'document',
  'navigator', 'location', 'localStorage', 'sessionStorage', 'indexedDB', 'setTimeout', 'setInterval',
  'queueMicrotask', 'structuredClone', 'TextEncoder', 'TextDecoder', 'URL', 'atob', 'btoa', 'crypto', 'performance',
] as const;

interface Bundled {
  code: string;
  warnings: number;
  context: vm.Context;
  R: RenderApi;
  globalsAfter: string[];
}

/** A fresh VM context whose sandbox object has no prototype, so nothing of the outer realm hangs off it. */
function newSandbox(): vm.Context {
  return vm.createContext(Object.create(null));
}

/** A copy of a JSON value made inside the context: its objects and arrays belong to the context's realm, not the host's. */
function inContext<T>(context: vm.Context, value: T): T {
  if (value === undefined) return value;
  return vm.runInContext(`(${JSON.stringify(value)})`, context) as T;
}

/** Bundle src/render/index.ts for the browser and run it in an empty VM context. */
function bundleInEmptyContext(): Bundled {
  const out = buildSync({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'R',
    target: 'es2022',
    logLevel: 'silent',
  });
  const code = out.outputFiles[0]?.text ?? '';
  const context = newSandbox();
  vm.runInContext(code, context, { filename: 'docserver-render.bundle.js' });
  const sandbox = context as Record<string, unknown>;
  return { code, warnings: out.warnings.length, context, R: sandbox['R'] as RenderApi, globalsAfter: Object.keys(sandbox) };
}

describe('browser parity: the bundle in an empty VM context', () => {
  let b: Bundled;
  let vmRun: CorpusRun;
  const cases = loadCorpus();

  // Every call into the bundle goes through `bundle`, which records whether the options argument is an object of
  // the context's own realm (its prototype is the context's Object.prototype). Omitted options are allowed.
  let contextObjectPrototype: unknown;
  const seen = { withOptions: 0, host: [] as string[] };
  function note(call: string, options: unknown): void {
    if (options === undefined) return;
    seen.withOptions += 1;
    if (Object.getPrototypeOf(options) !== contextObjectPrototype) seen.host.push(`${call}: ${JSON.stringify(options)}`);
  }
  const bundle = {
    render(input: string, options?: Parameters<RenderApi['render']>[1]): ReturnType<RenderApi['render']> {
      note('render', options);
      return b.R.render(input, options);
    },
    scanRefs(input: string, options?: Parameters<RenderApi['scanRefs']>[1]): ReturnType<RenderApi['scanRefs']> {
      note('scanRefs', options);
      return b.R.scanRefs(input, options);
    },
  };

  beforeAll(() => {
    b = bundleInEmptyContext();
    contextObjectPrototype = vm.runInContext('Object.prototype', b.context);
    vmRun = runCorpus((input, options) => bundle.render(input, inContext(b.context, options)), {
      scanRefs: (input, options) => bundle.scanRefs(input, inContext(b.context, options)),
      timeScale: TIME_SCALE,
    });
  }, 300_000);

  it('bundles for the browser without a warning', () => {
    expect(b.warnings).toBe(0);
    expect(b.code.length).toBeGreaterThan(0);
  });

  it('the context holds none of the host globals', () => {
    const present = vm.runInContext(`${JSON.stringify(HOST_GLOBALS)}.filter((n) => typeof globalThis[n] !== 'undefined')`, b.context) as string[];
    expect([...present]).toEqual([]);
  });

  it('the context reaches no host Function: the constructor chain yields no process', () => {
    // Every step is guarded, so a probe that fails for another reason answers 'threw' and not a false pass.
    const probe = `(() => {
      try {
        return [].constructor.constructor('return this')().constructor.constructor('return typeof process')();
      } catch (e) {
        return 'threw';
      }
    })()`;
    expect(vm.runInContext(probe, newSandbox())).toBe('undefined');
    expect(vm.runInContext(probe, b.context)).toBe('undefined');
  });

  it('the options a case passes in are created in the context: the host Function is not reachable through them', () => {
    // From inside the context, walk an options object's constructor chain to a Function and ask it for process.
    const reach = vm.runInContext(
      `(o) => { try { return [].constructor.constructor('return typeof process')() + '/' + o.constructor.constructor('return typeof process')(); } catch (e) { return 'threw'; } }`,
      b.context,
    ) as (o: unknown) => string;
    // The probe can see a leak: an outer-realm object reaches the host's process.
    expect(reach({})).toBe('undefined/object');
    const reached = cases.filter((c) => reach(inContext(b.context, c.options)) !== 'undefined/undefined').map((c) => c.id);
    expect(reached).toEqual([]);
    expect(reach(inContext(b.context, { maxBytes: 9, lineAttrs: false }))).toBe('undefined/undefined');
  });

  it('the bundle defines exactly one global, R, with the same exports as the Node import', () => {
    expect(b.globalsAfter).toEqual(['R']);
    expect(Object.keys(b.R).sort()).toEqual(Object.keys(node).sort());
    expect(JSON.stringify(b.R.ALLOWLIST)).toBe(JSON.stringify(node.ALLOWLIST));
    expect([b.R.DEFAULT_MAX_BYTES, b.R.DEFAULT_MAX_IMAGES]).toEqual([node.DEFAULT_MAX_BYTES, node.DEFAULT_MAX_IMAGES]);
  });

  it('passes the whole corpus there', () => {
    const failed = vmRun.results.filter((r) => !r.ok).map((r) => `${r.id}: ${r.failures.join(' | ')}`);
    expect(failed).toEqual([]);
    expect([vmRun.ok, vmRun.total, vmRun.passed]).toEqual([true, cases.length, cases.length]);
    // The corpus run passed options in (so the recording is not vacuous), and every one was made in the context.
    expect(seen.withOptions).toBeGreaterThanOrEqual(cases.length);
    expect(seen.host).toEqual([]);
  });

  it("every case's render() and scanRefs() equal the Node import's, byte for byte", () => {
    const differ: string[] = [];
    const before = seen.withOptions;
    for (const c of cases) {
      const a = node.render(c.input, c.options);
      const v = bundle.render(c.input, inContext(b.context, c.options));
      if (JSON.stringify(v) !== JSON.stringify(a)) differ.push(`${c.id}: render`);
      const aFront = a.meta.front === null ? 'null' : String(Object.getPrototypeOf(a.meta.front));
      const vFront = v.meta.front === null ? 'null' : String(Object.getPrototypeOf(v.meta.front));
      if (aFront !== vFront) differ.push(`${c.id}: meta.front prototype`);
      const maxBytes = c.options.maxBytes;
      const scanOptions = maxBytes === undefined ? {} : { maxBytes };
      if (JSON.stringify(bundle.scanRefs(c.input, inContext(b.context, scanOptions))) !== JSON.stringify(node.scanRefs(c.input, scanOptions))) {
        differ.push(`${c.id}: scanRefs`);
      }
    }
    expect(differ).toEqual([]);
    expect(seen.withOptions - before).toBe(2 * cases.length);
    expect(seen.host).toEqual([]);
  });

  it('agrees with Node with data-line off, and over the byte cap', () => {
    const doc = '# Title\n\n> [!NOTE]\n> text\n\n```mermaid\nflowchart LR\n```\n\n*Figure 1. A.*\n';
    expect(JSON.stringify(bundle.render(doc, inContext(b.context, { lineAttrs: false })))).toBe(JSON.stringify(node.render(doc, { lineAttrs: false })));
    expect(JSON.stringify(bundle.render('x'.repeat(10), inContext(b.context, { maxBytes: 9 })))).toBe(JSON.stringify(node.render('x'.repeat(10), { maxBytes: 9 })));
    expect(seen.host).toEqual([]);
  });
});
