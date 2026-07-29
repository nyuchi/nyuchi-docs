# @nyuchi/nyuchi-docs-skills

> The **public** agent skill for `docs.nyuchi.com`.

```bash
npx skills add @nyuchi/nyuchi-docs-skills
```

## What's in it

One skill, deliberately.

| Skill | Covers |
| --- | --- |
| `using-nyuchi-docs` | Searching, asking, and reading the docs; the MCP endpoint and its five tools; `llms.txt`; in-page `⌘K` search and Ask AI; how to tell an authoritative page from a stub; and how to report a bad page. |

That is the whole public surface, and the split is intentional: **consuming** the docs is
something any user or agent anywhere might need, so it ships. **Producing** them is not.

## The internal skills are not here

The repo also carries five skills under [`.claude/skills/`](../.claude/skills/) for authoring
and maintaining this site — auditing it for drift, verifying its agent surfaces, syncing product
guides, the shell contract, and cutting an MCP release. Those are **not published**, because
they are only meaningful with a checkout of `nyuchi/nyuchi-docs` in front of you: they reference
repo paths, run repo scripts, and assume you can open a PR against it. Shipping them to npm
would hand consumers instructions they cannot act on.

Claude Code picks them up automatically for any session running inside the repo, which is
exactly the audience they have.

If you are **reading** the docs, install this package. If you are **editing** them, clone the
repo and you get the internal five for free.

## Authoring

Same shape as `@nyuchi/mzizi-skills`, so the tooling and the habits carry over:

1. Add a directory under `skills/`, e.g. `skills/my-skill/`.
2. Write `skills/my-skill/SKILL.md` with YAML frontmatter carrying `name` and `description`.
3. Add an entry to `index.json` (`name`, `file`, `description`) — consumers read the index, so an
   unlisted skill ships in the tarball and is invisible.
4. Bump the version in **both** `package.json` and `index.json`; they move in lockstep.

Before adding one here, ask whether it is genuinely public. If it needs a checkout, it belongs in
`.claude/skills/` instead. If it is about the design system rather than the docs, it belongs in
`@nyuchi/mzizi-skills`.

## Related

- **`@nyuchi/nyuchi-docs-mcp`** — the stdio bridge to the same MCP server, for clients that want
  a local process rather than an HTTP endpoint.
- **`@nyuchi/mzizi-skills`** — the design-system and engineering doctrine bundle.
- **[docs.nyuchi.com/tools](https://docs.nyuchi.com/tools/)** — the directory of every Nyuchi
  skill, CLI, and MCP server.

## License

MIT.
