---
name: agent-readiness
description: Probe docs.nyuchi.com's agent surfaces end-to-end — llms.txt, MCP server card, the hosted /mcp JSON-RPC endpoint, and the worker-direct fallback. Use to verify the docs site is agent-ready after deploys or Cloudflare config changes.
---

# Agent-readiness test — docs.nyuchi.com

Run every probe with a plain HTTP client (curl). Agents are
non-browser clients: if curl gets challenged, agents are blocked.

```bash
D=https://docs.nyuchi.com
W=https://shamwari-docs-ai.nyuchi.workers.dev

# 1. Machine-readable site surfaces (expect 200, NOT a challenge page)
curl -s -o /dev/null -w '%{http_code}\n' $D/llms.txt
curl -s -o /dev/null -w '%{http_code}\n' $D/robots.txt
curl -s -o /dev/null -w '%{http_code}\n' $D/.well-known/mcp/server-card.json

# 2. Hosted MCP through the domain (expect a JSON-RPC result)
curl -s -X POST $D/mcp -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 300

# 3. Worker-direct fallback (isolates zone config from worker health)
curl -s $W/health
curl -s -X POST $W/mcp -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 300
```

Expected tools: `search_docs`, `ask_docs`, `read_page`,
`submit_feedback`, `raise_issue`.

## Interpreting failures

- **Domain 403 + "Just a moment" HTML, worker-direct fine** → the
  Cloudflare ZONE is challenging non-browser clients (Bot Fight Mode
  or a WAF challenge rule). This blocks every agent. Fix in the
  Cloudflare dashboard (Security → Bots / WAF): disable Bot Fight
  Mode for the zone or add Skip rules for at least `/mcp*`,
  `/.well-known/*`, `/llms.txt`, `/robots.txt` — for a public docs
  site, skipping the whole zone is reasonable. workers.dev is NOT
  covered by the zone's WAF, which is why the direct probe isolates
  the cause.
- **Worker-direct also failing** → the worker itself; check the
  Cloudflare Workers build logs and `wrangler.toml` routes.
- **Domain serves wrong content** → the docs.nyuchi.com apex may
  still point at the legacy deployment; check DNS/routes cutover.

## MCP registry lockstep

`nyuchi-docs-mcp` (the npm stdio bridge) and root `server.json` must
stay version-locked — `.github/workflows/publish-mcp.yml` enforces it
at release time.
