# nyuchi-docs

Nyuchi engineering documentation — how things are done at Nyuchi, and how to
use the Mzizi tools from a Nyuchi project. Published at
[docs.nyuchi.com](https://docs.nyuchi.com).

Built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build).

## Sections

- **`platform/`** — the product guide for the Nyuchi platform: getting started,
  configuration, administration, and the public API. Migrated from the previous
  Mintlify site.
- **`analytics/`** — dashboards, reports, and connecting data sources.
- **`integrations/`** — connectors, webhooks, the API gateway, and the public
  Nyuchi API surface (commerce, pay, logistics, lingo, news, weather).
- **`identity/`** — WorkOS, `identity.nyuchi.com`, organisations, SSO, and the
  shape of Nyuchi-issued JWTs.
- **`console/`** — the Nyuchi Console at `platform.nyuchi.com`: mini-apps, API
  extensions, plans, and billing.
- **`mzizi-tools/`** — using `mzizi-mcp`, `mzizi-sdk`, and `mzizi-skills` from
  inside a Nyuchi project.
- **`deployment/`** — Cloudflare, Vercel, and Supabase deployment patterns.
- **`conventions/`** — PR doctrine, commit doctrine, repo-naming rules.

## Companion site

[`bundu-labs/bundu-docs`](https://github.com/bundu-labs/bundu-docs) covers the
Bundu Foundation's outward-facing projects — the Mzizi product itself, the
Ubuntu doctrine, and the Bundu brand system. This repo is the inward-facing
engineering counterpart.

## Develop

```sh
npm install
npm run dev      # local dev server
npm run build    # production build to ./dist
npm run preview  # preview the production build
```

Content lives in `src/content/docs/`. The sidebar is configured in
`astro.config.mjs`.
