// Read marks per section, and "changed since you read it" (the reference layout, section 14). Built by L2 Task 18.
//
// Consumes ctx.sections (source-text fingerprints, so chrome text never flips a mark), ctx.plan (a task unit on a
// long plan), events (`spy`, `changes`), headCtl('mark') and keys (`m`). Stores `<ns>:doc:<key>:marks` (heading id
// to fingerprint: read into a Map, written with a null prototype, pruned of ids that no longer exist). Produces
// section 14's classes.
//
// Standard files, slug `rail`: test/enhance-rail.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import { chrome } from './journal.js';
import type { MarkState } from './registry.js';
import type { FeatureContext } from './types.js';

/** The per-document state name for read-mark fingerprints. */
const MARKS = 'marks';

/** text.hash() encodes a 32-bit FNV-1a value in base 36. */
function fingerprintMaxLength(): number {
  return (0xffff_ffff).toString(36).length;
}

/** A stored mark record is bounded by the units it can name and their fingerprints. */
function storedMarks(value: unknown, units: ReadonlyMap<string, string>): Map<string, string> {
  const marks = new Map<string, string>();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return marks;
  const entries = Object.entries(value);
  if (entries.length > units.size) return marks;
  const maxLength = fingerprintMaxLength();
  for (const [id, fingerprint] of entries) {
    if (typeof fingerprint === 'string' && fingerprint.length <= maxLength && units.has(id)) marks.set(id, fingerprint);
  }
  return marks;
}

/** Whether `heading` is in the editorial short box of this root, never in one a host wrapped around it. */
function inShort(heading: Element, root: Element): boolean {
  for (let parent = heading.parentElement; parent !== null && parent !== root; parent = parent.parentElement) {
    if (parent.classList.contains('short')) return true;
  }
  return false;
}

/** Build read marks for sections. */
export function build(ctx: FeatureContext): void {
  if (!ctx.info.isDocument) return;
  const taskUnits = ctx.plan.outlineable
    ? ctx.plan.tasks.map((heading, at) => ({ heading, fingerprint: ctx.plan.fingerprints[at] ?? '' }))
    : [];
  const taskByHeading = new Map(taskUnits.map((unit) => [unit.heading, unit]));
  const taskHeadings = new Set(taskByHeading.keys());
  const holders = new Set(ctx.sections.filter((section) => section.members.some((member) => taskHeadings.has(member as HTMLElement))).map((section) => section.heading));
  const sectionByHeading = new Map(ctx.sections
    .filter((section) => !inShort(section.heading, ctx.root) && !holders.has(section.heading))
    .map((section) => [section.heading, section]));
  const units: readonly { readonly heading: HTMLElement; readonly fingerprint: string }[] = ctx.text.inOrder([...new Set([...sectionByHeading.keys(), ...taskByHeading.keys()])])
    .map((heading) => taskByHeading.get(heading) ?? sectionByHeading.get(heading) as { readonly heading: HTMLElement; readonly fingerprint: string });
  const fingerprints = new Map(units.map((section) => [section.heading.id, section.fingerprint]));
  if (fingerprints.size === 0) return;
  const marks = storedMarks(ctx.state.readDoc(MARKS), fingerprints);
  const controls = new Map<HTMLElement, HTMLButtonElement>();
  let current: HTMLElement | null = null;

  const stateOf = (heading: HTMLElement): MarkState => {
    const mark = marks.get(heading.id);
    if (mark === undefined) return 'unread';
    return mark === fingerprints.get(heading.id) ? 'read' : 'changed';
  };

  const write = (): void => {
    if (marks.size === 0) {
      ctx.state.writeDoc(MARKS, null);
      return;
    }
    const stored = Object.create(null) as Record<string, string>;
    for (const [id, fingerprint] of marks) stored[id] = fingerprint;
    ctx.state.writeDoc(MARKS, stored);
  };

  const refresh = (): void => {
    const snapshot = units.map(({ heading }) => Object.freeze({ heading, state: stateOf(heading) }));
    for (const { heading, state } of snapshot) {
      const control = controls.get(heading);
      if (control === undefined) continue;
      const read = state === 'read';
      control.textContent = read ? 'Read' : state === 'changed' ? 'Changed since you read it' : 'Mark read';
      control.setAttribute('aria-pressed', String(read));
      ctx.journal.toggleClass(control, 'on', read);
      ctx.journal.toggleClass(control, 'changed', state === 'changed');
    }
    ctx.events.emit('marks', Object.freeze({ units: Object.freeze(snapshot) }));
  };

  const toggle = (heading: HTMLElement): void => {
    if (stateOf(heading) === 'read') marks.delete(heading.id);
    else marks.set(heading.id, fingerprints.get(heading.id) as string);
    write();
    if (ctx.live()) refresh();
  };

  for (const { heading } of units) {
    const control = chrome(ctx.root.ownerDocument, 'button', { className: 'h-mark', text: 'Mark read', attrs: { type: 'button', 'aria-pressed': 'false' } });
    ctx.headCtl(heading, 'mark', control);
    controls.set(heading, control);
    ctx.journal.listen(control, 'click', (event) => {
      event.preventDefault();
      toggle(heading);
    });
  }

  ctx.events.on('spy', ({ unit }) => {
    current = unit !== null && controls.has(unit) ? unit : null;
  });
  ctx.keys.bind({
    key: 'm',
    label: 'Mark section read',
    when: () => current !== null,
    run: () => {
      if (current !== null) toggle(current);
    },
  });
  refresh();
}
