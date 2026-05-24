# shamwari-docs-ai

Cloudflare Worker that powers the **Ask AI** tab in
[`nyuchi-docs-search`](../nyuchi-docs-search) for both `docs.nyuchi.com` and
`docs.bundu.org`.

- **Embeddings**: `@cf/baai/bge-base-en-v1.5` (768-dim).
- **Generation**: Workers AI — defaults to `@cf/meta/llama-3.1-70b-instruct`;
  swap to `@cf/anthropic/claude-3-haiku` (when generally available) via the
  `CHAT_MODEL` wrangler var.
- **Vector store**: Cloudflare Vectorize index `shamwari-docs` (cosine, 768-dim).
- **AI Gateway**: `shamwari-docs` — gives us caching, rate limits, and one
  observability pane for all model calls, for free.

## Routes

- `POST /chat` — body `{ messages: ChatMessage[], source?: 'nyuchi' | 'bundu' }`.
  Streams Server-Sent-Event frames: `{type:'token', text}`, then a single
  `{type:'citations', citations:[…]}`, then `{type:'done'}`.
- `GET /health` — `{ ok: true, ts }`.

CORS: allows `https://docs.nyuchi.com`, `https://docs.bundu.org`,
`https://*.vercel.app`, and `localhost`/`127.0.0.1` for dev.

## Live deployment

- URL: `https://shamwari-docs-ai.nyuchi.workers.dev`
- Health: `GET /health` → `{"ok":true,"ts":…}`

## One-time setup

Requires a Cloudflare API token scoped with **Workers Scripts (Edit)**,
**Workers AI (Edit)**, **Vectorize (Edit)**, and **AI Gateway (Edit)**.

```sh
# 1. Vectorize index (768-dim cosine, matches BGE base).
wrangler vectorize create shamwari-docs --dimensions 768 --metric cosine

# 2. AI Gateway (Dashboard → AI → AI Gateway, "Create gateway", name
#    `shamwari-docs`). The Wrangler CLI does not yet expose ai-gateway
#    CRUD; the binding is referenced via the AI_GATEWAY_ID var.

# 3. Deploy with the canonical wrangler.toml (which references both bindings).
pnpm --filter shamwari-docs-ai deploy
```

> **Bootstrap mode** — the repo also ships `wrangler.bootstrap.toml`, which
> omits the Vectorize + AI bindings so the worker URL can be provisioned
> before those resources exist. Use it for the very first deploy if the
> Vectorize index hasn't been created yet:
>
> ```sh
> pnpm --filter shamwari-docs-ai exec wrangler deploy --config wrangler.bootstrap.toml
> ```
>
> Then create the resources above and redeploy with the canonical config.

## Ingest a docs site

```sh
CLOUDFLARE_API_TOKEN=…  pnpm --filter shamwari-docs-ai ingest -- \
  --sitemap https://docs.nyuchi.com/sitemap-index.xml \
  --source  nyuchi
```

The ingest script:

1. Walks the sitemap (recurses into sitemap indexes).
2. Fetches each page, strips HTML to clean text.
3. Chunks at ~512 tokens with 64-token overlap on sentence boundaries.
4. Embeds each chunk with BGE base.
5. Upserts to Vectorize with metadata `{source, url, title, breadcrumb, chunk_index, text}`.

The chunk id is a SHA-256 of `source|url|chunk_index|text`, so re-running on
unchanged content is a no-op (upsert dedup).

## Develop

```sh
pnpm install
pnpm --filter shamwari-docs-ai build   # tsc --noEmit
pnpm --filter shamwari-docs-ai test    # vitest
pnpm --filter shamwari-docs-ai dev     # wrangler dev (requires CLOUDFLARE_API_TOKEN)
```
