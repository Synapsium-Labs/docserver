// A large plan, the document of review focus RF3 (docserver L2, Task 7b): about 1.5 MB of Markdown with 2,000 defined
// IDs, 300 glossary terms and 1,000 steps in 50 tasks, for the tests that bound how the cross-references, the
// glossary, the outline and the scroll spy grow (Tasks 11, 12 and 13). `scale` multiplies every count and the size,
// so a test can compare a document twice as large (RF3: a 2× document takes at most 2.5× the time).
//
// What it holds, in order: a title and a byline; "In short"; a glossary ("Words used here", a Term | Meaning table, one
// row per term); the decisions, 100 ID rows per table under an h3 each (ID | What | Status, the IDs R1, R2, …, each
// row naming a term and an earlier ID); the tasks ("Task N: …" h3s under one h2, each with 20 steps as a task list,
// every fifth task owned by the reader and every seventh step marked as theirs); then notes, in h2 sections of 12
// paragraphs, each paragraph naming IDs and terms, until the size is reached. Deterministic: no randomness and no
// clock, so two calls give the same text. Neutral words only: the terms are made-up syllable words.

/** What a large plan holds. */
export interface LargePlanCounts {
  /** Defined IDs: rows of the ID tables. */
  readonly ids: number;
  /** Glossary terms: rows of the glossary table. */
  readonly terms: number;
  /** Task headings. */
  readonly tasks: number;
  /** Steps: task-list items. */
  readonly steps: number;
  /** Level-2 sections (each with an id). */
  readonly sections: number;
}

export interface LargePlan {
  readonly markdown: string;
  /** Its size in bytes (the text is ASCII, so one byte a character). */
  readonly bytes: number;
  readonly counts: LargePlanCounts;
}

/** The size of a plan at scale 1, in bytes. */
export const LARGE_PLAN_BYTES = 1_500_000;

/** Each count at scale 1. */
export const LARGE_PLAN_COUNTS: Omit<LargePlanCounts, 'sections'> = { ids: 2000, terms: 300, tasks: 50, steps: 1000 };

const SYLLABLES = ['ba', 'co', 'di', 'fe', 'ga', 'hu', 'ki', 'lo', 'me', 'nu', 'pa', 'ri', 'so', 'tu', 'va', 'we', 'xi', 'yo', 'za'];

/** The i-th term: a made-up word of three syllables and an l, unique for i below 19³. */
export function termWord(i: number): string {
  const n = SYLLABLES.length;
  return `${SYLLABLES[i % n] ?? ''}${SYLLABLES[Math.floor(i / n) % n] ?? ''}${SYLLABLES[Math.floor(i / (n * n)) % n] ?? ''}l`;
}

const ROWS_PER_TABLE = 100;
const STEPS_PER_TASK = 20;
const PARAGRAPHS_PER_SECTION = 12;

/** The large plan at `scale` (a positive integer; default 1). */
export function largePlan(scale = 1): LargePlan {
  if (!Number.isInteger(scale) || scale < 1 || scale > 4) throw new Error('largePlan: scale is an integer from 1 to 4');
  const ids = LARGE_PLAN_COUNTS.ids * scale;
  const terms = LARGE_PLAN_COUNTS.terms * scale;
  const tasks = LARGE_PLAN_COUNTS.tasks * scale;
  const target = LARGE_PLAN_BYTES * scale;
  const term = (i: number): string => termWord(i % terms);
  const id = (i: number): string => `R${String((i % ids) + 1)}`;
  const parts: string[] = [];
  let size = 0;
  const push = (s: string): void => {
    parts.push(s);
    size += s.length + 1;
  };
  let sections = 0;
  const section = (title: string): void => {
    sections += 1;
    push(`## ${title}`);
    push('');
  };

  push('# A large plan');
  push('');
  push('**Plan** · 2026-10-20 · Status: Draft');
  push('');
  section('In short');
  push(`- ${String(ids)} decisions, ${String(terms)} terms and ${String(tasks * STEPS_PER_TASK)} steps.`);
  push('- A document for measuring how the layout grows.');
  push('');

  section('Words used here');
  push('| Term | Meaning |');
  push('|---|---|');
  for (let i = 0; i < terms; i += 1) {
    push(`| ${termWord(i)} | The part that holds the ${term(i + 1)}, kept apart from the ${term(i + 7)}. |`);
  }
  push('');

  section('1. Decisions');
  for (let t = 0; t * ROWS_PER_TABLE < ids; t += 1) {
    push(`### Group ${String(t + 1)}`);
    push('');
    push('| ID | What | Status |');
    push('|---|---|---|');
    for (let r = 0; r < ROWS_PER_TABLE && t * ROWS_PER_TABLE + r < ids; r += 1) {
      const n = t * ROWS_PER_TABLE + r;
      const status = n % 3 === 0 ? 'Agreed' : n % 3 === 1 ? 'Pending' : 'Deferred';
      push(`| ${id(n)} | Keep the ${term(n)} beside ${id(n + ids - 1)} | ${status} |`);
    }
    push('');
  }

  section('2. Tasks');
  for (let k = 0; k < tasks; k += 1) {
    push(`### Task ${String(k + 1)}: Build part ${String(k + 1)}`);
    push('');
    if (k % 5 === 0) {
      push('Who: you.');
      push('');
    }
    for (let s = 0; s < STEPS_PER_TASK; s += 1) {
      const n = k * STEPS_PER_TASK + s;
      const owner = n % 7 === 0 ? ' (you)' : '';
      push(`- [ ] **Step ${String(s + 1)}${owner}:** Wire the ${term(n)} to the ${term(n + 3)} under ${id(n * 2)}.`);
    }
    push('');
  }

  let p = 0;
  while (size < target) {
    if (p % PARAGRAPHS_PER_SECTION === 0) section(`${String(3 + p / PARAGRAPHS_PER_SECTION)}. Notes, part ${String(p / PARAGRAPHS_PER_SECTION + 1)}`);
    const words: string[] = [];
    for (let w = 0; w < 12; w += 1) {
      const n = p * 12 + w;
      words.push(`The ${term(n)} follows ${id(n * 7)} when the ${term(n + 11)} is ready, and nothing else waits on it.`);
    }
    push(words.join(' '));
    push('');
    p += 1;
  }

  const markdown = parts.join('\n');
  return { markdown, bytes: markdown.length, counts: { ids, terms, tasks, steps: tasks * STEPS_PER_TASK, sections } };
}
