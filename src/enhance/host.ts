// The host adapters, as features call them: one wrapper per host callback (§3.2). The reference layout reached for
// the page itself (a clipboard, a fetch of a changes URL, a link navigating the page, the address bar); here each
// of those is a callback the host may give in the options, and a feature reaches it only through `ctx.host`.
//
// Every wrapper:
//   - is safe when the host left the callback out: it calls nothing and answers null. `present` says, at once and
//     synchronously, which callbacks were given, so a feature decides from it whether to build a Copy button or to
//     call preventDefault for a link, never from a result: a null result never stands for absence.
//   - calls nothing once the instance is not live (destroyed, or being destroyed), and answers null.
//   - calls the host only inside an operation of the instance, so a destroy the host requests from inside the call
//     waits until the call returns (the lifecycle's operate).
//   - turns a throw, or a rejection of what an asynchronous callback returned, into null. Nothing it returns ever
//     throws or rejects.
//   - answers `unknown`: a feature checks the shape of whatever comes back. A callback the host declares as void
//     (copy, openVersion, onLink, onHash) answers undefined when it returned, whatever it returned, so for those
//     null means only that it was absent, not live or failed. A callback that returns a value (changes, itemLink,
//     mermaid's load) answers that value, null included. The three synchronous void wrappers never look at what
//     the host returned: a promise one of them returns is the host's own, and its rejection is the host's.
//   - silences a reply once the instance is not live: an asynchronous one that settles after that, and a
//     synchronous one whose callback itself destroyed the instance (the destroy runs as the call returns), both
//     answer null. A feature still checks live() after every call, as for any call-out.
//   - passes the objects it hands the host (`{ newTab }`, `{ push, from }`, `{ sha, only }`) as fresh frozen
//     copies, so the host never holds an object of the library's.
// The host's function is called with the object it was read from as its receiver (the options object, or the
// `mermaid` object for its `load`), as a method call on that object would be. It is called through the language's
// own call, captured once when the host is built (`invoke`), so no property of the host's function is read (an own
// `call` property is never run) and a Function.prototype.call patched later sees nothing. A thenable it returns has
// its `then` read inside the operation and called by the promise machinery afterwards, outside any operation: host
// code in that `then` (or in a getter of what it resolves with) runs as a plain promise reaction, so a destroy it
// requests takes effect at once, and the reply is then silenced. A reply that settles with an object is a promise
// settling with it, so the machinery reads that object's `then` again, as it does for any value.
//
// Import-inert: declarations only, and createHost runs when the lifecycle calls it.

/** The host callbacks, in the order `present.names` lists them. `mermaid` is the `load` of options.mermaid. */
export const HOST_CALLBACKS = ['copy', 'changes', 'openVersion', 'onLink', 'onHash', 'itemLink', 'mermaid'] as const;

export type HostCallback = (typeof HOST_CALLBACKS)[number];

/** One host function as the options gave it: never called while the options are read. */
export interface BoundCallback {
  readonly fn: (...args: never[]) => unknown;
  /** The object `fn` was read from, its receiver when called. */
  readonly self: object;
}

/** Each host callback, or null when the host left it out. Built by normalizeOptions, used only by createHost. */
export type HostCallbacks = Readonly<Record<HostCallback, BoundCallback | null>>;

/** Which callbacks the host gave: a frozen set, read synchronously. */
export interface Present {
  has(name: HostCallback): boolean;
  /** The callbacks given, in HOST_CALLBACKS order (frozen). */
  readonly names: readonly HostCallback[];
}

/** The host, as features see it. Every answer is unknown: null when absent, not live, thrown or rejected. */
export interface Host {
  readonly present: Present;
  /** Copy text: undefined once the host's copy returned (or its promise fulfilled), else null. */
  copy(text: string): Promise<unknown>;
  /** The host's change set since `sha`, unchecked. */
  changes(sha: string): Promise<unknown>;
  /** Open another version of the document: undefined when the host returned, else null. */
  openVersion(v: { readonly sha: string | null; readonly only: string | null }): unknown;
  /** Hand a link to the host: undefined when the host returned, else null. */
  onLink(href: string, how: { readonly newTab: boolean }): unknown;
  /** Tell the host the reader went to `id` (null: no section): undefined when the host returned, else null. */
  onHash(id: string | null, entry: { readonly push: boolean; readonly from: string | null }): unknown;
  /** The host's link for an item key, unchecked. */
  itemLink(key: string): unknown;
  /** Mermaid's module, from the host's options.mermaid.load(), unchecked. */
  loadMermaid(): Promise<unknown>;
}

/** The instance's operation: runs `fn`, or does nothing and answers undefined once not live. */
export type Operate = <T>(fn: () => T) => T | undefined;

/** A callback's outcome: what it returned, or null when it was not called or threw. */
type Called = { readonly value: unknown } | null;

/** The wrappers over `callbacks`, for one instance: `live` and `operate` are that instance's. */
export function createHost(callbacks: HostCallbacks, live: () => boolean, operate: Operate): Host {
  /**
   * The language's call, bound to itself: invoke(fn, self, ...args) calls fn with self as its receiver. Captured
   * here, once per instance, so a call reads nothing from `fn` and a later patch of Function.prototype.call is not
   * seen. (Reflect and Function are names the source walls refuse.)
   */
  type Invoke = (fn: BoundCallback['fn'], self: object, ...args: readonly unknown[]) => unknown;
  const intrinsicCall = ((): undefined => undefined).call as unknown as Invoke & { bind(self: unknown): Invoke };
  const invoke = intrinsicCall.bind(intrinsicCall);

  /** Call one callback inside an operation, its throw caught; null when it destroyed the instance itself. */
  const call = (name: HostCallback, args: readonly unknown[]): Called => {
    const bound = callbacks[name];
    if (bound === null || !live()) return null;
    const out = operate((): Called => {
      try {
        return { value: invoke(bound.fn, bound.self, ...args) };
      } catch {
        return null; // swallowed: the host's failure is the feature's null
      }
    });
    return out === undefined || !live() ? null : out;
  };

  /**
   * Call one callback that may answer with a promise. The promise is made inside the operation, so the `then` of a
   * thenable the host returned is read there; a throwing getter or `then` rejects it, and a rejection reads as null.
   */
  const callAsync = (name: HostCallback, args: readonly unknown[], keep: boolean): Promise<unknown> => {
    const bound = callbacks[name];
    if (bound === null || !live()) return Promise.resolve(null);
    const pending = operate((): Promise<unknown> | null => {
      try {
        const value = invoke(bound.fn, bound.self, ...args);
        return new Promise<unknown>((resolve) => {
          resolve(value);
        });
      } catch {
        return null;
      }
    });
    if (pending === undefined || pending === null) return Promise.resolve(null);
    return pending.then(
      (v) => (live() ? (keep ? v : undefined) : null),
      () => null,
    );
  };

  /** A void callback's answer: undefined when it returned, null otherwise. */
  const done = (c: Called): unknown => (c === null ? null : undefined);

  const names = Object.freeze(HOST_CALLBACKS.filter((n) => callbacks[n] !== null));
  const present: Present = Object.freeze({ has: (name: HostCallback): boolean => names.includes(name), names });

  return Object.freeze({
    present,
    copy: (text: string) => callAsync('copy', [text], false),
    changes: (sha: string) => callAsync('changes', [sha], true),
    openVersion: (v: { readonly sha: string | null; readonly only: string | null }) =>
      done(call('openVersion', [Object.freeze({ sha: v.sha, only: v.only })])),
    onLink: (href: string, how: { readonly newTab: boolean }) => done(call('onLink', [href, Object.freeze({ newTab: how.newTab })])),
    onHash: (id: string | null, entry: { readonly push: boolean; readonly from: string | null }) =>
      done(call('onHash', [id, Object.freeze({ push: entry.push, from: entry.from })])),
    itemLink: (key: string) => {
      const c = call('itemLink', [key]);
      return c === null ? null : c.value;
    },
    loadMermaid: () => callAsync('mermaid', [], true),
  });
}
