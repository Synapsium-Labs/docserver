// The meta of a rendered document (docserver L1; architecture section C, the "Meta" row; ruling C2).
// Every field is read from what the rules recorded in the document's RenderEnv while it was parsed and
// rendered, so meta and html come from one pass and cannot disagree. Task 4 filled `headings` and `title`,
// Task 6 `figures` and `mermaidKinds` (the fence rule, fence.ts), Task 8 `tables` (the table_open rule,
// tables.ts), Task 9 `front` and `frontList` (the front_matter render rule, frontMatter.ts; both from the
// one mapping the strip renders, PD3).
import type { RenderEnv } from './env.js';
import { frontRecord } from './frontMatter.js';
import type { RenderMeta } from './types.js';

/** The meta of one rendered document. Call it after the env's render has finished. */
export function collectMeta(env: RenderEnv): RenderMeta {
  const headings = env.headings;
  const frontList = env.frontList ?? null;
  return {
    front: frontList === null ? null : frontRecord(frontList),
    frontList,
    title: headings.find((h) => h.level === 1)?.text ?? null,
    headings,
    figures: env.figures,
    tables: env.tables,
    mermaidKinds: env.mermaidKinds,
  };
}
