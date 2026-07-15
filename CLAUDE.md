# CLAUDE.md — nyuchi-docs

> AI assistant briefing for this repository: the mental model for the
> codebase and the rules to follow when changing it.

## What this repo is

A pnpm workspace monorepo that builds **Nyuchi Docs** — the
engineering + product documentation site for Nyuchi Africa (Pvt)
Ltd, published at **`docs.nyuchi.com`** — plus two supporting
packages that are shared with the companion repo
`bundu-labs/bundu-docs` (which powers `docs.bundu.org`).

| Package              | Path                   | What it is                                                                                                                                                                              |
| -------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `site`               | `site/`                | The docs website — Astro 6 + Starlight + Svelte 5. Private.                                                                                                                             |
| `nyuchi-docs-search` | `nyuchi-docs-search/`  | Publishable npm package (MIT): a Mintlify-style `⌘K`/`Ctrl+K` search modal (Pagefind-backed) with an "Ask AI" tab. Consumed here via `workspace:*` and by `bundu-docs` from the registry — this shared package is the reason the monorepo exists. |
| `shamwari-docs-ai`   | `shamwari-docs-ai/`    | Cloudflare Worker — thin proxy in front of Cloudflare **AI Search** that powers the Ask-AI tab for both docs sites (CORS, SSE), **plus the docs MCP server at `docs.nyuchi.com/mcp`** (read tools over the same AI Search index; feedback/issue write tools into the `FEEDBACK` KV namespace, optional `GITHUB_TOKEN` secret files real issues). |

_Shamwari_ = "friend" in Shona. Nyuchi is part of the **Bundu
Foundation** ecosystem; the design system is **Mzizi**
(`mzizi.dev`), consumed via `@bundu/ui` tokens.

## Commands

Package manager is **pnpm 10** (`packageManager` pinned in root
`package.json`). Use **Node 22** — root `engines` says `>=20`, but
Astro 6 requires ≥22.12 and CI pins 22.

```bash
pnpm install               # workspace install
pnpm dev                   # site dev server → http://localhost:4321
pnpm build                 # build the site (builds the search package first)
pnpm build:all             # pnpm -r build (all packages)
pnpm test                  # pnpm -r test (search pkg + worker; Vitest)
pnpm deploy:worker         # wrangler deploy of shamwari-docs-ai
```

Per package:

- `site`: `dev`, `build` (runs `build:deps` — the search package
  must be built first or the site build fails), `preview`.
- `nyuchi-docs-search`: `build` (`svelte-package` + `publint`),
  `test`, `test:watch`.
- `shamwari-docs-ai`: `build` (`tsc --noEmit`), `dev`
  (`wrangler dev`, proxies to the live AI Search instance),
  `deploy`, `test`.

**Known-broken root scripts — do not "fix" code to satisfy them:**

- `pnpm lint` is a no-op: no package defines a `lint` script and
  there are no ESLint/Prettier configs in this repo.
- `pnpm ingest` targets a script that no longer exists — a leftover
  from the old hand-built RAG pipeline (replaced by Cloudflare AI
  Search). Safe to ignore.

## CI / deployment

- One GitHub Actions workflow: `.github/workflows/build.yml` —
  push (all branches) + PRs to `main`. Node 22 + pnpm 10.33 →
  `pnpm install` → `pnpm -r build` → `pnpm -r --if-present run test`.
- **Deploys are NOT GitHub Actions.** Both workers deploy via
  **Cloudflare Workers Builds** (the Cloudflare GitHub App connected
  to `nyuchi/nyuchi-docs`, one build trigger per package root).
  There is no `CLOUDFLARE_API_TOKEN` repo secret and none is needed.
- `site` deploys as a Cloudflare Worker with **Static Assets**
  (`site/wrangler.toml`, `[assets] directory = "./dist"`, no worker
  `main`) → `nyuchi-docs.nyuchi.workers.dev`, custom domain
  `docs.nyuchi.com`.
- `shamwari-docs-ai` → `shamwari-docs-ai.nyuchi.workers.dev`.
- The Cloudflare `account_id` is hardcoded in both `wrangler.toml`
  files — intentional, not a secret.

## The site (`site/`)

- **Astro 6 + Starlight + Svelte 5.** `site/astro.config.mjs` is
  the single source of the site title, description, **sidebar**
  (hardcoded array — new pages must be added there), logo, social
  links, and plugin wiring. `site: 'https://docs.nyuchi.com'`.
- **Content lives in `site/src/content/docs/**` as MDX** (Starlight
  `docsLoader` + `docsSchema` in `site/src/content.config.ts`).
  Sections: `platform/` (configuration, administration, api),
  `analytics/`, `integrations/` (connectors, webhooks, nyuchi-api),
  `mukoko-weather/`, `identity/`, `console/`, `mzizi-tools/`,
  `deployment/`, `conventions/`, plus the `index.mdx` splash page.
- **Much of the content is stub/WIP scaffolding** — several
  `overview.mdx` pages are single-page stubs and
  `conventions/overview.mdx` is explicitly flagged as a stub. Treat
  existing prose as placeholder, not authoritative reference.
- **Theming:** `site/src/styles/theme.css` maps `@bundu/ui` (Mzizi)
  tokens onto Starlight. Nyuchi's brand mineral is **gold**
  (`--sl-color-accent: #ffd740` dark / `#7a5c00` light); wordmarks
  render lowercase. Fonts: Noto Sans (body), Noto Serif (display),
  JetBrains Mono (code).
- `site/src/components/Footer.astro` is the custom ecosystem footer
  with the canonical **seven-mineral strip** (cobalt, tanzanite,
  malachite, gold, terracotta, sodalite, copper). Don't reorder or
  drop minerals.
- Public assets: `site/public/` (favicon, robots.txt, `llms.txt` —
  the machine-readable site index for LLMs, images).
- Wordmark is **"Nyuchi Docs"** — leftover Mintlify branding was
  removed; don't reintroduce it.

## Search + Ask AI (how the three packages connect)

```
docs.nyuchi.com (site)
  └─ Search modal (nyuchi-docs-search, ⌘K)
       ├─ keyword tab → Pagefind index (built into the site)
       └─ Ask AI tab  → POST {worker}/chat  (SSE)
                          └─ shamwari-docs-ai worker
                               └─ Cloudflare AI Search instance
                                  ("nyuchi-docs", web-crawler over
                                  the live site's sitemap; LLM calls
                                  via the shared `shamwari` AI Gateway)
```

- The search package exports (see its `package.json` `exports`):
  `.` (barrel), `./plugin` (`starlightDocsSearch` Starlight plugin),
  `./SearchModal.svelte`, and `./Search.astro` (the Starlight
  `Search` component override). Key sources: `SearchModal.svelte`,
  `AiChat.svelte`, `lib/ai-client.ts` (SSE client),
  `lib/pagefind.ts`.
- **Plugin options are dead code:** `starlightDocsSearch()` ignores
  its options object. Real configuration flows ONLY through env vars
  read in `Search.astro` at build time: `PUBLIC_SHAMWARI_AI_URL`
  (worker base URL) and `PUBLIC_DOCS_SOURCE` (`nyuchi` | `bundu`,
  unset here — the worker defaults to the Nyuchi corpus).
- Worker API: `POST /chat` with
  `{ messages: ChatMessage[], source?: 'nyuchi' | 'bundu' }`,
  responding with SSE frames `citations` / `token` / `done` /
  `error`; `GET /health`; `POST /mcp` — MCP Streamable HTTP
  (JSON-RPC) with tools `search_docs` / `ask_docs` / `read_page` /
  `submit_feedback` / `raise_issue` (`src/mcp.ts`, routed from
  `docs.nyuchi.com/mcp*` via `wrangler.toml` routes; server card at
  `site/public/.well-known/mcp/server-card.json`, guide at
  `integrations/docs-mcp.mdx`).
- Worker config (`shamwari-docs-ai/wrangler.toml`): vars `TOP_K`,
  `ALLOWED_ORIGINS`; AI Search binding `NYUCHI_DOCS`. The
  `BUNDU_DOCS` binding is **commented out** (blocked on
  `docs.bundu.org` publishing a sitemap) — `source: 'bundu'`
  currently returns 503.
- There is no ingestion pipeline in this repo anymore — AI Search
  crawls the deployed site itself. Ask-AI cannot run fully locally;
  `wrangler dev` proxies to the live instance.

## Conventions

- **Commits:** Conventional-Commit style subjects
  (`feat(site): ...`, `fix(site): ...`, `ci: ...`), imperative,
  ≤72 chars. Not enforced by commitlint — follow the git history.
- **TypeScript:** strict everywhere. `site` extends
  `astro/tsconfigs/strict`; the search package and worker use
  `moduleResolution: "Bundler"`, `noEmit`, `isolatedModules`.
- **No lint/format tooling is configured** — match the style of
  surrounding code by hand.
- The search package is published to npm: keep it dependency-free at
  runtime (Svelte 5 + Starlight are peer deps), keep the `exports`
  map accurate, and make sure `build` still passes `publint`.
- Tests are Vitest: jsdom + Testing Library for the search package,
  node env for the worker. Run `pnpm -r test` before pushing.

## Gotchas

- `site/.env.example` points `PUBLIC_SHAMWARI_AI_URL` at
  `shamwari-docs-ai.nyuchi-com.workers.dev`, while the READMEs use
  `shamwari-docs-ai.nyuchi.workers.dev` — one of the two is wrong;
  verify against the deployed worker before relying on either.
- Build outputs (`dist/`, `.astro/`, `.wrangler/`, `.svelte-kit/`)
  are gitignored; building `site` in isolation without first
  building `nyuchi-docs-search` fails — use the root/site `build`
  scripts, which handle the ordering.
- The README notes the `docs.nyuchi.com` apex may still point at the
  legacy Mintlify-on-Vercel deployment until cutover completes.
- The sidebar in `astro.config.mjs` and the sections listed in the
  root README can drift (e.g. Mukoko Weather appears in the sidebar
  but not the README) — the Astro config is the source of truth.
