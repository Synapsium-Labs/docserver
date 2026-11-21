// Which texts are the document's own: page-side code for the Level 2 snapshot (snapshot.ts). Before enhance() runs,
// every text node under the root is recorded. The layout never re-types a source text: it moves it, or partitions it
// with Text.splitText (src/enhance/journal.ts, `split`) or cuts it in one pass (`splitAll`, whose pieces are shallow clones
// of an empty copy of it): the new tail holds source characters too. So splitText and a shallow cloneNode are wrapped for
// the page: a tail split off a source text, or a clone of one, is a source text. A text the layout creates (a chrome label,
// a reading time) is never recorded. The wrapper is installed once per window and serves every root tracked in it.

/** The source texts of one window's tracked roots. */
const tracked = new WeakMap<object, WeakSet<Text>>();

/**
 * Record the texts under `root` as source texts and return the test for them. `TextClass` is the window's `Text`
 * constructor (the page's own, or jsdom's), whose prototype's splitText and cloneNode are wrapped once.
 */
export function trackSource(root: Node, TextClass: typeof Text): (t: Text) => boolean {
  let set = tracked.get(TextClass);
  if (set === undefined) {
    const known = new WeakSet<Text>();
    set = known;
    tracked.set(TextClass, known);
    const split = TextClass.prototype.splitText;
    TextClass.prototype.splitText = function splitText(this: Text, offset: number): Text {
      const tail = split.call(this, offset);
      if (known.has(this)) known.add(tail);
      return tail;
    };
    // The journal's splitAll makes its pieces in one pass (splitText per cut is quadratic) by shallow clones of an empty copy of
    // the source text, so a `cloneNode(false)` of a source text is a source text too. A deep clone (`cloneNode(true)`, as the
    // cards make of what they copy) is chrome, as before.
    const clone = TextClass.prototype.cloneNode;
    TextClass.prototype.cloneNode = function cloneNode(this: Text, deep?: boolean): Node {
      const copy = clone.call(this, deep);
      if (deep === false && known.has(this)) known.add(copy as Text);
      return copy;
    };
  }
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) set.add(n as Text);
  const known = set;
  return (t: Text) => known.has(t);
}
