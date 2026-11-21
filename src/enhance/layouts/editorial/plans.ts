import { headingText } from '../../headctl.js';
import { CHROME_ATTR, chrome } from '../../journal.js';
import type { FeatureContext } from '../../types.js';

/** Editorial's plan labels, without the outline mode of the shared plan builder. */
export function build(ctx: FeatureContext): void {
  const { root, journal, vocab } = ctx;
  const doc = root.ownerDocument;
  const headings: HTMLElement[] = [];
  const members: Element[][] = [];
  const fingerprints: string[] = [];
  const tasks: { heading: HTMLElement; text: Text; match: RegExpExecArray; steps: number; owner: string }[] = [];

  for (const heading of Array.from(root.querySelectorAll<HTMLElement>('h3'))) {
    if (heading.hasAttribute(CHROME_ATTR) || heading.firstChild?.nodeType !== 3) continue;
    const text = heading.firstChild as Text;
    const match = vocab.plan.task.exec(text.data);
    if (match === null) continue;
    const siblings: Element[] = [];
    let steps = 0;
    let owner = '';
    for (let node = heading.nextElementSibling; node !== null && !/^h[1-3]$/.test(node.localName); node = node.nextElementSibling) {
      if (node.classList.contains('short') && node.querySelector('h1, h2, h3') !== null) break;
      siblings.push(node);
      if (node.localName === 'ul') steps += Array.from(node.children).filter((li) => li.classList.contains('task-list-item')).length;
      if (owner === '' && node.localName === 'p') owner = vocab.plan.who.exec((node.textContent ?? '').replace(/\s+/g, ' ').trim())?.[1] ?? '';
    }
    let source = heading.textContent ?? '';
    for (const node of siblings) if (node.localName !== 'script' && node.localName !== 'dl') source += `\u0001${node.textContent ?? ''}`;
    headings.push(heading);
    members.push(siblings);
    fingerprints.push(ctx.text.hash(source));
    tasks.push({ heading, text, match, steps, owner });
  }

  for (const task of tasks) {
    const { heading, text, match, steps, owner } = task;
    if (!heading.hasAttribute('aria-label') && !heading.hasAttribute('aria-labelledby')) {
      journal.setAttribute(heading, 'aria-label', headingText(heading, (el) => el.hasAttribute(CHROME_ATTR)));
    }
    const end = text.data.indexOf(match[2]!, match[1]!.length) + match[2]!.length;
    if (match[0].length < text.data.length) journal.split(text, match[0].length);
    const separator = journal.split(text, end);
    const badge = chrome(doc, 'span', { className: 'task-id' });
    journal.wrap([text], badge);
    journal.wrap([separator], chrome(doc, 'span', { attrs: { hidden: '' } }));
    if (steps > 0) journal.insert(chrome(doc, 'span', { className: 'tmeta', text: `${steps} ${steps === 1 ? 'step' : 'steps'}` }), badge, null);
    if (owner !== '') journal.insert(chrome(doc, 'span', { className: 'tmeta', text: owner }), badge, null);
    journal.toggleClass(heading, 'task', true);
  }

  const steps = Array.from(root.querySelectorAll<HTMLElement>('li.task-list-item'));
  let yours = 0;
  for (const item of steps) {
    const checkbox = item.querySelector<HTMLInputElement>(':scope > input[type="checkbox"], :scope > p:first-child > input[type="checkbox"]');
    const strong = item.querySelector<HTMLElement>(':scope > strong') ?? checkbox?.parentElement?.querySelector<HTMLElement>(':scope > strong') ?? null;
    const first = strong?.firstChild;
    const match = first?.nodeType === 3 ? vocab.plan.step.exec((first as Text).data) : null;
    if (strong === null || first === null || first === undefined || match === null) {
      if (checkbox !== null && !checkbox.hasAttribute('aria-label')) {
        const title = (strong?.textContent ?? item.textContent ?? '').replace(/\s+/g, ' ').trim();
        journal.setAttribute(checkbox, 'aria-label', ctx.text.clip(title, 200) || 'Step');
      }
      continue;
    }
    const text = first as Text;
    const label = match[1]!;
    const owner = match[2];
    const title = (strong.textContent ?? '').slice(match[0].length).trim();
    if (match[0].length < text.data.length) journal.split(text, match[0].length);
    const rest = journal.split(text, label.length);
    const badge = chrome(doc, 'span', { className: 'step-no' });
    journal.insert(badge, strong.parentNode!, strong);
    journal.move(text, badge, null);
    if (owner !== undefined) {
      const ownerNode = journal.split(rest, rest.data.indexOf('(') + 1);
      const end = journal.split(ownerNode, owner.length);
      const who = chrome(doc, 'span', { className: 'who' });
      journal.insert(who, badge, null);
      journal.move(ownerNode, who, null);
      journal.wrap([rest, end], chrome(doc, 'span', { attrs: { hidden: '' } }));
      if (vocab.addresseeAnywhere.test(owner)) yours += 1;
    } else journal.wrap([rest], chrome(doc, 'span', { attrs: { hidden: '' } }));
    if (checkbox !== null && !checkbox.hasAttribute('aria-label')) journal.setAttribute(checkbox, 'aria-label', ctx.text.clip(`${label}: ${title}`, 200));
  }
  ctx.plan.publish({ tasks: headings, members, fingerprints, steps, yours, outlineable: false });
}
