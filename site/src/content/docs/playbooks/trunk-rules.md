---
title: Trunk-based estate rules
description: "Operations playbook: trunk-based estate rules."
sidebar:
  label: Trunk-based estate rules
---

Source: [`AGENTS.md`](/engineering/guide/) (Versioning, GitHub environments, Branch
ownership) and [`CONTRIBUTING.md`](/engineering/contributing/).

- **Default branch is `main`.** No `staging` branch, environment or workflow.
  A repo that still has one gets it deleted by the owner, not by an agent.
- **Only three GitHub environments:** `release` (tag-triggered publishing),
  `production` (deploys), `publish` (docs and pages). Restrict `release` and
  `production` to `v*` tags, plus `main` where a deploy runs on push. No
  required reviewers. `repo-standards.yml` warns on any other name;
  environments that Vercel, GitHub Pages and similar apps create are theirs.
- **Every change is a PR linked to an issue:** `Closes #n`, `Refs #n` or
  `No issue: <reason>` in the description (the `issue attached` check).
- **Squash through the merge queue** with the plain command: no strategy
  flag, no `--admin`, never past a ruleset.

```sh
gh pr merge 123
```

On a merge-queue repo this only **enqueues**. Poll
`gh pr view 123 --json state,mergedAt` and never repeat the merge. (`--auto`,
the form `AGENTS.md` shows, enqueues the same way while checks are pending.)
Merge only when every check is green: red and orange (queued, in progress)
block; skipped counts as green.

- **PR title** (`reusable-pr-title-lint.yml`): a Conventional Commits type
  (`feat fix perf refactor docs test build ci chore revert style`), then a
  subject that **starts lowercase** and **does not end in a period or space**
  (`^(?![A-Z]).*[^. ]$`). Periods inside are fine, so version numbers work:
  `chore(release): rename the package, 0.2.4`.
- **`CHANGELOG.md`:** every PR adds an entry under `## [Unreleased]` in any
  repo that has one (the Mzizi repos enforce it in CI; `nyuchi/.github` has
  none).
- **Pin every third-party action to a 40-character SHA** with the tag in a
  trailing comment. Resolve it first (an annotated tag needs one more
  dereference through `git/tags/<sha>`):

```sh
gh api repos/<owner>/<repo>/git/refs/tags/<tag> --jq '.object.sha'
```

- **One writer per branch.** Work on your own branch (`claude/<topic>`) and
  worktree or clone under `$TMPDIR`; never push to another session's branch.
- **Commits** are signed (`-S`), DCO signed off (`-s`) with the human
  operator's identity, and end with the attribution trailer you were given.
