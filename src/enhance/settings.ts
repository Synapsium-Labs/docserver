// The reading settings menu (the reference layout, section 22; Task 19): theme, typeface, width, lens, fold controls
// and the colour key. It is root-local chrome and consumes the lifecycle's prefs seam, so host changes update its radios too.
import { completeFoldJoins } from './attention.js';
import { chrome } from './journal.js';
import type { Prefs, FeatureContext } from './types.js';

const choices: { readonly [K in keyof Prefs]: readonly [Prefs[K], string][] } = {
  theme: [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']],
  font: [['serif', 'Serif'], ['sans', 'Sans']],
  width: [['standard', 'Standard'], ['wide', 'Wide']],
  lens: [['all', 'Everything'], ['product', 'Product']],
};

const labels: { readonly [K in keyof Prefs]: string } = {
  theme: 'Theme',
  font: 'Typeface',
  width: 'Text width',
  lens: 'Reading lens',
};

/** True only for a node that this root contains; works across DOM realms without global constructors. */
function contains(root: Element, target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false;
  try {
    return root.contains(target as Node);
  } catch {
    // A numeric nodeType can be spoofed; native containment remains the realm-safe node check.
    return false;
  }
}

/** Focus an element only when its realm provides the DOM focus method. */
function focus(target: Element): void {
  const method = (target as { focus?: unknown }).focus;
  if (typeof method === 'function') method.call(target, { preventScroll: true });
}

/** Build the settings tool when this root has settings chrome: in the bar's tray, else at the root's top right (batch 1.1, C108). */
export function build(ctx: FeatureContext): void {
  completeFoldJoins(ctx);
  if (!ctx.options.chrome.settings) return;
  const doc = ctx.root.ownerDocument;
  const wrap = chrome(doc, 'div', { className: 'aa-wrap' });
  const menuId = ctx.chromeId('settings');
  const button = chrome(doc, 'button', {
    className: 'aa-btn',
    attrs: { type: 'button', title: 'Reading settings', 'aria-label': 'Reading settings', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': menuId },
  }, [chrome(doc, 'span', { text: 'Aa' })]);
  const menu = chrome(doc, 'div', { className: 'aa-menu', attrs: { id: menuId, role: 'dialog', 'aria-label': 'Reading settings', hidden: '' } });
  const radios = new Map<keyof Prefs, Map<string, HTMLInputElement>>();

  const sync = (prefs: Readonly<Prefs>): void => {
    for (const [name, inputs] of radios) {
      for (const [value, input] of inputs) input.checked = prefs[name] === value;
    }
  };

  for (const name of Object.keys(choices) as (keyof Prefs)[]) {
    const fieldset = chrome(doc, 'fieldset');
    fieldset.append(chrome(doc, 'legend', { text: labels[name] }));
    const segment = chrome(doc, 'div', { className: 'seg' });
    const group = ctx.chromeId(`settings-${name}`);
    const inputs = new Map<string, HTMLInputElement>();
    for (const [value, label] of choices[name]) {
      const id = ctx.chromeId(`settings-${name}-${value}`);
      const input = chrome(doc, 'input', {
        attrs: { type: 'radio', name: group, id, value, 'data-pref': name },
      });
      const caption = chrome(doc, 'label', { text: label, attrs: { for: id } });
      const option = chrome(doc, 'span', { className: 'opt' }, [input, caption]);
      ctx.journal.listen(input, 'change', () => {
        if (!input.checked) return;
        if (name === 'font' || name === 'width' || name === 'lens') ctx.position.keep(() => {
          ctx.setPrefs({ [name]: value } as Pick<Prefs, typeof name>);
          ctx.relayout('prefs');
        });
        else ctx.setPrefs({ [name]: value } as Pick<Prefs, typeof name>);
      });
      inputs.set(value, input);
      segment.append(option);
    }
    radios.set(name, inputs);
    fieldset.append(segment);
    menu.append(fieldset);
  }

  const lensField = menu.lastElementChild;
  lensField?.append(chrome(doc, 'p', { className: 'aa-note', text: 'Product quiets code, file paths and technical tables. Decisions, rules and prose stay as they are.' }));

  const fieldset = chrome(doc, 'fieldset');
  const collapse = chrome(doc, 'button', { text: 'Collapse all', attrs: { type: 'button' } });
  const expand = chrome(doc, 'button', { text: 'Expand all', attrs: { type: 'button' } });
  const update = (): void => {
    const headings = ctx.folds.headings();
    collapse.disabled = headings.length === 0 || headings.every((heading) => ctx.folds.isFolded(heading));
    expand.disabled = headings.length === 0 || headings.every((heading) => !ctx.folds.isFolded(heading));
  };
  ctx.journal.listen(collapse, 'click', () => {
    ctx.position.keep(() => ctx.folds.setAll(true));
    update();
  });
  ctx.journal.listen(expand, 'click', () => {
    ctx.position.keep(() => ctx.folds.setAll(false));
    update();
  });
  fieldset.append(chrome(doc, 'legend', { text: 'Sections' }), chrome(doc, 'div', { className: 'aa-btns' }, [collapse, expand]));
  menu.append(fieldset);
  update();

  menu.append(chrome(doc, 'div', { className: 'aa-key' }, [chrome(doc, 'p', { className: 'aa-kh', text: 'Colour key' }), ctx.text.colourKey(doc)]));

  // A close made by the reader's own press outside the menu (the pointerdown, seen in the capture phase, so a host that
  // stops the event on its button cannot hide it): the same gesture's click may then run the settings command (a host's
  // own button, run synchronously from its click handler), which must find the menu closed and leave it so, or a second
  // press on that button would open it again. The flag is cleared after the gesture's click has been dispatched (a
  // bubbling listener on the document runs after the target's own), by a key's click (detail 0, before the target's
  // handler), by a cancelled press (pointercancel), when the menu opens, and when the command consumes it. A focus
  // leaving the menu (Tab) never sets it: no click follows to clear it.
  // The document's listeners are there only while they have work, as the pin's are (nav.ts), so an instance with a closed
  // menu adds none: the outside-press listener while the menu is open, the gesture's while the flag is set. They are
  // added and removed by hand, and every end is run at teardown.
  const onDoc = (type: string, fn: (event: Event) => void, capture: boolean): (() => void) => {
    const run = (event: Event): void => {
      ctx.operate(() => fn(event));
    };
    doc.addEventListener(type, run, { capture });
    return () => doc.removeEventListener(type, run, { capture });
  };
  let closedByOutside = false;
  let stopOutside: (() => void) | null = null;
  let stopGesture: (() => void) | null = null;
  const clearFlag = (): void => {
    closedByOutside = false;
    stopGesture?.();
    stopGesture = null;
  };
  const setFlag = (): void => {
    closedByOutside = true;
    if (stopGesture !== null) return;
    const ends = [
      onDoc('click', (event) => {
        if ((event as MouseEvent).detail === 0) clearFlag();
      }, true),
      onDoc('click', clearFlag, false),
      onDoc('pointercancel', clearFlag, false),
    ];
    stopGesture = () => {
      for (const end of ends) end();
    };
  };
  const stopListening = (): void => {
    stopOutside?.();
    stopOutside = null;
  };
  ctx.journal.defer(() => {
    stopListening();
    clearFlag();
  });

  let returnTo: Element | null = null;
  const close = (): void => {
    if (menu.hidden) return;
    menu.hidden = true;
    stopListening();
    button.setAttribute('aria-expanded', 'false');
    const returnFocus = returnTo?.isConnected ? returnTo : button;
    if (menu.contains(doc.activeElement) || doc.activeElement === ctx.root) focus(returnFocus);
  };
  const show = (): void => {
    if (!menu.hidden) return;
    update();
    returnTo = contains(ctx.root, doc.activeElement) ? doc.activeElement as Element : null;
    menu.hidden = false;
    clearFlag();
    stopListening();
    stopOutside = onDoc('pointerdown', (event) => {
      if (menu.hidden || contains(wrap, event.target)) return;
      setFlag();
      close();
    }, true);
    button.setAttribute('aria-expanded', 'true');
    const first = menu.querySelector('input:checked, input');
    if (first !== null) focus(first);
  };
  ctx.journal.listen(button, 'click', () => {
    if (menu.hidden) show();
    else close();
  });
  ctx.journal.listen(wrap, 'focusout', (event) => {
    const to = (event as FocusEvent).relatedTarget;
    if (menu.hidden || contains(wrap, to)) return;
    // Focus leaving the document itself (a frame whose parent took the focus) names no element: the menu stays open.
    // Another element of this document, the page's own press, Escape and the command still close it.
    if (to === null && !doc.hasFocus()) return;
    close();
  });

  ctx.overlays.register('settings', { isOpen: () => !menu.hidden, close });
  ctx.journal.defer(() => ctx.overlays.close('settings'));

  sync(ctx.state.prefs);
  ctx.events.on('prefs', sync);
  ctx.onRelayout((reasons) => {
    if (reasons.has('folds')) update();
  });
  wrap.append(button, menu);
  ctx.commands.register('settings', () => {
    if (closedByOutside) {
      clearFlag();
      return true; // this gesture's press just closed it: the command is the toggle's second half, and leaves it closed
    }
    if (!menu.hidden) {
      close();
      return true;
    }
    if (ctx.overlays.any()) return false;
    show();
    return true;
  });
  if (ctx.slots !== null) ctx.slots.tool('settings', wrap);
  else ctx.journal.insert(wrap, ctx.root, ctx.root.firstChild);
}
