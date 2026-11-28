---
title: README standard
description: "How every repository in the Bundu Foundation enterprise opens: the shape, the branding facts, the lint and how to merge a README change."
---

**How every repository in the Bundu Foundation enterprise opens.**

This is not a template invented for its own sake. It is the shape already
shared by the three READMEs in the estate that work hardest —
[`mzizi-dev/mzizi-registry`](https://github.com/mzizi-dev/mzizi-registry),
[`mukoko-dev/mukoko-auth`](https://github.com/mukoko-dev/mukoko-auth) and
[`nyuchi/zti-app`](https://github.com/nyuchi/zti-app) — written down so the
next repo has something to copy instead of something to invent.

It applies to all seven orgs: `mzizi-dev`, `mukoko-dev`, `nyuchi`,
`bundu-labs`, `shamwari-ai`, `openNTL`, `siafuDB`.

---

## The rule that outranks the shape

**A README that is wrong is worse than a README that is thin.**

Consistency here means the same _shape_ — heading, one-line purpose, install,
usage, links, licence — never the same prose. A README that says the same
thing about a different thing is worse than none at all. If you cannot
honestly describe what a repo does, write one true sentence and stop; do not
pad it with the ecosystem boilerplate from a neighbouring repo.

Two corollaries:

- **Curl every URL and badge before you commit it.** A dead badge is a broken
  promise on the most public page the project has. This is not hypothetical:
  `@nyuchi/mzizi-cli` shipped to npm with a `repository` field pointing at a
  repo that no longer exists under that name.
- **Delete a claim you cannot verify.** Retired architecture vocabulary and
  superseded counts survive in READMEs long after the code moved on, because
  nobody is required to re-read them.

---

## The shape

Twelve parts, in this order. Parts 1–5 and 12 are **required in every repo**,
however small. Parts 6–11 appear when the repo has something to put in them.

| #   | Part              | Required | What it is                                                          |
| --- | ----------------- | :------: | ------------------------------------------------------------------- |
| 1   | Title             |    ✅    | `# <Product name>` — the thing's name, not the repo slug            |
| 2   | One-line purpose  |    ✅    | A single sentence saying what this is and who it is for             |
| 3   | Badges            |    ✅    | CI, licence, and the two or three facts about the stack that matter |
| 4   | At a glance       |    ✅    | Live URLs, version, deploy target — the orientation line            |
| 5   | What it is / does |    ✅    | The substantive section. Prose, not a feature checklist             |
| 6   | Install           |    —     | Required for anything published to npm or crates.io                 |
| 7   | Usage             |    —     | The smallest example that actually runs                             |
| 8   | Architecture      |    —     | How the pieces fit. A table or a diagram, not both                  |
| 9   | Commands          |    —     | A table of the scripts a contributor will actually type             |
| 10  | Ecosystem         |    —     | Sibling repos and services, with live links                         |
| 11  | Contributing      |    —     | Pointers to CONTRIBUTING / SECURITY / CODE_OF_CONDUCT               |
| 12  | Licence           |    ✅    | The licence, and the governance line where it applies               |

### 1. Title

The product's name, as a person would say it. `# Mukoko ID`, not
`# mukoko-auth`. `# Iconic Concierge`, not `# zti-app`. If the repo slug and
the product name differ, the first sentence should reconcile them.

### 2. One-line purpose

One sentence. What it is, and for whom. It is what a reader sees under the
repo name in search results and on the npm page, so it has to stand alone.

Use a blockquote when the line is a tagline, plain bold when it is a
description. Both appear in the exemplars; pick one per repo and stay with it.

### 3. Badges

Badges are load-bearing: they are how a reader judges whether the project is
alive before reading a word. Rules:

- **Every badge must resolve.** Curl it. A 404 badge image renders as a broken
  icon on npm.
- **CI badges point at a workflow that exists** in _this_ repo, on the
  repo's actual default branch (several repos use `master` or `scaffold`, not
  `main`).
- **The licence badge must match the LICENSE file.** Apache-2.0 for the open
  infrastructure repos, proprietary where that is the truth.
- Stack badges: at most six. Prefer `style=flat-square`, or `for-the-badge`
  consistently within one repo — never mixed.

The two forms in use, both acceptable:

```markdown
[![CI](https://github.com/<org>/<repo>/actions/workflows/ci.yml/badge.svg)](https://github.com/<org>/<repo>/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
```

```markdown
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
```

### 4. At a glance

One line, pipe-separated, directly under the badges — the orientation a reader
needs before deciding to read on:

```markdown
**Version:** 1.0.0 | **Live:** [mzizi.dev](https://mzizi.dev) | **Docs:** [docs.bundu.org](https://docs.bundu.org)
```

For an application, a small Live Deployments table is
the better form. Follow `mukoko-auth`.

### 5. What it is

Prose. Two to five paragraphs, or one paragraph and a tight feature list. This
is the part that has to be _true_, and it is the part that rots fastest.

Do not list features that are planned. Mark them, or leave them out.

### 12. Licence and governance

The last section, always. Where the repo is Bundu Foundation IP, it carries
the governance line — see [Branding facts](#branding-facts) below for the
exact wording.

---

## Branding facts

These were verified against the live API on 2026-09-12. Do not restate them
from memory, and do not copy them out of an older README — several of the
errors below were propagated exactly that way.

### The governance line

Mzizi is an **open-architecture project of the Bundu Foundation**, operated
and developed by **Nyuchi**. The plugin manifest and the `/v1` discovery
document both say exactly this. Match it.

Mzizi is **not** a Nyuchi product. Nyuchi is the operator; the Bundu
Foundation is the governance body.

### The palette: 21 colour families, not five, not seven

| Family group | Count |                                                            Names |
| ------------ | ----: | ---------------------------------------------------------------: |
| Minerals     |     7 | cobalt, tanzanite, malachite, gold, terracotta, sodalite, copper |
| Heritage     |     7 |       indigo, savanna, baobab, sunset, river, hematite, kalahari |
| Experimental |     7 |                 ember, acacia, fern, lagoon, storm, dusk, protea |

**Twenty-one.** A "Five African Minerals" claim shipped inside the published
`@nyuchi/mzizi-skills` package for weeks before it was caught. "Seven African
Minerals" is also wrong as a description of the whole palette — the minerals
are seven, the palette is twenty-one. Live source:
`GET https://api.mzizi.dev/api/v1/brand`.

### The architecture: the DNA double helix

**8 nodes, 4 rungs, 6 strands, 575 components.**

The words **axis**, **axes** and **layer** are retired. They survive in some
legacy API route names, which is not a licence to use them in prose. Live
source: `GET https://api.mzizi.dev/api/v1/architecture`.

### There is no database

**The registry is disk.** D1 exists only for the MCP server and for fundi
logging. Any README claiming Supabase — or any database — is the source of
truth for components, brand or tokens is wrong and the claim must be deleted,
not softened. See `mzizi-registry/docs/db-contents-rule.md`.

### Addresses

| Address          | What       | State                                    |
| ---------------- | ---------- | ---------------------------------------- |
| `mzizi.dev`      | Human site | Live                                     |
| `api.mzizi.dev`  | API        | Live                                     |
| `app.mzizi.dev`  | Console    | Live                                     |
| `mcp.mzizi.dev`  | MCP server | Live, WorkOS-gated (401 without a token) |
| `docs.mzizi.dev` | Docs       | **Does not resolve.** Do not link it     |

Long-form docs are at [docs.bundu.org](https://docs.bundu.org) (product) and
[docs.nyuchi.com](https://docs.nyuchi.com) (engineering). Both resolve.

### The install command

```bash
npx shadcn@latest add https://api.mzizi.dev/v1/ui/<name>
```

This is the **canonical** form and the only one to document. Note, honestly,
that it currently 404s: `/v1` is served by PR #335, which is not yet merged.
The working form today is `https://api.mzizi.dev/api/v1/ui/<name>`.

Never write the old `mzizi.dev/api/v1` form. 1,464 references were migrated
off it on 2026-09-12.

---

## Publishing surfaces

For anything on npm or crates.io the README **is** the package page, and it is
read by people with no access to the repo. Two extra rules:

1. **The `repository` field must point at a repo that exists and that the
   reader can open.** `mzizi-dev/agent-tools` is private, so a public package
   whose repository field points there renders a 404 for every reader. Give
   those packages a `homepage` that resolves publicly.
2. **The README must stand alone.** Relative links (`./CONTRIBUTING.md`,
   `../LICENSE`) do not resolve on npm. Use absolute URLs in any README that
   ships in a package tarball.

---

## Lint

READMEs are linted by the five `lint / *` contexts every repo requires. Run
them locally before pushing:

```bash
npx markdownlint-cli2 "**/*.md"
npx prettier --check "**/*.md"
```

Config is inherited from this repo: [`.markdownlint.jsonc`](https://github.com/nyuchi/.github/blob/main/.markdownlint.jsonc)
and [`.prettierrc`](https://github.com/nyuchi/.github/blob/main/.prettierrc). Notable settings: `MD013` (line length) is
off, `MD033` (inline HTML) is off, `MD060` (table alignment) is **on** and
satisfied by Prettier's table output.

> **Never run `prettier --write` on an `.mdx` file.** Prettier 3.9.x corrupts
> `{/* … */}` into `{/_ … _/}`, producing invalid MDX. Prettier is safe on
> `.md`. This is why `.mdx` belongs in `.prettierignore`.

---

## Merging a README change

READMEs are documentation, not features, and are exempt from the feature
merge freeze. They still go through a PR and still need green CI.

```bash
gh pr create --fill
gh pr merge --rebase --auto
```

**Squash or rebase.** The branch standard in
[[org settings](/engineering/org-settings/)](/engineering/org-settings/) allows both, with linear history and
no merge commits. On 2 October 2026 most repos still had squash switched off
in their own settings, so `--rebase` is the method that works everywhere until
the standard is rolled out. Auto-merge is enabled. Never use `--admin`.

> `mzizi-dev/.github/ORG_STANDARDS.md` describes a merge-commit-only
> convention. That was true when it was written on 2026-09-11 and is not true
> now; the live API disagrees with it on all 75 repos. That document needs
> correcting separately.

---

## Skeleton

```markdown
# Product Name

> One sentence: what this is and who it is for.

[![CI](https://github.com/ORG/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/ORG/REPO/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

**Live:** [example.com](https://example.com) | **Docs:** [docs.bundu.org](https://docs.bundu.org)

---

## What it is

Two to five paragraphs of true prose.

## Install

\`\`\`bash
npm install PACKAGE
\`\`\`

## Usage

The smallest example that actually runs.

## Architecture

A table, or a diagram — not both.

## Commands

| Command      | Description      |
| ------------ | ---------------- |
| `pnpm dev`   | Development server |
| `pnpm check` | Every CI gate locally |

## Ecosystem

Sibling repos and services, with links that resolve.

## Contributing

See [CONTRIBUTING.md](/engineering/contributing/), [SECURITY.md](SECURITY.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licence

Licensed under the [Apache License 2.0](LICENSE).
© Bundu Foundation, operated by Nyuchi Africa (PVT) Ltd.
```
