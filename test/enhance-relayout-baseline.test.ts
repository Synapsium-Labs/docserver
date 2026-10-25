// @vitest-environment jsdom
// C63: the root observer must distinguish a width already measured by start from a genuine first width change.
import { afterEach, describe, expect, it } from 'vitest';
import { createEnv, type Env, type ResizeChange } from '../src/enhance/env.js';
import { createJournal } from '../src/enhance/journal.js';
import type { Position } from '../src/enhance/nav.js';
import { createEvents } from '../src/enhance/registry.js';
import { createRelayout } from '../src/enhance/relayout.js';

type Shape = {
  display: string;
  writing: string;
  overflowX: string;
  overflowY: string;
  gutter: string;
  columns: string;
  columnWidth: string;
  sizing: string;
  width: string;
  paddingLeft: string;
  paddingRight: string;
  borderLeft: string;
  borderRight: string;
  rects: number;
};

const cleanups: (() => void)[] = [];

const normal = (): Shape => ({
  display: 'block',
  writing: 'horizontal-tb',
  overflowX: 'visible',
  overflowY: 'visible',
  gutter: 'auto',
  columns: 'auto',
  columnWidth: 'auto',
  sizing: 'content-box',
  width: '640px',
  paddingLeft: '0px',
  paddingRight: '0px',
  borderLeft: '0px',
  borderRight: '0px',
  rects: 1,
});

interface Scene {
  readonly root: HTMLElement;
  readonly shape: Shape;
  readonly runs: string[][];
  readonly events: string[][];
  readonly relayout: ReturnType<typeof createRelayout>;
  readonly observed: Element[];
  readonly computed: string[];
  onEvent(fn: () => void): void;
  setWidth(width: string): void;
  report(target: Element, width: number, height?: number): void;
  start(): void;
  flush(): void;
}

/** A real relayout with only its browser boundary made deterministic. */
function scene(root: HTMLElement = document.createElement('main')): Scene {
  const restoreDisconnected = !root.isConnected;
  if (restoreDisconnected) document.body.append(root);
  const shape = normal();
  Object.defineProperty(root, 'getClientRects', { configurable: true, value: () => Array.from({ length: shape.rects }) });
  let resize: ((changes: readonly ResizeChange[]) => void) | null = null;
  const observed: Element[] = [];
  const computed: string[] = [];
  const actualFrames: (() => void)[] = [];
  const request = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
  const cancel = Object.getOwnPropertyDescriptor(window, 'cancelAnimationFrame');
  let next = 1;
  const frameIds = new Map<number, () => void>();
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (fn: () => void): number => {
      const id = next;
      next += 1;
      frameIds.set(id, fn);
      actualFrames.push(() => {
        const callback = frameIds.get(id);
        frameIds.delete(id);
        callback?.();
      });
      return id;
    },
  });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: (id: number): void => { frameIds.delete(id); } });
  const live = (): boolean => true;
  const control = createJournal(live, (fn) => fn());
  cleanups.push(() => {
    control.undoAll();
    if (restoreDisconnected) root.remove();
    if (request === undefined) delete (window as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    else Object.defineProperty(window, 'requestAnimationFrame', request);
    if (cancel === undefined) delete (window as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
    else Object.defineProperty(window, 'cancelAnimationFrame', cancel);
  });
  const base = createEnv(root, control.journal, live, (fn) => fn());
  const env = {
    ...base,
    timeout: () => () => undefined,
    onResize: () => () => undefined,
    observeResize: (fn: (changes: readonly ResizeChange[]) => void) => {
      resize = fn;
      return {
        observe: (el: Element) => observed.push(el),
        unobserve: () => undefined,
        cancel: () => undefined,
      };
    },
    fonts: () => new Promise<boolean>(() => undefined),
    computed: (_el: Element, prop: string) => {
      computed.push(prop);
      const values: Record<string, string> = {
        display: shape.display,
        'writing-mode': shape.writing,
        'overflow-x': shape.overflowX,
        'overflow-y': shape.overflowY,
        'scrollbar-gutter': shape.gutter,
        'column-count': shape.columns,
        'column-width': shape.columnWidth,
        'box-sizing': shape.sizing,
        width: shape.width,
        'padding-left': shape.paddingLeft,
        'padding-right': shape.paddingRight,
        'border-left-width': shape.borderLeft,
        'border-right-width': shape.borderRight,
      };
      return values[prop] ?? '';
    },
  } satisfies Env;
  const events = createEvents(live);
  const position: Position = { keep: <T>(fn: () => T): T => fn(), holdBar: () => undefined, barHeld: () => false };
  const relayout = createRelayout({ root, env, events, position, live });
  const runs: string[][] = [];
  const emitted: string[][] = [];
  relayout.onRelayout((reasons) => runs.push([...reasons]));
  events.on('relayout', (payload) => emitted.push([...payload.reasons]));
  const flush = (): void => {
    while (actualFrames.length > 0) actualFrames.shift()?.();
  };
  return {
    root,
    shape,
    runs,
    events: emitted,
    relayout,
    observed,
    computed,
    onEvent: (fn) => {
      events.on('relayout', fn);
    },
    setWidth: (width) => {
      shape.width = width;
    },
    report: (target, width, height = 1) => resize?.([{ target, width, height }]),
    start: () => {
      relayout.relayout('start');
      flush();
    },
    flush,
  };
}

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
  document.body.replaceChildren();
});

describe('relayout startup width baseline', () => {
  it('suppresses an equal first grid report after the completed start measurement', () => {
    const s = scene();
    s.shape.display = 'grid';
    s.setWidth('1360px');
    s.start();
    expect([s.observed, s.runs, s.events]).toEqual([[s.root], [['start']], [['start']]]);

    s.report(s.root, 1360, 80);
    s.flush();
    expect(s.runs).toEqual([['start']]);
  });

  it('does not construct, schedule, or post-event seed a width baseline', () => {
    const s = scene();
    expect(s.computed).toEqual([]);

    s.relayout.relayout('content');
    expect(s.computed).toEqual([]);
    s.flush();
    expect(s.computed).toEqual([]);

    s.start();
    const afterStart = s.computed.length;
    s.relayout.relayout('content');
    s.flush();
    expect(s.computed).toHaveLength(afterStart);
  });

  it('keeps the first post-start report when its width changed', () => {
    const s = scene();
    s.start();
    s.setWidth('520px');
    s.report(s.root, 520);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('keeps a hidden root unknown and measures its first visible width without a zero report', () => {
    const s = scene();
    s.shape.rects = 0;
    s.start();
    s.shape.rects = 1;
    s.setWidth('611.25px');
    s.report(s.root, 611.25);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('does not turn an unknown hidden width into zero', () => {
    const s = scene();
    s.shape.rects = 0;
    s.start();
    s.report(s.root, 0);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('forgets a pre-start observer report and replaces it with the actual start baseline', () => {
    const s = scene();
    s.report(s.root, 0);
    s.setWidth('640px');
    s.start();
    expect(s.runs).toEqual([['start']]);
    s.report(s.root, 640);
    s.flush();
    expect(s.runs).toEqual([['start']]);
  });

  it('forgets a pre-start observer report when start leaves the root unknown', () => {
    const s = scene();
    s.report(s.root, 520);
    s.shape.rects = 0;
    s.start();
    s.shape.rects = 1;
    s.setWidth('520px');
    s.report(s.root, 520);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('keeps a changed width that arrives after start but before its first observer delivery', () => {
    const s = scene();
    s.start();
    s.setWidth('520px');
    s.report(s.root, 520);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('keeps the first equal report after a measuring listener faults at an unchanged width', () => {
    const s = scene();
    s.relayout.onRelayout((reasons) => {
      if (reasons.has('start')) throw new Error('measurement fault');
    });
    s.relayout.relayout('start');
    expect(() => s.flush()).toThrow('measurement fault');

    s.report(s.root, 640);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('keeps either sampled width when a measuring listener changes the root without faulting', () => {
    for (const firstReport of [640, 520]) {
      const s = scene();
      s.relayout.onRelayout((reasons) => {
        if (reasons.has('start')) s.setWidth('520px');
      });
      s.start();

      s.report(s.root, firstReport);
      s.flush();
      expect(s.runs, `first ${String(firstReport)}`).toEqual([['start'], ['resize']]);
    }
  });

  it('forgets a measuring-listener width change and fault, then keeps the next report', () => {
    const s = scene();
    s.relayout.onRelayout((reasons) => {
      if (reasons.has('start')) {
        s.setWidth('520px');
        throw new Error('measurement fault');
      }
    });
    s.relayout.relayout('start');
    expect(() => s.flush()).toThrow('measurement fault');
    s.report(s.root, 520);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('does not absorb a width change made by the public relayout event', () => {
    const s = scene();
    s.onEvent(() => s.setWidth('520px'));
    s.start();
    s.report(s.root, 520);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('rejects foreign and nonfinite reports before caching, while zero is an independent real width', () => {
    const s = scene();
    const foreign = document.createElement('main');
    document.body.append(foreign);
    s.start();
    s.report(foreign, 800);
    s.report(s.root, Number.NaN);
    s.report(s.root, Number.POSITIVE_INFINITY);
    s.report(s.root, 640, 9);
    s.flush();
    expect(s.runs).toEqual([['start']]);

    s.report(s.root, 0);
    s.flush();
    s.report(s.root, 0, 99);
    s.flush();
    s.report(s.root, 640);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize'], ['resize']]);
  });

  it('accepts only the strict block and grid content-box shapes', () => {
    const cases: readonly [string, (s: Scene) => void, boolean][] = [
      ['block fractions', (s) => s.setWidth('601.25px'), true],
      ['grid fractions', (s) => {
        s.shape.display = 'grid';
        s.setWidth('601.25px');
      }, true],
      ['inline grid', (s) => (s.shape.display = 'inline-grid'), false],
      ['contents', (s) => (s.shape.display = 'contents'), false],
      ['hidden', (s) => (s.shape.rects = 0), false],
      ['multiple rects', (s) => (s.shape.rects = 2), false],
      ['vertical writing', (s) => (s.shape.writing = 'vertical-rl'), false],
      ['overflow x', (s) => (s.shape.overflowX = 'auto'), false],
      ['overflow y', (s) => (s.shape.overflowY = 'hidden'), false],
      ['gutter', (s) => (s.shape.gutter = 'stable'), false],
      ['column count', (s) => (s.shape.columns = '2'), false],
      ['column width', (s) => (s.shape.columnWidth = '20px'), false],
      ['unsupported box sizing', (s) => (s.shape.sizing = 'padding-box'), false],
      ['non-pixel width', (s) => s.setWidth('50%'), false],
      ['garbage width', (s) => s.setWidth('600px rest'), false],
      ['negative width', (s) => s.setWidth('-1px'), false],
    ];
    for (const [name, change, eligible] of cases) {
      const s = scene();
      change(s);
      const first = eligible ? Number(s.shape.width.slice(0, -2)) : 640;
      s.start();
      s.report(s.root, first);
      s.flush();
      expect(s.runs, name).toHaveLength(eligible ? 1 : 2);
    }
  });

  it('keeps html, body, foreign and disconnected roots unknown', () => {
    const roots = [
      document.documentElement,
      document.body,
      document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as HTMLElement,
      document.createElement('main'),
    ];
    for (const root of roots) {
      const s = scene(root);
      if (root.localName === 'main') root.remove();
      s.start();
      s.report(s.root, 640);
      s.flush();
      expect(s.runs).toEqual([['start'], ['resize']]);
    }
  });

  it('uses resolved border-box content width and preserves fractions without bounding or client widths', () => {
    const s = scene();
    s.shape.sizing = 'border-box';
    s.setWidth('600.5px');
    s.shape.paddingLeft = '10.25px';
    s.shape.paddingRight = '10.25px';
    s.shape.borderLeft = '1px';
    s.shape.borderRight = '1px';
    s.start();
    s.report(s.root, 578);
    s.flush();
    expect(s.runs).toEqual([['start']]);
    s.report(s.root, 578.5);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('keeps border-box roots unknown for invalid edges or negative derived content width', () => {
    const cases: readonly [string, number, (s: Scene) => void][] = [
      ['nonpixel padding', 0, (s) => (s.shape.paddingLeft = '10%')],
      ['invalid padding', 0, (s) => (s.shape.paddingRight = '10px rest')],
      ['negative padding', 0, (s) => (s.shape.paddingLeft = '-1px')],
      ['nonpixel border', 0, (s) => (s.shape.borderLeft = 'thin')],
      ['invalid border', 0, (s) => (s.shape.borderRight = '1.px')],
      ['negative border', 0, (s) => (s.shape.borderLeft = '-1px')],
      ['negative derived content', 0, (s) => {
        s.setWidth('10px');
        s.shape.paddingLeft = '6px';
        s.shape.paddingRight = '6px';
      }],
    ];
    for (const [name, firstReport, change] of cases) {
      const s = scene();
      s.shape.sizing = 'border-box';
      change(s);
      s.start();
      s.report(s.root, firstReport);
      s.flush();
      expect(s.runs, name).toEqual([['start'], ['resize']]);
    }
  });

  it('does not seed plausible widths from invalid border-box edges or a negative result', () => {
    const cases: readonly [string, number, (s: Scene) => void][] = [
      ['partial 10% padding would seed 630', 630, (s) => (s.shape.paddingLeft = '10%')],
      ['partial 10px rest padding would seed 630', 630, (s) => (s.shape.paddingRight = '10px rest')],
      ['accepted -1px padding would seed 641', 641, (s) => (s.shape.paddingLeft = '-1px')],
      ['accepted -1px border would seed 641', 641, (s) => (s.shape.borderLeft = '-1px')],
      ['partial 1.px border would seed 639', 639, (s) => (s.shape.borderRight = '1.px')],
      ['defaulted thin border would seed 640', 640, (s) => (s.shape.borderLeft = 'thin')],
      ['finite-only negative result would seed -2', -2, (s) => {
        s.setWidth('10px');
        s.shape.paddingLeft = '6px';
        s.shape.paddingRight = '6px';
      }],
    ];
    for (const [semanticReversal, firstReport, change] of cases) {
      const s = scene();
      s.shape.sizing = 'border-box';
      change(s);
      s.start();
      // Each fresh scene makes the first report match only its named invalid baseline.
      s.report(s.root, firstReport);
      s.flush();
      expect(s.runs, semanticReversal).toEqual([['start'], ['resize']]);
    }
  });

  it('rejects non-CSS pixel syntax rather than partially accepting it', () => {
    const s = scene();
    s.setWidth('600.px');
    s.start();
    s.report(s.root, 600);
    s.flush();
    expect(s.runs).toEqual([['start'], ['resize']]);
  });

  it('does not request resize from a root report while a scheduled start is still pending', () => {
    const s = scene();
    s.relayout.relayout('start');
    s.report(s.root, 520);
    s.setWidth('520px');
    s.flush();
    expect(s.runs).toEqual([['start']]);
    s.report(s.root, 520);
    s.flush();
    expect(s.runs).toEqual([['start']]);
  });
});
