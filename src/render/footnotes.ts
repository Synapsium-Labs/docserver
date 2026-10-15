// The footnote_tail core rule (docserver L1, ruling C26). It is markdown-it-footnote 4.0.0's own rule of
// that name, ported step for step, and made linear. The plugin's rule ends every note with
// `state.tokens = state.tokens.concat(tokens)`, which copies the whole token array once per note, so a
// document with n notes costs O(n^2) (20000 notes took 32.6 s). This port appends each note's tokens to one
// output array instead. Its output is token-for-token the plugin's (test/footnote-cost.test.ts compares the
// two over the corpus, constructed shapes and seeded random documents), so no golden moves.
//
// This is a port of a pinned dependency's rule (ruling C26): when markdown-it-footnote is upgraded past
// 4.0.0, re-run test/footnote-cost.test.ts, its differential above all, and re-read the plugin's footnote_tail
// for changes before taking the new version.
//
// What the rule does, in the plugin's order:
// - it takes the `footnote_reference_open` ... `footnote_reference_close` runs out of the token stream
//   (the block rule footnote_def put them there), keeping each run's tokens under its label;
// - it appends a `footnote_block_open`, then for every note in the order of first reference a
//   `footnote_open`, the note's tokens (an inline note becomes one paragraph, a note defined by a block
//   takes the tokens kept for its label), one `footnote_anchor` for each reference to it (one when it has
//   none), and a `footnote_close`; the last paragraph's `paragraph_close` is moved after the anchors, so
//   the back-references sit inside that paragraph;
// - it ends with a `footnote_block_close`.
// Its only state is the env's `footnotes` (written by the plugin's parse rules) and the token array.
import type { StateCore, Token } from 'markdown-it';

interface FootnoteEntry {
  label?: string;
  count: number;
  tokens?: Token[];
  content: string;
}

interface FootnoteEnv {
  footnotes?: { list?: FootnoteEntry[] };
}

export function footnoteTail(state: StateCore): void {
  const env = state.env as FootnoteEnv;
  if (!env.footnotes) return;

  let current: Token[] = [];
  let currentLabel: string | undefined;
  let insideRef = false;
  const refTokens: Record<string, Token[]> = {};

  const out = state.tokens.filter((tok) => {
    if (tok.type === 'footnote_reference_open') {
      insideRef = true;
      current = [];
      currentLabel = (tok.meta as { label?: string }).label;
      return false;
    }
    if (tok.type === 'footnote_reference_close') {
      insideRef = false;
      // The plugin prepends ':' so that a label cannot collide with an Object.prototype member.
      refTokens[`:${String(currentLabel)}`] = current;
      return false;
    }
    if (insideRef) current.push(tok);
    return !insideRef;
  });
  state.tokens = out;

  const list = env.footnotes.list;
  if (!list) return;

  out.push(new state.Token('footnote_block_open', '', 1));

  for (const [i, note] of list.entries()) {
    const open = new state.Token('footnote_open', '', 1);
    open.meta = { id: i, label: note.label };
    out.push(open);

    let tokens: Token[] | undefined;
    if (note.tokens) {
      const paragraphOpen = new state.Token('paragraph_open', 'p', 1);
      paragraphOpen.block = true;
      const inline = new state.Token('inline', '', 0);
      inline.children = note.tokens;
      inline.content = note.content;
      const paragraphClose = new state.Token('paragraph_close', 'p', -1);
      paragraphClose.block = true;
      tokens = [paragraphOpen, inline, paragraphClose];
    } else if (note.label) {
      tokens = refTokens[`:${note.label}`];
    }

    // The plugin concatenates here, copying all of out; appending each token is the whole change.
    if (tokens) for (const t of tokens) out.push(t);

    const last = out[out.length - 1];
    const lastParagraph = last?.type === 'paragraph_close' ? out.pop() : undefined;

    const anchors = note.count > 0 ? note.count : 1;
    for (let j = 0; j < anchors; j += 1) {
      const anchor = new state.Token('footnote_anchor', '', 0);
      anchor.meta = { id: i, subId: j, label: note.label };
      out.push(anchor);
    }

    if (lastParagraph) out.push(lastParagraph);

    out.push(new state.Token('footnote_close', '', -1));
  }

  out.push(new state.Token('footnote_block_close', '', -1));
}
