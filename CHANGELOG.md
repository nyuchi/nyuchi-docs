# Changelog

All notable changes to this repository. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — engineering and operations docs move in from nyuchi/.github (2026-11-28)

Owner ruling: `nyuchi/.github` does not control how Nyuchi is run, developed or built; those docs live here. Procedures go in the one Playbooks section; standards and reference go in a new Engineering section. Refs #169.

- **Playbooks** (how engineering is done with agents): the operations playbook, split into one page per procedure (roles and authority, trunk-based rules, release procedure, making a repo public, security triage, incident response, dependency policy, naming and where things live, known sharp edges), plus Adopting lint. The Playbooks index lists them and says how to add a playbook.
- **Engineering** (architecture, problems being solved, standards): the engineering guide (the org `AGENTS.md`), Contributing, the README standard, Org settings and rulesets (with the all-checks-green procedure) and the DPIA pre-assessment template.
- The staging-era promotion flow in `nyuchi/.github/settings/README.md` is not carried over: no repo has a `staging` branch.

### Changed — staging wording removed (2026-11-28)

The release workflow comments, AGENTS.md and CONTRIBUTING.md no longer describe a `staging` branch; the repo is trunk-based. No behaviour changes.

### Changed

- **Releases are trunk only** (owner, 2026-11-23: "Main is the only target"). The releases playbook no longer describes `staging`: every PR goes into the default branch, the PR titles pick the bump when the release app tags the new tip, and a green PR held up by a slow queue may be merged. No repository checked that day has a `staging` branch.

- **Kweli's brand mineral is Malachite** (owner decision, 2026-11-23), as Mzizi's brand-minerals table and `/v1/brand` give it; the design-system page said Tanzanite. The verification badge's tier colours are a separate scale (Mzizi's trust tokens) and are unchanged.

- **Wordmarks take an initial capital** (owner decision, 2026-11-23): Nyuchi, Mzizi, Mukoko, Bundu, Shamwari, Kweli. The `using-nyuchi-docs` skill no longer says "Lowercase, always", and the weather-stations page and the `mukoko-design` rows on the tools pages write Mukoko with a capital. `@nyuchi/nyuchi-docs-skills` moves to 0.1.2 so the changed skill ships. Code identifiers (package names, repository names, domains, slugs) are unchanged.

- **Nyuchi and Mukoko facts move in from docs.mzizi.dev**, so each lives in the Nyuchi docs. Kweli overview gains Kweli Address (the short code, RFC v0.1, Mukoko Events as first consumer). The Web playbook gains two decisions: "Open in Mukoko" is one https universal link resolved by `super-app-web`, and every discover page is identical across the Mukoko apps (owner, 2026-10-04). The Console overview records that its shell is the ecosystem's dashboard design (owner, 2026-10-04) and that the Mzizi mini-app left it for `app.mzizi.dev`. Identity links the Mzizi authentication pattern at docs.mzizi.dev instead of bundu-docs. Nothing is removed from docs.mzizi.dev in this change.

- **Dependencies on the latest releases** (#156). `astro` 7.4.13, `@astrojs/starlight` 0.43.1, `@bundu/ui` 0.17, `vite-plus` 1.7.0 (with its `vite-plus-core` 8.3.8000 alias), `vitest` 5.1.1, `wrangler` 4.166.0, `jsdom` 31, `jose`, `zod` and the rest of the minor and patch group. `nyuchi-docs-search` accepts Starlight 0.42 and 0.43 as a peer, so its dev install no longer resolves an old Astro. Clears the astro, smol-toml and postcss-selector-parser Dependabot alerts. Supersedes #100 and #116.

- **The shared shell is on the Bundu floor.** `@bundu/ui` moves to `^0.17.0`: icon buttons 45px, sidebar and footer items 49px, a 9px gap between controls, a 21px page edge, and breadcrumb links at least 45px on touch and 28px on a desktop. `nyuchi-docs-mcp` is set to 0.11.0, the next minor the release policy allows after v0.10.1, so the next release can be tagged (Auto tag refused 0.2.0 on main). Refs #151.
- **Mzizi is named with the owner's wording.** The README, `llms.txt` and the home page call it Mzizi, not "the Mzizi design system", and describe it as a Bundu Foundation project, built by Nyuchi, with Nyuchi running its cyber section. Refs #151.
- **The site follows the current Bundu floor.** The hit area is 45px on touch and 24px on desktop (replacing the 44px touch floor in the home hero), and the field inset and control gap move to the spacing layers (17px and 9px). `site/src/styles/theme.css` (home hero) and the Kweli design-system and Web playbook pages are updated, and the Web playbook links to the full table at [docs.mzizi.dev/foundations/bundu-floor](https://docs.mzizi.dev/foundations/bundu-floor).
- **docs.nyuchi.com uses the shared Mzizi Starlight shell from `@bundu/ui`** (#140). `starlightMziziShell` now comes from `@bundu/ui/starlight` (mzizi-dev/packages-npm#141), the same shell and theme docs.bundu.org uses, with `accent: 'gold'`; the private workspace package `@nyuchi/nyuchi-docs-shell` (`nyuchi-docs-shell/`) it was moved from is deleted. The shell now also brings the Starlight theme (tokens, accent, neutrals, fonts, radii, lowercase wordmark), so `site/src/styles/theme.css` keeps only the home-hero styles. The site's PageFrame override, with its page-edge mineral strip, now composes `@bundu/ui/starlight/PageFrame.astro`. The rendered-site tests move from the shell package to `site/tests/rendered-shell.test.ts` (`pnpm --filter site test`, after a build); the shell's unit tests live with it in packages-npm. `@bundu/ui` is declared as `>=0.15.0`, the first release with the `starlight` export.
- **The docs search UI no longer uses Svelte** (phase 1 of #129). `nyuchi-docs-search` is now a `.astro` trigger plus framework-free TypeScript that runs in the browser (`src/lib/search-modal.ts`); `./Search.astro` and `./plugin` keep their paths and the Pagefind and Ask-AI clients are unchanged. `@astrojs/svelte`, `svelte`, `@sveltejs/*` and `svelte-check` are removed, the package builds with plain `tsc`, and type checking is on for it. A Starlight site that consumes the package no longer needs the Svelte integration. The Ask AI error is now shown as an alert, and citations stay with the answer after it finishes. Refs #129.
- **The docs MCP server (`nyuchi-docs-mcp-worker`, `docs.nyuchi.com/mcp`) runs on the official MCP TypeScript SDK v2** (`@modelcontextprotocol/server` 2.4, `zod` 4) instead of a hand-rolled JSON-RPC dispatcher. It now serves 2026-07-28 clients (`server/discover`, per-request version) as well as the 2025 `initialize` handshake. Tools are renamed `nyuchi_docs_*`, with the old names kept as deprecated aliases, and every tool has a title and annotations. Inputs are validated with bounds; `top_k` is still clamped to 1–10 rather than refused. Clients that send no `Accept` header still get one JSON body. Refs #109.
- `integrations/docs-mcp` names the Worker that actually serves the endpoint (`nyuchi-docs-mcp`, not `shamwari-docs-ai`) and the new tool names.

### Security

- **The SvelteKit advisory (GHSA-3r8g-jcqq-3p5j) is gone with the dependency**, not bumped past. `pnpm audit --audit-level=high` is clean.
- **Dependabot waits seven days before proposing a newly published version** (`cooldown: default-days: 7` on the npm and GitHub Actions entries in `.github/dependabot.yml`), which the org Semgrep rule `dependabot-missing-cooldown` requires. Security updates are not delayed.
- **`http-cache-semantics` moves to 4.3.0 and the set-aside advisory is gone** (GHSA-ch52-4w7c-c8xp). The advisory was set aside until 2026-11-03 because no patched release existed; 4.3.0 shipped on 2026-10-04. A `pnpm.overrides` entry (`http-cache-semantics@<4.3.0` to `>=4.3.0`) puts both `astro` snapshots on it, the `auditConfig.ignoreGhsas` block and its recheck step in `build.yml` are removed, and the `audit` job passes again.
- **`pnpm audit --audit-level=high` is clean.** Most of these advisories were already on `staging`; only the `zod` floor relates to the SDK change.
  - `zod` gets an override `>=4.6.6` and the worker's spec is now `^4.6.6` (GHSA-mrhx-c7xc-m3w5). It resolves to 4.6.7.
  - `sharp` `^0.35.5` (GHSA-wq5f-xc86-pv6w), resolving 0.35.5.
  - `vite` 8 to `>=8.3.3` (GHSA-587h-7wmj-h5pm), resolving 8.3.5.
  - The `vite-plus` toolchain moves to `^1.4.0`, and with it the `@voidzero-dev/vite-plus-core` alias, to `^1.4.0` (GHSA-587h-7wmj-h5pm). `vitest` moves to `^5.0.5`, which `vite-plus` 1.4 requires.
  - `undici` to `>=7.30.1` and `>=8.12.2` (GHSA-xjj6-f33q-929c, GHSA-4w7w-5xrc-9h26, GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm).

### Added

- **The standard Mzizi shell on docs.nyuchi.com** (steps 2 and 3 of #133, `nyuchi-docs` only). New private workspace package `@nyuchi/nyuchi-docs-shell`: a Starlight plugin, `starlightMziziShell`, that replaces Starlight's Header and Sidebar with the Mzizi N7 anatomy (56px sticky header with section links, the brand-accent pill action group on small screens, a blurred and bordered scrolled state; a sidebar with the seven-mineral strip and 48px items with a tinted accent active state) and mounts a full-width footer (3px mineral strip, brand column with "I am because we are.", link columns with 48px targets, legal line). Astro and CSS only, tokens only, no UI framework. The site's custom Header and Footer overrides are removed. Refs #133.
- `nyuchi-docs-mcp-worker/evals/evals.xml`: ten read-only evaluation questions, verified against production.
