// The guided layout's reading times, which follow the reader's lens as the reference's do: prose at 230 words a minute and a
// figure at half a minute under both, code at 520 words a minute under Engineering and 2000 under Product (skimmed).
//
// `guided-times` measures each section once, right after `editorial` and before any step adds text to a section: its heading's
// and blocks' prose, code and figures (reading.ts's contributions, the numbers the shared times are made from). The hero, the
// layers and the Contents then ask for a section's contribution and `stamp` a chrome node with a time made from it; every
// stamped node is made again when the lens changes (the `prefs` event). Nothing of the document is read again.
import {
  contributionMinutes,
  headingContribution,
  memberContribution,
  type ReadingContribution,
} from '../../reading.js';
import type { FeatureContext } from '../../types.js';

/** Words of code a minute under the Product lens: skimmed. */
const PRODUCT_CODE_RATE = 2000;

interface Stamped {
  readonly node: HTMLElement;
  readonly c: ReadingContribution;
  readonly say: (minutes: number) => string;
}

interface Held {
  readonly sections: Map<Element, ReadingContribution>;
  readonly stamped: Stamped[];
}

/** One record per instance, made by build; lazy and context-keyed, so importing this creates no reader state. */
let held: WeakMap<FeatureContext, Held> | undefined;

/** A contribution's minutes under the lens in force. */
export function minutesUnder(ctx: FeatureContext, c: ReadingContribution): number {
  return ctx.state.prefs.lens === 'product' ? c[0] / 230 + c[1] / PRODUCT_CODE_RATE + c[2] * 0.5 : contributionMinutes(c[0], c[1], c[2]);
}

/** Measure every section. */
export function build(ctx: FeatureContext): void {
  const sections = new Map<Element, ReadingContribution>();
  for (const u of ctx.sections) {
    let [prose, code, figures] = headingContribution(u.heading);
    for (const m of u.members) {
      const [p, c, f] = memberContribution(m);
      prose += p;
      code += c;
      figures += f;
    }
    sections.set(u.heading, [prose, code, figures]);
  }
  const record: Held = { sections, stamped: [] };
  (held ??= new WeakMap()).set(ctx, record);
  ctx.journal.defer(ctx.events.on('prefs', () => {
    for (const s of record.stamped) s.node.textContent = s.say(minutesUnder(ctx, s.c));
  }));
}

/** A section's contribution (a heading the shared steps counted as a section). */
export function contributionOf(ctx: FeatureContext, heading: Element): ReadingContribution {
  return (held?.get(ctx) as Held).sections.get(heading) as ReadingContribution;
}

/** Every section's contributions, added. */
export function wholeDocument(ctx: FeatureContext): ReadingContribution {
  let prose = 0;
  let code = 0;
  let figures = 0;
  for (const [p, c, f] of (held?.get(ctx) as Held).sections.values()) {
    prose += p;
    code += c;
    figures += f;
  }
  return [prose, code, figures];
}

/** Put the time of `c`, as `say` words it, in `node` now and after every change of the lens. */
export function stamp(ctx: FeatureContext, node: HTMLElement, c: ReadingContribution, say: (minutes: number) => string): HTMLElement {
  (held?.get(ctx) as Held).stamped.push({ node, c, say });
  node.textContent = say(minutesUnder(ctx, c));
  return node;
}
