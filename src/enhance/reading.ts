// Reading time, ported from the reference reader's section 0: prose at 230 words a minute, code at 520, and half a
// minute a figure. A section's time feeds its fold note (folds.ts); the whole document's feeds the byline
// (editorial.ts). Both are measured on the rendered document before any feature moves a node.

/** Words in a text: runs of characters other than space, tab, line feed, carriage return and no-break space. */
export function words(s: string): number {
  let n = 0;
  let inWord = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    const space = c === 32 || c === 10 || c === 9 || c === 13 || c === 160;
    if (!space && !inWord) n += 1;
    inWord = !space;
  }
  return n;
}

/** Compact integer reading contributions: prose words, code words and figures. */
export type ReadingContribution = readonly [prose: number, code: number, figures: number];

/** The contribution of one heading. */
export function headingContribution(heading: Element | null): ReadingContribution {
  return [heading === null ? 0 : words(heading.textContent ?? ''), 0, 0];
}

/** The contribution of one direct presentation member. */
export function memberContribution(n: Element): ReadingContribution {
  if (n.localName === 'script' || n.localName === 'dl') return [0, 0, 0];
  if (n.localName === 'figure') return [0, 0, 1];
  const all = words(n.textContent ?? '');
  if (n.classList.contains('codehilite') || n.localName === 'pre') return [0, all, 0];
  let code = 0;
  let figures = 0;
  if (n.firstElementChild !== null) {
    for (const x of Array.from(n.querySelectorAll('.codehilite'))) code += words(x.textContent ?? '');
    figures = n.getElementsByTagName('figure').length;
  }
  return [Math.max(0, all - code), code, figures];
}

/** Convert integer reading contributions once, after their section has been summed. */
export function contributionMinutes(prose: number, code: number, figures: number): number {
  return prose / 230 + code / 520 + figures * 0.5;
}

/** The reading time of a heading (or none, for what comes before the first one) and its blocks, in minutes. */
export function sectionMinutes(heading: Element | null, members: readonly Element[]): number {
  const [headingProse, headingCode, headingFigures] = headingContribution(heading);
  let prose = headingProse;
  let code = headingCode;
  let figures = headingFigures;
  for (const member of members) {
    const [memberProse, memberCode, memberFigures] = memberContribution(member);
    prose += memberProse;
    code += memberCode;
    figures += memberFigures;
  }
  return contributionMinutes(prose, code, figures);
}

/**
 * The reading time of the whole document under `root`, in minutes: its children cut into sections at every h1 and
 * h2, each measured as sectionMinutes does.
 */
export function documentMinutes(root: Element): number {
  let total = 0;
  let heading: Element | null = null;
  let members: Element[] = [];
  for (const c of Array.from(root.children)) {
    if (c.localName === 'h1' || c.localName === 'h2') {
      total += sectionMinutes(heading, members);
      heading = c;
      members = [];
    } else {
      members.push(c);
    }
  }
  return total + sectionMinutes(heading, members);
}

/** A section's time, for a fold note: "12 min", "1.5 h", or '' under a minute. */
export function formatMinutes(m: number): string {
  if (m < 1) return '';
  return m < 59.5 ? `${String(Math.round(m))} min` : `${String(Math.round(m / 6) / 10)} h`;
}

/** A document's time, for the byline: "7 min", "1 h", "1 h 20 min" (at least a minute; to ten minutes past an hour). */
export function formatLong(m: number): string {
  const r = Math.max(1, Math.round(m));
  if (r < 60) return `${String(r)} min`;
  const t = Math.round(r / 10) * 10;
  const h = Math.floor(t / 60);
  const mm = t % 60;
  return `${String(h)} h${mm === 0 ? '' : ` ${String(mm)} min`}`;
}
