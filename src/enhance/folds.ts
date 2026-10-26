// Section folding, ported from the reference reader's heading controls and its setFold.
//
// Each level-2 heading that is a child of the root, has an id and has source-bearing blocks after it (up to the next
// level-2 heading, or a block that holds one) gets a control: an `.h-fold` button in the heading's controls (headCtl's
// `fold` slot, after the section link and the read mark), and a `.fold-note` button right after the heading. Folding
// hides the section's blocks with hidden="until-found", so find-in-page still reaches them and opens the fold
// (`beforematch`). Only blocks the library hid are ever shown again: a block the author hid stays as the author left it.
//
// Source identities and integer reading contributions are captured when the lifecycle creates the empty Folds facade,
// after state setup and before features. buildFolds later maps those identities to the presentation tree it sees, holds
// the exact associations through the stored-fold getter, and never discovers a new source node after that getter.
import { headingText } from './headctl.js';
import { CHROME_ATTR, chrome } from './journal.js';
import {
  contributionMinutes,
  formatMinutes,
  headingContribution,
  memberContribution,
  type ReadingContribution,
} from './reading.js';
import type { FeatureContext } from './types.js';

/** The per-document state name of the folds. */
export const FOLDS = 'folds';

// The reading-time helpers moved to reading.ts; re-exported here for the callers that import them from folds.
export { formatMinutes, sectionMinutes } from './reading.js';

/** The folds' members API (see the header). */
export interface Folds {
  headings(): readonly HTMLElement[];
  isFolded(h: Element): boolean;
  setFold(h: Element, on: boolean): void;
  setAll(on: boolean): void;
  sectionOf(node: Node): HTMLElement | null;
  join(node: Element, member: Element): boolean;
}

interface CapturedSource {
  readonly source: Element;
  readonly member: ReadingContribution;
  readonly heading: ReadingContribution;
}

/** Each Folds the lifecycle made, where its build puts the real implementation, and its pre-feature source snapshot. */
let builds: WeakMap<Folds, (impl: Folds) => void> | undefined;
let captures: WeakMap<Folds, readonly CapturedSource[]> | undefined;

/** The folds' API of one instance: empty until buildFolds runs for it. */
export function createFolds(root: Element): Folds {
  const captured = Object.freeze(
    Array.from(root.children, (source): CapturedSource =>
      Object.freeze({ source, member: memberContribution(source), heading: headingContribution(source) }),
    ),
  );
  let impl: Folds | null = null;
  const api: Folds = Object.freeze({
    headings: () => impl?.headings() ?? [],
    isFolded: (h: Element) => impl?.isFolded(h) ?? false,
    setFold: (h: Element, on: boolean) => {
      impl?.setFold(h, on);
    },
    setAll: (on: boolean) => {
      impl?.setAll(on);
    },
    sectionOf: (node: Node) => impl?.sectionOf(node) ?? null,
    join: (node: Element, member: Element) => impl?.join(node, member) ?? false,
  });
  (builds ??= new WeakMap()).set(api, (i) => {
    impl = i;
  });
  (captures ??= new WeakMap()).set(api, captured);
  return api;
}

interface HeldAssociation {
  readonly source: Element;
  readonly member: Element;
  readonly contribution: ReadingContribution;
}

interface HeldSection {
  readonly heading: HTMLElement;
  /** The heading id at the pre-getter scan: stored fold selection stays tied to it. */
  readonly id: string;
  readonly headingContribution: ReadingContribution;
  readonly associations: readonly HeldAssociation[];
}

interface HeldOwner {
  readonly heading: HTMLElement;
  readonly id: string;
  readonly headingContribution: ReadingContribution;
  readonly associations: readonly HeldAssociation[];
  readonly retiredSources: Set<Element>;
  active: HeldAssociation[];
  section: Section | null;
}

interface Section {
  readonly owner: HeldOwner;
  readonly heading: HTMLElement;
  /** The heading id at the pre-getter scan: stored fold selection stays tied to it. */
  readonly id: string;
  readonly headingContribution: ReadingContribution;
  /** Only held associations that have not failed a later liveness check. */
  associations: HeldAssociation[];
  /** A source that failed later liveness never becomes a member again. */
  readonly retiredSources: Set<Element>;
  readonly btn: HTMLButtonElement;
  readonly note: HTMLButtonElement;
  folded: boolean;
  /** The members this library hid. */
  readonly hid: Set<Element>;
}

/** Every chrome node is left out of a section's name. */
const isChrome = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);

/** The presentation child of root that currently contains source, or null when source left the root. */
function presentationMember(root: Element, source: Element): Element | null {
  let top: Element = source;
  while (top.parentElement !== root) {
    const parent = top.parentElement;
    if (parent === null) return null;
    top = parent;
  }
  return top;
}

/** The existing fold-stop condition: a direct h2, or a direct member that contains one. */
function stopsFold(member: Element): boolean {
  return member.localName === 'h2' || member.querySelector('h2') !== null;
}

function eligibleHeading(root: Element, heading: HTMLElement): boolean {
  return heading.parentElement === root && heading.localName === 'h2' && heading.id !== '';
}

/** A held association is preserved, never retargeted, only while its exact source/member/heading path survives. */
function preservesAssociation(root: Element, heading: HTMLElement, association: HeldAssociation): boolean {
  if (!eligibleHeading(root, heading) || presentationMember(root, association.source) !== association.member || association.member.parentElement !== root) {
    return false;
  }
  for (let node = heading.nextElementSibling; node !== null; node = node.nextElementSibling) {
    if (node === association.member) return !stopsFold(node);
    if (stopsFold(node)) return false;
  }
  return false;
}

/** The unique, still-valid presentation members of one held section. */
function liveMembers(root: Element, section: HeldSection): Element[] {
  const out: Element[] = [];
  for (const association of section.associations) {
    if (preservesAssociation(root, section.heading, association) && !out.includes(association.member)) out.push(association.member);
  }
  return out;
}

/** The still-valid source associations of one held section. */
function liveAssociations(root: Element, section: HeldSection): HeldAssociation[] {
  return section.associations.filter((association) => preservesAssociation(root, section.heading, association));
}

export function buildFolds(ctx: FeatureContext): void {
  const captured = captures?.get(ctx.folds) ?? [];
  // The source snapshot is only a construction input. Held associations retain the few identities the running feature
  // needs, and every early exit drops the bulk capture as well.
  captures?.delete(ctx.folds);
  const { root, journal, state } = ctx;
  if (!ctx.options.folds || !ctx.info.isDocument) return;

  const presented = new Map<Element, CapturedSource[]>();
  for (const source of captured) {
    const member = presentationMember(root, source.source);
    if (member === null) continue;
    let sources = presented.get(member);
    if (sources === undefined) presented.set(member, (sources = []));
    sources.push(source);
  }

  const held: HeldSection[] = [];
  for (const heading of Array.from(root.children) as HTMLElement[]) {
    if (!eligibleHeading(root, heading)) continue;
    const source = captured.find((candidate) => candidate.source === heading);
    if (source === undefined) continue;
    const associations: HeldAssociation[] = [];
    for (let member = heading.nextElementSibling; member !== null && !stopsFold(member); member = member.nextElementSibling) {
      for (const original of presented.get(member) ?? []) {
        // A direct h2 is a heading, never an ordinary member. An h1 remains an ordinary member by the stop rule above.
        if (original.source !== heading) associations.push({ source: original.source, member, contribution: original.member });
      }
    }
    if (associations.length > 0) {
      held.push(Object.freeze({ heading, id: heading.id, headingContribution: source.heading, associations: Object.freeze(associations) }));
    }
  }

  // With no held section, preserve the old no-read/no-chrome empty result after capture is consumed.
  if (held.length === 0) return;
  // Storage can synchronously mutate the source. Validate the held, exact associations before any fold chrome exists.
  const stored = state.readDoc(FOLDS);
  if (!ctx.live()) return;
  const want = new Set(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : []);
  const owners = held.map((candidate): HeldOwner => {
    const active = liveAssociations(root, candidate);
    return {
      ...candidate,
      active,
      retiredSources: new Set(candidate.associations.filter((association) => !active.includes(association)).map((association) => association.source)),
      section: null,
    };
  });
  const ownerOfSource = new Map<Element, HeldOwner>();
  const ownerOfMember = new Map<Element, HeldOwner>();
  for (const owner of owners) {
    for (const association of owner.associations) {
      ownerOfSource.set(association.source, owner);
      ownerOfMember.set(association.member, owner);
    }
  }
  const sections: Section[] = [];
  const sectionOfMember = new Map<Element, Section>();
  const joinedTo = new Map<Element, { readonly section: Section; readonly member: Element }>();

  for (const owner of owners) {
    const candidate = owner;
    const associations = owner.active;
    if (associations.length === 0) continue;
    const members = liveMembers(root, candidate);
    if (members.length === 0) continue;
    let prose = candidate.headingContribution[0];
    let code = candidate.headingContribution[1];
    let figures = candidate.headingContribution[2];
    for (const association of associations) {
      prose += association.contribution[0];
      code += association.contribution[1];
      figures += association.contribution[2];
    }
    // A heading an earlier feature has named (plans names a task heading with its task number, before its badge
    // becomes chrome) is named that way here too, as the reference named the fold before plans ran; otherwise its
    // own text, chrome left out.
    const bare = (candidate.heading.getAttribute('aria-label') ?? headingText(candidate.heading, isChrome)).replace(/^[A-Z]?\d+[a-z]?\.\s+/, '');
    const minutes = formatMinutes(contributionMinutes(prose, code, figures));
    const btn = chrome(root.ownerDocument, 'button', {
      className: 'h-fold',
      text: 'Fold',
      attrs: { type: 'button', 'aria-expanded': 'true', 'aria-label': `Fold or unfold: ${bare}` },
    });
    const note = chrome(root.ownerDocument, 'button', { className: 'fold-note', attrs: { type: 'button', hidden: '', 'aria-label': `Unfold: ${bare}` } }, [
      chrome(root.ownerDocument, 'span', { className: 'fn-t', text: 'Folded' }),
      ...(minutes === '' ? [] : [chrome(root.ownerDocument, 'span', { className: 'fn-m', text: minutes })]),
      chrome(root.ownerDocument, 'span', { className: 'fn-s', text: 'Show' }),
    ]);
    const section: Section = {
      owner,
      heading: candidate.heading,
      id: candidate.id,
      headingContribution: candidate.headingContribution,
      associations,
      retiredSources: owner.retiredSources,
      btn,
      note,
      folded: want.has(candidate.id),
      hid: new Set(),
    };
    owner.section = section;
    sections.push(section);
    for (const member of members) sectionOfMember.set(member, section);
    journal.insert(note, root, candidate.heading.nextSibling);
    // The heading is named by its own text, not by the controls inside it: headCtl labels it (aria-label) as it makes
    // the controls, unless the heading has a label already.
    ctx.headCtl(candidate.heading, 'fold', btn);
  }
  if (sections.length === 0) return;

  /** Format the live frozen contributions without another preservation pass. */
  const refreshMinutes = (section: Section, associations: readonly HeldAssociation[]): void => {
    if (!ctx.live()) return;
    let prose = section.headingContribution[0];
    let code = section.headingContribution[1];
    let figures = section.headingContribution[2];
    for (const association of associations) {
      prose += association.contribution[0];
      code += association.contribution[1];
      figures += association.contribution[2];
    }
    const minute = formatMinutes(contributionMinutes(prose, code, figures));
    const label = section.note.querySelector('.fn-m');
    if (minute === '') label?.remove();
    else if (label !== null) label.textContent = minute;
    else section.note.querySelector('.fn-t')?.after(chrome(root.ownerDocument, 'span', { className: 'fn-m', text: minute }));
  };

  /** Retire every stale association in an owner before any caller makes its structural decision. */
  const reconcile = (owner: HeldOwner): readonly HeldAssociation[] => {
    const kept: HeldAssociation[] = [];
    for (const association of owner.active) {
      if (owner.retiredSources.has(association.source) || !preservesAssociation(root, owner.heading, association)) {
        owner.retiredSources.add(association.source);
      } else kept.push(association);
    }
    if (kept.length !== owner.active.length) {
      owner.active = kept;
      if (owner.section !== null) {
        owner.section.associations = kept;
        refreshMinutes(owner.section, kept);
      }
    }
    return owner.active;
  };

  /** Exact live source members, deduplicated only after every captured original was checked. */
  const sourceMembers = (section: Section): Element[] => {
    const out: Element[] = [];
    for (const association of reconcile(section.owner)) {
      if (!out.includes(association.member)) out.push(association.member);
    }
    return out;
  };

  /** Reconcile every known held owner reachable from an exact source/member/join ancestry. */
  const ownersFor = (node: Node): Set<HeldOwner> => {
    const owners = new Set<HeldOwner>();
    for (let current: Node | null = node; current !== null; current = current.parentNode) {
      if (current.nodeType !== 1) continue;
      const element = current as Element;
      const source = ownerOfSource.get(element);
      if (source !== undefined) owners.add(source);
      const member = ownerOfMember.get(element);
      if (member !== undefined) owners.add(member);
      const join = joinedTo.get(element);
      if (join !== undefined) owners.add(join.section.owner);
    }
    for (const owner of owners) reconcile(owner);
    return owners;
  };

  /** The nearest original source decides whether this query may use a current presentation container. */
  const nearestSource = (node: Node): Element | null => {
    for (let current: Node | null = node; current !== null; current = current.parentNode) {
      if (current.nodeType === 1 && ownerOfSource.has(current as Element)) return current as Element;
    }
    return null;
  };

  /** A direct source member or exact joined chain that still terminates in one live source presentation member. */
  const memberLive = (section: Section, member: Element, seen: ReadonlySet<Element> = new Set()): boolean => {
    ownersFor(member);
    if (seen.has(member) || member.parentElement !== root) return false;
    if (sourceMembers(section).includes(member)) return true;
    const join = joinedTo.get(member);
    if (join === undefined || join.section !== section || !isChrome(member)) return false;
    const next = new Set(seen);
    next.add(member);
    return memberLive(section, join.member, next);
  };

  /** The source-bearing members that still preserve a section, plus exact live chrome join chains. */
  const visibleMembers = (section: Section): Element[] => {
    const out = sourceMembers(section);
    for (const [node, join] of joinedTo) {
      if (join.section === section && memberLive(section, node) && !out.includes(node)) out.push(node);
    }
    return out;
  };

  const isLiveSection = (section: Section): boolean => sourceMembers(section).length > 0;

  /** Hide or show one member as its section is folded or not. */
  const showMember = (section: Section, member: Element): void => {
    if (section.folded) {
      if (!member.hasAttribute('hidden')) {
        journal.setAttribute(member, 'hidden', 'until-found');
        section.hid.add(member);
      }
    } else if (section.hid.has(member)) {
      section.hid.delete(member);
      if (member.getAttribute('hidden') === 'until-found') journal.setAttribute(member, 'hidden', null);
    }
  };

  /** Put a section's fold state on the DOM. Its caller has revalidated source, heading and presentation membership. */
  const show = (section: Section): void => {
    const associations = reconcile(section.owner);
    refreshMinutes(section, associations);
    for (const member of visibleMembers(section)) showMember(section, member);
    journal.toggleClass(section.heading, 'folded', section.folded);
    section.note.hidden = !section.folded;
    section.btn.textContent = section.folded ? 'Unfold' : 'Fold';
    section.btn.setAttribute('aria-expanded', String(!section.folded));
  };

  /** Write the folded headings behind; false when the host's set() destroyed the instance. */
  const save = (): boolean => {
    const ids = sections.filter((section) => section.folded && isLiveSection(section)).map((section) => section.id);
    state.writeDoc(FOLDS, ids.length > 0 ? [...new Set(ids)] : null);
    return ctx.live(); // the host's set() ran: it may have destroyed the instance
  };

  /** Fold or unfold one section: local state, then the write-behind, then (still live) the DOM and a relayout. */
  const setFold = (section: Section, on: boolean): void => {
    if (section.folded === on || !isLiveSection(section)) return;
    section.folded = on;
    if (!save() || !isLiveSection(section)) return;
    show(section);
    ctx.relayout('folds');
  };

  /** Fold or unfold every currently valid section: one write, then (still live) the DOM and one relayout. */
  const setAll = (on: boolean): void => {
    const changed = sections.filter((section) => section.folded !== on && isLiveSection(section));
    if (changed.length === 0) return;
    for (const section of changed) section.folded = on;
    if (!save()) return;
    const current = changed.filter(isLiveSection);
    if (current.length === 0) return;
    for (const section of current) show(section);
    ctx.relayout('folds');
  };

  /** The folding section whose blocks hold node: through its exact, current direct-root-child presentation member. */
  const holding = (node: Node): Section | null => {
    ownersFor(node);
    const source = nearestSource(node);
    if (source !== null && ownerOfSource.get(source)?.retiredSources.has(source)) return null;
    let top: Node | null = node;
    while (top !== null && top.parentNode !== root) top = top.parentNode;
    if (top === null || top.nodeType !== 1) return null;
    const member = top as Element;
    const direct = sectionOfMember.get(member);
    if (direct !== undefined && memberLive(direct, member)) return direct;
    const join = joinedTo.get(member);
    return join !== undefined && memberLive(join.section, member) ? join.section : null;
  };

  const listenFind = (section: Section, member: Element): void => {
    journal.listen(member, 'beforematch', (event) => {
      const target = event.target;
      if (target !== null && holding(target as Node) === section && memberLive(section, member)) setFold(section, false);
    });
  };

  for (const section of sections) {
    if (section.folded && isLiveSection(section)) show(section);
    journal.listen(section.btn, 'click', (event) => {
      event.preventDefault();
      setFold(section, !section.folded);
    });
    journal.listen(section.note, 'click', () => {
      setFold(section, false);
    });
    for (const member of visibleMembers(section)) listenFind(section, member);
  }

  // Reveal unfolds the section that holds what it shows.
  ctx.onReveal((element) => {
    const section = holding(element);
    if (section !== null) setFold(section, false);
  });

  const bySection = new Map<Element, Section>(sections.map((section) => [section.heading, section]));
  builds?.get(ctx.folds)?.(
    Object.freeze({
      headings: () => Object.freeze(sections.filter(isLiveSection).map((section) => section.heading)),
      isFolded: (heading: Element) => {
        const section = bySection.get(heading);
        return section !== undefined && isLiveSection(section) ? section.folded : false;
      },
      setFold: (heading: Element, on: boolean) => {
        const section = bySection.get(heading);
        if (section !== undefined) setFold(section, on);
      },
      setAll,
      sectionOf: (node: Node) => holding(node)?.heading ?? null,
      join: (node: Element, member: Element) => {
        if (node.parentNode !== root || !node.hasAttribute(CHROME_ATTR)) {
          throw new Error('docreader: folds.join takes a node the feature put in the root, as a child of it');
        }
        ownersFor(member);
        if (ownerOfSource.has(node) || joinedTo.has(node) || sectionOfMember.has(node)) return false;
        const section = sectionOfMember.get(member) ?? joinedTo.get(member)?.section;
        if (section === undefined || !memberLive(section, member)) return false;
        joinedTo.set(node, { section, member });
        listenFind(section, node);
        if (isLiveSection(section)) showMember(section, node);
        return true;
      },
    }),
  );

  // Print shows everything, whatever is folded (the root's window, through env).
  ctx.env.onPrint((printing) => {
    for (const section of sections) {
      if (!section.folded || !isLiveSection(section)) continue;
      for (const member of section.hid) {
        if (!visibleMembers(section).includes(member)) continue;
        if (printing && member.getAttribute('hidden') === 'until-found') journal.setAttribute(member, 'hidden', null);
        else if (!printing && !member.hasAttribute('hidden')) journal.setAttribute(member, 'hidden', 'until-found');
      }
    }
  });
}
