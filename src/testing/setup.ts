/**
 * Vitest setup: the node test environment has no `window` object, but the
 * plugin follows Obsidian's popout-window guidance and calls timers as
 * `window.setTimeout` / `window.clearTimeout`. Alias `window` to node's
 * global object so that production code runs unchanged under tests.
 */
declare const global: { window?: unknown };

global.window ??= global;

export {};
