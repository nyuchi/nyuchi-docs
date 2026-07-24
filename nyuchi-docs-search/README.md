# nyuchi-docs-search

Mintlify-style command-palette search modal (`⌘K` + Pagefind) with an
**Ask AI** tab that streams answers from the [`shamwari-docs-ai`][worker]
Cloudflare Worker. Pure Svelte 5, no runtime deps. Designed to drop into any
[Astro Starlight][starlight] site.

Used in production by:

- [`nyuchi/nyuchi-docs`](https://github.com/nyuchi/nyuchi-docs) — `docs.nyuchi.com`
- [`bundu-labs/bundu-docs`](https://github.com/bundu-labs/bundu-docs) — `docs.bundu.org`

## Install

```sh
pnpm add @nyuchi/nyuchi-docs-search svelte @astrojs/svelte
# or
npm install @nyuchi/nyuchi-docs-search svelte @astrojs/svelte
```

## Wire into a Starlight site

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import svelte from '@astrojs/svelte';
import { starlightDocsSearch } from '@nyuchi/nyuchi-docs-search/plugin';

export default defineConfig({
  integrations: [
    svelte(),
    starlight({
      title: 'My docs',
      plugins: [
        starlightDocsSearch({
          aiUrl: import.meta.env.PUBLIC_SHAMWARI_AI_URL, // e.g. https://shamwari-docs-ai.nyuchi.workers.dev
          source: 'bundu', // or 'nyuchi'; filters retrieval to your subset
        }),
      ],
    }),
  ],
});
```

Then expose the worker URL to the client:

```sh
# .env
PUBLIC_SHAMWARI_AI_URL=https://shamwari-docs-ai.nyuchi.workers.dev
```

That's it. Press `⌘K` / `Ctrl+K` to open the modal.

## What you get

- **Search tab** (default) — instant fuzzy results from the built-in Pagefind
  index that Starlight already produces. Title, breadcrumb, snippet, full
  keyboard navigation (`↑` `↓` `Enter` `Esc`).
- **Ask AI tab** — chat answers grounded in your docs, with numbered inline
  citations linking back to the page. Powered by Cloudflare AI Search
  (managed crawl + chunk + embed + retrieve + generate, routed through the
  shared `shamwari` AI Gateway for observability).

## Manual component usage

You can import individual pieces too:

```svelte
<script>
  import { SearchModal, AiChat } from '@nyuchi/nyuchi-docs-search';
</script>

<SearchModal aiUrl="https://…" source="nyuchi" />
```

## Theming

The components pick up Starlight CSS variables by default
(`--sl-color-bg`, `--sl-color-gray-*`, …) and a custom `--mzizi-green` accent.
Override either in your site's `customCss`.

## Develop

```sh
pnpm install
pnpm --filter @nyuchi/nyuchi-docs-search build
pnpm --filter @nyuchi/nyuchi-docs-search test
```

[starlight]: https://starlight.astro.build
[worker]: ../shamwari-docs-ai
