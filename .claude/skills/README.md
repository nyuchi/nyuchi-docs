# Internal skills — authoring and maintaining docs.nyuchi.com

**These five are internal and are not published.** They are for working *on* this site, and each
one assumes a checkout of `nyuchi/nyuchi-docs` in front of you — repo paths, repo scripts, and
the ability to open a PR against it. Shipping them to npm would hand consumers instructions they
cannot act on, so they stay here.

Claude Code loads them automatically for any session running inside this repo, which is exactly
the audience they have.

| Skill | Kind | Use it when |
| --- | --- | --- |
| `docs-drift-audit` | maintain | Sweeping the repo for drift and strays — sidebar orphans, README/sidebar mismatch, stale strings, gotchas that no longer hold. Periodically, or after a big ship. |
| `kweli-docs-sync` | maintain | Kweli shipped something user- or agent-visible in `nyuchi/barstool` and the guides need syncing. |
| `agent-readiness` | verify | Probing the agent surfaces end-to-end after a deploy or a Cloudflare config change — `llms.txt`, the MCP server card, the hosted `/mcp` endpoint, the worker-direct fallback. |
| `mzizi-shell` | create | Touching the site shell, or replicating the Mzizi N7 shell contract on another Starlight site. |
| `release-mcp` | release | Cutting a new version of the `@nyuchi/nyuchi-docs-mcp` stdio bridge — the `package.json` / `server.json` version lockstep and the publish workflow. |

## The public one lives elsewhere

Consuming the docs is something any user or agent anywhere might need, so it ships separately as
**[`@nyuchi/nyuchi-docs-skills`](../../nyuchi-docs-skills/)** — one skill, `using-nyuchi-docs`,
covering search, ask, read, the MCP endpoint and its five tools, and how to report a bad page.

```bash
npx skills add @nyuchi/nyuchi-docs-skills
```

The split is the rule to apply when adding a skill: **consuming the docs is public, producing
them is internal.**

## Adding an internal skill

A directory under `.claude/skills/<name>/` with a `SKILL.md` carrying `name` and `description`
frontmatter. Nothing to register — Claude Code discovers them.

Two checks before you write it here rather than in the public package:

- **Does it need a checkout?** Repo paths, `pnpm` scripts, or opening a PR ⇒ internal.
- **Is it about the docs, or the design system?** Design-system doctrine belongs in
  `@nyuchi/mzizi-skills` in `nyuchi/mzizi-tools`, not in either of this repo's homes.

`mzizi-shell` is the deliberate borderline case: it documents a contract another Starlight site
would plausibly want. It stays internal for now because it is written against this repo's
`PageFrame.astro`; generalising it is the prerequisite for promoting it, not a reason to publish
it as-is.
