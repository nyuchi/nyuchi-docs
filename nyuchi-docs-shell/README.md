# nyuchi-docs-shell

The standard Mzizi shell (header, sidebar, footer) for
[Astro Starlight][starlight] docs sites: `nyuchi-docs` and `bundu-docs`.
Astro components and CSS only. One small browser module (the scrolled header
state). No UI framework, no runtime dependencies.

The anatomy follows the Mzizi registry's N7 shell components
(`mzizi-header`, `mzizi-sidebar`, `mzizi-footer`, served at
`https://api.mzizi.dev/v1/ui/<name>`), re-implemented in Astro and CSS with the
site's Mzizi tokens and the Bundu floor (7:1 text contrast, 7px gaps, 14px
insets, 1.5 body leading, 44px minimum touch targets).

This package is private and workspace-only for now. It is not published to npm.

## What it does

| Part    | What you get                                                                                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header  | Sticky, 56px, 20px side padding. Brand on the left, section links on desktop, then one action group: the brand-accent pill (round 44px icon buttons) on small screens, the labelled search field, GitHub icon and theme select on desktop. Blurred and bordered once scrolled. |
| Sidebar | Seven-mineral strip, logo header (mobile menu), separator, groups. Items are at least 48px high; the active item is a tinted accent background with accent text.                                                                                                               |
| Footer  | Top border, 3px seven-mineral strip, brand column with the tagline, link columns with 48px targets, a legal line. Full width, a real `contentinfo` landmark.                                                                                                                   |

Reused from Starlight, so behaviour is unchanged: `SiteTitle`, `SocialIcons`,
`ThemeSelect`, `MobileMenuToggle`, the mobile popover menu in `PageFrame`,
`SidebarPersister` and `SidebarSublist` (collapsible groups, remembered state,
`aria-current="page"`), and `Search` (the `@nyuchi/nyuchi-docs-search` modal and
Ctrl+K).

## Use

```js
// astro.config.mjs
import starlight from '@astrojs/starlight';
import { starlightMziziShell } from '@nyuchi/nyuchi-docs-shell/plugin';

starlight({
  plugins: [
    starlightMziziShell({
      navLinks: [
        { label: 'Platform', href: '/platform/' },
        { label: 'API Docs', href: '/api/' },
      ],
      footerColumns: [
        {
          title: 'Docs',
          links: [{ label: 'API Docs', href: '/api/' }],
        },
        {
          title: 'Ecosystem',
          links: [
            { label: 'Website', href: 'https://nyuchi.com', external: true },
          ],
        },
      ],
      tagline: 'I am because we are.',
      legal: '© 2026 Nyuchi Africa (Pvt) Ltd · Part of the Bundu Foundation',
      accent: 'var(--sl-color-accent)',
    }),
  ],
});
```

## Options

| Option          | Default                  | Notes                                                                                                  |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `navLinks`      | none                     | At most 6 `{ label, href, external? }`. By design the sidebar's top-level sections. Shown from 72rem.  |
| `footerColumns` | none                     | At most 4 `{ title, links[] }`, at most 8 links each.                                                  |
| `tagline`       | `I am because we are.`   | Under the footer logo.                                                                                 |
| `legal`         | none                     | The legal line.                                                                                        |
| `accent`        | `var(--sl-color-accent)` | A CSS custom property reference, never a literal colour. Used by the pill and the active sidebar item. |

Options are validated when the config loads. An unknown option, a bad `href`
(only root-relative paths and http(s) URLs are accepted), a duplicate link or a
literal colour in `accent` fails the build with a message that names it.

## Components it registers

`Header`, `Sidebar` and `PageFrame`. The footer is mounted by `PageFrame`, not
by Starlight's `Footer` slot: Starlight renders that inside the article column
(about 45rem), and the standard footer is full width with its own landmark. If
a site already overrides `PageFrame`, the plugin leaves it and warns; compose
the shell's frame inside yours:

```astro
---
import ShellFrame from '@nyuchi/nyuchi-docs-shell/PageFrame.astro';
---

<ShellFrame>
  <slot name="header" slot="header" />
  <slot name="sidebar" slot="sidebar" />
  <slot />
</ShellFrame>
```

The sheet is unlayered CSS (`@nyuchi/nyuchi-docs-shell/shell.css`, added before
the site's own `customCss`), so it wins over Starlight's layered styles and the
site theme can still refine it. It needs the seven `--color-<mineral>` tokens
from `@bundu/ui`.

## Develop

```sh
pnpm --filter @nyuchi/nyuchi-docs-shell test
pnpm --filter @nyuchi/nyuchi-docs-shell build
```

The rendered-markup tests read the built site (`site/dist`), so run
`pnpm --filter site build` first; they are skipped, with a warning, when it is
missing.

[starlight]: https://starlight.astro.build
