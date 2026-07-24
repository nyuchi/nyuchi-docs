// Starlight plugin that overrides the default search with our cmdk + Ask AI modal.
//
// Usage in astro.config.mjs:
//   starlight({
//     plugins: [starlightDocsSearch()],
//   })
//
// Set the worker base URL via env:
//   PUBLIC_SHAMWARI_AI_URL=https://shamwari-docs-ai.workers.dev
//   PUBLIC_DOCS_SOURCE=nyuchi   # or "bundu"

export interface StarlightDocsSearchOptions {
  /** Reserved for future use. Configuration currently flows through PUBLIC_ env vars. */
  _reserved?: never;
}

// Starlight's plugin contract is loosely typed across versions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StarlightPlugin = any;

export function starlightDocsSearch(
  _options: StarlightDocsSearchOptions = {}
): StarlightPlugin {
  return {
    name: 'nyuchi-docs-search',
    hooks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'config:setup'({ updateConfig, config }: any) {
        updateConfig({
          components: {
            ...(config?.components ?? {}),
            Search: '@nyuchi/nyuchi-docs-search/Search.astro',
          },
        });
      },
    },
  };
}

export default starlightDocsSearch;
