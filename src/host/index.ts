// The entry of `./host` (docserver L3, Task 10; plan Reference §1 and §11, FD22): the reference parent of the sealed
// reader frame, for viewers other than the first consumer (which re-implements the same contract on its side and never
// imports this). Import-inert: importing it creates no global, starts no timer and touches no DOM; only a
// mountDocFrame() call does. The package's export map gains `./host` in Task 12.
export { mountDocFrame } from './mount.js';
export type { DocFrame, FallbackReason, HostAdapters } from './mount.js';
export type { HostLink } from './links.js';
export type { HiddenChar } from './copy.js';
