// A readDoc call with no argument at all (its own state type lets the field be left out).
interface LooseState {
  readDoc(name?: string): unknown;
}

export function use(s: LooseState): void {
  s.readDoc();
}
