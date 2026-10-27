// The free-global pin (docserver L3, Task 5; plan Reference §5.5 step 2, ruling R2, FD6). An element id becomes a named
// property of the window only where the window itself has no own property of that name: it shadows what the global
// inherits (`addEventListener`, `dispatchEvent`, `toString`) and what it lacks. So, in Phase S, before any authored
// node exists, every name the frame's scripts read freely from the global is made an own property of it: a name that
// is already an own property is left as it is; any other is defined as {value: what win[name] reads now, writable:
// false, configurable: false}, so a later element with that id changes nothing the scripts read.
//
// The list is the build's (DOCSERVER_FREE_GLOBALS, Task 6's scan of the four bundled scripts); the bootstrap passes it.
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
