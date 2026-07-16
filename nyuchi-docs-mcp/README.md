# nyuchi-docs-mcp

MCP server for the [Nyuchi docs](https://docs.nyuchi.com) — search,
read, and ask the documentation, and send feedback or raise issues
about it, from any Model Context Protocol client.

This package is a dependency-free stdio bridge to the hosted
Streamable HTTP endpoint at **`https://docs.nyuchi.com/mcp`**. Clients
that speak Streamable HTTP can skip the package and connect to the URL
directly.

## Use

```bash
npx nyuchi-docs-mcp
```

Claude Code:

```bash
claude mcp add nyuchi-docs -- npx nyuchi-docs-mcp
```

Or any client config:

```json
{
  "mcpServers": {
    "nyuchi-docs": { "command": "npx", "args": ["nyuchi-docs-mcp"] }
  }
}
```

Direct HTTP (no package needed):

```json
{
  "mcpServers": {
    "nyuchi-docs": { "type": "http", "url": "https://docs.nyuchi.com/mcp" }
  }
}
```

## Tools

| Tool | Kind | What it does |
| --- | --- | --- |
| `search_docs` | read | Search the docs; titles, URLs, snippets |
| `ask_docs` | read | Synthesized answer with citations |
| `read_page` | read | Full readable text of a docs page |
| `submit_feedback` | write | Send a correction / comment to the docs team |
| `raise_issue` | write | File an actionable docs issue |

The endpoint can be overridden with an argument
(`nyuchi-docs-mcp <url>`) or `NYUCHI_DOCS_MCP_URL` — useful against a
preview deployment.

MCP registry name: `io.github.nyuchi/nyuchi-docs`. Source lives in
[`nyuchi/nyuchi-docs`](https://github.com/nyuchi/nyuchi-docs)
(`nyuchi-docs-mcp/` for this bridge, `shamwari-docs-ai/src/mcp.ts` for
the hosted server). MIT.
