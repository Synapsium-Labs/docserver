// The free-global pin (docserver L3, Task 5; plan Reference §5.5 step 2, ruling R2, FD6). An element id becomes a named
// property of the window only where the window itself has no own property of that name: it shadows what the global
// inherits (`addEventListener`, `dispatchEvent`, `toString`) and what it lacks. So, in Phase S, before any authored
// node exists, every name the frame's scripts read freely from the global is made an own property of it: a name that
// is already an own property is left as it is; any other is defined as {value: what win[name] reads now, writable:
// false, configurable: false}, so a later element with that id changes nothing the scripts read.
//
// The list is the build's (DOCSERVER_FREE_GLOBALS, Task 6's scan of the four bundled scripts); the bootstrap passes it.
// A second function below reserves the two names Mermaid writes while it evaluates (reserveGlobals).
// The built-ins this file uses are read when the bootstrap's bundle starts, before any other code of the frame runs.
const hasOwn = Object.prototype.hasOwnProperty;
const define = Object.defineProperty;

/** Pin each of `names` on `win` (see the header). Throws when the global refuses a definition; the bootstrap fails closed. */
export function pinFreeGlobals(win: object, names: readonly string[]): void {
  for (const name of names) {
    if (hasOwn.call(win, name)) continue;
    const value: unknown = (win as Record<string, unknown>)[name];
    define(win, name, { value, writable: false, configurable: false });
  }
}

/**
 * The names the bundled Mermaid file writes to the global while it evaluates (the build's FREE_GLOBALS_ALLOWLIST, which
 * the pin leaves alone so the write lands): `injected` (`globalThis.injected ??= {…}`) and `fastdom`
 * (`e.fastdom = e.fastdom || …`). In 'after-ready' mode the file evaluates after content exists, when an element id of
 * either name would already be a named property of the window and the write would land on it; so every mode reserves
 * them in Phase S (BD5; C107).
 */
export const RESERVED_GLOBALS: readonly string[] = Object.freeze(['fastdom', 'injected']);

/**
 * Reserve each of `names` on `win`: a name that is already an own property is left as it is; any other is defined as an
 * own, writable, non-configurable property holding undefined. An element id can no longer stand in for it (an own
 * property wins over a named property), and the file's own write still lands, `??=` and `x = x || …` alike. Throws when
 * the global refuses a definition; the bootstrap fails closed.
 */
export function reserveGlobals(win: object, names: readonly string[]): void {
  for (const name of names) {
    if (hasOwn.call(win, name)) continue;
    define(win, name, { value: undefined, writable: true, configurable: false });
  }
}
