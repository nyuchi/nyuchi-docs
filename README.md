# nyuchi-docs

Nyuchi engineering documentation — how things are done at Nyuchi, and how to
use the Mzizi tools from a Nyuchi project. Published at
[docs.nyuchi.com](https://docs.nyuchi.com).

This repo is a **pnpm workspace** with three packages:

| Package                | Path                  | What it does                                                                              |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `site`                 | `site/`               | The Astro + [Starlight](https://starlight.astro.build) docs site itself.                  |
| `nyuchi-docs-search`   | `nyuchi-docs-search/` | Publishable npm package: cmdk-style search modal + Ask-AI tab for Starlight sites.        |
| `shamwari-docs-ai`     | `shamwari-docs-ai/`   | Cloudflare Worker (Workers AI + Vectorize + AI Gateway) that powers the Ask-AI tab.       |

## Companion site

[`bundu-labs/bundu-docs`](https://github.com/bundu-labs/bundu-docs) covers the
Bundu Foundation's outward-facing projects — the Mzizi product, the Ubuntu
doctrine, and the Bundu brand system. It installs `nyuchi-docs-search` from
npm and points at the same `shamwari-docs-ai` worker.

## Sections (`site/src/content/docs/`)

- **`platform/`** — the product guide for the Nyuchi platform.
- **`analytics/`** — dashboards, reports, and connecting data sources.
- **`integrations/`** — connectors, webhooks, the API gateway, and the public Nyuchi API.
- **`identity/`** — WorkOS, `identity.nyuchi.com`, SSO, JWTs.
- **`console/`** — the Nyuchi Console at `platform.nyuchi.com`.
- **`mzizi-tools/`** — `mzizi-mcp`, `mzizi-sdk`, `mzizi-skills`.
- **`deployment/`** — Cloudflare, Vercel, and Supabase deployment patterns.
- **`conventions/`** — PR doctrine, commit doctrine, repo-naming rules.

## Develop

```sh
pnpm install
pnpm dev            # site only
pnpm -r build       # all packages
pnpm -r test        # all packages
```

Site dev server: <http://localhost:4321>. Content lives in
`site/src/content/docs/`; the sidebar is configured in `site/astro.config.mjs`.

## Search + Ask AI

The search modal opens with `⌘K` / `Ctrl+K`. The **Ask AI** tab streams
answers from `shamwari-docs-ai` (Cloudflare Worker) with retrieval-grounded
citations. To enable it locally, copy `site/.env.example` to `site/.env`:

```sh
cp site/.env.example site/.env
# .env:
# PUBLIC_SHAMWARI_AI_URL=https://shamwari-docs-ai.nyuchi.workers.dev
```

## Deploy

- **Site** — built by the existing CI workflow (`.github/workflows/build.yml`)
  and shipped by the docs-site host (Cloudflare Pages / Vercel).
- **Worker** — `.github/workflows/deploy-shamwari-docs-ai.yml` runs
  `wrangler deploy` on push to `main` whenever `shamwari-docs-ai/**` changes.
  See [`shamwari-docs-ai/README.md`](./shamwari-docs-ai/README.md) for the
  one-time Vectorize + AI Gateway setup.

## Why pnpm workspace

The search package (`nyuchi-docs-search`) is consumed by **both**
`nyuchi-docs` (this repo, via `workspace:*`) and `bundu-docs` (separate repo,
via the npm registry). Keeping it in the same workspace as the docs site
means local changes to the search UI are picked up instantly during `pnpm dev`,
while the published package is a single `pnpm publish` away.
