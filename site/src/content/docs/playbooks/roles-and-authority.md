---
title: Roles and authority
description: "Operations playbook: roles and authority."
sidebar:
  label: Roles and authority
---

The **orchestrator** decides everything below a major-version release and
delegates the work to **sub agents**, each with one scoped job.

**Always the owner's call** (the orchestrator prepares, never decides):

- A major-version release (`bump: major`), run from the Actions tab.
- Any credential: creating, rotating, revoking, entering or reading one.
- DNS, Cloudflare, Fly and Coolify infrastructure.
- Deleting a resource: repo, branch, environment, secret, release, package.
- Anything the permission classifier refuses.

## Classifier denials

A denial is the answer, not an obstacle.

1. Stop. Do not retry, rephrase, split the command, loop it, or reach the
   same effect another way.
2. Report the **exact command** denied and what it was for.
3. Carry on with everything that does not depend on it; say what is blocked.

## Sandbox and the rate limit

- A network command that fails in the sandbox (connection refused, host not
  allowed) is re-run once with `dangerouslyDisableSandbox: true`, for that
  command only. The retry still goes through the permission gate.
- The GitHub API limit is **5,000 requests an hour, shared by every agent**.
  Check before bulk work and after:

```sh
gh api rate_limit --jq '.resources.core, .resources.graphql'
```

Prefer GraphQL and narrow queries, trim with `--jq`, never poll in a tight
loop, and when `remaining` is near zero wait for `reset` (a Unix time).

## Sub agent briefing checklist

A sub agent knows only what the brief says. Every brief carries:

- **Goal:** one outcome, the repo, and its issue (`Closes #n` or `Refs #n`).
- **Scope:** exactly what to change, and the files worth reading first.
- **Safety rules:** security first; no secrets in chat or commits;
  classifier denials are reported, never worked around.
- **Rate limit:** the shared 5,000/hour limit; `gh api rate_limit` first.
- **Attribution:** the exact commit trailer and PR footer lines from the
  session's attribution reminder.
- **Do NOT touch:** other agents' branches, the owner-only list above,
  settings, releases, anything outside scope.
- **Report format:** PR link, what changed, checks run with results, what is
  blocked, and a final "Needs you:" line.

The agent that wrote a change never approves it (see
[security triage](/playbooks/security-triage/)).
