---
title: Making a repo public
description: "Operations playbook: making a repo public."
sidebar:
  label: Making a repo public
---

History is public too, and publishing cannot be undone.

1. **Scan the full history first**, not only the tip, for secrets, personal
   paths (home directories, usernames), personal emails and private hostnames
   or IPs: `scripts/pii-scan.py` with `pii-patterns.json`, plus a secret
   scanner such as gitleaks over `git log -p --all`.
2. **If history is not clean, publish from a squashed seed tree in a fresh
   repo:** the cleaned tree, one initial commit, a new repo; the old repo
   stays private. A secret that was found is rotated by the owner regardless.
3. **Security settings**, all on before the visibility change (needs repo
   admin; a refusal goes to the owner):

   ```sh
   # secret scanning and push protection
   gh api -X PATCH repos/<o>/<r> \
     -f 'security_and_analysis[secret_scanning][status]=enabled' \
     -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
   # private vulnerability reporting
   gh api -X PUT repos/<o>/<r>/private-vulnerability-reporting
   # CodeQL default setup
   gh api -X PATCH repos/<o>/<r>/code-scanning/default-setup \
     -f state=configured -f query_suite=default
   # `release` environment restricted to v* tags
   gh api -X PUT repos/<o>/<r>/environments/release \
     -F 'deployment_branch_policy[protected_branches]=false' \
     -F 'deployment_branch_policy[custom_branch_policies]=true'
   gh api -X POST repos/<o>/<r>/environments/release/deployment-branch-policies \
     -f name='v*' -f type=tag
   ```

4. **Dependabot** (`.github/dependabot.yml`, weekly, with a `cooldown`;
   [dependency policy](/playbooks/dependency-policy/)) and a **`SECURITY.md`** that says to report privately and
   names scope. Confirm each setting with a read call, for example
   `gh api repos/<o>/<r>/private-vulnerability-reporting --jq .enabled`.
5. **README and content pass** against
   [`README-STANDARD.md`](/engineering/readme-standard/): curl every URL and badge,
   licence matches `LICENSE`, no unverifiable claim, no internal hostname,
   no personal data.
6. Only then change visibility. That step is the owner's.
