# shamwari-docs-ai

Thin Cloudflare Worker that powers the **Ask AI** tab in
[`nyuchi-docs-search`](../nyuchi-docs-search) for both `docs.nyuchi.com` and
`docs.bundu.org`.

The worker is a proxy: crawl, chunk, embed, retrieve, and generate all happen
inside Cloudflare **AI Search** instances. This worker exists to keep the API
token server-side, add CORS, route between per-corpus instances, and translate
the AI Search response into the SSE wire shape the docs client already
understands.

## Routes

- `POST /chat` — body `{ messages: ChatMessage[], source?: 'nyuchi' | 'bundu' }`.
  Emits Server-Sent-Event frames:
  - `{type:'citations', citations:[…]}` (if any chunks were retrieved)
  - `{type:'token', text}` (the generated answer)
  - `{type:'done'}` (or `{type:'error', error}` on failure)
- `GET /health` — `{ ok: true, ts }`.

CORS: allows `https://docs.nyuchi.com`, `https://docs.bundu.org`,
`https://*.vercel.app`, and `localhost`/`127.0.0.1` for dev.

## Live deployment

- URL: `https://shamwari-docs-ai.nyuchi.workers.dev`
- AI Search instance (nyuchi-docs): crawls `docs.nyuchi.com` via sitemap,
  routes Workers AI calls through the `shamwari` AI Gateway.

## Architecture

```
docs.nyuchi.com / docs.bundu.org
        │
        │  fetch /chat  (SSE)
        ▼
shamwari-docs-ai  ── Workers binding ──▶  AI Search instance (e.g. nyuchi-docs)
                                                 │
                                                 ├─ web-crawler ingests the docs site
                                                 ├─ chunks + embeds automatically
                                                 ├─ retrieves + generates on each query
                                                 └─ logs via AI Gateway "shamwari"
```

## One-time setup (per docs corpus)

A privileged operator (account-level **AI Search:Edit** + **AI Search:Run**)
provisions an AI Search instance per docs corpus:

```sh
ACC=125a2dfbc21f76a25c980609609e8218

# 1. Create the AI Search instance, wired to the sitemap of the target docs.
curl -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$ACC/ai-search/instances" \
  --data '{"id":"nyuchi-docs","type":"web-crawler","source":"docs.nyuchi.com"}'

# 2. Bind to the shared AI Gateway "shamwari" so all LLM traffic is observable.
curl -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$ACC/ai-search/instances/nyuchi-docs" \
  --data '{"ai_gateway_id":"shamwari"}'

# 3. Add the binding to wrangler.toml (already done for nyuchi-docs):
#    [[ai_search]]
#    binding = "NYUCHI_DOCS"
#    instance_name = "nyuchi-docs"

# 4. Deploy.
pnpm --filter shamwari-docs-ai deploy
```

The crawler runs automatically and re-syncs on the instance's `sync_interval`
(default 21 600 s = 6 h). Trigger an immediate sync via the dashboard or
`POST .../ai-search/instances/{id}/sync`.

## Adding bundu-docs

Blocked: `docs.bundu.org` does not currently publish a sitemap (the crawler
errors with `missing_sitemap`). Once a sitemap is published:

1. Run the same `POST` from step 1 above with `id: bundu-docs`,
   `source: docs.bundu.org`.
2. Bind it to the `shamwari` gateway.
3. Uncomment the `BUNDU_DOCS` binding in `wrangler.toml`.
4. Redeploy.

## Indexing status

```sh
ACC=125a2dfbc21f76a25c980609609e8218
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACC/ai-search/instances/nyuchi-docs"
```

Look for `status`: `waiting` → `indexing` → `ready`.

## Develop

```sh
pnpm install
pnpm --filter shamwari-docs-ai build   # tsc --noEmit
pnpm --filter shamwari-docs-ai test    # vitest
pnpm --filter shamwari-docs-ai dev     # wrangler dev (binding proxies to remote)
```

The `[[ai_search]]` binding supports local development via `remote: true`
(already implied by the deployed instance). `wrangler dev` proxies queries to
the live instance.
