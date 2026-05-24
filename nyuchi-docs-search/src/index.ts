// Public entrypoints for nyuchi-docs-search.
export { default as SearchModal } from './SearchModal.svelte';
export { default as SearchResults } from './SearchResults.svelte';
export { default as AiChat } from './AiChat.svelte';
export { default as Citation } from './Citation.svelte';
export { createPagefindClient } from './lib/pagefind.js';
export { createAiClient } from './lib/ai-client.js';
export type {
  PagefindClient,
  PagefindResult,
  SearchHit,
} from './lib/pagefind.js';
export type {
  AiClient,
  AiClientOptions,
  ChatMessage,
  Citation as CitationData,
  StreamEvent,
} from './lib/ai-client.js';
export { default as starlightDocsSearch } from './plugin.js';
