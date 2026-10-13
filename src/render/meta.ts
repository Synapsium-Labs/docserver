// The meta of a rendered document (docserver L1; architecture section C, the "Meta" row; ruling C2).
// Every field is read from what the rules recorded in the document's RenderEnv while it was parsed and
// rendered, so meta and html come from one pass and cannot disagree. This task fills `headings` and
// `title`; Task 9 fills `front` and `frontList`, Tasks 6, 8 and 10 the counters and `mermaidKinds`.
import type { RenderEnv } from './env.js';
import type { RenderMeta } from './types.js';

/** The meta of one rendered document. Call it after the env's render has finished. */
export function collectMeta(env: RenderEnv): RenderMeta {
  const headings = env.headings;
  return {
    front: null,
    frontList: null,
    title: headings.find((h) => h.level === 1)?.text ?? null,
    headings,
    figures: 0,
    tables: 0,
    mermaidKinds: [],
  };
}
