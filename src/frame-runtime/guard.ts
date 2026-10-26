// The click guard, built to assets/frame/guard.js (docserver L3; design §7). The first script of the srcdoc, right
// after the policy meta. It keeps every link of the frame from navigating it, before the reader exists, while it runs
// and after it failed, and hands each link it stopped to the bootstrap:
//
//   1. The net: window click and auxclick listeners in the BUBBLE phase. For an event no one prevented whose path holds
//      a link (HTML a[href] or area[href], SVG a with href or xlink:href), it calls preventDefault, whatever the
//      button (WebKit follows a link on any auxclick but the right button's). For a click or a middle-button
//      auxclick it then dispatches a non-bubbling `docserver:link` event, detail {href, newTab}, on its own script
//      element; the bootstrap listens there. Any other button's auxclick is prevented and not forwarded. Bubble, not capture: the reader's own delegated handler returns early on a prevented click
//      (src/enhance/nav.ts), so a capture-phase net would take every link from the reader.
//   2. The stop wrappers: Event.prototype.stopPropagation, stopImmediatePropagation and the cancelBubble setter call
//      preventDefault first when the event is a click or auxclick with a link on its path, so a handler that stops a
//      link click before it reaches the net still cannot let it navigate.
//   3. Submit: a window capture-phase submit listener that always prevents.
//
// The guard never stops propagation itself and never prevents a click that is not on a link. Every built-in it uses
// is read once, at its start, before any other script runs.
(() => {
  const me = document.currentScript;
  if (me === null) return;
  const add = EventTarget.prototype.addEventListener;
  const dispatch = EventTarget.prototype.dispatchEvent;
  const evProto = Event.prototype;
  const preventDefault = evProto.preventDefault;
  const prevented = Object.getOwnPropertyDescriptor(evProto, 'defaultPrevented')?.get;
  const typeOf = Object.getOwnPropertyDescriptor(evProto, 'type')?.get;
  const buttonOf = Object.getOwnPropertyDescriptor(MouseEvent.prototype, 'button')?.get;
  const composedPath = evProto.composedPath;
  const getAttribute = Element.prototype.getAttribute;
  const hasAttribute = Element.prototype.hasAttribute;
  const getAttributeNS = Element.prototype.getAttributeNS;
  const localName = Object.getOwnPropertyDescriptor(Element.prototype, 'localName')?.get;
  const namespaceURI = Object.getOwnPropertyDescriptor(Element.prototype, 'namespaceURI')?.get;
  const define = Object.defineProperty;
  const getOwn = Object.getOwnPropertyDescriptor;
  const freeze = Object.freeze;
  const Custom = CustomEvent;
  const Elem = Element;
  if (prevented === undefined || typeOf === undefined || buttonOf === undefined || localName === undefined || namespaceURI === undefined) return;

  const HTML = 'http://www.w3.org/1999/xhtml';
  const SVG = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';

  /** The link on the event's path and its href as written, or null. */
  const linkOf = (e: Event): { href: string } | null => {
    for (const node of composedPath.call(e)) {
      if (!(node instanceof Elem)) continue;
      const name = localName.call(node);
      const ns = namespaceURI.call(node);
      if (ns === HTML && (name === 'a' || name === 'area') && hasAttribute.call(node, 'href')) {
        return { href: getAttribute.call(node, 'href') ?? '' };
      }
      if (ns === SVG && name === 'a') {
        const href = getAttribute.call(node, 'href') ?? getAttributeNS.call(node, XLINK, 'href');
        if (href !== null) return { href };
      }
    }
    return null;
  };

  const isClick = (e: Event): boolean => {
    const t = typeOf.call(e);
    return t === 'click' || t === 'auxclick';
  };

  const net = (event: Event): void => {
    if (prevented.call(event)) return;
    const link = linkOf(event);
    if (link === null) return;
    // Every activation of a link is prevented, whatever the button: WebKit follows a link in place on an auxclick of
    // any button but the right one (a back or forward button included). Of the non-primary buttons only the middle
    // one is forwarded (a new tab); forwarding a back, forward or right button would move the host page.
    preventDefault.call(event);
    const button = buttonOf.call(event);
    if (typeOf.call(event) === 'auxclick' && button !== 1) return;
    const m = event as MouseEvent;
    const newTab = m.ctrlKey || m.metaKey || m.shiftKey || button === 1;
    dispatch.call(me, new Custom('docserver:link', { bubbles: false, detail: freeze({ href: link.href, newTab }) }));
  };
  add.call(window, 'click', net, false);
  add.call(window, 'auxclick', net, false);

  // The stop wrappers.
  for (const name of ['stopPropagation', 'stopImmediatePropagation'] as const) {
    const original = evProto[name];
    define(evProto, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: function (this: Event): void {
        if (isClick(this) && linkOf(this) !== null) preventDefault.call(this);
        original.call(this);
      },
    });
  }
  const cancel = getOwn(evProto, 'cancelBubble');
  const cancelSet = cancel?.set;
  if (cancel !== undefined && cancelSet !== undefined) {
    define(evProto, 'cancelBubble', {
      ...cancel,
      set(this: Event, v: boolean): void {
        if (v && isClick(this) && linkOf(this) !== null) preventDefault.call(this);
        cancelSet.call(this, v);
      },
    });
  }

  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);
})();
