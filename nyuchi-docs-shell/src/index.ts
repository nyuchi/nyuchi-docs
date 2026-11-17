// Public entrypoints for nyuchi-docs-shell. Framework-free: the shell is
// Astro components plus CSS, with one tiny browser module for the scrolled
// header state.
export { default as starlightMziziShell } from "./plugin.js";
export {
  resolveShellOptions,
  ShellOptionsError,
  DEFAULT_ACCENT,
  DEFAULT_TAGLINE,
} from "./options.js";
export type {
  FooterColumn,
  MziziShellOptions,
  ResolvedShellOptions,
  ShellLink,
} from "./options.js";
export { isActivePath } from "./lib/nav.js";
export { initScrollState } from "./lib/scroll-state.js";
