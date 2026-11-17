// Static guarantees on the stylesheet and the component sources: tokens only,
// the Bundu floor, and the Mzizi anatomy being present at all.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs with the package directory as the working directory.
const src = (file: string) =>
  readFileSync(resolve(process.cwd(), "src", file), "utf8");
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");

const css = stripComments(src("shell.css"));
const MINERALS = [
  "cobalt",
  "tanzanite",
  "malachite",
  "gold",
  "terracotta",
  "sodalite",
  "copper",
];

/** The declarations of every rule whose selector list contains `selector`. */
function rule(selector: string): string {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) out.push(m[2]);
  }
  return out.join(";");
}

describe("shell.css: tokens only", () => {
  it("has no literal colour: no hex, rgb(), hsl() or named colour", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab)\(/);
    expect(css).not.toMatch(
      /:\s*(?:white|black|gray|grey|red|blue|green|gold|yellow|orange)\b/i,
    );
  });

  it("builds the seven-mineral strip from the --color-<mineral> tokens", () => {
    const strip = css.match(/--mzizi-strip:([^;]+);/)?.[1] ?? "";
    for (const mineral of MINERALS) {
      expect(strip).toContain(`var(--color-${mineral})`);
    }
    expect((strip.match(/var\(--color-/g) ?? []).length).toBe(7);
  });

  it("makes the strips 4px in the sidebar and 3px in the footer", () => {
    expect(rule(".mzizi-strip")).toMatch(/block-size:\s*4px/);
    expect(rule(".mzizi-strip--footer")).toMatch(/block-size:\s*3px/);
    expect(rule(".mzizi-strip")).toContain("var(--mzizi-strip)");
  });

  it("takes the accent from a token that the plugin option can override", () => {
    expect(rule(":root")).toContain(
      "--mzizi-brand-accent: var(--sl-color-accent)",
    );
    expect(css).toMatch(/background-color:\s*var\(--mzizi-brand-accent\)/);
  });
});

describe("shell.css: the Bundu floor", () => {
  it("declares 44px, 48px, 7px and 14px as tokens", () => {
    const root = rule(":root");
    expect(root).toMatch(/--mzizi-target:\s*2\.75rem/);
    expect(root).toMatch(/--mzizi-target-lg:\s*3rem/);
    expect(root).toMatch(/--mzizi-gap:\s*0\.4375rem/);
    expect(root).toMatch(/--mzizi-inset:\s*0\.875rem/);
    expect(root).toMatch(/--mzizi-pad-x:\s*1\.25rem/);
  });

  it("gives header controls a 44px target", () => {
    expect(rule(".mzizi-header__nav a")).toMatch(
      /min-block-size:\s*var\(--mzizi-target\)/,
    );
    expect(rule(".mzizi-menu-button")).toMatch(
      /block-size:\s*var\(--mzizi-target\)/,
    );
    expect(rule(".mzizi-menu-button")).toMatch(
      /inline-size:\s*var\(--mzizi-target\)/,
    );
    expect(rule(".mzizi-actions__item")).toMatch(
      /block-size:\s*var\(--mzizi-target\)/,
    );
    expect(rule(".mzizi-actions__social a")).toMatch(
      /min-block-size:\s*var\(--mzizi-target\)/,
    );
    expect(rule(".mzizi-actions__search .nds-trigger")).toMatch(
      /min-block-size:\s*var\(--mzizi-target\)/,
    );
  });

  it("gives sidebar items and footer links a 48px target", () => {
    expect(rule(".mzizi-sidebar a")).toMatch(
      /min-block-size:\s*var\(--mzizi-target-lg\)/,
    );
    expect(rule(".mzizi-sidebar summary")).toMatch(
      /min-block-size:\s*var\(--mzizi-target-lg\)/,
    );
    expect(rule(".mzizi-footer__column a")).toMatch(
      /min-block-size:\s*var\(--mzizi-target-lg\)/,
    );
  });

  it("uses 1.5 leading for text and 7px gaps between controls", () => {
    expect(rule(".mzizi-header__nav a")).toMatch(/line-height:\s*1\.5/);
    expect(rule(".mzizi-footer__column a")).toMatch(/line-height:\s*1\.5/);
    expect(rule(".mzizi-actions")).toMatch(/gap:\s*var\(--mzizi-gap\)/);
    expect(rule(".mzizi-header__nav ul")).toMatch(/gap:\s*var\(--mzizi-gap\)/);
  });

  it("makes the pill a capsule and the active sidebar item a tint, not a fill", () => {
    expect(css).toMatch(
      /@media \(max-width: 49\.99rem\)\s*\{\s*\.mzizi-actions\s*\{[^}]*border-radius:\s*9999px/,
    );
    const active = rule('.mzizi-sidebar a[aria-current="page"]');
    expect(active).toMatch(
      /color-mix\(\s*in srgb,\s*var\(--mzizi-brand-accent\) 10%,\s*transparent\s*\)/,
    );
    expect(active).not.toMatch(
      /background-color:\s*var\(--mzizi-brand-accent\)\s*;/,
    );
  });

  it("draws a visible focus ring from the focus-ring tokens", () => {
    expect(rule(":root")).toContain("var(--focusRing-width, 2px)");
    expect(css).toMatch(
      /\.mzizi-sidebar a:focus-visible[^{]*\{[^}]*var\(--mzizi-focus\)/,
    );
    expect(css).toMatch(
      /\.mzizi-footer__column a:focus-visible[^{]*\{[^}]*var\(--mzizi-focus\)/,
    );
    expect(css).toMatch(
      /\.mzizi-header__nav a:focus-visible\s*\{[^}]*var\(--mzizi-focus\)/,
    );
  });

  it("turns every transition off under prefers-reduced-motion", () => {
    const transitions = (css.match(/transition:/g) ?? []).length;
    const reduced = (css.match(/transition:\s*none/g) ?? []).length;
    expect(transitions).toBeGreaterThan(0);
    // header, nav link, pill item, sidebar link and footer link
    expect(reduced).toBeGreaterThanOrEqual(4);
    for (const block of css.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\}\s*\}/g,
    ) ?? []) {
      expect(block).toMatch(/transition:\s*none/);
    }
  });
});

describe("component sources", () => {
  const header = stripComments(src("Header.astro"));
  const sidebar = stripComments(src("Sidebar.astro"));
  const footer = stripComments(src("Footer.astro"));

  it("have no literal colour and no inline style attribute", () => {
    for (const source of [
      header,
      sidebar,
      footer,
      stripComments(src("PageFrame.astro")),
    ]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/\bstyle=/);
    }
  });

  it("header reuses Starlight's search, theme, social and title", () => {
    for (const piece of ["Search", "SiteTitle", "SocialIcons", "ThemeSelect"]) {
      expect(header).toContain(`virtual:starlight/components/${piece}`);
    }
    expect(header).toContain('popovertarget="starlight__sidebar"');
  });

  it("sidebar reuses Starlight's persisted group tree", () => {
    expect(sidebar).toContain("SidebarPersister.astro");
    expect(sidebar).toContain("SidebarSublist.astro");
    expect(sidebar).toContain('data-slot="mineral-strip"');
  });

  it("footer is a top-level footer with the strip, brand column and legal line", () => {
    expect(footer).toContain("<footer");
    expect(footer).toContain("mzizi-strip--footer");
    expect(footer).toContain("mzizi-footer__tagline");
    expect(footer).toContain("mzizi-footer__legal");
    expect(footer).toContain("aria-label={column.title}");
  });
});
