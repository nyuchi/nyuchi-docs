---
title: Org settings and rulesets
description: "Intended state of GitHub org and repository settings, branch protection, rulesets, secrets, supply chain, OIDC and the all-checks-green gate."
sidebar:
  label: Org settings and rulesets
---

**Intended state of GitHub settings for Nyuchi Web Services.** The rulesets as files live in [`nyuchi/.github`](https://github.com/nyuchi/.github) (`github-rulesets/`, `settings/rulesets/`, `settings/apply.sh`, `settings/require-all-green.sh`); this page is the procedure and the intent.

Most of what's in this repo (community-health files, workflow
templates, issue forms, Dependabot config) works at the _content_
level — it ships code and markdown that GitHub applies as defaults.

But a significant part of our security and review posture lives
in **GitHub's UI settings**, not in any file. That configuration
is easy to drift out of, and easy to forget when spinning up a
new repo.

This document is the **source of truth** for the settings we
intend to have in place. If the live GitHub configuration disagrees
with this document, either:

1. This document is wrong — update it. Or,
2. GitHub configuration is wrong — fix it.

Audit this document against reality at least once a quarter.
Changes require the same review bar as other security-adjacent
files (see [`CODEOWNERS`](https://github.com/nyuchi/.github/blob/main/.github/CODEOWNERS)).

---

## Organization-level settings

### Member privileges

- **Base repository permission:** _Read_ for all org members.
  Write / Admin is granted via team membership, not via base
  permission.
- **Repository creation:** Restricted to org owners and the
  `@nyuchi/maintainers` team. Prevents ad-hoc repo sprawl.
- **Repository forking:** Allowed within the org; disallowed
  externally for private repos.
- **Pages creation:** Restricted to org owners.
- **Two-factor authentication:** **Required** for all members.

### Security features (org-wide)

Enable at **Settings → Code security and analysis** for the org,
and let the settings propagate to new repos as defaults:

| Feature                                 | State                                         |
| --------------------------------------- | --------------------------------------------- |
| Dependency graph                        | **Enabled**                                   |
| Dependabot alerts                       | **Enabled**                                   |
| Dependabot security updates             | **Enabled**                                   |
| Dependabot version updates              | Opt-in per-repo via `.github/dependabot.yml`  |
| Secret scanning                         | **Enabled**                                   |
| Secret scanning — push protection       | **Enabled**                                   |
| Secret scanning — validity checks       | **Enabled**                                   |
| Secret scanning — non-provider patterns | **Enabled** (org-wide, not just public repos) |
| Private vulnerability reporting         | **Enabled**                                   |
| CodeQL default setup                    | Enabled per-repo (see below)                  |

### Actions permissions

At **Settings → Actions → General**:

- **Allowed actions:** _Allow select actions and reusable
  workflows_ — do not allow all actions unrestricted.
- **Allow actions created by GitHub:** **Yes.**
- **Allow actions by Marketplace verified creators:** **Yes.**
- **Allow specified actions and reusable workflows:** the
  allow-list below is the source of truth — every action used in
  [`.github/workflows/reusable-*.yml`](https://github.com/nyuchi/.github/tree/main/.github/workflows)
  must appear here. When adding a new action to any reusable
  workflow, update this list in the same PR.

  ```text
  actions/*,
  github/codeql-action/*,
  anchore/sbom-action@*,
  softprops/action-gh-release@*,
  DavidAnson/markdownlint-cli2-action@*,
  amannn/action-semantic-pull-request@*,
  streetsidesoftware/cspell-action@*,
  lycheeverse/lychee-action@*,
  dorny/paths-filter@*,
  pnpm/action-setup@*,
  Swatinem/rust-cache@*,
  dtolnay/rust-toolchain@*,
  taiki-e/install-action@*,
  astral-sh/setup-uv@*,
  ossf/scorecard-action@*,
  foundry-rs/foundry-toolchain@*,
  docker/setup-qemu-action@*,
  docker/setup-buildx-action@*,
  docker/login-action@*,
  docker/build-push-action@*,
  docker/metadata-action@*,
  aquasecurity/trivy-action@*,
  sigstore/cosign-installer@*,
  opentofu/setup-opentofu@*,
  actions/attest-build-provenance@*,
  hashicorp/setup-terraform@*,
  terraform-linters/setup-tflint@*
  ```

  To audit drift against what's actually referenced in the
  reusables:

  ```sh
  grep -rhoE 'uses: [^@[:space:]]+' .github/workflows/ \
    | sort -u
  ```

- **Workflow permissions default:** _Read repository contents
  and packages permissions_. Individual workflows opt into more
  via their own `permissions:` block.
- **Allow GitHub Actions to create and approve pull requests:**
  **Disabled.** Prevents a malicious action from self-approving.
- **Artifact and log retention:** 30 days.

### Domain verification

- **Verified domains:** `nyuchi.com`, `mukoko.com`, `siafudb.org`,
  `travel-info.co.zw`, `barstool.co.zw`.
  Email notifications for commits go only to addresses on verified
  domains, which makes commit impersonation harder.

---

## Repository-level defaults

These should hold for **every public repo** under
`nyuchi`, including any new repo created going forward.

### General

| Setting                          | Value                                      |
| -------------------------------- | ------------------------------------------ |
| Default branch                   | `main`                                     |
| Template repository              | _Disabled_ (unless the repo IS a template) |
| Require contributors to sign off | **Enabled** (DCO via `Signed-off-by`)      |
| Issues                           | Enabled                                    |
| Discussions                      | Enabled on primary ecosystem repos         |
| Wiki                             | **Disabled** — we keep docs in repos       |
| Projects                         | Enabled                                    |
| Preserve this repository         | Enabled on public repos                    |

### Pull requests and merge settings

| Setting                             | Value                                |
| ----------------------------------- | ------------------------------------ |
| Allow merge commits                 | **Enabled** (promotion only)         |
| Allow squash merging                | **Enabled** (default)                |
| Allow rebase merging                | **Enabled**                          |
| Default commit message for squash   | _Pull request title and description_ |
| Always suggest updating PR branches | **Enabled**                          |
| Allow auto-merge                    | **Enabled**                          |
| Automatically delete head branches  | **Enabled**                          |

### Branch protection for `main`

One standard covers every org in the enterprise: `nyuchi`,
`mukoko-dev`, `mzizi-dev`, `shamwari-ai`, `bundu-labs`, `openNTL` and
`siafuDB`. It has four layers:

1. **One enterprise ruleset**, `enterprise-main-protection`, set on the
   `bundu-labs` enterprise and **active** on the default branch of every
   repo in every org (except `sandbox-*` and `archive-*`). It holds the
   floor: pull request required with **0** approvals, no force pushes, no
   deletion. Linear history is not required on the default branch (see
   _Merges_ below). It carries no status checks.
2. **One org ruleset per org**, `org-wide-main-protection`, the same in
   every org. It repeats the floor and adds what the enterprise does
   not: the five required lint status checks and a "Require workflows to
   pass" rule naming that org's
   `<org>/.github/.github/workflows/org-lint.yml`. Its JSON (as applied
   to `nyuchi`) is
   [`github-rulesets/org-wide-main-protection.json`](https://github.com/nyuchi/.github/blob/main/github-rulesets/org-wide-main-protection.json).
3. **At most one repo ruleset per repo**, named `repo-ci`, holding only
   that repo's own CI checks (and a `merge_queue` rule where one
   already exists). A repo ruleset never repeats the org's rules and
   never sets reviews or merge methods, because a narrower repo-level
   list silently overrides the org's.
4. **No classic branch protection** on any default branch. Rulesets
   are the single source of truth.

The org ruleset (**Settings → Rules → Rulesets**):

| Rule                                                             | Value                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Target                                                           | The default branch of every repo except `sandbox-*` and `archive-*` |
| Bypass                                                           | Organisation admins, always                                         |
| Restrict deletions                                               | **Enabled**                                                         |
| Block force pushes                                               | **Enabled**                                                         |
| Require linear history                                           | **Disabled** on the default branch                                  |
| Require a pull request before merging                            | **Enabled**                                                         |
| Required approving reviews                                       | **0** (pre-scale solo-developer phase)                              |
| Dismiss stale pull request approvals when new commits are pushed | **Disabled**                                                        |
| Require review from Code Owners                                  | _Deferred_ until ≥ 2 engineers with merge rights                    |
| Require approval of the most recent reviewable push              | _Deferred_ until ≥ 2 engineers with merge rights                    |
| Require approval for unattributed changes                        | **Disabled** (it asks for an approval a solo owner cannot give)     |
| Require conversation resolution before merging                   | **Enabled**                                                         |
| Allowed merge methods                                            | **Merge, squash**                                                   |
| Require status checks to pass                                    | **Enabled** — the five lint checks below                            |
| Require workflows to pass                                        | **Enabled** — `<org>/.github/.github/workflows/org-lint.yml`        |
| Require branches to be up to date before merging                 | **Enabled**                                                         |
| Require signed commits                                           | **Not a ruleset rule.** Signing is policy (see `CONTRIBUTING.md`).  |

> **Pre-scale reviewer posture.** The reviewer count is **0**
> during the solo-developer phase, per NA-01 Article 4.2 (flat
> structure, pre-scale reality). Every PR still goes through the
> pull-request flow, CI gates, DCO sign-off and
> conversation-resolution gates — just without an external
> reviewer because there isn't one yet. As soon as a second
> engineer with merge rights joins the org, the ruleset flips
> back to `required_approving_review_count: 1`, with `.github`,
> security, and infra repositories rising to `2` per the original
> design. The trigger is documented in NA-01 Article 10.1 (the
> transition to formal divisional structure).

**Merges.** The estate is trunk-based: every PR targets the default branch
and every merge there is a release (see _Automatic releases_). There is no
`staging` branch. The `staging` rulesets and the promotion design in
`settings/` are historical and apply to no repo.

#### Required status checks

Every adopter calls the org's reusable workflows. Status check
names take the form `<caller-job-name> / <reusable-job-name>`. By
convention, every repo names its caller job after the workflow
purpose so the contexts read sensibly.

**Lint — required on every repo, no exceptions.** Lint is an
**org-required workflow**: each org ruleset's "Require workflows to
pass" rule names `<org>/.github/.github/workflows/org-lint.yml`, so
GitHub runs it on every pull request in every repo of the org. A repo
needs **no `lint.yml` of its own and no lint config files**: the
org-lint job calls `nyuchi/.github`'s `reusable-lint.yml`, which uses a
repo's own `.prettierrc`, `.prettierignore`, `.markdownlint.jsonc` or
`.yamllint.yaml` where present and falls back to the canonical copies in
this repository where not. Its job is named `lint`, so it publishes:

- `lint / actionlint`
- `lint / JSON validity`
- `lint / prettier`
- `lint / markdownlint`
- `lint / yamllint`

These five run on every PR to every repo and are blocking. CI
does not auto-fix; the developer fixes locally and pushes.

**Per-repo CI — required where applicable** (caller-job names
shown are conventions; the second segment is the reusable-job
name and is fixed):

- `pr-title / Conventional Commits` — from `reusable-pr-title-lint.yml`
- `dep-review / Review dependencies` — from `reusable-dependency-review.yml`
- `codeql / Analyze (*)` — from `reusable-codeql.yml`, per enabled language
- The primary CI job(s) — from whichever of
  `reusable-ci-nextjs-monorepo.yml`,
  `reusable-ci-rust-monorepo.yml`,
  `reusable-ci-python-monorepo.yml`, or
  `reusable-ci-docs-mdx.yml` the repo uses.

**Supply-chain and security gates added per-stack:**

- `ci / pnpm audit` — from `reusable-ci-nextjs-monorepo.yml` (moderate+ CVEs
  fail the PR; matches `dependency-review` but uses the pnpm lockfile directly)
- `ci / pip-audit` — from `reusable-ci-python-monorepo.yml` (scans the
  exported `uv` lockfile against PyPI advisory DB)
- `ci / cargo deny` — from `reusable-ci-rust-monorepo.yml` (advisories, bans,
  licence compliance, source verification; requires `deny.toml` in the repo root)

### Tag protection

- Tags matching `v*` require **admin** or
  `@nyuchi/maintainers` team approval to create, move, or
  delete. Prevents accidental release-tag rewrites.

---

## Secrets and tokens

### Org secrets (available to all repos by default)

| Name          | Used by                  | Source              |
| ------------- | ------------------------ | ------------------- |
| `TURBO_TOKEN` | `ci-nextjs-monorepo.yml` | Vercel Remote Cache |
| `TURBO_TEAM`  | `ci-nextjs-monorepo.yml` | Vercel Remote Cache |

**No long-lived cloud credentials** (AWS keys, GCP service-account
JSON, Cloudflare API tokens) should be stored as org or repo
secrets. Use OIDC federation with the cloud provider and scope
the trust policy to specific repos + branches + environments.

### Dependabot

Dependabot cannot read regular Actions secrets. If a Dependabot-
triggered workflow needs a secret, configure it at **Settings →
Secrets and variables → Dependabot**, and prefer narrowly-scoped
tokens.

---

## Enforcement and audit

- **Rulesets:** branch and tag protection is enforced via GitHub
  Rulesets, not legacy branch-protection rules. The definitions live
  in [`github-rulesets/`](https://github.com/nyuchi/.github/tree/main/github-rulesets) in this repo:
  - `org-wide-main-protection.json` — the org ruleset described in
    §Branch protection for `main`, the same in every org apart from
    the `workflows` rule's repository id.
  - `release-tag-protection.json` — applied to `nyuchi/.github`
    (protects `v*.*.*` tags). Tag and push rulesets are outside the
    branch standard and are left as they are.

  There is no per-repo copy of the org rules. The former
  `main-branch-protection.json` repeated them for `nyuchi/.github`
  and narrowed merges to rebase only; it is removed from the
  standard, and the live copy is deleted when the standard is
  applied.

  The standard is applied across the orgs by the owner's
  rollout script (dry run by default), which also removes duplicate
  repo rulesets and classic protection. To update one org ruleset by
  hand, PUT the JSON to the existing ruleset's id:

  ```sh
  gh api orgs/nyuchi/rulesets --jq '.[] | [.id, .name] | @tsv'
  gh api --method PUT /orgs/nyuchi/rulesets/<id> \
    --input github-rulesets/org-wide-main-protection.json
  ```

  The org ruleset JSON names `nyuchi/.github` by `repository_id` in its
  `workflows` rule. Each org's live ruleset points at its own
  `<org>/.github` repository instead, so swap the id before applying the
  file to another org.

  The `enterprise-main-protection` ruleset is set on the `bundu-labs`
  enterprise (**Enterprise settings → Policies → Code → Rulesets**) and
  is **active** across every org. It holds pull request (0 approvals),
  linear history, no force push and no deletion; status checks and the
  required lint workflow live only in each org ruleset.

- **In progress — infrastructure as code:** migrating org and repo
  configuration to OpenTofu (the open-source Terraform fork) using
  the `integrations/github` provider. When complete this document
  becomes a generated artifact rather than hand-maintained prose.
  Target: all new repos provisioned via `tofu apply` by Q3 2026.
  The `reusable-ci-opentofu.yml` reusable workflow supports this.
- **Quarterly audit (automated):** a GitHub Actions scheduled workflow
  (`.github/workflows/scheduled-settings-audit.yml`) opens a GitHub
  Issue on the first day of every quarter with a checklist of items to
  verify. Close the issue once the audit is complete and any drift has
  been corrected.

---

## Artifact provenance and supply-chain security

### SLSA provenance (SLSA L2)

Every release attaches a **GitHub Artifact Attestation** (SLSA L2
provenance) signed with a short-lived OIDC token via Sigstore. This is
generated automatically by the `attestations` step in
`reusable-release.yml` and by the standalone
`reusable-slsa-provenance.yml` workflow.

Attestations can be verified by any user with read access to the
repository:

```sh
gh attestation verify <artifact-file> --repo nyuchi/<repo>
```

Each release also ships a `SHA256SUMS` file covering all attached
release assets. Consumers must verify this file against the attestation
before executing any release artifact.

### OpenSSF alignment

The organisation targets the following OpenSSF / SLSA milestones:

| Practice                              | Target                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| SHA-pinned Actions (supply-chain)     | **Enforced** — NA-03 §7.1.1                              |
| SBOM on every production release      | **Enforced** — NA-03 §7.2, `reusable-sbom.yml`           |
| Artifact provenance (SLSA L2)         | **Enforced** — `reusable-release.yml` + attestation step |
| OIDC federation for cloud credentials | **Required** — see §Secrets and tokens below             |
| Dependency review on every PR         | **Enforced** — `reusable-dependency-review.yml`          |
| Secret scanning (all patterns)        | **Enabled** — org-wide                                   |
| Signed commits on `main`              | **Policy** — not enforced by a ruleset                   |
| OpenSSF Scorecard                     | **Available** — `reusable-openssf-scorecard.yml`         |
| SLSA L3 (hermetic builds)             | Planned — requires isolated build runners                |

### Reusable workflow versioning and rollback

Consuming repos reference reusables at `@main`, so changes propagate
instantly on the next CI run. To avoid a broken change from silently
affecting every downstream repo:

1. **Test in isolation first.** Always run the reusable's own
   `lint.yml` CI before merging to `main`.
2. **Use feature flags via workflow inputs.** New behaviour is opt-in
   (`default: false`) for at least one release cycle before becoming
   the default.
3. **Rollback procedure.** If a merged change breaks downstream repos:
   - Open a hotfix branch in `nyuchi/.github`.
   - Revert the offending commit.
   - Merge immediately (no waiting for the normal review bar if the
     regression is confirmed and the Founder approves — per NA-01
     Article 6.1(a)).
   - Notify affected repo maintainers via a GitHub Issue.
4. **Versioned refs (planned).** Long-term, critical consumers should
   reference a `@v1`, `@v2` tag rather than `@main` to opt into
   upgrades deliberately. This is tracked as a future enhancement.

---

## OIDC federation for cloud credentials

Long-lived cloud API keys (AWS, GCP, Cloudflare, Fly.io) must **not**
be stored as GitHub secrets. Use OIDC federation so workflows obtain
short-lived tokens at runtime. The trust policy must be scoped to
specific repositories, branches, and environments.

### Cloudflare example

```yaml
- name: Authenticate to Cloudflare via OIDC
  uses: cloudflare/cloudflare-action@v1   # pin to SHA per NA-03 §7.1.1
  with:
    api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}  # narrow-scope token
```

For a Cloudflare Workers deployment the preferred approach is Wrangler
with a scoped API token generated from a service account, not a Global
API key.

### Fly.io example

```yaml
- name: Deploy to Fly.io
  env:
    FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}   # deploy-only token
  run: flyctl deploy --remote-only
```

Generate the `FLY_API_TOKEN` via `fly tokens create deploy` — this
creates a token scoped to deploy operations only, not account admin.
Store it as a repository- or environment-level secret, never as an
org-level secret unless the token legitimately covers all repos.

### AWS / GCP (future)

When Nyuchi services expand to AWS or GCP, use OIDC federation:

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v4   # pin to SHA
    with:
      role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
      aws-region: af-south-1
      role-session-name: GitHubActions
```

Document the trust policy (`aud`, `sub` conditions) in the Terraform
module for that environment.

---

## Supply chain security

### Container signing and verification

All OCI images built and published by Nyuchi repos must be:

1. **Scanned** by Trivy (CRITICAL + HIGH severity — exit-code 1) before push.
2. **Signed** with cosign keyless signing using the `reusable-ci-container.yml`
   reusable workflow.
3. **Verified** by consumers: `cosign verify --certificate-oidc-issuer
https://token.actions.githubusercontent.com --certificate-identity-regexp
'https://github.com/nyuchi/'`.

The OIDC issuer and identity regexp above act as the trust anchor —
only images built by a GitHub Actions workflow in the `nyuchi` org
will verify successfully. Do not use a long-lived cosign key.

### SLSA provenance

All published releases must include SLSA level 2 provenance
attestations (enforced today — see "SLSA provenance (SLSA L2)"
above):

- The `reusable-release.yml` reusable workflow already attaches a
  CycloneDX SBOM (NA-03 §7.2).
- Container images built by `reusable-ci-container.yml` include
  BuildKit-generated SBOM and provenance via `sbom: true` and
  `provenance: true` in the build step.
- For binary releases (Rust crates, Python wheels, JS packages),
  add SLSA provenance via `slsa-framework/slsa-github-generator`
  when the toolchain supports it.

### Trivy IaC scanning

All OpenTofu / Terraform configurations must be scanned with Trivy
in `config` mode (CRITICAL + HIGH). The `reusable-ci-opentofu.yml`
reusable workflow does this automatically. SARIF results appear in
each repo's GitHub Security tab.

### Automatic releases

Every 15 minutes, `Auto release` (`.github/workflows/auto-release.yml`)
runs `scripts/auto-release-prs.sh` for each of the seven orgs. For every
repo (not archived, not `sandbox-*`/`archive-*`):

- Where the default-branch tip is untagged, it is tagged (a `feat` is a
  MINOR, anything else a PATCH) and published as the latest GitHub
  release, as the enterprise-owned **bundu-release** GitHub App — the
  app's private key lives only in the `org-release` environment, which
  only `main` can deploy from. Repos that tag their own releases
  (`main-release.yml`, or `release.yml` calling `reusable-trunk-release.yml`)
  are skipped.

A MAJOR is only ever made by hand. A repo opts out with the
`AUTO_RELEASE=off` repository variable.

### Hourly repo bootstrap

Every hour at :23, `Bootstrap repos`
(`.github/workflows/bootstrap-repos.yml`) runs
`scripts/bootstrap-repos.sh` for each org: every repo has a default
branch, the standard merge
settings, immutable releases, the standard labels, and the standard
files — missing files are proposed in one pull request, never pushed
directly. Run it by hand from the Actions tab for an instant fix.

---

## All checks green, required everywhere

Owner decision (2026-11-17): nothing merges while any check is red or orange,
in every repository. `.github/workflows/all-checks-green.yml` is the one gate:
it waits on every other check run and commit status on the commit under test
and fails on anything red, or anything still pending after 40 minutes. It is
required through the same "Require workflows to pass" rule as Org lint, so the
`All checks green` context exists in every repository with no per-repo file.

1. Merge `all-checks-green.yml` to `main` here (the rule points at `main`).
2. Copy that file verbatim to each organisation's own `<org>/.github` main:
   GitHub rejects a required workflow sourced from another organisation, even
   a public repository, so each org carries its own copy.
3. Each organisation: `settings/require-all-green.sh <org> ...` to see the
   change, then again with `--apply`. It needs an org admin.
4. Remove any per-repository `all-green.yml` copies, so the context does not
   run twice.

---

## Related documents

- [Contributing](/engineering/contributing/) — the rules branch protection enforces.
- [Engineering guide](/engineering/guide/) — agent-specific additions to those rules.
- [`.github/CODEOWNERS`](https://github.com/nyuchi/.github/blob/main/.github/CODEOWNERS) — the review routing that pairs with "Require review from Code Owners".
- [`SECURITY.md`](https://github.com/nyuchi/.github/blob/main/SECURITY.md) — vulnerability reporting workflow that depends on "Private vulnerability reporting" being enabled.
