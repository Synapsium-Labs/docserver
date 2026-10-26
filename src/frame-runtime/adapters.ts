// The reader's host callbacks inside the sealed frame, mapped onto bridge ops (docserver L3; design §8). Bundled into
// the bootstrap.
//
// Prototype scope: storage is an empty snapshot with a no-op set, and onLink forwards `navigate` with no pacing (the
// outbox, the storage key mapping and the other callbacks are the plan's). Every other callback is absent, so the
// reader runs without hash reports, copy, changes or versions.
import type { FrameToParent } from '../frame/protocol.js';

/** The longest href sent (BRIDGE_LIMITS.hrefMaxChars). */
const HREF_MAX = 4096;

/** True for an href the frame may send: 1 to HREF_MAX code units, with no C0, DEL or C1 control. */
export function sendableHref(href: unknown): href is string {
  return typeof href === 'string' && href.length > 0 && href.length <= HREF_MAX && !/[\u0000-\u001f\u007f-\u009f]/.test(href);
}

export interface FrameAdapters {
  readonly storage: { readonly snapshot: Readonly<Record<string, string>>; set(key: string, value: string | null): void };
  onLink(href: string, how: { readonly newTab: boolean }): void;
}

/** The adapters for one frame; `send` is the bootstrap's sink (buffered until ready). */
export function createAdapters(send: (m: FrameToParent) => void): FrameAdapters {
  const navigate = (href: string): void => {
    if (sendableHref(href)) send({ t: 'navigate', href });
  };
  return {
    storage: { snapshot: {}, set(): void {} },
    onLink(href: string): void {
      navigate(href);
    },
  };
}
