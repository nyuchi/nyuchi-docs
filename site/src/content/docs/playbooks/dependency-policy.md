---
title: Dependency policy
description: "Operations playbook: dependency policy."
sidebar:
  label: Dependency policy
---

- **Dependabot runs weekly (Monday) with `cooldown: default-days: 7`**, so a
  hijacked or broken release is caught first. Copy a current config
  (`.github/dependabot.yml` in `nyuchi/.github` or `mzizi-dev/agent-tools`);
  `dependabot.example.yml` has no cooldown yet. Set `commit-message.prefix`
  to `build` so titles pass lint.
- **Majors** are ignored in the Mzizi repos (`version-update:semver-major`,
  owner 2026-11-12) and elsewhere arrive as one PR each. A major is migrated
  when someone chooses it, once **build and tests pass** on the new major.
- **TypeScript stays on the latest 6.x.** Major 7 is ignored (an `ignore`
  entry for `typescript` with `version-update:semver-major`) until Astro and
  typescript-eslint support it; remove the entry then.

- **No downgrades.** A failing upgrade is fixed forward or waits; never pin
  back to hide it. First-party and direct dependencies use `>=x.y.z`
  minimums (see `AGENTS.md`). Never approve a prohibited dependency.
