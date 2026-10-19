// The journal: every DOM write an instance makes, recorded so that teardown can undo it. Teardown undoes the
// entries in reverse and attempts every one even when one throws (the faults are returned, not thrown).
//
// Restores are conditional: an attribute or class the library wrote is put back only while it still holds what
// the library last wrote, so a change the host made since wins. Source nodes (the rendered document) are only
// moved, by `wrap` and `move`, and moved back on undo; a source text node may be partitioned by `split` (no
// character changes) and is joined again on undo; chrome (what the library creates) is inserted by `insert` and
// removed on undo. Listeners run inside the instance's operation, so a handler does nothing once the instance is not live.
//
// While the instance is not live, every write method refuses (does nothing), so no DOM write can follow a
// destroy, whatever a feature forgets to check.

/** The attribute every element the library creates carries, so teardown and tests find chrome without classes. */
export const CHROME_ATTR = 'data-docreader-chrome';

export interface Journal {
  /** Set (a string) or remove (null) an attribute; undo restores the original only if the value is still ours. */
  setAttribute(el: Element, name: string, value: string | null): void;
  /** Add or remove one class; undo restores it only if its presence is still what the library last wrote. */
  toggleClass(el: Element, cls: string, on: boolean): void;
  /** Insert a new chrome node (one with no parent yet); undo removes it, wherever it is by then. */
  insert(node: Node, parent: Node, before: Node | null): void;
  /**
   * Move a run of adjacent sibling source nodes, in order, into a new chrome `wrapper` placed where the run
   * started. Undo moves the wrapper's children at that time (anything the host put there included) back to where
   * the wrapper sits, in order, then removes the wrapper.
   */
  wrap(nodes: readonly Node[], wrapper: Element): void;
  /**
   * Move one source node to a new place (into chrome, usually). Undo puts it back where it was: before the
   * sibling that followed it then, in the parent it had then. Undone in reverse order, every move lands exactly.
   */
  move(node: Node, parent: Node, before: Node | null): void;
  /**
   * Partition a source text node at `offset` (0 < offset < length) without changing a character: the node keeps
   * the text before `offset`, and a new text node right after it holds the rest, which is returned. Undo joins the
   * two again, only while the new node still follows the first (a host that moved it wins).
   */
  split(text: Text, offset: number): Text;
  /** addEventListener with the handler run inside the instance's operation; undo removes the listener. */
  listen(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  /** A cleanup callback, run in its place in the reverse order. */
  defer(fn: () => void): void;
}

/** The lifecycle's own handle on a journal: the writer, plus the undo that teardown runs once. */
export interface JournalControl {
  readonly journal: Journal;
  /** Undo every entry in reverse, attempting each; returns what the failing ones threw. Empties the journal. */
  undoAll(): unknown[];
}

interface AttrRecord {
  readonly original: string | null;
  last: string | null;
}

interface ClassRecord {
  readonly originalAttr: string | null;
  readonly originalHad: boolean;
  last: boolean;
}

/** The distinct tokens of a class attribute value. */
function tokens(value: string | null): Set<string> {
  return new Set((value ?? '').split(/[\t\n\f\r ]+/).filter((t) => t !== ''));
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((t) => b.has(t));
}

/**
 * A journal for one instance. `live` says whether writes are still allowed; `operate` runs a handler as one
 * operation of the instance.
 */
export function createJournal(live: () => boolean, operate: (fn: () => void) => void): JournalControl {
  const undo: (() => void)[] = [];
  const attrs = new Map<Element, Map<string, AttrRecord>>();
  const classes = new Map<Element, Map<string, ClassRecord>>();

  const journal: Journal = {
    setAttribute(el, name, value) {
      if (!live()) return;
      let byName = attrs.get(el);
      if (byName === undefined) attrs.set(el, (byName = new Map()));
      let rec = byName.get(name);
      if (rec === undefined) {
        const r: AttrRecord = { original: el.getAttribute(name), last: null };
        byName.set(name, (rec = r));
        undo.push(() => {
          if (el.getAttribute(name) !== r.last) return; // the host changed it since: the host wins
          if (r.original === null) el.removeAttribute(name);
          else el.setAttribute(name, r.original);
        });
      }
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
      rec.last = value;
    },

    toggleClass(el, cls, on) {
      if (!live()) return;
      let byClass = classes.get(el);
      if (byClass === undefined) classes.set(el, (byClass = new Map()));
      let rec = byClass.get(cls);
      if (rec === undefined) {
        const originalAttr = el.getAttribute('class');
        const r: ClassRecord = { originalAttr, originalHad: tokens(originalAttr).has(cls), last: false };
        byClass.set(cls, (rec = r));
        undo.push(() => {
          if (el.classList.contains(cls) !== r.last) return; // the host changed it since: the host wins
          // Nothing else changed: put the attribute's original text back, byte for byte (absent stays absent).
          const now = tokens(el.getAttribute('class'));
          if (r.originalHad) now.add(cls);
          else now.delete(cls);
          if (sameSet(now, tokens(r.originalAttr))) {
            if (r.originalAttr === null) el.removeAttribute('class');
            else el.setAttribute('class', r.originalAttr);
          } else {
            el.classList.toggle(cls, r.originalHad);
          }
        });
      }
      el.classList.toggle(cls, on);
      rec.last = on;
    },

    insert(node, parent, before) {
      if (!live()) return;
      if (node.parentNode !== null) throw new Error('docreader: journal.insert takes a new chrome node');
      if (node.nodeType === 1) (node as Element).setAttribute(CHROME_ATTR, '');
      parent.insertBefore(node, before);
      undo.push(() => {
        node.parentNode?.removeChild(node);
      });
    },

    wrap(nodes, wrapper) {
      if (!live()) return;
      const first = nodes[0];
      const parent = first?.parentNode ?? null;
      if (first === undefined || parent === null) throw new Error('docreader: journal.wrap takes attached nodes');
      if (wrapper.parentNode !== null) throw new Error('docreader: journal.wrap takes a new chrome wrapper');
      for (let i = 1; i < nodes.length; i += 1) {
        if (nodes[i - 1]?.nextSibling !== nodes[i]) throw new Error('docreader: journal.wrap takes adjacent siblings, in order');
      }
      wrapper.setAttribute(CHROME_ATTR, '');
      parent.insertBefore(wrapper, first);
      for (const n of nodes) wrapper.appendChild(n);
      undo.push(() => {
        const at = wrapper.parentNode;
        if (at === null) throw new Error('docreader: a wrapper was removed by someone else; its contents stay with it');
        while (wrapper.firstChild !== null) at.insertBefore(wrapper.firstChild, wrapper);
        at.removeChild(wrapper);
      });
    },

    move(node, parent, before) {
      if (!live()) return;
      const from = node.parentNode;
      if (from === null) throw new Error('docreader: journal.move takes an attached node');
      const next = node.nextSibling;
      parent.insertBefore(node, before);
      undo.push(() => {
        if (next !== null && next.parentNode !== from) throw new Error('docreader: a moved node has lost its place; it stays where it is');
        from.insertBefore(node, next);
      });
    },

    split(text, offset) {
      if (!live()) throw new Error('docreader: journal.split after a destroy');
      if (!(offset > 0 && offset < text.data.length)) throw new Error('docreader: journal.split takes an offset inside the text');
      const tail = text.splitText(offset);
      undo.push(() => {
        if (text.nextSibling !== tail) return; // the host moved one of them since: the host wins
        text.appendData(tail.data);
        tail.parentNode?.removeChild(tail);
      });
      return tail;
    },

    listen(target, type, handler, options) {
      if (!live()) return;
      const wrapped = (event: Event): void => {
        operate(() => handler(event));
      };
      target.addEventListener(type, wrapped, options);
      undo.push(() => {
        target.removeEventListener(type, wrapped, options);
      });
    },

    defer(fn) {
      if (!live()) return;
      undo.push(fn);
    },
  };

  return {
    journal,
    undoAll() {
      const faults: unknown[] = [];
      while (undo.length > 0) {
        const step = undo.pop() as () => void;
        try {
          step();
        } catch (e) {
          faults.push(e);
        }
      }
      attrs.clear();
      classes.clear();
      return faults;
    },
  };
}

/** The adjacent siblings from `first` up to, not including, `stop` (or to the end): a run for `journal.wrap`. */
export function siblingRun(first: Node, stop: Node | null): Node[] {
  const run: Node[] = [];
  for (let n: Node | null = first; n !== null && n !== stop; n = n.nextSibling) run.push(n);
  return run;
}

/** A new chrome element of the root's document: tag, classes, text, and attributes; marked as chrome. */
export function chrome<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  init: { className?: string; text?: string; attrs?: Readonly<Record<string, string>> } = {},
  children: readonly Node[] = [],
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  el.setAttribute(CHROME_ATTR, '');
  if (init.className !== undefined) el.className = init.className;
  if (init.text !== undefined) el.textContent = init.text;
  for (const [k, v] of Object.entries(init.attrs ?? {})) el.setAttribute(k, v);
  for (const c of children) el.appendChild(c);
  return el;
}
