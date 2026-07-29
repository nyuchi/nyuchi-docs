---
name: using-nyuchi-docs
description: Use this skill to find answers in the Nyuchi engineering documentation at docs.nyuchi.com — searching it, asking it a question, reading a specific page, and reporting a page that is wrong or missing. Covers the MCP endpoint and its five tools (search_docs, ask_docs, read_page, submit_feedback, raise_issue), the llms.txt index, the in-page ⌘K search and Ask-AI tab, and how to tell an authoritative page from a stub. Reach for it before answering a question about Nyuchi platform configuration, analytics, integrations, identity, the Console, Mzizi tooling, or deployment.
user-invocable: true
---

# Using the Nyuchi docs

**docs.nyuchi.com** is the engineering and product documentation for Nyuchi Africa — how things
are actually done, as opposed to product narrative (which lives at `docs.bundu.org`) or the
design-system registry (`mzizi.dev`). This skill is about consuming it well.

## Reach for it when

The question is about Nyuchi platform configuration or administration, analytics, integrations
(connectors, webhooks, the Nyuchi API), identity and AuthKit, the Console, Mzizi tooling as
Nyuchi uses it, deployment, or house conventions. Check the docs before answering from memory —
the whole point of the corpus is that it is more current than any model's training.

## The MCP endpoint — prefer this

```
https://docs.nyuchi.com/mcp
```

Streamable HTTP, **no authentication for reads**. Add it once and the docs become queryable
rather than something you have to scrape.

```json
{
  "mcpServers": {
    "nyuchi-docs": { "type": "http", "url": "https://docs.nyuchi.com/mcp" }
  }
}
```

If your client needs a local process rather than an HTTP endpoint, there is a stdio bridge to
the same server:

```bash
npx @nyuchi/nyuchi-docs-mcp
```

### The five tools

| Tool | Use it for |
| --- | --- |
| `search_docs` | Keyword lookup. Start here when you know roughly what the page is called. |
| `ask_docs` | A natural-language question answered over the corpus, with citations. Use when you don't know which page holds the answer. |
| `read_page` | Pull one page in full, once search or ask has told you which one. |
| `submit_feedback` | Report a page that is wrong, confusing, or incomplete. |
| `raise_issue` | File a real issue when something is broken enough to need tracking. |

**The pattern that works:** `search_docs` or `ask_docs` to locate, then `read_page` to get the
whole thing before you rely on it. Answering from a search snippet is how you end up quoting a
caveat's setup line as if it were the recommendation.

Prefer `ask_docs` when the question spans pages ("how does auth flow from the Console to the
API?") and `search_docs` when you want a specific named page. `ask_docs` returns citations —
follow them with `read_page` rather than trusting the summary for anything load-bearing.

## Without MCP

- **`⌘K` / `Ctrl+K`** in the browser opens search, with an **Ask AI** tab beside the keyword
  results — the same corpus the MCP serves.
- **`https://docs.nyuchi.com/llms.txt`** is the machine-readable index of the site. Fetch it
  first if you want to know what exists before querying.
- Every page is a normal URL, so `read_page` and a plain fetch reach the same content.

## Read the maturity signals — much of the corpus is scaffolding

This matters more than it sounds. The site is mid-build, and **some pages are explicitly stubs**.
Several `overview.mdx` pages are single-paragraph placeholders, and pages carry a caution
admonition when they are not yet a reference.

Before treating a page as authoritative:

- Look for a caution or note admonition at the top saying the page is a stub or partial. If it
  says so, believe it — say the docs don't cover it yet rather than dressing up a placeholder.
- A "What needs to land here" section means the surrounding prose is a TODO list, not
  documentation.
- Prefer a page that names concrete commands, file paths, or endpoints over one that describes
  intent in general terms.

Reporting a stub as a gap is useful. Presenting one as an answer is not.

## When the docs are wrong

Use the write tools rather than working around a bad page silently — an unreported error stays
wrong for everyone.

- `submit_feedback` for "this page is confusing / out of date / missing a step". Cheap, no
  ceremony; use it liberally.
- `raise_issue` when it needs tracking: a documented command that fails, a contradiction between
  two pages, a broken link in a critical path.

Include the page URL and what you expected versus what you found. "The connectors overview is
thin" is not actionable; "connectors/overview says to run `pnpm sync` but the repo has no such
script" is.

## What is not here

- **Product and marketing narrative** → `docs.bundu.org` (bundu-docs).
- **The design system** — components, tokens, the DNA-helix architecture → `mzizi.dev`, with its
  own MCP at `mcp.mzizi.dev/mcp` and skills in `@nyuchi/mzizi-skills`.
- **Internal authoring and maintenance workflow** — how to add a page, audit the site for drift,
  verify the agent surfaces, or cut an MCP release. Those are internal skills in the
  `nyuchi/nyuchi-docs` repo under `.claude/skills/`, and they are deliberately not published:
  they are only meaningful with a checkout in front of you. If you are editing the docs rather
  than reading them, work in that repo and use those.

## Wordmarks

Lowercase, always: `nyuchi`, `mzizi`, `mukoko`, `bundu`, `shamwari`, `nhimbe`, `kweli`.
