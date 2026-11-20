// The appearance contract at the `./frame` boundary (docserver appearance plan, Task 1, fix round). The contract's one
// home is src/enhance/appearance.ts, which the reader imports and whose walls allow no call at the top level, so its
// lists are only typed readonly there. This file freezes them in place, deeply, and re-exports the public names:
// whatever a host reads from `./frame` cannot be written to. `SLOT_PROPERTY` stays internal.
import { APPEARANCE_PAIRS, APPEARANCE_SLOTS } from '../enhance/appearance.js';

Object.freeze(APPEARANCE_SLOTS.colour);
Object.freeze(APPEARANCE_SLOTS.skin);
Object.freeze(APPEARANCE_SLOTS);
for (const pair of APPEARANCE_PAIRS) Object.freeze(pair);
Object.freeze(APPEARANCE_PAIRS);

export {
  APPEARANCE_CONTRACT,
  APPEARANCE_LABEL_DEFAULT,
  APPEARANCE_PAIRS,
  APPEARANCE_SLOTS,
  parseAppearance,
} from '../enhance/appearance.js';
export type {
  Appearance,
  AppearanceColourSlot,
  AppearanceRefusal,
  AppearanceRefusalWhy,
  AppearanceSkinSlot,
} from '../enhance/appearance.js';
