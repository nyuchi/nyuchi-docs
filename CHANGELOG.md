# Changelog

All notable changes to this repository. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- **The docs MCP server (`nyuchi-docs-mcp-worker`, `docs.nyuchi.com/mcp`) runs on the official MCP TypeScript SDK v2** (`@modelcontextprotocol/server` 2.4, `zod` 4) instead of a hand-rolled JSON-RPC dispatcher. It now serves 2026-07-28 clients (`server/discover`, per-request version) as well as the 2025 `initialize` handshake. Tools are renamed `nyuchi_docs_*`, with the old names kept as deprecated aliases, and every tool has a title and annotations. Inputs are validated with bounds; `top_k` is still clamped to 1–10 rather than refused. Clients that send no `Accept` header still get one JSON body. Refs #109.
- `integrations/docs-mcp` names the Worker that actually serves the endpoint (`nyuchi-docs-mcp`, not `shamwari-docs-ai`) and the new tool names.

### Security

- **Dependabot waits seven days before proposing a newly published version** (`cooldown: default-days: 7` on the npm and GitHub Actions entries in `.github/dependabot.yml`), which the org Semgrep rule `dependabot-missing-cooldown` requires. Security updates are not delayed.
- **`http-cache-semantics` moves to 4.3.0 and the set-aside advisory is gone** (GHSA-ch52-4w7c-c8xp). The advisory was set aside until 2026-11-03 because no patched release existed; 4.3.0 shipped on 2026-10-04. A `pnpm.overrides` entry (`http-cache-semantics@<4.3.0` to `>=4.3.0`) puts both `astro` snapshots on it, the `auditConfig.ignoreGhsas` block and its recheck step in `build.yml` are removed, and the `audit` job passes again.
- **`pnpm audit --audit-level=high` is clean.** Most of these advisories were already on `staging`; only the `zod` floor relates to the SDK change.
  - `zod` gets an override `>=4.6.6` and the worker's spec is now `^4.6.6` (GHSA-mrhx-c7xc-m3w5). It resolves to 4.6.7.
  - `sharp` `^0.35.5` (GHSA-wq5f-xc86-pv6w), resolving 0.35.5.
  - `vite` 8 to `>=8.3.3` (GHSA-587h-7wmj-h5pm), resolving 8.3.5.
  - The `vite-plus` toolchain moves to `^1.4.0`, and with it the `@voidzero-dev/vite-plus-core` alias, to `^1.4.0` (GHSA-587h-7wmj-h5pm). `vitest` moves to `^5.0.5`, which `vite-plus` 1.4 requires.
  - `undici` to `>=7.30.1` and `>=8.12.2` (GHSA-xjj6-f33q-929c, GHSA-4w7w-5xrc-9h26, GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm).

### Added

- `nyuchi-docs-mcp-worker/evals/evals.xml`: ten read-only evaluation questions, verified against production.
