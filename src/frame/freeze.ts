// `Object.freeze` under one short name. The bootstrap bundles protocol.ts and seed.ts, whose frozen tables spell the call about
// forty-five times: one module-level function lets the minifier write a single short identifier for all of them, which is a
// byte saving and nothing else (the same call and the same three overloads as `Object.freeze`, so the tables' `as const` types
// are unchanged). The one thing the alias loses is what esbuild knows of `Object.freeze` itself, that a frozen table nothing
// reads is droppable: a table the bootstrap does not read (the frame ops, the parent ops, the place kinds) carries a
// `/* @__PURE__ */` mark at its call instead, so it stays out of the bundle. Pure: a function and nothing else.
export function freeze<T extends (...args: never[]) => unknown>(f: T): T;
export function freeze<T extends { [idx: string]: U | null | undefined | object }, U extends string | bigint | number | boolean | symbol>(o: T): Readonly<T>;
export function freeze<T>(o: T): Readonly<T>;
export function freeze(value: unknown): unknown {
  return Object.freeze(value);
}
