# Changelog

All notable changes to this repository. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **The docs MCP server (`nyuchi-docs-mcp-worker`, `docs.nyuchi.com/mcp`) runs on the official MCP TypeScript SDK v2** (`@modelcontextprotocol/server` 2.4, `zod` 4) instead of a hand-rolled JSON-RPC dispatcher. It now serves 2026-07-28 clients (`server/discover`, per-request version) as well as the 2025 `initialize` handshake. Tools are renamed `nyuchi_docs_*`, with the old names kept as deprecated aliases, and every tool has a title and annotations. Inputs are validated with bounds; `top_k` is still clamped to 1–10 rather than refused. Clients that send no `Accept` header still get one JSON body. Refs #109.
- `integrations/docs-mcp` names the Worker that actually serves the endpoint (`nyuchi-docs-mcp`, not `shamwari-docs-ai`) and the new tool names.

### Added

- `nyuchi-docs-mcp-worker/evals/evals.xml`: ten read-only evaluation questions, verified against production.
