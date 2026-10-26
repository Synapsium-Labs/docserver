// Plans: tasks, steps and owners, and outline mode on long plans (the reference layout, sections 7 and 23; docserver
// L2 Task 11).
//
// Tasks. An h2 or h3 of the document whose first child is text opening with a task word and a number, then a
// separator (`:`, `.`, an em or en dash): "Task 3: Build the parser", "Task P0-1 — Ship" (ctx.vocab.plan.task). The
// number moves into a badge, `span.task-id` ("Task 3"), and the separator into a hidden chrome span; the rest of the
// heading stays as written. A heading whose first child is not text (a section number, bold text) is no task. The
// task's parts are the heading's next siblings, up to a heading of its level or above, or a box that holds one
// (editorial's "In short", which holds its h2; a "Where things stand" box can never follow a task, as its h2 comes
// first). In them, the badge counts the steps (the direct
// items of a task list among the parts) and names the owner of the first owner line, a paragraph that opens with
// "Who:" (ctx.vocab.plan.who) and names the owner up to its first full stop; the owner is `.yours` when it names the
// reader (ctx.vocab.addressee, a whole word). A task heading with no label of its own is named by its own text as
// written ("Task 3: Build the parser"), taken before the badge exists, so its name never holds the badge's counts: as
// headCtl names a heading, a chrome button an earlier feature put in it is left out and any other text is kept.
//
// Steps. Every `li.task-list-item` of the document. A step title is the item's first `strong` (or, in a loose list,
// the first paragraph's) whose first text opens with a step word, a number and an optional owner in brackets of at
// most 24 characters, then a colon: "Step 2 (you): Pick a name" (ctx.vocab.plan.step). The number moves into a badge,
// `span.step-no` ("Step 2"), placed before the `strong` (the stylesheet's outline grid needs it there), and the owner
// into a `span.who` inside it; the brackets and the colon stay in the `strong`, in a hidden chrome span. A step whose
// owner names the reader (ctx.vocab.addresseeAnywhere: the words anywhere in the bracket, so "(yours)" too) is
// `.attn` and counted in ctx.plan.yours. After the `strong`, the step's body is marked `.step-rest`: an element by its
// class, a text by a chrome span wrapped around it; in a loose item (`.loose`) the blocks after the first paragraph
// too. The checkbox is named "Step 2: Pick a name", or, for an item with no step title, by its bold lead or its text.
// Steps get no ids.
//
// Text changes only by split, wrap and move: the document's text nodes are partitioned (journal.split), never
// rewritten, and a step's number and owner text are moved into their badges (journal.move); destroy puts every
// character back where it was. No attribute names a task (the reference's `data-task`): what belongs to which task is
// kept here, by element, so two tasks with the same number are told apart.
//
// Outline mode (section 23), for a plan of OUTLINE_MIN_STEPS steps or more (`outlineable`). Each task's parts are
// `.task-part` (an element that two tasks' parts share belongs to the innermost task, the last one walked), and each
// task heading gets a "Show all" button (`.task-open`), before its controls. The root class `outline` shows each task
// as its step titles (the stylesheet hides the rest); "Show all" opens one task (`.t-open` on the heading and its
// parts) and "Outline" closes it again. The outline is turned on and off by the Outline button in the bar's tray
// (slots.tool('outline'), with chrome.bar) and by the `o` key (keys.bind), keeping the reader's place
// (position.keep) and asking for a relayout ('outline'); turning it off closes every open task. It is per-document
// state, `outline` (true, or cleared), written behind; a stored true is applied during this build, so the full plan
// is never shown first, but only when the reader can turn it off again (the bar's tool or the key): with neither, it
// is left as stored and not read. Reveal (ctx.onReveal) opens the task whose parts hold what it shows, in the outline only.
//
// It publishes ctx.plan once, during its build: the task headings and the steps in document order, the count of the
// reader's own steps, and whether the plan takes the outline mode (Tasks 19 and 20 read it).
//
// A change changes the local state first, writes it behind (the host's set() may run there, and may destroy the
// instance), and only then, if the instance is still live, changes the DOM, as folds.ts does.
import { headingText } from './headctl.js';
import { CHROME_ATTR, chrome } from './journal.js';
import type { FeatureContext } from './types.js';

/** The per-document state name of the outline mode. */
const OUTLINE = 'outline';

/** A plan with this many steps or more takes the outline mode. */
const OUTLINE_MIN_STEPS = 20;

/** The longest name a step's checkbox takes from its title or text, in code units (the reference's). */
const STEP_LABEL_MAX = 90;

/** The most of an item's text read for its checkbox's name when it has no title (the reference's). */
const ITEM_TEXT_MAX = 300;

interface Task {
  readonly heading: HTMLElement;
  /** The heading's next siblings up to the end of the task. */
  readonly parts: readonly Element[];
}

/** A task in the outline mode. */
interface Outlined {
  readonly heading: HTMLElement;
  /** Its own parts: those no task inside it holds. */
  readonly own: readonly Element[];
  /** Its "Show all" button. */
  readonly btn: HTMLButtonElement;
  /** Shown whole in the outline. */
  opened: boolean;
}

const level = (n: Element): number => (/^h[1-6]$/.test(n.localName) ? Number(n.localName.slice(1)) : 0);

/**
 * Whether `n` ends the task whose heading is `h`: a heading of its level or above, or editorial's "In short" box, which
 * holds one (its h2), as the heading it wraps would have. (A "Where things stand" box wraps an h3 after that section's
 * h2, which has ended every task before it, so no task reaches one.)
 */
function ends(h: Element, n: Element): boolean {
  const l = level(n);
  if (l > 0) return l <= level(h);
  return n.matches('.short') && Array.from(n.querySelectorAll('h1, h2, h3')).some((x) => level(x) <= level(h));
}

/** A task's source fingerprint, before the plan feature adds its own chrome. */
function fingerprint(heading: HTMLElement, members: readonly Element[], ctx: FeatureContext): string {
  let text = heading.textContent ?? '';
  for (const member of members) if (member.localName !== 'script' && member.localName !== 'dl') text += `\u0001${member.textContent ?? ''}`;
  return ctx.text.hash(text);
}

/** A text with its white space runs as one space, trimmed. */
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

const isChrome = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);

/** A chrome button: a control, never part of a heading's name (headCtl's rule, so a task is named as a heading is). */
const isControl = (el: Element): boolean => el.localName === 'button' && isChrome(el);

export function build(ctx: FeatureContext): void {
  const { root, journal, vocab, state } = ctx;
  const doc = root.ownerDocument;
  const hidden = (): HTMLSpanElement => chrome(doc, 'span', { attrs: { hidden: '' } });

  // ── Tasks
  const tasks: Task[] = [];
  for (const h of Array.from(root.querySelectorAll('h2, h3')) as HTMLElement[]) {
    if (isChrome(h)) continue;
    const t = h.firstChild;
    if (t === null || t.nodeType !== 3) continue;
    const text = t as Text;
    const m = vocab.plan.task.exec(text.data);
    if (m === null) continue;
    const no = m[2] as string;
    const parts: Element[] = [];
    let steps = 0;
    let who = '';
    for (let n = h.nextElementSibling; n !== null && !ends(h, n); n = n.nextElementSibling) {
      parts.push(n);
      if (n.localName === 'ul' || n.localName === 'ol') {
        for (const li of Array.from(n.children)) if (li.classList.contains('task-list-item')) steps += 1;
      }
      // The first owner line: a paragraph opening with "Who:" (as written), its owner read from its squashed text.
      if (who === '' && n.localName === 'p') {
        const raw = n.textContent ?? '';
        if (vocab.plan.who.test(raw)) who = vocab.plan.who.exec(squash(raw))?.[1] ?? '';
      }
    }
    // Named by its own text, before the badge exists.
    if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h, 'aria-label', headingText(h, isControl));
    // "Task 3" | ": " | "Build the parser": the number into the badge, the separator hidden. The number is the first
    // run of its text after the word (white space, which it cannot hold, comes between).
    const idEnd = text.data.indexOf(no, (m[1] as string).length) + no.length;
    if (m[0].length < text.data.length) journal.split(text, m[0].length);
    const sep = journal.split(text, idEnd);
    const badge = chrome(doc, 'span', { className: 'task-id' });
    journal.wrap([text], badge);
    journal.wrap([sep], hidden());
    if (steps > 0) journal.insert(chrome(doc, 'span', { className: 'tmeta', text: `${String(steps)} ${steps === 1 ? 'step' : 'steps'}` }), badge, null);
    if (who !== '') journal.insert(chrome(doc, 'span', { className: vocab.addressee.test(who) ? 'tmeta yours' : 'tmeta', text: who }), badge, null);
    journal.toggleClass(h, 'task', true);
    tasks.push({ heading: h, parts });
  }

  // ── Steps
  const steps = Array.from(root.querySelectorAll('li.task-list-item')) as HTMLElement[];
  let yours = 0;
  for (const li of steps) {
    const cb = li.querySelector(':scope > input[type="checkbox"], :scope > p:first-child > input[type="checkbox"]');
    const s = li.querySelector(':scope > strong') ?? cb?.parentElement?.querySelector(':scope > strong') ?? null;
    const first = s?.firstChild ?? null;
    if (first !== null && first.nodeType === 3) {
      const text = first as Text;
      const strong = text.parentNode as Element; // s
      const m = vocab.plan.step.exec(text.data);
      if (m !== null) {
        const title = m[1] as string;
        const owner = m[2];
        // The title after the step's number, as the checkbox names it.
        const named = (strong.textContent ?? '').slice(m[0].length);
        // "Step 2" | " (" | "you" | "): " | "Pick a name": the number and the owner into the badge, the rest hidden.
        if (m[0].length < text.data.length) journal.split(text, m[0].length);
        const after = journal.split(text, title.length);
        const badge = chrome(doc, 'span', { className: 'step-no' });
        journal.insert(badge, strong.parentNode as Node, strong);
        journal.move(text, badge, null);
        if (owner === undefined) {
          journal.wrap([after], hidden());
        } else {
          const ownerText = journal.split(after, after.data.indexOf('(') + 1);
          const tail = journal.split(ownerText, owner.length);
          const whoEl = chrome(doc, 'span', { className: 'who' });
          journal.insert(whoEl, badge, null);
          journal.move(ownerText, whoEl, null);
          journal.wrap([after, tail], hidden());
          if (vocab.addresseeAnywhere.test(owner)) {
            yours += 1;
            journal.toggleClass(li, 'attn', true);
          }
        }
        if (cb !== null) journal.setAttribute(cb, 'aria-label', `${title}: ${ctx.text.clip(named, STEP_LABEL_MAX)}`);
      }
      // The step's body: everything after the title, marked in place (moving it would re-shape every code block).
      const parent = strong.parentElement as Element;
      let past = false;
      for (const c of Array.from(parent.childNodes)) {
        if (c === strong) {
          past = true;
          continue;
        }
        if (!past) continue;
        if (c.nodeType === 1) journal.toggleClass(c as Element, 'step-rest', true);
        else if (c.nodeType === 3 && (c as Text).data.trim() !== '') journal.wrap([c], chrome(doc, 'span', { className: 'step-rest' }));
      }
      if (parent !== li) {
        journal.toggleClass(li, 'loose', true);
        for (let x = parent.nextElementSibling; x !== null; x = x.nextElementSibling) journal.toggleClass(x, 'step-rest', true);
      }
    }
    if (cb !== null && !cb.hasAttribute('aria-label')) {
      const lead = squash(s?.textContent ?? '');
      journal.setAttribute(cb, 'aria-label', ctx.text.clip(lead !== '' ? lead : (li.textContent ?? '').slice(0, ITEM_TEXT_MAX), STEP_LABEL_MAX) || 'Step');
    }
  }

  const outlineable = steps.length >= OUTLINE_MIN_STEPS;
  ctx.plan.publish({
    tasks: tasks.map((t) => t.heading),
    members: tasks.map((t) => t.parts),
    fingerprints: tasks.map((t) => fingerprint(t.heading, t.parts, ctx)),
    steps,
    yours,
    outlineable,
  });
  if (!outlineable) return;

  // ── Outline mode
  /** Each part's task: the innermost (the last walked) when two tasks share it. */
  const ownerOf = new Map<Element, Task>();
  for (const t of tasks) for (const p of t.parts) ownerOf.set(p, t);
  for (const p of ownerOf.keys()) journal.toggleClass(p, 'task-part', true);
  const outlinedOf = new Map<Task, Outlined>();
  for (const t of tasks) {
    const btn = chrome(doc, 'button', { className: 'task-open', text: 'Show all', attrs: { type: 'button', 'aria-expanded': 'false' } });
    // Before the heading's controls, when a feature built before this one made them.
    const ctl = Array.from(t.heading.children).find((c) => isChrome(c) && c.classList.contains('h-ctl')) ?? null;
    journal.insert(btn, t.heading, ctl);
    outlinedOf.set(t, { heading: t.heading, own: t.parts.filter((p) => ownerOf.get(p) === t), btn, opened: false });
  }

  let outlined = false;

  /** Show a task whole in the outline, or as its step titles again; a task already so changes nothing. */
  const openTask = (o: Outlined, on: boolean): void => {
    if (o.opened === on) return;
    o.opened = on;
    journal.toggleClass(o.heading, 't-open', on);
    for (const p of o.own) journal.toggleClass(p, 't-open', on);
    o.btn.setAttribute('aria-expanded', String(on));
    o.btn.textContent = on ? 'Outline' : 'Show all';
    ctx.relayout('outline');
  };

  for (const o of outlinedOf.values()) {
    journal.listen(o.btn, 'click', () => {
      openTask(o, !o.opened);
    });
  }

  let tool: HTMLButtonElement | null = null;

  /** Put the outline on the DOM. Calls no host code. */
  const show = (on: boolean): void => {
    journal.toggleClass(root, 'outline', on);
    if (!on) for (const o of outlinedOf.values()) openTask(o, false);
    tool?.setAttribute('aria-pressed', String(on));
  };

  /** Turn the outline on or off: local state, the write-behind, then (still live) the DOM, the place kept, a relayout. */
  const setOutline = (on: boolean): void => {
    outlined = on;
    state.writeDoc(OUTLINE, on ? true : null);
    if (!ctx.live()) return; // the host's set() ran: it may have destroyed the instance
    ctx.position.keep(() => {
      show(on);
    });
    ctx.relayout('outline');
  };

  if (ctx.slots !== null) {
    tool = chrome(doc, 'button', {
      className: 'outline-btn',
      text: 'Outline',
      attrs: {
        type: 'button',
        'aria-pressed': 'false',
        title: ctx.options.keyboard ? 'Show each task as its step titles (o)' : 'Show each task as its step titles',
      },
    });
    ctx.slots.tool('outline', tool);
    journal.listen(tool, 'click', () => {
      setOutline(!outlined);
    });
  }
  ctx.keys.bind({
    key: 'o',
    label: 'Outline: step titles only',
    run: () => {
      setOutline(!outlined);
    },
  });

  /** The task whose part holds `el` (a part is a child of the root, or of a box in it), or undefined. */
  const taskOf = (el: Element): Outlined | undefined => {
    for (let n: Element | null = el; n !== null; n = n.parentElement) {
      const t = ownerOf.get(n);
      if (t !== undefined) return outlinedOf.get(t);
    }
    return undefined;
  };

  // Reveal opens the task whose part holds the target, in the outline only.
  ctx.onReveal((el) => {
    if (!outlined) return;
    const o = taskOf(el);
    if (o !== undefined) openTask(o, true);
  });

  // With neither the tool nor the key the reader could not leave a stored outline: it is left as stored, unread.
  if (ctx.slots === null && !ctx.options.keyboard) return;

  // A stored outline, applied now, so the full plan is never shown first. Reading it may run host code (a getter of
  // the snapshot) that destroys the instance: then the journal refuses the root's class, and the tool, which is not
  // in the root yet (the bar goes in once every feature is built, and the build stops first), goes with the chrome.
  if (state.readDoc(OUTLINE) === true) {
    outlined = true;
    show(true);
  }
}
