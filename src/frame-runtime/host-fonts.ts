// The host's two faces (docserver appearance contract, Task 5; the first consumer's design, section 2.2). The seed carries
// `fonts` as two base64 woff2 strings, `sans` and `mono`; the bootstrap hands them here, in the reader script, because
// `atob` and `FontFace` are DOM globals the reader's own walls refuse. Each face is checked in turn: the base64 alphabet,
// the decoded bytes' `wOF2` signature and the cap (131 072 decoded bytes), then loaded from the bytes with the FontFace API
// under a fixed family name (no CSS text is built from host input; the hosted stylesheet names the families). A face that
// fails any check or its load is dropped, and that role keeps the library's own face. Never throws, and the returned
// promise always resolves: a bad face never refuses the mount.
//
// The platform's three sinks, each used once: `atob` (the decode), `FontFace` (the constructor) and the document's `fonts`
// (the set the face is added to, and removed from when its load fails); test/frame-runtime-walls.test.ts names each.

/** The fixed family names the hosted stylesheet's font stacks begin with. */
const FAMILY = { sans: 'Docreader Host Sans', mono: 'Docreader Host Mono' } as const;
/** The cap on one face, in decoded bytes. */
const CAP = 131072;
/** A base64 alphabet string (the standard one, with its padding). */
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** One role's face: the bytes when every check passes, else null. */
function decode(text: unknown): Uint8Array<ArrayBuffer> | null {
  // A cap on the text first (4 characters per 3 bytes), so a long string is never decoded.
  if (typeof text !== 'string' || text.length > CAP * 1.4 || !BASE64.test(text)) return null;
  const raw = atob(text);
  if (raw.length > CAP || raw.slice(0, 4) !== 'wOF2') return null;
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Load each host face; resolves once every load has settled. See the header. */
export function loadHostFonts(fonts: unknown): Promise<void> {
  const loads: Promise<unknown>[] = [];
  try {
    if (typeof fonts !== 'object' || fonts === null) return Promise.resolve();
    const set = document.fonts;
    for (const role of ['sans', 'mono'] as const) {
      try {
        const d = Object.getOwnPropertyDescriptor(fonts, role); // a getter is never called
        const bytes = d !== undefined && 'value' in d ? decode(d.value) : null;
        if (bytes === null) continue;
        const face = new FontFace(FAMILY[role], bytes);
        set.add(face);
        loads.push(face.load().catch(() => set.delete(face)));
      } catch {
        // this face is dropped (bad base64, a refused constructor, a font set that refuses it); the other role goes on
      }
    }
  } catch {
    // an unreadable value, or a document without a font set: nothing more is loaded
  }
  return Promise.all(loads).then(() => undefined, () => undefined);
}
