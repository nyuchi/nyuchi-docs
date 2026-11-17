// Public entrypoints for nyuchi-docs-search. Framework-free: the modal is
// plain DOM code that runs in the browser (see `Search.astro` for the mount).
export { createSearchModal, initDocsSearch } from "./lib/search-modal.js";
export { createPagefindClient } from "./lib/pagefind.js";
export { createAiClient } from "./lib/ai-client.js";
export type {
  DocsSource,
  SearchModalController,
  SearchModalOptions,
  SearchTab,
} from "./lib/search-modal.js";
export type {
  PagefindClient,
  PagefindResult,
  SearchHit,
} from "./lib/pagefind.js";
export type {
  AiClient,
  AiClientOptions,
  ChatMessage,
  Citation as CitationData,
  StreamEvent,
} from "./lib/ai-client.js";
export { default as starlightDocsSearch } from "./plugin.js";
