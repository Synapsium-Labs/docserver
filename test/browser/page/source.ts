// Which texts are the document's own: page-side code for the Level 2 snapshot (snapshot.ts). Before enhance() runs,
// every text node under the root is recorded. The layout never re-types a source text: it moves it, or partitions it
// with Text.splitText (src/enhance/journal.ts, `split`), whose new tail holds source characters too. So splitText is
// wrapped for the page: a tail split off a source text is a source text. A text the layout creates (a chrome label,
// a reading time) is never recorded. The wrapper is installed once per window and serves every root tracked in it.

/** The source texts of one window's tracked roots. */
const tracked = new WeakMap<object, WeakSet<Text>>();

/**
 * Record the texts under `root` as source texts and return the test for them. `TextClass` is the window's `Text`
 * constructor (the page's own, or jsdom's), whose prototype's splitText is wrapped once.
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
  }
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) set.add(n as Text);
  const known = set;
  return (t: Text) => known.has(t);
}
