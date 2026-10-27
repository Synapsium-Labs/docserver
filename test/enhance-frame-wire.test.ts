// The frame's DOM-free copies of L2's plain-data shapes, held equal to L2's own (docserver L3, Task 1; review findings C1
// and C3). src/frame typechecks with no DOM lib (tsconfig.frame.json, Reference §12), and src/enhance/types.ts reaches DOM
// types through its imports, so the frame cannot import the shapes Reference §1 names from it. src/frame/wire-types.ts
// copies them (CommitEntry, ChromeOptions, VocabularyOptions), and src/frame/protocol.ts holds the values of the `prefs`
// op (theme, width, font; the lens stays frame-local, Q1). This file sits in the enhance typecheck project
// (tsconfig.enhance.json, with the DOM lib), the one place where both sides typecheck: a drift on either side is a red
// `npm run typecheck`. The prefs' values are compared at run time as well.
import { describe, expect, expectTypeOf, it } from 'vitest';
import { PREF_VALUES } from '../src/enhance/options.js';
import type { ChromeOptions, CommitEntry, Prefs, VocabularyOptions } from '../src/enhance/types.js';
import { FRAME_PREF_VALUES, type FramePrefValues } from '../src/frame/protocol.js';
import type * as Wire from '../src/frame/wire-types.js';

describe("src/frame/wire-types.ts: exactly L2's shapes, with no DOM (finding C1)", () => {
  it('CommitEntry, ChromeOptions and VocabularyOptions equal src/enhance/types.ts', () => {
    expectTypeOf<Wire.CommitEntry>().toEqualTypeOf<CommitEntry>();
    expectTypeOf<Wire.ChromeOptions>().toEqualTypeOf<ChromeOptions>();
    expectTypeOf<Wire.VocabularyOptions>().toEqualTypeOf<VocabularyOptions>();
  });

  it("the prefs the bridge carries are L2's theme, width and font", () => {
    // Reference §1's FramePrefs, `Pick<EnhancePrefs, 'theme' | 'width' | 'font'>`, taken from wire-types.ts.
    expectTypeOf<Wire.FramePrefs>().toEqualTypeOf<Pick<Prefs, 'theme' | 'width' | 'font'>>();
    expectTypeOf<Required<FramePrefValues>>().toEqualTypeOf<Pick<Prefs, 'theme' | 'width' | 'font'>>();
    expectTypeOf<keyof typeof FRAME_PREF_VALUES>().toEqualTypeOf<Exclude<keyof Prefs, 'lens'>>();
  });
});

describe("FRAME_PREF_VALUES: L2's PREF_VALUES without the lens (finding C3)", () => {
  it('the same prefs, in the same order, each with the same values in the same order (the first the default)', () => {
    const l2 = Object.fromEntries(Object.entries(PREF_VALUES).filter(([k]) => k !== 'lens'));
    expect(Object.keys(FRAME_PREF_VALUES)).toEqual(Object.keys(l2));
    expect(FRAME_PREF_VALUES).toEqual(l2);
  });

  it("the lens is L2's and stays out (its control: PREF_VALUES does carry one)", () => {
    expect(Object.keys(PREF_VALUES)).toContain('lens');
    expect(Object.keys(FRAME_PREF_VALUES)).not.toContain('lens');
  });
});
