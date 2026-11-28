---
title: Release procedure
description: "Operations playbook: release procedure."
sidebar:
  label: Release procedure
---

## 3.1 How tagging works

Every merge to `main` is a release; the merged PR's title decides the bump
(`fix:`, `chore:`, `docs:`, `ci:` patch; `feat:` minor). Nobody labels a PR.

1. A repo's `.github/workflows/release.yml` calls
   `nyuchi/.github/.github/workflows/reusable-trunk-release.yml@<40-hex>`,
   pinned by SHA. It reads the merged PR's title, computes the next version
   (the `next-version` action) and pushes an annotated `v<version>` tag and a
   GitHub release with generated notes.
2. A tag pushed with the run's `GITHUB_TOKEN` starts **no** downstream
   workflow. Repos with no release workflow of their own are tagged every 15
   minutes by `auto-release.yml`, as the enterprise `bundu-release` app (its
   key lives only in the `org-release` environment); app tags do start
   `on: push: tags` workflows. `AUTO_RELEASE=off` opts a repo out.
3. A **major** is made by hand, by the owner: the repo's release workflow
   from the Actions tab with `bump: major`. A `feat!:` or `fix!:` title is
   refused on purpose. Agents never set a major and never renumber a release.

Check a merge's result with `gh release list -R <owner>/<repo> --limit 3`.

## 3.2 npm packages

Reference: `mzizi-dev/mzizi-cli/.github/workflows/release.yml`.

- **Trusted publishing over OIDC; no `NPM_TOKEN`.** The package's trusted
  publisher on npmjs.com names the repo and workflow file. The job runs in
  the `release` environment with `id-token: write`, npm 11.5.1 or newer, and
  no `registry-url` (the OIDC token must be the only credential).
- It runs on a `v*` tag and first checks the tag equals the version in
  `package.json` (and `Cargo.toml`, where there is one).
- Publish with provenance; skipping a version already on the registry makes
  a re-run safe:

```sh
npm view "<package>@<version>" version >/dev/null 2>&1 \
  || npm publish --access public --provenance
```

- `actions/download-artifact` drops file modes: restore executable bits and
  check `npm pack` plus `tar -tvzf` before publishing.
- **Post-publish smoke test**, a job after publish on `ubuntu-latest`,
  `macos-latest` and `windows-latest`: in a clean `mktemp -d`, wait until
  `npm view` serves the version (minutes, not seconds), `npm install` it, run
  the binary and compare the printed version.
- **If the smoke test fails, the version is public: ship a patch release.**
  Never unpublish. **Never `npm deprecate` unless the owner asks.**

## 3.3 crates.io

A crates.io version is **irreversible**: yankable, never replaceable or
deletable. Every publish is a one-way door.

- **Name every crate with its project identity prefix:** `bundu-*`,
  `mzizi-*`, `nyuchi-*`. A rename is a new crate (`age-hybrid` became
  `bundu-age-hybrid`). Never publish an unprefixed name.
- **Dry run first, always:**

```sh
cargo publish --dry-run --locked
cargo package --list --locked
```

`cargo package --list` must show **no** `fuzz/`, tests, CI files or secrets;
fix `exclude` or `include` in `Cargo.toml` and list again.

- **Publish workflow** (reference: `bundu-labs/age-hybrid/.github/workflows/publish.yml`):
  manual `workflow_dispatch` with `version` (the tag without the `v`) and
  `dry_run` (default true). It checks out `v<version>` and fails unless
  `Cargo.toml` and `CHANGELOG.md` agree with the tag.
- **Run it with `--ref v<version>`.** The `release` environment accepts only
  `v*` tags and refuses a branch, so a dispatch from `main` is rejected by
  design. Dry run, review, then the real one:

```sh
gh workflow run publish.yml -R <owner>/<repo> --ref v<version> \
  -f version=<version> -f dry_run=true
gh workflow run publish.yml -R <owner>/<repo> --ref v<version> \
  -f version=<version> -f dry_run=false
```

- **The publish gate** needs green CI on the tagged commit: the job reads
  `repos/<repo>/commits/<sha>/check-runs` and fails closed on any named check
  that is missing, running or not `success`.
- **The token lives in the repo's `release` environment** as
  `CARGO_REGISTRY_TOKEN`, entered by the owner, never in chat. Confirm it
  exists by name only:
  `gh api repos/<owner>/<repo>/environments/release/secrets --jq '.secrets[].name'`.
- **After the first publish, switch to crates.io trusted publishing** (the
  crate must exist first, which is why release one uses the token), then
  remove the token and the `# zizmor: ignore[use-trusted-publishing]` marker.
- Workspaces publish in dependency order and skip versions already on
  crates.io (`mzizi-registry`'s `publish-crates.yml`). A new crate can hit
  HTTP 429; wait and re-run.

## 3.4 Homebrew tap and clean-directory verification

Repo `mzizi-dev/homebrew-tap`, formula `Formula/mz.rb`. Each `mzizi-cli`
release publishes `SHA256SUMS` next to the platform binaries.

1. In `Formula/mz.rb`, change `base` (the release tag) and the four `sha256`
   values (macOS arm and Intel, Linux arm and Intel), copying each hash from
   `SHA256SUMS`; never type one by hand.
2. In the PR: `brew audit --strict mzizi-dev/tap/mz` and
   `brew test mzizi-dev/tap/mz`.
3. After merge, verify from a **clean directory**, never a source checkout:
   `brew install mzizi-dev/tap/mz && mz --version`, then
   `npm install @nyuchi/mzizi-cli@<v>` and
   `cargo install mzizi-cli --version <v> --locked`. Each must run and print
   the released version.
