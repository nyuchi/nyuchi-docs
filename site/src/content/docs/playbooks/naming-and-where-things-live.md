---
title: Naming, identity and where things live
description: "Operations playbook: naming, identity and where things live."
sidebar:
  label: Naming, identity and where things live
---

**Names carry the project identity:** crates `bundu-*`, `mzizi-*`, `nyuchi-*`;
npm scope `@nyuchi/`. **Bundu** is the Foundation (standards, doctrine, the
commons; `bundu-labs`). **Nyuchi** is the operator (infrastructure and
products; `nyuchi`). **Mzizi** is the open architecture framework and language
on Rust (`mzizi-dev`): an open-architecture project of the Bundu Foundation,
operated by Nyuchi, **not a Nyuchi product**.

| Repo                       | Publishes                                                     |
| -------------------------- | ------------------------------------------------------------- |
| `mzizi-dev/mzizi-cli`      | `mzizi-cli` (crates.io), `@nyuchi/mzizi-cli` (npm), `mz` bins |
| `mzizi-dev/mzizi-registry` | `mzizi-*` Roots crates (crates.io)                            |
| `mzizi-dev/mzizi-api`      | `mzizi-api-types` (crates.io)                                 |
| `mzizi-dev/mzizi`          | `mzizi-lang-compiler` (crates.io, manual dispatch)            |
| `mzizi-dev/homebrew-tap`   | The `mz` Homebrew formula                                     |
| `bundu-labs/age-hybrid`    | `bundu-age-hybrid` (crates.io)                                |
| `nyuchi/nyuchi-api`        | Nothing: deploys to Fly on merge to `main`                    |

**Secrets** never appear in chat, issues, commits or logs. List names only:
`gh api orgs/<org>/actions/secrets --jq '.secrets[].name'`.

- `CARGO_REGISTRY_TOKEN` exists as an **org secret only in `mzizi-dev`**.
  `bundu-labs` repos use their **own `release` environment secret**.
- npm uses OIDC trusted publishing: there is no npm token.
- `FLY_API_TOKEN` is a repo secret scoped to one app. `RELEASE_BUMP_TOKEN` is
  the `mzizi-dev` org secret that lets a workflow's tag start other workflows.

**The GitHub API limit is 5,000 an hour across every agent** ([roles and authority](/playbooks/roles-and-authority/)).
**Where rules live:** [`AGENTS.md`](/engineering/guide/),
[`CONTRIBUTING.md`](/engineering/contributing/), [[org settings](/engineering/org-settings/)](/engineering/org-settings/),
[`README-STANDARD.md`](/engineering/readme-standard/), and the
[Mzizi playbook](https://github.com/mzizi-dev/mzizi-docs/blob/main/playbook.mdx).
