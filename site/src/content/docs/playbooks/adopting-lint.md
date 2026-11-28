---
title: Adopting the org lint gate
description: "Turn on the org lint gate in a repository: the caller, the config files, the five contexts, reproducing CI locally and fixing violations."
sidebar:
  label: Adopting lint
---

Every repository in `nyuchi`, `mzizi-dev`, `shamwari-ai`, `mukoko-dev`
and `bundu-labs` runs the same lint gate, from a single copy of the
policy in this repository. This page is how you turn it on.

## Why one copy, in `nyuchi/.github`

A **public** reusable workflow can be called from any repository, in any
organisation, public or private. This repository is public, so all five
orgs call the same file. That is proven in production, not assumed:
private `bundu-labs/marketing` calls
`nyuchi/.github/.github/workflows/reusable-lint.yml` and publishes all
five contexts green.

Because cross-org calling works, there is exactly **one** copy of the
lint policy. Do not fork `reusable-lint.yml` into
`mzizi-dev/.github`, `shamwari-ai/.github`, `mukoko-dev/.github` or
`bundu-labs/.github`. Five copies with nothing comparing them is how an
estate ends up with five subtly different gates.

## Step 1 - the caller

Create `.github/workflows/lint.yml`. This is the whole file, identical
in every repository, with nothing to customise:

```yaml
name: Lint

on:
  pull_request:
  push:
    branches: [main, master, scaffold]
  merge_group:
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read

jobs:
  lint:
    uses: nyuchi/.github/.github/workflows/reusable-lint.yml@main
```

Two things in that trigger list are load-bearing and must not be edited
per repo:

- **`pull_request:` carries no `branches:` filter.** That filter matches
  the PR's _base_ branch, so adding one silently stops the gate emitting
  in any repo whose default branch is not `main` - `shamwari-core`,
  `shamwari-gateway`, `shamwari-web` (`scaffold`) and `siafudb-kuzu`
  (`master`).
- **The `push:` branch list names every default branch in the estate.**
  68 repos use `main`, `siafudb-kuzu` uses `master`, and
  `shamwari-core`/`-gateway`/`-web` use `scaffold`. Drop a name and
  merging to that repo's default branch fires nothing, so the contexts
  never land on the default-branch head. It is a list rather than a bare
  `push:` because unfiltered push would run the gate on every
  feature-branch push in 74 repos and bill it twice per PR.
- **`merge_group:`** is what makes the gate work in a repo whose ruleset
  uses a merge queue. Required checks must report on the
  `gh-readonly-queue/**` ref and only `merge_group` produces that;
  without it a queued PR stalls for the full `check_response_timeout`
  and nothing can land. Harmless where there is no queue.

It is also offered in the GitHub UI under **Actions -> New workflow ->
Org lint gate**, from `workflow-templates/lint.yml`.

## Step 2 - the config files

Copy these four files from this repository's root into yours, unchanged:

| File                  | Used by      |
| --------------------- | ------------ |
| `.prettierrc`         | prettier     |
| `.prettierignore`     | prettier     |
| `.markdownlint.jsonc` | markdownlint |
| `.yamllint.yaml`      | yamllint     |

`.editorconfig` is recommended but not required by the gate.

## `.jsonlintignore` (rare, and visible)

`lint / JSON validity` parses every `.json` and `.jsonc` file. If your
repo contains files that are **not** single JSON documents and should not
be - NDJSON, gzipped fixtures with a `.json` name, deliberately
malformed test inputs - list them in a repo-root `.jsonlintignore`,
gitignore-style. Absent by default; most repos never need one.

It is deliberately hard to hide behind. The file is printed **verbatim**
in every run, the log always reports `checked N ... skipped M`, and if
the patterns exclude _every_ JSON file the job fails outright with
"a gate that inspects nothing cannot fail". That is not a tunable
threshold - it is the difference between a check and a decoration.
`nhimbe` shipped a `.prettierignore` containing only `*` for months, and
its `lint / prettier` passed every time without opening a file.

Use it for fixtures you do not own. Do not use it to silence a file you
could fix.

## The five contexts

The job must be named `lint` and must _call_ the reusable workflow. A
check publishes as `<caller job name> / <called job name>`, which is how
these exact strings appear:

```text
lint / actionlint
lint / JSON validity
lint / prettier
lint / markdownlint
lint / yamllint
```

A matrix strategy publishes `lint (actionlint)` instead and will **not**
satisfy `nyuchi/org-wide-main-protection`. Keep the caller as written.

## Reproducing CI locally

Pin the same versions CI pins, so a clean local run and a clean CI run
mean the same thing:

```bash
npm install --global prettier@3.9.4 markdownlint-cli2@0.23.2
pip install yamllint==1.38.0
# actionlint 1.7.12

actionlint .github/workflows/*.yml
prettier --check --config .prettierrc --ignore-path .prettierignore \
  "**/*.{md,mdx,json,jsonc}"
markdownlint-cli2 "**/*.md" "!**/node_modules/**"
yamllint -s .
```

`lint / JSON validity` parses `.json` with **two** parsers, chosen by
filename. Ordinary `.json` files are parsed strictly. Files that are JSONC
_by specification_ are parsed as JSONC, because they are allowed to carry
comments and trailing commas and a strict parser is simply the wrong tool
for them:

- `tsconfig*.json`, `jsconfig*.json`
- `.vscode/*.json`
- `devcontainer.json`, `.eslintrc.json`
- anything named `*.jsonc`

A genuine syntax error in one of those still fails the job - nothing is
exempted. Do **not** delete a comment from a `tsconfig.json` to make this
check pass; that was never the bug.

Two traps this gate has already been bitten by, both now fixed here:

- **`markdownlint-cli2-action` floats its bundled ruleset.** Bumping the
  action silently enabled `MD060`, which failed in CI and passed
  locally. The reusable now installs a pinned `markdownlint-cli2`
  instead, so the version is a number you can copy.
- **Prettier resolves a nested `.prettierrc` per file.** A sub-app with
  its own config that names a plugin — `nyuchi-identity`'s
  `apps/auth-ui` declares `prettier-plugin-svelte` — killed the entire
  job, not just that subtree, because the gate installs prettier globally
  and never runs `npm ci`. The reusable now passes `--config .prettierrc`
  so only the repo-root config governs the gate. A sub-app keeps its own
  `.prettierrc` for its own scripts and editors; it just cannot redefine
  the org gate from a subdirectory. Files under it are still linted.
- **Prettier 3 reads `.gitignore` as an ignore file.** `mukoko-home`'s
  `.gitignore` contained `claude.md`, which silently exempted the
  tracked `CLAUDE.md` from `prettier --check` - a green gate that never
  looked at the file. The reusable now passes `--ignore-path
.prettierignore` explicitly, so `.prettierignore` is the only ignore
  file that applies, and it prints any tracked file `.gitignore` would
  have hidden.

## Fixing violations: two things that will bite you

**Never run `prettier --write` blind on `.mdx`.** Prettier 3.9.4's mdx
parser rewrites a multi-line `{/* ... */}` comment into `{/_ ... _/}` -
it reads the `*` as markdown emphasis and emits invalid MDX. The
formatter actively breaks the file. Single-line comments round-trip
fine, so rewrite an affected comment as a run of single-line
`{/* ... */}` comments: same text, valid MDX, prettier leaves it alone.
Always diff an `.mdx` file after `--write`.

**A file with a `.md` extension that is not Markdown will be silently
corrupted.** `mzizi-registry` ships
`components/registry/n8-assurance/accessibility-audit.md`, which is
actually SQL - it is installed into consumers as documentation. Its
`/* ... */` banner parses as Markdown emphasis, so MD037 fires and
`prettier --write` rewrites `/*` to `/_` and `*/` to `_/`. The autofix
does not fail the gate: it rewrites a shipped artifact into invalid SQL
and then passes green. The fix is to wrap the body in a fenced code
block, which leaves the content byte-for-byte unchanged, satisfies both
tools, and makes the installed document render as code. Before running
`--fix` over a repo, look at what its `.md` files actually contain.

**A `.md` file containing MDX comments cannot satisfy both toolchains,
and `--fix` will corrupt it.** Mintlify starters leave `{/* ... */}` in a
file named `AGENTS.md`. Mintlify parses that file as MDX, where an HTML
comment is a parse error; markdownlint and Prettier read the same file as
Markdown, where the asterisks are emphasis - MD037 fires and Prettier
rewrites the marker to `_`. No spelling satisfies both. Worse,
`markdownlint-cli2 --fix` pairs the asterisks across adjacent comment
lines and emits `{/*Add product-specific terms and preferred usage _/}`,
which is neither valid MDX nor what anyone wrote. Decide which toolchain
owns the file: add it to `.mintignore` and use ordinary HTML comments, or
rename it to `.mdx`.

**`markdownlint-cli2 --fix` will not fix MD036.** Emphasis used as a
heading needs a judgement call, not a rewrite. A bold line introducing a
subsection should become a real heading one level below its parent; a
sign-off or attribution in italics is not a heading at all and should
become a blockquote. Converting the second kind into a heading produces
a correct linter and a wrong document.

## Language-specific CI

This gate is the shared baseline that every repository can satisfy.
Rust, typecheck, build, test and deploy jobs stay in the repository's
own `ci.yml`. Do not add them here.

## Moving to Vite+ (in progress, one org at a time)

[`reusable-vite-plus.yml`](https://github.com/nyuchi/.github/blob/main/.github/workflows/reusable-vite-plus.yml) is
the successor to the `prettier` and `JSON validity` jobs. It publishes
`vite-plus / fmt` (oxfmt over tracked `.md`, `.mdx`, `.json` and `.jsonc`
files, in every repo) and, for repositories with a root `package.json`,
`vite-plus / check`, `vite-plus / test` and `vite-plus / build`. A repo
without a `package.json` still reports all four, as passes.

`.oxfmtrc.json` is the canonical format config, with the same settings
as `.prettierrc`. `actionlint`, `yamllint` and `markdownlint` are not
replaced: Vite+ does not read YAML, and formatting is not a rule set.

Each org moves in the order in that file's MIGRATION section. The
`prettier` and `json-validity` inputs of this lint workflow let an org
that has finished stop running the retired jobs; leave them at their
default until the org's ruleset requires the `vite-plus /` contexts.
