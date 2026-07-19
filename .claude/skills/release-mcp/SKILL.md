---
name: release-mcp
description: Release the nyuchi-docs-mcp stdio bridge — the package.json/server.json version lockstep, the publish workflow, and post-release verification. Use when cutting a new version of the docs MCP bridge.
---

# Releasing nyuchi-docs-mcp

The npm stdio bridge (`nyuchi-docs-mcp/`) fronts the hosted MCP at
`docs.nyuchi.com/mcp`. Registry name: `io.github.nyuchi/nyuchi-docs`.

## The lockstep rule (workflow-enforced)

`nyuchi-docs-mcp/package.json` `version` and the repo-root
`server.json` `version` MUST match — `.github/workflows/publish-mcp.yml`
fails the release otherwise. Bump both in the same commit.

## Release steps

1. Bump both versions (same value), update the bridge's CHANGELOG or
   README if behavior changed.
2. Merge to `main`, then run the `publish-mcp.yml` workflow (npm
   publish needs the `NPM_TOKEN` repo secret; MCP-registry publish
   uses GitHub OIDC — no extra secret).
3. Post-release verification:
   - `npm view nyuchi-docs-mcp version` shows the new version.
   - The MCP registry lists the new version for
     `io.github.nyuchi/nyuchi-docs`.
   - Run the `agent-readiness` skill — the hosted endpoint the bridge
     targets must be reachable (watch for the Cloudflare zone
     challenge failure mode).

## What the bridge must track

If worker tools changed (`nyuchi-docs-mcp-worker/src/mcp.ts` — the tool
list or schemas), the bridge and the server card
(`site/public/.well-known/mcp/server-card.json`) must be updated in
the same release so all three surfaces advertise the same tools:
`search_docs`, `ask_docs`, `read_page`, `submit_feedback`,
`raise_issue`.
