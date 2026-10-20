// The keyboard layer (docserver L2, Task 7b), ported from the reference layout's section 25 (its key handler; the
// sheet itself is keysheet.ts). Features bind their keys here and never listen for keys themselves:
//   bind({ key, label, when?, run, listed? })  `key` is KeyboardEvent.key exactly ("j", "/", "?"), or CHORD for Ctrl
//                                               or Cmd with K; `when` says whether the key applies now (default
//                                               always); `run` runs inside an operation of the instance, and the
//                                               key's default is prevented unless it returns false; `listed: false`
//                                               keeps it off the sheet. One binding per key per instance; the cancel
//                                               unbinds it.
//   bindings()                                  the keys that apply now and are listed, as { key, label }, in the
//                                               sheet's order (SHEET_ORDER, the reference sheet's; any other key
//                                               after them, in the order bound), so a key a later feature binds shows
//                                               on the sheet with no edit to the sheet.
//
// One keydown listener per document, shared by every instance in it (a WeakMap from the document; added with the
// first instance, removed with the last). A key goes to the instance whose root holds the key's target; a key whose
// target is the page itself (the body, the html element or the document, where nothing has focus) goes to the
// document's live instance only when there is exactly one, so two roots on a page never act on one key (RF2). Host
// content outside every root gets nothing. For the instance it reaches, in the reference's order:
//   - a key whose default was already prevented (by the page, or a feature's own handler) is left alone;
//   - Escape closes that instance's top overlay (overlays.ts), whatever the target and `keyboard`;
//   - Ctrl or Cmd with K (never with Alt) runs the CHORD binding, from an editable field too, unless `keyboard` is
//     false or a dialog is open (overlays.any());
//   - any other key with Ctrl, Cmd or Alt, any key with `keyboard: false`, a key in an editable field (input,
//     textarea, select, contenteditable) and a key while a dialog is open are ignored (Shift is a key's own: "?");
//   - otherwise the key's binding runs when its `when` holds.
// The handler runs as one operation of that instance (ctx.operate), so a destroy a binding asks for waits for it, and
// nothing reaches an instance once it is not live.
//
// Import-inert: declarations only.
import type { Cancel } from './env.js';
import type { Journal } from './journal.js';
import type { Overlays } from './overlays.js';

/** The binding key for Ctrl or Cmd with K, the one chord. */
export const CHORD = 'Mod+k';

/** The keys sheet's order: the reference sheet's rows, key by key. */
export const SHEET_ORDER: readonly string[] = ['/', 'j', 'k', 'w', 'i', 'n', 'p', 'm', 'o', '?'];

/** The longest key a binding names, in code units. */
const KEY_MAX = 32;

export interface KeyBinding {
  readonly key: string;
  /** What the key does, for the sheet. */
  readonly label: string;
  /** Whether the key applies now; default always. */
  readonly when?: () => boolean;
  /** Do it: the default is prevented unless this returns false. */
  readonly run: () => boolean | void;
  /** False keeps it off the sheet; default true. */
  readonly listed?: boolean;
}

/** One row of the sheet. */
export interface KeyRow {
  readonly key: string;
  readonly label: string;
}

export interface Keys {
  bind(b: KeyBinding): Cancel;
  bindings(): readonly KeyRow[];
}

/** One instance, as the document's listener sees it. */
interface Member {
  readonly root: Element;
  readonly live: () => boolean;
  readonly handle: (e: KeyboardEvent) => void;
}

/** Per document: its live and tearing-down instances, and the one listener. */
let docs: WeakMap<Document, { readonly members: Set<Member>; readonly listener: (e: Event) => void }> | undefined;

/** True for the page itself as a key's target: the document, its html element or its body. */
function pageLevel(t: EventTarget | null, doc: Document): boolean {
  if (t === doc) return true;
  const n = t as Node | null;
  if (n === null || typeof n !== 'object' || n.nodeType !== 1) return false;
  if (n.parentNode === doc) return true;
  return (n as Element).localName === 'body' && n.parentNode?.parentNode === doc;
}

/** True for a target that takes text: an input, a textarea, a select or an editable element. */
function editable(t: EventTarget | null): boolean {
  const el = t as Element | null;
  if (el === null || typeof el !== 'object' || el.nodeType !== 1) return false;
  return /^(?:input|textarea|select)$/.test(el.localName) || (el as HTMLElement).isContentEditable === true;
}

/** The instance a key with this target goes to: the one whose root holds it; on the page, the sole live one. */
function owner(members: ReadonlySet<Member>, target: EventTarget | null, doc: Document): Member | undefined {
  const live = [...members].filter((m) => m.live());
  const node = target as Node | null;
  if (node !== null && typeof node === 'object' && typeof node.nodeType === 'number') {
    const holder = live.find((m) => m.root.contains(node));
    if (holder !== undefined) return holder;
  }
  return pageLevel(target, doc) && live.length === 1 ? live[0] : undefined;
}

export interface KeysArgs {
  readonly root: HTMLElement;
  readonly journal: Journal;
  readonly overlays: Overlays;
  /** options.keyboard. */
  readonly keyboard: boolean;
  readonly live: () => boolean;
  readonly operate: <T>(fn: () => T) => T | undefined;
}

/** The keyboard layer of one instance: joins its document's listener now, and leaves it at teardown. */
export function createKeys(args: KeysArgs): Keys {
  const { root, journal, overlays, keyboard, live, operate } = args;
  const doc = root.ownerDocument;
  const bound = new Map<string, KeyBinding>();
  const applies = (b: KeyBinding): boolean => b.when === undefined || b.when();
  const runIt = (b: KeyBinding, e: KeyboardEvent): void => {
    if (!applies(b)) return;
    if (b.run() !== false) e.preventDefault();
  };

  const handle = (e: KeyboardEvent): void => {
    const k = e.key;
    if (k === 'Escape') {
      overlays.close();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && k.toLowerCase() === 'k') {
      const b = bound.get(CHORD);
      if (b === undefined || !keyboard || overlays.any()) return;
      runIt(b, e);
      return;
    }
    if (!keyboard || e.ctrlKey || e.metaKey || e.altKey) return;
    if (editable(e.target) || overlays.any()) return;
    const b = bound.get(k);
    if (b !== undefined) runIt(b, e);
  };

  // Join the document's listener (made with its first instance); teardown leaves it (removed with its last).
  const member: Member = {
    root,
    live,
    handle: (e) => {
      operate(() => {
        handle(e);
      });
    },
  };
  docs ??= new WeakMap();
  let reg = docs.get(doc);
  if (reg === undefined) {
    const members = new Set<Member>();
    const listener = (e: Event): void => {
      if (e.defaultPrevented) return;
      owner(members, e.target, doc)?.handle(e as KeyboardEvent);
    };
    doc.addEventListener('keydown', listener);
    docs.set(doc, (reg = { members, listener }));
  }
  const { members, listener } = reg;
  members.add(member);
  journal.defer(() => {
    members.delete(member);
    if (members.size > 0) return;
    doc.removeEventListener('keydown', listener);
    if (docs?.get(doc)?.members === members) docs.delete(doc);
  });

  return Object.freeze({
    bind(b: KeyBinding): Cancel {
      if (typeof b !== 'object' || b === null) throw new Error('docreader: keys.bind takes a binding');
      if (typeof b.key !== 'string' || b.key === '' || b.key.length > KEY_MAX) throw new Error('docreader: a key binding names a key of 1 to 32 code units');
      if (typeof b.label !== 'string' || typeof b.run !== 'function') throw new Error('docreader: a key binding has a label and a run');
      if (b.when !== undefined && typeof b.when !== 'function') throw new Error('docreader: a key binding\'s when is a function');
      if (b.listed !== undefined && typeof b.listed !== 'boolean') throw new Error('docreader: a key binding\'s listed is a boolean');
      if (bound.has(b.key)) throw new Error(`docreader: the key ${JSON.stringify(b.key)} is bound already`);
      if (!live()) return () => undefined;
      const held: KeyBinding = Object.freeze({ ...b });
      bound.set(b.key, held);
      return () => {
        if (bound.get(b.key) === held) bound.delete(b.key);
      };
    },
    bindings(): readonly KeyRow[] {
      const rank = (k: string): number => {
        const i = SHEET_ORDER.indexOf(k);
        return i < 0 ? SHEET_ORDER.length : i;
      };
      const rows = [...bound.values()].filter((b) => b.listed !== false && applies(b));
      // A stable sort: keys of equal rank keep the order they were bound in.
      rows.sort((a, b) => rank(a.key) - rank(b.key));
      return Object.freeze(rows.map((b) => Object.freeze({ key: b.key, label: b.label })));
    },
  });
}
