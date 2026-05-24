// Starlight plugin that overrides the default search with our cmdk + Ask AI modal.
// Usage in astro.config.mjs:
//   starlight({
//     plugins: [starlightDocsSearch({ aiUrl: import.meta.env.PUBLIC_SHAMWARI_AI_URL, source: 'nyuchi' })],
//   })

export interface StarlightDocsSearchOptions {
  /** Base URL of the shamwari-docs-ai worker (e.g. https://shamwari-docs-ai.workers.dev). */
  aiUrl?: string;
  /** Which docs source to filter on (passed through to the worker). */
  source?: 'nyuchi' | 'bundu';
  /** Whether to render the Ask AI tab. Defaults to true if aiUrl is set. */
  enableAskAi?: boolean;
}

// Starlight's plugin contract is loosely typed across versions; we accept `any` to
// stay forward-compatible. The contract: return { name, hooks: { 'config:setup'(ctx) }}.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StarlightPlugin = any;

export function starlightDocsSearch(
  options: StarlightDocsSearchOptions = {}
): StarlightPlugin {
  const enableAskAi = options.enableAskAi ?? Boolean(options.aiUrl);
  return {
    name: 'nyuchi-docs-search',
    hooks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'config:setup'(ctx: any) {
        // Inject our component override. Sites that don't want this can omit the
        // plugin from their config.
        ctx.addRouteMiddleware?.({
          entrypoint: 'nyuchi-docs-search/SearchModal.svelte',
        });
        ctx.updateConfig?.({
          components: {
            ...(ctx.config?.components ?? {}),
            Search: 'nyuchi-docs-search/SearchModal.svelte',
          },
        });
        // Pass options through Vite define so the component can read them.
        if (typeof globalThis !== 'undefined') {
          (globalThis as Record<string, unknown>).__NYUCHI_DOCS_SEARCH__ = {
            aiUrl: options.aiUrl,
            source: options.source,
            enableAskAi,
          };
        }
      },
    },
  };
}

export default starlightDocsSearch;
