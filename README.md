# Nyuchi Docs

> Nyuchi engineering documentation — how things are done at Nyuchi, and how
> to use the Mzizi tools from a Nyuchi project.

[![lint](https://img.shields.io/github/actions/workflow/status/nyuchi/nyuchi-docs/lint.yml?branch=main&label=lint&style=flat-square)](https://github.com/nyuchi/nyuchi-docs/actions/workflows/lint.yml)
[![build](https://img.shields.io/github/actions/workflow/status/nyuchi/nyuchi-docs/build.yml?branch=main&label=build&style=flat-square)](https://github.com/nyuchi/nyuchi-docs/actions/workflows/build.yml)
![Astro](https://img.shields.io/badge/Astro-7-BC52EE?style=flat-square&logo=astro&logoColor=white)
![Starlight](https://img.shields.io/badge/Starlight-0.41-FFC107?style=flat-square)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?style=flat-square&logo=pnpm&logoColor=white)

**Live:** [docs.nyuchi.com](https://docs.nyuchi.com) | **Product docs:**
[docs.bundu.org](https://docs.bundu.org) | **MCP:** `docs.nyuchi.com/mcp`

---

## Packages

A **pnpm workspace** of six packages.

| Package                      | Path                      | What it does                                                                                                              |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `site`                       | `site/`                   | The Astro + [Starlight](https://starlight.astro.build) docs site itself. Ships as a Cloudflare Worker with Static Assets. |
| `@nyuchi/nyuchi-docs-search` | `nyuchi-docs-search/`     | cmdk-style search modal + Ask-AI tab for Starlight sites. **Not yet published to npm.**                                   |
| `shamwari-docs-ai`           | `shamwari-docs-ai/`       | Cloudflare Worker — the Ask-AI chat proxy (SSE).                                                                          |
| `nyuchi-docs-mcp-worker`     | `nyuchi-docs-mcp-worker/` | Cloudflare Worker `nyuchi-docs-mcp` — the docs MCP server at docs.nyuchi.com/mcp.                                         |
| `@nyuchi/nyuchi-docs-mcp`    | `nyuchi-docs-mcp/`        | The stdio bridge to that hosted endpoint, for clients that cannot speak Streamable HTTP.                                  |
| `@nyuchi/nyuchi-docs-skills` | `nyuchi-docs-skills/`     | The public agent skill for docs.nyuchi.com. The repo's authoring skills are internal and deliberately not shipped.        |

## Companion site

[`bundu-labs/bundu-docs`](https://github.com/bundu-labs/bundu-docs) covers the
Bundu Foundation's outward-facing projects — the Mzizi product, the Ubuntu
doctrine, and the Bundu brand system. It is an internal-visibility repository,
so that link resolves only for org members. It consumes
`@nyuchi/nyuchi-docs-search` and points at the `nyuchi-docs-mcp` worker.

> `@nyuchi/nyuchi-docs-search` is **not on npm** — `registry.npmjs.org`
> returns `{"error":"Not found"}` for it (checked 2026-09-12). Until it is
> published, `bundu-docs` cannot install it from the registry.

## Sections (`site/src/content/docs/`)

- **`platform/`** — the product guide for the Nyuchi platform.
- **`api/`** — API Docs: the `/v1` gateway, WorkOS authentication,
  console-managed API keys, security, and the product namespaces.
- **`analytics/`** — dashboards, reports, and connecting data sources.
- **`kweli/`** — Mukoko Kweli product guides: verification, cross-app
  how-to, open data, data quality, design system.
- **`mukoko-weather/`** — Mukoko Weather user guide and stations.
- **`integrations/`** — connectors, webhooks, the docs MCP server, and
  the Mukoko Events MCP server.
- **`identity/`** — WorkOS, `accounts.mukoko.com` (the AuthKit issuer), SSO,
  JWTs.
- **`console/`** — the Nyuchi Console at `platform.nyuchi.com`.
- **`tools/`** — the cross-repo tools directory: every skill, CLI, and MCP
  server across the Nyuchi and Bundu repos.
- **`mzizi-tools/`** — `mzizi-mcp`, `mzizi-cli`, `mzizi-skills`, the DNA
  double-helix architecture, registry health, and the A2A design.
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
  Live at `https://nyuchi-docs.nyuchi.workers.dev`, and **the cutover is
  done**: `docs.nyuchi.com` now serves this Worker. Both hosts return the
  same Astro 7.2.9 / Starlight 0.41.10 page (checked 2026-09-12); there is no
  Mintlify-on-Vercel deployment behind the apex any more.
- **`shamwari-docs-ai`** — root `shamwari-docs-ai/`, thin proxy in front of
  Cloudflare **AI Search**. Live at
  `https://shamwari-docs-ai.nyuchi.workers.dev`, which serves exactly two
  routes: `GET /health` and `POST /chat`. Its root returns `404`, correctly.
  See
  [`shamwari-docs-ai/README.md`](./shamwari-docs-ai/README.md) for the
  per-corpus AI Search instance setup (managed via REST API).
- **`nyuchi-docs-mcp`** — root `nyuchi-docs-mcp-worker/`, the docs MCP
  server. Live at `https://nyuchi-docs-mcp.nyuchi.workers.dev` and routed
  from `docs.nyuchi.com/mcp*`. Needs its own Workers Builds trigger (root
  directory `nyuchi-docs-mcp-worker/`).

## Well-known and machine-readable endpoints

`docs.nyuchi.com` serves these outside the docs tree. Most are static files in
`site/public/`; `security.txt` is generated per request by the site worker.

| Path                                | Served from                       | What it is                                                                  |
| ----------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `/robots.txt`                       | `site/public/robots.txt`          | Crawl policy + sitemap pointer. Everything here is meant to be indexed.     |
| `/llms.txt`                         | `site/public/llms.txt`            | Machine-readable site index for LLMs.                                       |
| `/AUTH.md`                          | `site/public/AUTH.md`             | Agent-facing WorkOS auth reference, synced from `nyuchi/api-gateway`.       |
| `/.well-known/mcp/server-card.json` | `site/public/.well-known/mcp/`    | MCP server card for the `nyuchi-docs-mcp` worker at `/mcp`.                 |
| `/.well-known/security.txt`         | `site/src/worker/security-txt.ts` | RFC 9116 disclosure contact — **generated per request**, not a static file. |

`security.txt` is dynamic because RFC 9116 makes `Expires` mandatory and caps
it under one year, so a checked-in file silently becomes non-compliant as it
ages. `site/wrangler.toml` sets `run_worker_first = true`, so every request
already passes through `site/src/worker/gate.ts`; it answers this path before
the gate check and before the asset router, deriving `Expires` from the
request time (180 days out). Same approach as `nyuchi/nhimbe` and
`nyuchi/kweli`.

## Why pnpm workspace

The search package (`nyuchi-docs-search`) is consumed by **both**
`nyuchi-docs` (this repo, via `workspace:*`) and `bundu-docs` (separate repo,
via the npm registry). Keeping it in the same workspace as the docs site
means local changes to the search UI are picked up instantly during `pnpm dev`,
while the published package is a single `pnpm publish` away.

## Commands

| Command                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `pnpm dev`             | The docs site on `:4321`                       |
| `pnpm build`           | Build the site                                 |
| `pnpm build:all`       | Build every workspace package                  |
| `pnpm test`            | Every package's tests                          |
| `pnpm lint`            | Every package's linter                         |
| `pnpm check`           | Every package's type/content check             |
| `pnpm skills:validate` | Validate the shipped agent skills              |
| `pnpm deploy:worker`   | Deploy `shamwari-docs-ai`                      |
| `pnpm deploy:mcp`      | Deploy `nyuchi-docs-mcp-worker`                |
| `pnpm ingest`          | Re-ingest the corpus into Cloudflare AI Search |

> Never run `prettier --write` on an `.mdx` file. Prettier 3.9.x rewrites
> `{/* … */}` to `{/_ … _/}` and produces invalid MDX. `.md` is safe.

## Ecosystem

- [docs.bundu.org](https://docs.bundu.org) — Bundu Foundation product docs
- [mzizi.dev](https://mzizi.dev) — the Mzizi design system, an
  open-architecture project of the Bundu Foundation, operated and developed
  by Nyuchi
- [api.nyuchi.com](https://api.nyuchi.com) — the `/v1` gateway these docs
  describe

## Licence

This repository is public but carries no `LICENSE` file, so no licence is
granted over it as a whole: all rights reserved. © Nyuchi Africa (PVT) Ltd.
The `@nyuchi/nyuchi-docs-search` package declares `MIT` in its own
`package.json`; if that is the intent for the package, the repository needs
a `LICENSE` to back it.
