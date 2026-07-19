# nyuchi-docs

Nyuchi engineering documentation — how things are done at Nyuchi, and how to
use the Mzizi tools from a Nyuchi project. Published at
[docs.nyuchi.com](https://docs.nyuchi.com).

This repo is a **pnpm workspace** with these packages:

| Package                | Path                  | What it does                                                                              |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `site`                 | `site/`               | The Astro + [Starlight](https://starlight.astro.build) docs site itself. Ships as a Cloudflare Worker with Static Assets. |
| `nyuchi-docs-search`   | `nyuchi-docs-search/` | Publishable npm package: cmdk-style search modal + Ask-AI tab for Starlight sites.        |
| `shamwari-docs-ai`     | `shamwari-docs-ai/`   | Cloudflare Worker — the Ask-AI chat proxy (SSE).                                          |
| `nyuchi-docs-mcp-worker` | `nyuchi-docs-mcp-worker/` | Cloudflare Worker `nyuchi-docs-mcp` — the docs MCP server at docs.nyuchi.com/mcp.   |

## Companion site

[`bundu-labs/bundu-docs`](https://github.com/bundu-labs/bundu-docs) covers the
Bundu Foundation's outward-facing projects — the Mzizi product, the Ubuntu
doctrine, and the Bundu brand system. It installs `nyuchi-docs-search` from
npm and points at the `nyuchi-docs-mcp` worker.

## Sections (`site/src/content/docs/`)

- **`platform/`** — the product guide for the Nyuchi platform.
- **`api/`** — API Docs: the `/v1` gateway, WorkOS authentication,
  console-managed API keys, security, and the product namespaces.
- **`analytics/`** — dashboards, reports, and connecting data sources.
- **`kweli/`** — Mukoko Kweli product guides: verification, cross-app
  how-to, open data, data quality, design system.
- **`mukoko-weather/`** — Mukoko Weather user guide and stations.
- **`integrations/`** — connectors, webhooks, and the docs MCP server.
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

Both workers in this repo deploy via **Cloudflare Workers Builds** — the
[Cloudflare GitHub App](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
is connected to `nyuchi/nyuchi-docs` with one trigger per worker (root
directory points at the worker package). No GitHub Actions deploy workflow,
no `CLOUDFLARE_API_TOKEN` repo secret.

- **`nyuchi-docs` (site)** — root `site/`, ships as a Cloudflare Worker with
  [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).
  Live at `https://nyuchi-docs.nyuchi.workers.dev`. Custom domain
  `docs.nyuchi.com` is attached via the Workers custom-domain API in a
  separate cutover step (apex still points at the legacy Mintlify-on-Vercel
  deployment until then).
- **`shamwari-docs-ai`** — root `shamwari-docs-ai/`, thin proxy in front of
  Cloudflare **AI Search**. Live at
  `https://shamwari-docs-ai.nyuchi.workers.dev`. See
  [`shamwari-docs-ai/README.md`](./shamwari-docs-ai/README.md) for the
  per-corpus AI Search instance setup (managed via REST API).
- **`nyuchi-docs-mcp`** — root `nyuchi-docs-mcp-worker/`, the docs MCP
  server. Live at `https://nyuchi-docs-mcp.nyuchi.workers.dev` and routed
  from `docs.nyuchi.com/mcp*`. Needs its own Workers Builds trigger (root
  directory `nyuchi-docs-mcp-worker/`).

## Why pnpm workspace

The search package (`nyuchi-docs-search`) is consumed by **both**
`nyuchi-docs` (this repo, via `workspace:*`) and `bundu-docs` (separate repo,
via the npm registry). Keeping it in the same workspace as the docs site
means local changes to the search UI are picked up instantly during `pnpm dev`,
while the published package is a single `pnpm publish` away.
