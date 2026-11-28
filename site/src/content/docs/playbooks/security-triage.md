---
title: Security triage
description: "Operations playbook: security triage."
sidebar:
  label: Security triage
---

## Code-scanning alerts: fix, do not bulk-dismiss

- **Fix the code.** Dismissal is the exception, never a sweep.
- **Every dismissal is one alert at a time**, with an individually justified
  verdict and a written reason naming the code and why it is unreachable or
  harmless. Allowed reasons: `false positive`, `used in tests`, `won't fix`.

```sh
gh api -X PATCH repos/<o>/<r>/code-scanning/alerts/<n> \
  -f state=dismissed -f dismissed_reason='false positive' \
  -f dismissed_comment='<file and line, and why it cannot be exploited>'
```

- **A separate reviewer agent re-reviews every dismissal independently**,
  from the alert and the code, not the author's verdict. The first batch on
  2026-11-28 needed **three alerts reopened** and exposed an
  **account-takeover bug**. Reopen with `-f state=open`.
- Patterns found: **`js/bad-tag-filter`** (a regex that matches HTML tags
  misses variants such as `</script >`; use a parser or sanitizer, not a
  regex) and **`js/redos`** / **`js/polynomial-redos`** (nested or overlapping
  quantifiers on user input; make the pattern linear, bound the input, or
  drop the regex).

## Secret-scanning alerts: metadata only

The list API returns a `secret` field. **Never print it**; always select
fields:

```sh
gh api repos/<o>/<r>/secret-scanning/alerts \
  --jq '.[] | {number, state, secret_type_display_name, created_at, html_url}'
```

Read the metadata, tell the owner the credential type and location, and
**the owner rotates the credential**. Only then close the alert
(`-f state=resolved -f resolution=revoked`). A value never goes into chat, an
issue, a commit or a PR.

## Never weaken a check

No `ignore`, allowlist, `continue-on-error`, `--no-verify`, lowered severity
or disabled workflow to get green. **Advisories are fixed by upgrading.** A
waiver is an org decision (`AUDIT_ALLOW_GHSAS`, with a reason and a review
date), never a repo's own. `deny.toml` keeps `ignore = []` unless the owner
decides, per advisory ID.

## cargo-deny: pinned version

Repos install a pinned cargo-deny release binary and check its published
SHA-256 (`.github/workflows/supply-chain.yml`, the `VERSION` variable).
Dependabot does not bump it, because it is not an action. If `cargo deny`
**errors** (cannot load the advisory database) rather than reporting an
advisory, suspect the pin: raise `VERSION`, keep the checksum step, re-run. An
advisory is fixed by upgrading the dependency.
