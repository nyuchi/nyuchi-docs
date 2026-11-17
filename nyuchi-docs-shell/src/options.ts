// Options for the Mzizi shell plugin, with strict validation and defaults.
//
// Everything a site passes in is data that ends up in markup (link hrefs, the
// footer text) or in a CSS custom property (the accent), so it is checked here
// once, at config time, and a mistake fails the build with a message that names
// the option, rather than shipping a broken or unsafe header.

export interface ShellLink {
  label: string;
  /** Root-relative ("/api/") or absolute http(s) URL. */
  href: string;
  /** Opens in a new tab with `rel="noopener noreferrer"`. */
  external?: boolean;
}

export interface FooterColumn {
  title: string;
  links: ShellLink[];
}

export interface MziziShellOptions {
  /**
   * Top-level links in the header (desktop). By design these are the sidebar's
   * top-level sections, passed in from the site config. Default: none.
   */
  navLinks?: ShellLink[];
  /** Link columns in the footer, beside the brand column. Default: none. */
  footerColumns?: FooterColumn[];
  /** The line under the footer logo. Default: "I am because we are." */
  tagline?: string;
  /** The legal line at the foot of the footer. Default: none. */
  legal?: string;
  /**
   * The brand accent used by the header pill and the active sidebar item, as a
   * CSS custom property reference, never a literal colour. Default:
   * `var(--sl-color-accent)`, the site's existing Starlight accent.
   */
  accent?: string;
}

export interface ResolvedShellOptions {
  navLinks: ShellLink[];
  footerColumns: FooterColumn[];
  tagline: string;
  legal: string;
  accent: string;
}

export const DEFAULT_TAGLINE = "I am because we are.";
export const DEFAULT_ACCENT = "var(--sl-color-accent)";

export const MAX_NAV_LINKS = 6;
export const MAX_FOOTER_COLUMNS = 4;
export const MAX_FOOTER_LINKS = 8;

const OPTION_KEYS = [
  "navLinks",
  "footerColumns",
  "tagline",
  "legal",
  "accent",
] as const;

/** `var(--name)` or `var(--name, var(--other))`: tokens only, never a literal. */
const ACCENT_PATTERN =
  /^var\(--[a-z][a-z0-9-]*(?:,\s*var\(--[a-z][a-z0-9-]*\))?\)$/i;

export class ShellOptionsError extends Error {
  constructor(message: string) {
    super(`[nyuchi-docs-shell] ${message}`);
    this.name = "ShellOptionsError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, where: string, max: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ShellOptionsError(`${where} must be a non-empty string.`);
  }
  if (value.length > max) {
    throw new ShellOptionsError(`${where} must be at most ${max} characters.`);
  }
  return value.trim();
}

/** A root-relative path or an absolute http(s) URL. Nothing else is linkable. */
export function isSafeHref(href: string): boolean {
  if (href.startsWith("//")) return false;
  if (href.startsWith("/")) return !/[\s\\]/.test(href);
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function link(value: unknown, where: string): ShellLink {
  if (!isRecord(value)) {
    throw new ShellOptionsError(`${where} must be an object.`);
  }
  for (const key of Object.keys(value)) {
    if (key !== "label" && key !== "href" && key !== "external") {
      throw new ShellOptionsError(`${where} has an unknown key "${key}".`);
    }
  }
  const label = text(value.label, `${where}.label`, 60);
  const href = text(value.href, `${where}.href`, 300);
  if (!isSafeHref(href)) {
    throw new ShellOptionsError(
      `${where}.href "${href}" must be a root-relative path or an http(s) URL.`,
    );
  }
  if (value.external !== undefined && typeof value.external !== "boolean") {
    throw new ShellOptionsError(`${where}.external must be a boolean.`);
  }
  const result: ShellLink = { label, href };
  if (value.external) result.external = true;
  return result;
}

function list(value: unknown, where: string, max: number): unknown[] {
  if (!Array.isArray(value)) {
    throw new ShellOptionsError(`${where} must be an array.`);
  }
  if (value.length > max) {
    throw new ShellOptionsError(`${where} must have at most ${max} entries.`);
  }
  return value;
}

function column(value: unknown, where: string): FooterColumn {
  if (!isRecord(value)) {
    throw new ShellOptionsError(`${where} must be an object.`);
  }
  for (const key of Object.keys(value)) {
    if (key !== "title" && key !== "links") {
      throw new ShellOptionsError(`${where} has an unknown key "${key}".`);
    }
  }
  const title = text(value.title, `${where}.title`, 40);
  const links = list(value.links, `${where}.links`, MAX_FOOTER_LINKS).map(
    (entry, i) => link(entry, `${where}.links[${i}]`),
  );
  if (links.length === 0) {
    throw new ShellOptionsError(`${where}.links must not be empty.`);
  }
  return { title, links };
}

function unique(values: string[], where: string): void {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) {
      throw new ShellOptionsError(`${where} repeats "${v}".`);
    }
    seen.add(v);
  }
}

/** Validate user options and fill in the defaults. Throws ShellOptionsError. */
export function resolveShellOptions(input: unknown = {}): ResolvedShellOptions {
  if (input === undefined || input === null) input = {};
  if (!isRecord(input)) {
    throw new ShellOptionsError("options must be an object.");
  }
  for (const key of Object.keys(input)) {
    if (!(OPTION_KEYS as readonly string[]).includes(key)) {
      throw new ShellOptionsError(
        `unknown option "${key}". Known options: ${OPTION_KEYS.join(", ")}.`,
      );
    }
  }

  const navLinks =
    input.navLinks === undefined
      ? []
      : list(input.navLinks, "navLinks", MAX_NAV_LINKS).map((entry, i) =>
          link(entry, `navLinks[${i}]`),
        );
  unique(
    navLinks.map((l) => l.href),
    "navLinks",
  );

  const footerColumns =
    input.footerColumns === undefined
      ? []
      : list(input.footerColumns, "footerColumns", MAX_FOOTER_COLUMNS).map(
          (entry, i) => column(entry, `footerColumns[${i}]`),
        );
  unique(
    footerColumns.map((c) => c.title),
    "footerColumns",
  );

  const tagline =
    input.tagline === undefined
      ? DEFAULT_TAGLINE
      : text(input.tagline, "tagline", 120);
  const legal =
    input.legal === undefined ? "" : text(input.legal, "legal", 240);

  let accent = DEFAULT_ACCENT;
  if (input.accent !== undefined) {
    accent = text(input.accent, "accent", 80);
    if (!ACCENT_PATTERN.test(accent)) {
      throw new ShellOptionsError(
        `accent "${accent}" must be a CSS custom property reference such as var(--sl-color-accent), never a literal colour.`,
      );
    }
  }

  return { navLinks, footerColumns, tagline, legal, accent };
}
