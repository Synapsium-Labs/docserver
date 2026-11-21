import type { FeatureContext } from '../../types.js';

/** Reveal below-the-fold blocks as they enter the viewport. */
export function build(ctx: FeatureContext): void {
  if (ctx.env.reducedMotion()) return;
  const pending = new Set<Element>();
  const show = (element: Element): void => {
    if (!pending.delete(element)) return;
    ctx.journal.toggleClass(element, 'in', true);
    observer?.unobserve(element);
  };
  const observer = ctx.env.observeIntersection((changes) => {
    for (const change of changes) if (change.isIntersecting) show(change.target);
  }, { rootMargin: '0px 0px -8% 0px' });
  if (observer === null) return;
  for (const element of Array.from(ctx.root.querySelectorAll('figure.mermaid-figure, .table-wrapper, .callout, .short'))) {
    if (element.getBoundingClientRect().top <= ctx.env.viewport().h) continue;
    pending.add(element);
    ctx.journal.toggleClass(element, 'reveal', true);
    observer.observe(element);
  }
  ctx.journal.defer(ctx.events.on('reveal', ({ target }) => {
    for (const element of pending) if (element === target || element.contains(target)) show(element);
  }));
  ctx.journal.defer(() => observer.cancel());
}
