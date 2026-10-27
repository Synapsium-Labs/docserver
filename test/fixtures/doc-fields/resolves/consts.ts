// Fields defined away from their calls: an exported const, an `as const` object, and a const re-exported elsewhere.
export const IMPORTED = 'imported';
export const KEYS = { member: 'member', nested: { deep: 'deep' } } as const;
export const SOURCE = 'reexported';
