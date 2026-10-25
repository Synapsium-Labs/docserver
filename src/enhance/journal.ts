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
//
// Styles (LD11): setStyle is the library's one style write, and this file its one reach into an element's inline
// style. It writes through the CSSOM (`style.setProperty`), which a strict Content Security Policy allows where it
// refuses a style attribute, and only the properties of a closed list, each a feature's measured value: three only
// with `!important` (a definition dot's and ring's paint, which must beat a diagram's own `!important` rules) and the
// others never with it. A value that could load a resource, escape or end the declaration is refused. Undo is
// conditional like an attribute's: each property goes back to the value and priority it had, unless the host has
// changed it since; an element that had no style attribute loses the empty one the CSSOM leaves.

/** The attribute every element the library creates carries, so teardown and tests find chrome without classes. */
export const CHROME_ATTR = 'data-docreader-chrome';

/** The style properties setStyle writes without `important` (LD11's closed list). */
export const STYLE_PROPS = [
  '--thead-h', '--fig-w', '--bar-h', 'left', 'top', 'right', 'width', 'max-height', 'transform', 'opacity', 'stroke-dasharray', 'stroke-dashoffset',
] as const;

/** The style properties setStyle writes only with `important`: a definition dot's and ring's paint. */
export const IMPORTANT_STYLE_PROPS = ['fill', 'stroke', 'stroke-width'] as const;

export type StyleProp = (typeof STYLE_PROPS)[number] | (typeof IMPORTANT_STYLE_PROPS)[number];

/** The longest style value setStyle writes, in code units. */
const STYLE_VALUE_MAX = 200;

/** A style value that could load a resource (a url() or an image function), escape a character, or end its declaration. */
const STYLE_VALUE_REFUSED = /[\\;{}]|(?:url|src|image|image-set|cross-fade|element|paint)\s*\(/i;
const ROOT_ISSUED_ID = /^docreader\.\d+\.[a-z][a-z0-9-]*(?:\.\d+)?$/;
const LOCAL_URL = /^url\(\s*(?:['"])?#([A-Za-z][\w:.-]*)(?:['"])?\s*\)$/i;
const LOCAL_HREF = /^#([A-Za-z][\w:.-]*)$/;

/** An element with an inline style: HTML, SVG or MathML. */
export type Styled = Element & ElementCSSInlineStyle;

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
   * If that sibling has left the parent since, undo still puts the node back in the parent (after its old previous
   * sibling, or at the end) and then throws, so teardown reports the fault and no text is lost with the chrome.
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
  /**
   * Set (a string) or remove (null) one style property through the CSSOM: a name of STYLE_PROPS, or with `important`
   * one of IMPORTANT_STYLE_PROPS; anything else, or a refused value, throws. Undo restores the property's value and
   * priority only while they are still what the library last wrote, and removes the style attribute the CSSOM leaves
   * when the element had none and nothing is left in it.
   */
  setStyle(el: Styled, prop: StyleProp, value: string | null, important?: boolean): void;
  /** Clone an SVG into chrome and rebind a complete, validated local ID snapshot within that detached clone only. */
  cloneSvg(source: SVGSVGElement, ids: ReadonlyMap<string, string>): SVGSVGElement;
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

interface StyleRecord {
  readonly value: string;
  readonly priority: string;
  last: { value: string; priority: string };
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

function mappedUrl(value: string, ids: ReadonlyMap<string, string>): string {
  let out = '';
  let at = 0;
  while (at < value.length) {
    const ch = value[at] ?? '';
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let end = at + 1;
      while (end < value.length) {
        if (value[end] === '\\') end += 2;
        else if (value[end++] === quote) break;
      }
      out += value.slice(at, end);
      at = end;
    } else if (value.slice(at, at + 4).toLowerCase() === 'url(') {
      const end = value.indexOf(')', at + 4);
      const token = end < 0 ? value.slice(at) : value.slice(at, end + 1);
      const match = LOCAL_URL.exec(token);
      const next = match === null ? undefined : ids.get(match[1] ?? '');
      out += next === undefined ? token : `url(#${next})`;
      at += token.length;
    } else {
      out += ch;
      at += 1;
    }
  }
  return out;
}

function cssId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, (c) => `\\${c}`);
}

/** Rebind only selector IDs and local URL tokens outside CSS strings and comments. */
function mappedStyleText(value: string, ids: ReadonlyMap<string, string>): string {
  let out = '';
  let at = 0;
  let selector = true;
  while (at < value.length) {
    const ch = value[at] ?? '';
    if (ch === '/' && value[at + 1] === '*') {
      const end = value.indexOf('*/', at + 2);
      const stop = end < 0 ? value.length : end + 2;
      out += value.slice(at, stop);
      at = stop;
    } else if (ch === '"' || ch === "'") {
      const quote = ch;
      let end = at + 1;
      while (end < value.length) {
        if (value[end] === '\\') end += 2;
        else if (value[end++] === quote) break;
      }
      out += value.slice(at, end);
      at = end;
    } else if (value.slice(at, at + 4).toLowerCase() === 'url(') {
      const end = value.indexOf(')', at + 4);
      const token = end < 0 ? value.slice(at) : value.slice(at, end + 1);
      out += mappedUrl(token, ids);
      at += token.length;
    } else if (selector && ch === '#') {
      const escaped = /^#((?:[A-Za-z0-9_-]+|\\.)+)/.exec(value.slice(at));
      const id = escaped?.[1]?.replace(/\\(.)/g, '$1');
      const next = id === undefined ? undefined : ids.get(id);
      if (escaped !== null && next !== undefined) {
        out += `#${cssId(next)}`;
        at += escaped[0].length;
      } else {
        out += ch;
        at += 1;
      }
    } else {
      out += ch;
      at += 1;
      if (ch === '{') selector = false;
      else if (ch === '}') selector = true;
    }
  }
  return out;
}

/**
 * A journal for one instance. `live` says whether writes are still allowed; `operate` runs a handler as one
 * operation of the instance.
 */
export function createJournal(live: () => boolean, operate: (fn: () => void) => void): JournalControl {
  const undo: (() => void)[] = [];
  const attrs = new Map<Element, Map<string, AttrRecord>>();
  const classes = new Map<Element, Map<string, ClassRecord>>();
  const styles = new Map<Element, Map<string, StyleRecord>>();

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
      const prev = node.previousSibling;
      parent.insertBefore(node, before);
      undo.push(() => {
        if (next === null || next.parentNode === from) {
          from.insertBefore(node, next);
          return;
        }
        // The node that followed it has left (the host removed it, or merged adjacent text nodes): the node still
        // goes back into the parent it came from, after the node that preceded it if that one is still there, else
        // at the end, so none of the document is left inside chrome that teardown removes. Then it is reported.
        from.insertBefore(node, prev !== null && prev.parentNode === from ? prev.nextSibling : null);
        throw new Error('docreader: a moved node lost its place (the node after it left); it went back into its parent');
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

    cloneSvg(source, ids) {
      if (!live()) throw new Error('docreader: journal.cloneSvg after a destroy');
      const snapshot = new Map(ids);
      if (source.id === '') throw new Error('docreader: journal.cloneSvg takes a source root ID');
      const originals = [source, ...Array.from(source.querySelectorAll<Element>('[id]'))].filter((el) => el.id !== '');
      if (!live()) throw new Error('docreader: journal.cloneSvg after source IDs');
      const seen = new Set<string>();
      if (originals.some((el) => seen.has(el.id) || (seen.add(el.id), false)) || originals.length !== snapshot.size) {
        throw new Error('docreader: journal.cloneSvg takes every unique source ID exactly once');
      }
      const destinations = new Set<string>();
      for (const id of seen) {
        const destination = snapshot.get(id);
        if (destination === undefined || !ROOT_ISSUED_ID.test(destination) || destinations.has(destination)) {
          throw new Error('docreader: journal.cloneSvg takes unique root-issued destination IDs');
        }
        destinations.add(destination);
      }
      const clone = source.cloneNode(true) as SVGSVGElement;
      if (!live()) throw new Error('docreader: journal.cloneSvg after cloning');
      const elements = [clone, ...Array.from(clone.querySelectorAll<Element>('*'))];
      for (const el of elements) {
        const next = snapshot.get(el.id);
        if (next !== undefined) el.id = next;
        if (!live()) throw new Error('docreader: journal.cloneSvg after ID rewrite');
        el.setAttribute(CHROME_ATTR, '');
        if (!live()) throw new Error('docreader: journal.cloneSvg after chrome marking');
        for (const name of ['href', 'xlink:href'] as const) {
          const value = el.getAttribute(name);
          const match = value === null ? null : LOCAL_HREF.exec(value);
          const mapped = match === null ? undefined : snapshot.get(match[1] ?? '');
          if (mapped !== undefined) el.setAttribute(name, `#${mapped}`);
          if (!live()) throw new Error('docreader: journal.cloneSvg after href rewrite');
        }
        for (const name of ['aria-labelledby', 'aria-describedby'] as const) {
          const value = el.getAttribute(name);
          if (value !== null) el.setAttribute(name, value.split(/\s+/).map((id) => snapshot.get(id) ?? id).join(' '));
          if (!live()) throw new Error('docreader: journal.cloneSvg after ARIA rewrite');
        }
        for (const name of ['fill', 'stroke', 'clip-path', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end'] as const) {
          const value = el.getAttribute(name);
          if (value !== null) el.setAttribute(name, mappedUrl(value, snapshot));
          if (!live()) throw new Error('docreader: journal.cloneSvg after presentation rewrite');
        }
        const style = (el as Styled).style;
        for (let i = 0; i < style.length; i += 1) {
          const name = style[i];
          if (name === undefined) continue;
          const value = style.getPropertyValue(name);
          const next = mappedUrl(value, snapshot);
          if (next !== value) style.setProperty(name, next, style.getPropertyPriority(name));
          if (!live()) throw new Error('docreader: journal.cloneSvg after CSSOM rewrite');
        }
      }
      for (const style of Array.from(clone.querySelectorAll('style'))) {
        style.textContent = mappedStyleText(style.textContent ?? '', snapshot);
        if (!live()) throw new Error('docreader: journal.cloneSvg after embedded style rewrite');
      }
      return clone;
    },

    setStyle(el, prop, value, important = false) {
      const name: string = prop;
      const plain = (STYLE_PROPS as readonly string[]).includes(name);
      const loud = (IMPORTANT_STYLE_PROPS as readonly string[]).includes(name);
      if (!plain && !loud) throw new Error(`docreader: journal.setStyle refuses the property ${JSON.stringify(name)}`);
      if (loud !== important) throw new Error('docreader: journal.setStyle takes important only for fill, stroke and stroke-width, and those only with it');
      if (value !== null && (value.length > STYLE_VALUE_MAX || STYLE_VALUE_REFUSED.test(value))) {
        throw new Error('docreader: journal.setStyle refuses this value');
      }
      if (!live()) return;
      const style = el.style;
      let byProp = styles.get(el);
      if (byProp === undefined) {
        styles.set(el, (byProp = new Map()));
        // The element's first style write: when it had no style attribute, the last undo removes the empty one. A
        // browser may serialize the CSSOM into the attribute lazily, on the next read: reading it first makes the
        // removal stick, where removing an attribute not yet written would let that later read bring it back empty.
        if (!el.hasAttribute('style')) {
          undo.push(() => {
            if (style.length === 0 && el.getAttribute('style') !== null) el.removeAttribute('style');
          });
        }
      }
      let rec = byProp.get(name);
      if (rec === undefined) {
        const r: StyleRecord = { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name), last: { value: '', priority: '' } };
        byProp.set(name, (rec = r));
        undo.push(() => {
          if (style.getPropertyValue(name) !== r.last.value || style.getPropertyPriority(name) !== r.last.priority) return; // the host changed it since
          if (r.value === '') style.removeProperty(name);
          else style.setProperty(name, r.value, r.priority);
        });
      }
      if (value === null) style.removeProperty(name);
      else style.setProperty(name, value, important ? 'important' : '');
      // What the browser holds now (it may have normalised the value, or refused it): the next undo compares with that.
      rec.last = { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) };
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
      styles.clear();
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
