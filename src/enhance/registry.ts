// The shared registries of one instance (docserver L2, Task 7b; LD1): what one feature defines and later features
// read, made by the lifecycle before the first feature builds, so the feature tasks touch only their own files.
//
//   index    every defined ID (LD6): `define(e)` (the first definition of an ID wins; a later one returns false),
//            `get(id)`, `of(el)` (the entry whose target or row is `el`) and `all()`, in document order. Kinds:
//            'rule' (rules.ts), 'row' and 'section' (ids.ts), 'figure' (figures.ts). Readers: xrefs, nav (byId's
//            fallback, idOf), jump, cards, rail, attention, strip, diagram-tools. An entry is frozen; its target is an
//            element of the root that is not chrome (rows and rules carry no id: the index is how a link finds them).
//   terms    the glossary's terms (glossary.ts defines them): `define(t)` makes an entry for a new name and adds a
//            definition to an existing one (matched case-insensitively), `get(name)`, `all()` in definition order.
//   blocks   every table (`div.table-wrapper` with its table) and code block (`div.codehilite` outside a figure) of the
//            document, in document order, collected before any feature builds. An entry's flags are written by one
//            feature each and read by the rest: `isIndex` (ids.ts), `glossary` (glossary.ts), `filter` (tables.ts),
//            `tech` (attention.ts).
//   figures  the numbered figures (figures.ts adds them): `add(e)` (one entry per figure element), `of(el)`, `all()` in
//            document order.
//   plan     tasks, steps, the reader's own steps and whether the plan takes the outline mode: published once, by
//            plans.ts; until then empty.
//   page     the title block's parts: the byline, the facts panel's seam (`facts`), the items waiting on the reader
//            and their box: published once, by editorial.ts (the first feature built); until then empty.
//   events   `on(name, fn)` (returns its cancel) and `emit(name, payload)`, for six names: 'prefs' (the lifecycle, when
//            the prefs change), 'relayout' (relayout.ts, after each run), 'spy' (scroll.ts), 'marks' (marks.ts),
//            'changes' (changes.ts) and 'reveal' (reveal.ts). A listener runs in the emitter's operation; each runs even
//            when one before it threw, and the first throw is thrown again once all have run. Nothing is emitted once
//            the instance is not live, and a listener that destroys it stops the rest.
//
// Pure: no DOM writes. A registry holds elements, so it lives as long as its instance's context. Keys are Map keys,
// never an object's properties, so an ID or a term such as `__proto__` or `constructor` is an ordinary key (RF1).
//
// Import-inert: declarations only.
import type { Cancel } from './env.js';
import { CHROME_ATTR } from './journal.js';
import { before, inOrder } from './text.js';
import type { Prefs } from './types.js';
import type { StatusRole } from './vocab.js';

/** The kinds of a defined ID. */
export type IndexKind = 'rule' | 'row' | 'section' | 'figure';

/** The kinds `define` accepts. */
export const INDEX_KINDS: readonly IndexKind[] = ['rule', 'row', 'section', 'figure'];

/** The longest ID, term name or label a registry takes, in code units. */
export const NAME_MAX = 200;

/** One defined ID. */
export interface IndexEntry {
  /** The ID as the document writes it ("R14", "F3"). */
  readonly id: string;
  readonly kind: IndexKind;
  /** Its title, for a preview, a jump result or a contents line (the definer clips it). */
  readonly title: string;
  /** Its status's colour role, or null. */
  readonly status: StatusRole | null;
  /** The heading it sits under, for grouping ("Decisions"), or ''. */
  readonly group: string;
  /** Where a link to it goes: the rule's paragraph, the row, the heading, the figure. */
  readonly target: Element;
  /** The table row that defines it (kind 'row'), else null. */
  readonly row: Element | null;
  /** Its table's header texts (kind 'row'), else empty. */
  readonly heads: readonly string[];
}

export interface IdIndex {
  /** Define an ID; false (and nothing changes) when it is defined already: the first definition wins. Throws on a malformed entry. */
  define(e: IndexEntry): boolean;
  get(id: string): IndexEntry | undefined;
  /** The entry whose target or row is `el`. */
  of(el: Element): IndexEntry | undefined;
  /** Every entry, in the document order of its target (frozen). */
  all(): readonly IndexEntry[];
}

/** One definition of a term: its qualifier ("for plans"), its meaning cell and its row. */
export interface TermDef {
  readonly qual: string;
  readonly cell: Element;
  readonly row: Element;
}

/** One glossary term. */
export interface TermEntry {
  /** As the glossary spells it ("Read mark"). */
  readonly name: string;
  /** What a mention matches: the name in lower case, its white space runs as one space. */
  readonly key: string;
  /** Matched only as spelled (case and all), as a name listed with others ("A, B and C") is. */
  readonly exact: boolean;
  /** The glossary's section name ("Words used here"), or ''. */
  readonly section: string;
  /** Where a link to it goes: its first row. */
  readonly target: Element;
  /** Its definitions, in the order they were defined (frozen; a later definition replaces the list). */
  readonly defs: readonly TermDef[];
}

export interface TermInit {
  readonly name: string;
  readonly exact: boolean;
  readonly section: string;
  readonly target: Element;
  readonly def: TermDef;
}

export interface Terms {
  /** The entry for `t.name`: a new one, or the existing one with `t.def` added (its other fields stay the first's). */
  define(t: TermInit): TermEntry;
  /** The entry a mention `name` matches (case-insensitively, white space as one space). */
  get(name: string): TermEntry | undefined;
  /** Every entry, in the order they were first defined (frozen). */
  all(): readonly TermEntry[];
}

/** A table of the document, as section 8 of the reference layout reads it. */
export interface TableBlock {
  readonly kind: 'table';
  /** render()'s `div.table-wrapper`. */
  readonly el: HTMLElement;
  readonly table: HTMLTableElement;
  /** The header row's texts (white space as one space, trimmed). */
  readonly heads: readonly string[];
  /** The body rows. */
  readonly rows: readonly HTMLTableRowElement[];
  /** An index of definitions (most first cells are IDs). Written by ids.ts. */
  isIndex: boolean;
  /** A glossary. Written by glossary.ts. */
  glossary: boolean;
  /** Engineering detail, quieter under the product lens. Written by attention.ts. */
  tech: boolean;
  /** Its filter field (a table of 12 rows or more). Written by tables.ts. */
  filter: HTMLInputElement | null;
}

/** A code block of the document, outside figures. */
export interface CodeBlock {
  readonly kind: 'code';
  /** render()'s `div.codehilite`. */
  readonly el: HTMLElement;
  readonly pre: HTMLPreElement | null;
  /** Engineering detail, quieter under the product lens. Written by attention.ts. */
  tech: boolean;
}

export type Block = TableBlock | CodeBlock;

/** One numbered figure. */
export interface FigureEntry {
  /** Its number as the caption writes it ("3"). */
  readonly no: string;
  /** The caption's text after the number. */
  readonly caption: string;
  readonly figure: HTMLElement;
}

export interface Figures {
  /** Add a figure; false (and nothing changes) when that figure element has an entry already. Throws on a malformed entry. */
  add(e: FigureEntry): boolean;
  of(figure: Element): FigureEntry | undefined;
  /** Every entry, in document order (frozen). */
  all(): readonly FigureEntry[];
}

/** What plans.ts finds (the reference layout, section 7). */
export interface PlanInfo {
  /** The task headings, in document order. */
  readonly tasks: readonly HTMLElement[];
  /** The steps (`li.task-list-item`), in document order. */
  readonly steps: readonly HTMLElement[];
  /** How many steps name the reader as their owner. */
  readonly yours: number;
  /** Long enough for the outline mode (20 steps or more). */
  readonly outlineable: boolean;
}

/** The plan, as features read it: empty until plans.ts publishes it. */
export interface PlanSlot extends PlanInfo {
  /** Publish the plan, once (plans.ts); a second call throws. */
  publish(p: PlanInfo): void;
  readonly published: boolean;
}

/**
 * The facts panel (the front matter's list keys, editorial.ts), as a seam a plugin builds into: the rules index
 * (rules.ts) takes the rule-ID keys out of the list and puts its own parts first, in the reference's order.
 */
export interface FactsSeam {
  /** The panel (`details.doc-facts`), or null when the document has none. */
  readonly panel: HTMLElement | null;
  /**
   * Take list key `key` out of the panel: its `dt`, its `dd` and its part of the summary go (they are chrome), and
   * its values are returned (frozen); null when the panel does not show that key.
   */
  take(key: string): readonly string[] | null;
  /** Put a plugin's part in the summary, before the panel's own parts and after earlier plugin parts. False without a panel. */
  summary(part: Node): boolean;
  /**
   * Put a plugin's block in the panel's body, before the list of keys, after earlier plugin blocks. False without a
   * panel. (Named `block`, not `body`: the walls refuse the member name `body`, the page's.)
   */
  block(node: Node): boolean;
}

/** The title block's parts (editorial.ts). */
export interface PageInfo {
  /** The byline (`dl.byline`), or null. */
  readonly byline: HTMLElement | null;
  readonly facts: FactsSeam;
  /** The items of the first "Waiting" box of "Where things stand", in order. */
  readonly waiting: readonly HTMLElement[];
  /** That box (`div.callout.waiting`), or null. */
  readonly waitBox: HTMLElement | null;
}

/** The page, as features read it: empty until editorial.ts publishes it. */
export interface PageSlot extends PageInfo {
  /** Publish the page, once (editorial.ts); a second call throws. */
  publish(p: PageInfo): void;
  readonly published: boolean;
}

/** Why a relayout ran (relayout.ts). */
export type RelayoutReason = 'start' | 'resize' | 'fonts' | 'prefs' | 'lens' | 'folds' | 'outline' | 'content';

/** A read mark's state (marks.ts). */
export type MarkState = 'unread' | 'read' | 'changed';

/** The events and what each carries. */
export interface EventMap {
  /** The prefs in force, after a change. */
  prefs: Readonly<Prefs>;
  /** A relayout ran, for these reasons. */
  relayout: { readonly reasons: readonly RelayoutReason[] };
  /** The section (h2) and the read-mark unit at the reading line changed. */
  spy: { readonly section: HTMLElement | null; readonly unit: HTMLElement | null };
  /** The read marks changed: every unit's state now. */
  marks: { readonly units: readonly { readonly heading: HTMLElement; readonly state: MarkState }[] };
  /** A change set was shown (the headings of the sections it marked) or hidden (none). */
  changes: { readonly sections: readonly HTMLElement[] };
  /** reveal() showed an element. */
  reveal: { readonly target: Element };
}

export type EventName = keyof EventMap;

/** The events, in the order the header lists them. */
export const EVENT_NAMES: readonly EventName[] = ['prefs', 'relayout', 'spy', 'marks', 'changes', 'reveal'];

export interface Events {
  /** Listen; the cancel stops it. Throws for a name not in EVENT_NAMES. */
  on<K extends EventName>(name: K, fn: (payload: EventMap[K]) => void): Cancel;
  /** Call every listener of `name` with `payload`, in the order they began listening; see the header. */
  emit<K extends EventName>(name: K, payload: EventMap[K]): void;
}

const isElement = (v: unknown): v is Element => typeof v === 'object' && v !== null && (v as { nodeType?: unknown }).nodeType === 1;

const isName = (v: unknown): v is string => typeof v === 'string' && v !== '' && v.length <= NAME_MAX;

/** A text with its white space runs as one space, trimmed. */
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** The ID index of one instance. `root` bounds the targets. */
export function createIndex(root: Element): IdIndex {
  const byId = new Map<string, IndexEntry>();
  const byEl = new WeakMap<Element, IndexEntry>();
  let sorted: readonly IndexEntry[] | null = null;
  return Object.freeze({
    define(e: IndexEntry): boolean {
      if (typeof e !== 'object' || e === null) throw new Error('docreader: index.define takes an entry');
      const { id, kind, title, status, group, target, row, heads } = e;
      if (!isName(id)) throw new Error('docreader: an index entry has an id of 1 to 200 code units');
      if (!INDEX_KINDS.includes(kind)) throw new Error(`docreader: an index entry's kind is one of ${INDEX_KINDS.join(', ')}`);
      if (typeof title !== 'string' || typeof group !== 'string') throw new Error('docreader: an index entry has a title and a group');
      if (status !== null && status !== 'ok' && status !== 'wait' && status !== 'no' && status !== 'info') {
        throw new Error('docreader: an index entry\'s status is a colour role or null');
      }
      if (!isElement(target) || target === root || !root.contains(target) || target.hasAttribute(CHROME_ATTR)) {
        throw new Error('docreader: an index entry\'s target is an element of the document inside the root');
      }
      if (row !== null && !(isElement(row) && root.contains(row))) throw new Error('docreader: an index entry\'s row is an element inside the root, or null');
      if (!Array.isArray(heads) || !heads.every((h) => typeof h === 'string')) throw new Error('docreader: an index entry\'s heads are strings');
      if (byId.has(id)) return false;
      const entry: IndexEntry = Object.freeze({ id, kind, title, status, group, target, row, heads: Object.freeze([...heads]) });
      byId.set(id, entry);
      if (!byEl.has(target)) byEl.set(target, entry);
      if (row !== null && !byEl.has(row)) byEl.set(row, entry);
      sorted = null;
      return true;
    },
    get: (id: string): IndexEntry | undefined => byId.get(id),
    of: (el: Element): IndexEntry | undefined => byEl.get(el),
    all(): readonly IndexEntry[] {
      if (sorted === null) {
        const list = [...byId.values()];
        list.sort((a, b) => (a.target === b.target ? 0 : before(a.target, b.target) ? -1 : 1));
        sorted = Object.freeze(list);
      }
      return sorted;
    },
  });
}

/** The key a term name, or a mention of it, is matched by. */
export function termKey(name: string): string {
  return squash(name).toLowerCase();
}

/** The glossary's terms of one instance. */
export function createTerms(root: Element): Terms {
  const byKey = new Map<string, { readonly entry: TermEntry; readonly add: (d: TermDef) => void }>();
  let list: readonly TermEntry[] = Object.freeze([]);
  return Object.freeze({
    define(t: TermInit): TermEntry {
      if (typeof t !== 'object' || t === null) throw new Error('docreader: terms.define takes a term');
      const { name, exact, section, target, def } = t;
      if (!isName(name) || termKey(name) === '') throw new Error('docreader: a term has a name of 1 to 200 code units');
      if (typeof exact !== 'boolean' || typeof section !== 'string') throw new Error('docreader: a term has exact and a section');
      if (!isElement(target) || !root.contains(target)) throw new Error('docreader: a term\'s target is an element inside the root');
      if (typeof def !== 'object' || def === null || typeof def.qual !== 'string' || !isElement(def.cell) || !isElement(def.row)) {
        throw new Error('docreader: a term\'s definition has a qualifier, a cell and a row');
      }
      const d: TermDef = Object.freeze({ qual: def.qual, cell: def.cell, row: def.row });
      const key = termKey(name);
      const held = byKey.get(key);
      if (held !== undefined) {
        held.add(d);
        return held.entry;
      }
      let defs: readonly TermDef[] = Object.freeze([d]);
      const entry: TermEntry = Object.freeze({
        name: squash(name),
        key,
        exact,
        section,
        target,
        get defs(): readonly TermDef[] {
          return defs;
        },
      });
      byKey.set(key, {
        entry,
        add: (x: TermDef) => {
          defs = Object.freeze([...defs, x]);
        },
      });
      list = Object.freeze([...list, entry]);
      return entry;
    },
    get: (name: string): TermEntry | undefined => byKey.get(termKey(name))?.entry,
    all: (): readonly TermEntry[] => list,
  });
}

const txt = (n: Node): string => squash(n.textContent ?? '');

/**
 * The document's tables and code blocks, in document order: each `div.table-wrapper` holding a table, and each
 * `div.codehilite` that is not inside a figure. Read before any feature builds: the header texts, the body rows.
 */
export function collectBlocks(root: Element): readonly Block[] {
  const out: Block[] = [];
  for (const el of Array.from(root.querySelectorAll('.table-wrapper, .codehilite')) as HTMLElement[]) {
    if (el.classList.contains('table-wrapper')) {
      const table = el.querySelector('table');
      if (table === null) continue;
      const headRow = table.tHead?.rows[0];
      out.push({
        kind: 'table',
        el,
        table,
        heads: Object.freeze(headRow === undefined ? [] : Array.from(headRow.cells).map(txt)),
        rows: Object.freeze(Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[]),
        isIndex: false,
        glossary: false,
        tech: false,
        filter: null,
      });
    } else if (el.closest('figure') === null) {
      out.push({ kind: 'code', el, pre: el.querySelector('pre'), tech: false });
    }
  }
  return Object.freeze(out);
}

/** The figures of one instance. */
export function createFigures(root: Element): Figures {
  const byFigure = new Map<Element, FigureEntry>();
  let sorted: readonly FigureEntry[] | null = null;
  return Object.freeze({
    add(e: FigureEntry): boolean {
      if (typeof e !== 'object' || e === null) throw new Error('docreader: figures.add takes an entry');
      const { no, caption, figure } = e;
      if (!isName(no) || typeof caption !== 'string') throw new Error('docreader: a figure entry has a number and a caption');
      if (!isElement(figure) || figure === root || !root.contains(figure)) throw new Error('docreader: a figure entry\'s figure is an element inside the root');
      if (byFigure.has(figure)) return false;
      byFigure.set(figure, Object.freeze({ no, caption, figure }));
      sorted = null;
      return true;
    },
    of: (figure: Element): FigureEntry | undefined => byFigure.get(figure),
    all(): readonly FigureEntry[] {
      if (sorted === null) {
        const order = inOrder([...byFigure.keys()]);
        sorted = Object.freeze(order.map((f) => byFigure.get(f) as FigureEntry));
      }
      return sorted;
    },
  });
}

const elements = (v: unknown): v is readonly HTMLElement[] => Array.isArray(v) && v.every(isElement);

/** The plan slot of one instance: empty until published. */
export function createPlan(): PlanSlot {
  let info: PlanInfo = Object.freeze({ tasks: Object.freeze([]), steps: Object.freeze([]), yours: 0, outlineable: false });
  let published = false;
  return Object.freeze({
    get tasks() {
      return info.tasks;
    },
    get steps() {
      return info.steps;
    },
    get yours() {
      return info.yours;
    },
    get outlineable() {
      return info.outlineable;
    },
    get published() {
      return published;
    },
    publish(p: PlanInfo): void {
      if (published) throw new Error('docreader: the plan is published once');
      if (typeof p !== 'object' || p === null || !elements(p.tasks) || !elements(p.steps)) throw new Error('docreader: a plan has tasks and steps');
      if (!Number.isInteger(p.yours) || p.yours < 0 || typeof p.outlineable !== 'boolean') throw new Error('docreader: a plan has a count of yours and outlineable');
      info = Object.freeze({ tasks: Object.freeze([...p.tasks]), steps: Object.freeze([...p.steps]), yours: p.yours, outlineable: p.outlineable });
      published = true;
    },
  });
}

/** A facts seam with no panel: nothing to take, and nowhere to put a part. */
export function noFacts(): FactsSeam {
  return Object.freeze({ panel: null, take: () => null, summary: () => false, block: () => false });
}

/** The page slot of one instance: empty until published. */
export function createPage(): PageSlot {
  let info: PageInfo = Object.freeze({ byline: null, facts: noFacts(), waiting: Object.freeze([]), waitBox: null });
  let published = false;
  return Object.freeze({
    get byline() {
      return info.byline;
    },
    get facts() {
      return info.facts;
    },
    get waiting() {
      return info.waiting;
    },
    get waitBox() {
      return info.waitBox;
    },
    get published() {
      return published;
    },
    publish(p: PageInfo): void {
      if (published) throw new Error('docreader: the page is published once');
      if (typeof p !== 'object' || p === null || typeof p.facts !== 'object' || p.facts === null || !elements(p.waiting)) {
        throw new Error('docreader: a page has its facts and its waiting items');
      }
      if ((p.byline !== null && !isElement(p.byline)) || (p.waitBox !== null && !isElement(p.waitBox))) {
        throw new Error('docreader: a page\'s byline and box are elements, or null');
      }
      info = Object.freeze({ byline: p.byline, facts: p.facts, waiting: Object.freeze([...p.waiting]), waitBox: p.waitBox });
      published = true;
    },
  });
}

/** The events of one instance: `live` is its own. */
export function createEvents(live: () => boolean): Events {
  const listeners = new Map<EventName, ((payload: never) => void)[]>();
  return Object.freeze({
    on<K extends EventName>(name: K, fn: (payload: EventMap[K]) => void): Cancel {
      if (!EVENT_NAMES.includes(name)) throw new Error(`docreader: events.on takes one of ${EVENT_NAMES.join(', ')}`);
      if (typeof fn !== 'function') throw new Error('docreader: events.on takes a function');
      let list = listeners.get(name);
      if (list === undefined) listeners.set(name, (list = []));
      const held = fn as (payload: never) => void;
      list.push(held);
      return () => {
        const at = list.indexOf(held);
        if (at >= 0) list.splice(at, 1);
      };
    },
    emit<K extends EventName>(name: K, payload: EventMap[K]): void {
      if (!live()) return;
      const list = [...(listeners.get(name) ?? [])];
      const faults: unknown[] = [];
      for (const fn of list) {
        try {
          (fn as (p: EventMap[K]) => void)(payload);
        } catch (e) {
          faults.push(e);
        }
        if (!live()) break;
      }
      if (faults.length > 0) throw faults[0];
    },
  });
}
