/**
 * Vitest setup: the node test environment has no `window` object, but the
 * plugin follows Obsidian's popout-window guidance and calls timers as
 * `window.setTimeout` / `window.clearTimeout`. Alias `window` to `globalThis`
 * so that production code runs unchanged under tests.
 */
(globalThis as { window?: unknown }).window ??= globalThis;

export {};
