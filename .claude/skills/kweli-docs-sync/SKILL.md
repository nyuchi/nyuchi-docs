---
name: kweli-docs-sync
description: Sync docs.nyuchi.com's Kweli guides after a feature ships in nyuchi/barstool — which page owns which surface, the sidebar rule, and the build check. Use whenever Kweli (kweli.mukoko.com) shipped something user-visible or agent-visible.
---

# Sync the Kweli docs after a barstool ship

The Kweli product guides live in `site/src/content/docs/kweli/`.
When nyuchi/barstool ships, update the page that owns the surface:

| Shipped surface | Page |
|-----------------|------|
| What Kweli is, data model, graph collections | `overview.mdx` |
| Tiers, claim flow, vouches, `/verify` entry, the internal verification console | `verification.mdx` |
| Deep-link contract for sibling apps (`/verify?entity=…&place=…&source=…`) | `cross-app-verification.mdx` |
| Open data: `/en/analytics`, `GET /api/open/stats`, MCP `get_open_stats` | `open-data.mdx` |
| Seed/enrichment, data provenance | `data-quality.mdx` |
| Minerals, density, badge contract | `design-system.mdx` |

## Rules

1. **The sidebar is hardcoded** in `site/astro.config.mjs` — a new
   page MUST be added to the `Kweli` items array or it's orphaned.
   (There is a drift check: every `.mdx` under `content/docs/` except
   `index` must appear in the sidebar.)
2. **Open-data docs state the boundary**: aggregates only, never rows
   or PII. Never document individual KYC records as open.
3. Docs describe the SHIPPED state, not roadmap — no "Phase N" or
   "coming soon" language; if it isn't live, leave it out.
4. Verify with `pnpm build` from the repo root (builds the search
   package first, then the site; the new page must appear in the
   Pagefind index count).
5. Cross-check claims against production, not memory:
   `curl https://kweli.mukoko.com/api/open/stats` for live numbers,
   and the barstool `CLAUDE.md` for route/service names.
