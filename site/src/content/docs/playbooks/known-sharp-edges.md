---
title: Known sharp edges
description: "Operations playbook: known sharp edges."
sidebar:
  label: Known sharp edges
---

| Symptom                                                   | Fix                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Publish dispatched from `main` is refused                 | By design: `release` accepts only `v*` tags. Dispatch with `--ref v<version>`.                                     |
| Interop tests fail in CI instead of skipping              | Intended. `AGE_INTEROP_OPTIONAL=1` is set only where a separate pinned job already ran them; install the binary.   |
| Title lint rejects a title containing a period            | An old pin of `reusable-pr-title-lint.yml`; the current pattern only bars a leading capital and a trailing period. |
| Dependabot restores its title on rebase                   | Set `commit-message.prefix: build` in `dependabot.yml`; re-check the title after any rebase.                       |
| Stale "Workers Builds" check after a Cloudflare migration | Disconnect the old Git connection in Cloudflare (owner); do not fix the token. `all-checks-green.yml` skips them.  |
| `gh pr merge` returns, PR still open                      | On a merge-queue repo it only enqueues. Poll the PR state; do not repeat it.                                       |
| Required check never reports on a queued PR               | The workflow must trigger on `merge_group:`; jobs that need a PR skip themselves there.                            |
| Tag exists but no tag workflow ran                        | A `GITHUB_TOKEN` tag starts nothing. Use the `bundu-release` app path; never push a tag by hand to force it.       |
