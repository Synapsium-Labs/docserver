// The face probe (docserver L3, Task 5; plan Reference §6.2 step 5, prototype finding P-4, row L3.M21). Before the
// frame settles it asks the document's font set to load each face the frame stylesheet declares once: "Docreader
// Serif" and "Docreader Sans", each normal and italic (assets/reader.css's @font-face rules, inlined as data: URLs in
// assets/frame/reader.css). An inherited host policy that blocks data: fonts then raises its violation before ready,
// so the frame fails closed rather than reading in a fallback face (ruling R7). The probe is bounded by L2's own font
// wait, 1500 ms, and never rejects: a face that fails to load is the violation listener's to report.
//
// The reader's own font wait (src/enhance/relayout.ts, through env.fonts) already asks for the regular faces, so a
// browser row cannot tell the probe apart; the italic faces and this independence are the probe's. Bundled into the
// bootstrap; the timer it uses is read when the bootstrap's bundle starts.
const later = setTimeout;

/** The four faces of the frame stylesheet, as `FontFaceSet.load` takes them. */
export const FACES: readonly string[] = Object.freeze([
  'normal 400 1em "Docreader Serif"',
  'italic 400 1em "Docreader Serif"',
  'normal 400 1em "Docreader Sans"',
  'italic 400 1em "Docreader Sans"',
]);

/** The probe's bound: L2's font wait. */
export const FONT_WAIT_MS = 1500;

/** What the probe needs of a FontFaceSet. */
export interface FaceLoader {
  load(font: string): Promise<unknown>;
}

/** Ask `fonts` to load each of `faces` once; resolves when all settle or after `ms`, whichever is first. Never rejects. */
export function probeFaces(fonts: FaceLoader | null | undefined, faces: readonly string[], ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (fonts === null || fonts === undefined) {
      resolve();
      return;
    }
    const loads: Promise<unknown>[] = [];
    for (const face of faces) {
      try {
        loads.push(fonts.load(face).then(undefined, () => undefined));
      } catch {
        // a font set that refuses the call probes nothing more
      }
    }
    later(resolve, ms);
    void Promise.all(loads).then(() => resolve());
  });
}
