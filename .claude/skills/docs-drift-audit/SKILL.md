---
name: docs-drift-audit
description: Sweep the nyuchi-docs repo for drift and stray docs — sidebar orphans, README/sidebar mismatch, stale strings, gotchas that no longer hold. Use periodically or after big ships to keep the docs truthful.
---

# Docs drift audit

Docs describe the shipped state. Run this sweep whenever a big
change lands or on request ("check for stray docs").

## 1. Sidebar ↔ content orphans

Every `.mdx` under `site/src/content/docs/` (except `index`) must
appear in the hardcoded sidebar in `site/astro.config.mjs`:

```bash
python3 - <<'EOF'
import re, pathlib
cfg = open('site/astro.config.mjs').read()
ids = set(re.findall(r"'([a-z0-9-]+/[a-z0-9-]+(?:/[a-z0-9-]+)?)'", cfg))
for f in sorted(pathlib.Path('site/src/content/docs').rglob('*.mdx')):
    rid = str(f.relative_to('site/src/content/docs').with_suffix(''))
    if rid != 'index' and rid not in ids:
        print('ORPHAN (not in sidebar):', rid)
EOF
```

## 2. README ↔ sidebar section sync

The README's "Sections" list must name every sidebar group. The
Astro config is the source of truth; update the README to match.

## 3. Stale-string grep

```bash
grep -rn 'Mintlify\|staging branch\|business\.mukoko\.com\|nyuchi-com\.workers\.dev\|Phase 2\|coming soon' \
  site/src/content/docs/ *.md */README.md
```

Anything found is either dead branding, a retired branch strategy, a
dead URL, or roadmap language — docs never describe futures.

## 4. Verify gotchas against reality

CLAUDE.md gotchas rot. For each one, test the claim (curl the URL,
run the command) — resolve or rewrite it as fact. Precedent: the
`.env.example` worker-URL gotcha was settled by curling both
candidates' `/health`.

## 5. Build gate

`pnpm build` from the repo root (search package first, then site).
Page count should match expectations; new pages must appear in the
Pagefind index.

Fix what the sweep finds in the same PR; flag content-writing work
(stub overviews) as follow-ups rather than padding them with filler.
