---
name: mzizi-shell
description: The Mzizi N7 shell contract as implemented on docs.nyuchi.com — vertical mineral strip in the core layout, pill icon-group header, strip-free ecosystem footer. Use when touching the site shell or replicating it (e.g. docs.bundu.org).
---

# The shell contract (Mzizi N7)

Three Starlight overrides implement the shell — registered in
`site/astro.config.mjs` `components`:

## PageFrame — the mineral strip's ONLY home

`site/src/components/PageFrame.astro`. The seven-mineral identity
strip is a **fixed 4px VERTICAL strip on the LEFT edge**, full
viewport height, rendered once in the app-core layout, hidden below
480px. Canonical order, equal sevenths, `@bundu/ui` tokens:
cobalt → tanzanite → malachite → gold → terracotta → sodalite →
copper.

**The strip never appears anywhere else.** No horizontal variants,
no footer strips, no per-page copies. If a design wants minerals
elsewhere, that's a role-contract question for the registry — not a
strip.

## Header — pill icon group

`site/src/components/Header.astro`. Wordmark left; ONE pill-shaped
icon group right (radius 9999, hairline border, slots divided by 1px
inline borders, 44px touch targets, logical CSS properties for RTL).
Slot order: **search trigger leftmost** (icon-only restyle of the
shared `nyuchi-docs-search` trigger — restyle from the site side,
never fork the package; ⌘K keeps working), then theme, then social.
`data-slot` attributes on shell pieces.

## Footer — strip-free ecosystem footer

`site/src/components/Footer.astro`. Starlight default (prev/next,
edit link) + the ecosystem bar: hairline top border, wordmark,
ecosystem links, legal line. Deliberately NO minerals.

## Rules

- Colors only via CSS variables (`--color-<mineral>`, `--sl-*`) —
  no raw hex outside token files.
- Verify after changes: `pnpm build`, then check the built HTML has
  exactly one `data-slot="mineral-stripe"` per page and zero
  horizontal strip markup.
- When the Mzizi MCP is reachable, cross-check against the registry
  (`get_ai_instructions`, brand tokens) before inventing anything new.
