// Commands (docserver batch 1.1, item C108): the tools the bar carries, reachable without the bar. A host that builds its
// own bar (chrome.bar false) calls runEnhancementCommand(root, name); each command does what its bar button did, as a
// toggle: the quick jump (`jump`), the reading settings (`settings`), the contents drawer (`contents`) and a plan's
// Outline (`outline`). COMMAND_NAMES is the one definition of the names in L2: the frame's wire keeps a twin of it
// (src/frame/protocol.ts), held equal by a test, because L2 may import only its own siblings.
//
// A feature registers its command once, at build, where it builds the tool: a tool that is turned off (chrome.settings
// false, no contents rail, no plan outline) registers nothing, so its command answers false. The registry is the
// instance's own; nothing runs once the instance is not live.
//
// (The member is `run`, never `open`: the walls refuse the name `open`, a page method.)
//
// Two commands are the host's history moving, not a tool (docserver parity T3): `close-overlay` closes the full-screen
// figure when it is open (false when it is not), and the close it causes is not reported to the host, which asked for it;
// `goto` takes `{ id, from? }` and goes where the host's history moved (nav.goToHash: back to the place `from` names,
// else to `id`), calling no onHash. Their arguments come through `run(name, args)`; the other commands take none.
//
// `print-figures` (docserver parity T6) asks for the document's Mermaid figures as PNGs, for a host that prints them: it
// exists only with the host's `onPrintFigure` (diagrams.ts registers it; without the callback it answers false and does
// nothing), answers true when a run starts, and a second one cancels the first run's figures not yet handed over.
//
// A command toggles: it closes its own overlay when that is open, and opens it only when no other overlay is open (the
// keyboard layer refuses the same way, keys.ts); otherwise its handler answers false and changes nothing.
//
// Import-inert: declarations only.
import type { Cancel } from './env.js';

/** The command names, in the bar's own order of tools. */
export const COMMAND_NAMES = ['jump', 'settings', 'contents', 'outline', 'close-overlay', 'goto', 'print-figures'] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];

/** What `goto` takes, and so what `runEnhancementCommand`'s `args` is: an id, and the opaque place token the host was given as onHash's `from`, when it kept one. */
export interface CommandArgs {
  readonly id: string;
  readonly from?: string;
}

/** What a registered command receives: the arguments `run` was given, unchecked (a command checks its own). */
export type CommandRun = (args?: unknown) => boolean | void;

export interface Commands {
  /** Register the command `name`, once per instance; its cancel unregisters it. Throws for an unknown name or a second one. */
  register(name: CommandName, run: CommandRun): Cancel;
  /**
   * Run `name`: true when its tool exists and the command ran; false for an unknown name, a tool turned off, an
   * instance not live, or a command that changed nothing (its handler answers false: another overlay is open, or the
   * tool is not a toggle at this width).
   */
  run(name: string, args?: unknown): boolean;
}

/** The commands of one instance: `live` is its own. */
export function createCommands(live: () => boolean): Commands {
  const handlers = new Map<CommandName, CommandRun>();
  const known = (name: string): name is CommandName => (COMMAND_NAMES as readonly string[]).includes(name);
  return Object.freeze({
    register(name: CommandName, run: CommandRun): Cancel {
      if (!known(name)) throw new Error(`docreader: a command is one of ${COMMAND_NAMES.join(', ')}`);
      if (typeof run !== 'function') throw new Error('docreader: a command registers a function');
      if (handlers.has(name)) throw new Error(`docreader: the ${name} command registers once`);
      if (!live()) return () => undefined;
      handlers.set(name, run);
      return () => {
        if (handlers.get(name) === run) handlers.delete(name);
      };
    },
    run(name: string, args?: unknown): boolean {
      if (!live() || typeof name !== 'string' || !known(name)) return false;
      const run = handlers.get(name);
      if (run === undefined) return false;
      return run(args) !== false;
    },
  });
}
