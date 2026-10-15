// The task_lists core rule (docserver L1; architecture section C, the "Task lists" row; contract sections
// 1 and 6 item 4). A port of the reference's task-list plugin with its defaults (checkboxes disabled, no
// label); markdown-it-task-lists cannot stand in for it, as it writes `checked=""` where the reference
// writes `checked="checked"`. For each list item whose first block is a paragraph whose text starts with
// `[ ]`, `[x]` or `[X]` and then GFM whitespace (space, tab, line feed, \v, \f or \r; not Python's wider
// set), the rule:
// - puts the checkbox before the paragraph's first inline token, as raw HTML of fixed text:
//     <input class="task-list-item-checkbox"{ checked="checked"} disabled="disabled" type="checkbox">
//   checked for `[x] ` and `[X] `, unchecked for `[ ] `. When the marker is followed by whitespace other
//   than a space (`[ ]\tx`, or `[x]` at the end of a line) the reference writes an empty string instead,
//   and so does this rule: the item is still a task item, with no checkbox;
// - drops the marker, the first three code points of that first inline token (Python's `[3:]`), so the
//   whitespace after the marker stays;
// - sets class="task-list-item" on the list item and class="contains-task-list" on the list that holds
//   it (the nearest token before it one level up), so a list that mixes tasks and plain items, and an
//   outer list whose item holds a task list, are marked as the reference marks them.
// It runs right after footnote_tail and before text_join, as the reference's does, so a task item inside
// a footnote is made like any other.
import type { StateCore, Token } from 'markdown-it';
import { cpSlice } from './pyText.js';

/** The task marker at the start of a list item's paragraph text: `[ ]`, `[x]` or `[X]`, then GFM whitespace. */
export const TASK = /^\[[ xX]\][ \t\n\v\f\r]+/;

/** The checkbox of an open task. */
export const UNCHECKED = '<input class="task-list-item-checkbox" disabled="disabled" type="checkbox">';

/** The checkbox of a done task. */
export const CHECKED =
  '<input class="task-list-item-checkbox" checked="checked" disabled="disabled" type="checkbox">';

/** The checkbox for a task item's text, read by its marker and the space after it; '' as the reference. */
function checkbox(content: string): string {
  if (content.startsWith('[ ] ')) return UNCHECKED;
  if (content.startsWith('[x] ') || content.startsWith('[X] ')) return CHECKED;
  return '';
}

/** Python's `s[3:]`: everything after the first three code points. */
function dropThree(s: string): string {
  return s.substring(cpSlice(s, 3).length);
}

function isTaskItem(tokens: readonly Token[], i: number): boolean {
  return (
    tokens[i]?.type === 'inline' &&
    tokens[i - 1]?.type === 'paragraph_open' &&
    tokens[i - 2]?.type === 'list_item_open' &&
    TASK.test(tokens[i]?.content ?? '')
  );
}

export function taskLists(state: StateCore): void {
  const tokens = state.tokens;
  // For each nesting level, the index of the last token seen at that level. A task item's list is the
  // last token one level above the item. The reference searched backwards from each item instead, which
  // costs a long list quadratic time; this one pass gives the same token. The rule adds children to
  // inline tokens and never adds or removes a token, so the indexes stay valid.
  const last = new Map<number, number>();
  for (const [i, t] of tokens.entries()) {
    last.set(t.level, i);
    // The reference's loop: from the third token to the one before the last.
    if (i < 2 || i >= tokens.length - 1 || !isTaskItem(tokens, i)) continue;
    const item = tokens[i - 2];
    if (item === undefined) continue;
    const children = t.children ?? [];
    const box = new state.Token('html_inline', '', 0);
    box.content = checkbox(t.content);
    const first = children[0];
    if (first !== undefined) first.content = dropThree(first.content);
    children.unshift(box);
    t.children = children;
    t.content = dropThree(t.content);
    item.attrSet('class', 'task-list-item');
    // The reference falls back to tokens[-1], the last token, when no parent is found. A list item always
    // follows its list, so that never happens on a parsed stream; the same fallback is kept all the same.
    tokens.at(last.get(item.level - 1) ?? -1)?.attrSet('class', 'contains-task-list');
  }
}
