<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import SearchResults from './SearchResults.svelte';
  import AiChat from './AiChat.svelte';
  import { createPagefindClient, type SearchHit } from './lib/pagefind.js';

  interface Props {
    aiUrl?: string;
    source?: 'nyuchi' | 'bundu';
    enableAskAi?: boolean;
  }

  let { aiUrl, source, enableAskAi }: Props = $props();

  // Read fallbacks from the global the plugin sets, in case props are not wired.
  const globalConfig =
    typeof globalThis !== 'undefined'
      ? ((globalThis as Record<string, unknown>).__NYUCHI_DOCS_SEARCH__ as
          | { aiUrl?: string; source?: 'nyuchi' | 'bundu'; enableAskAi?: boolean }
          | undefined)
      : undefined;
  const effectiveAiUrl = aiUrl ?? globalConfig?.aiUrl;
  const effectiveSource = source ?? globalConfig?.source;
  const effectiveEnableAskAi =
    enableAskAi ?? globalConfig?.enableAskAi ?? Boolean(effectiveAiUrl);

  let open = $state(false);
  let query = $state('');
  let tab: 'search' | 'ai' = $state('search');
  let results: SearchHit[] = $state([]);
  let selected = $state(0);
  let loading = $state(false);

  const pagefind = createPagefindClient();

  let searchToken = 0;
  async function runSearch(q: string) {
    const token = ++searchToken;
    if (!q.trim()) {
      results = [];
      return;
    }
    loading = true;
    try {
      const hits = await pagefind.search(q);
      if (token === searchToken) {
        results = hits;
        selected = 0;
      }
    } finally {
      if (token === searchToken) loading = false;
    }
  }

  $effect(() => {
    if (tab === 'search') runSearch(query);
  });

  function handleKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open = !open;
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
      return;
    }
    if (tab !== 'search') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = Math.min(selected + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
    } else if (e.key === 'Enter' && results[selected]) {
      e.preventDefault();
      window.location.href = results[selected].url;
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKey);
  });
  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', handleKey);
    }
  });
</script>

<button
  type="button"
  class="nds-trigger"
  aria-label="Search docs"
  onclick={() => (open = true)}
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M11 19a8 8 0 1 1 5.3-14.02A8 8 0 0 1 11 19zm10 2-4.35-4.35"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>
  <span>Search</span>
  <kbd>⌘K</kbd>
</button>

{#if open}
  <div
    class="nds-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Search documentation"
    onclick={(e) => e.target === e.currentTarget && (open = false)}
  >
    <div class="nds-modal">
      <div class="nds-input-row">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M11 19a8 8 0 1 1 5.3-14.02A8 8 0 0 1 11 19zm10 2-4.35-4.35"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <input
          class="nds-input"
          type="search"
          placeholder={tab === 'ai' ? 'Ask AI about the docs...' : 'Search docs...'}
          bind:value={query}
          autofocus
        />
        <kbd class="nds-esc">esc</kbd>
      </div>

      {#if effectiveEnableAskAi}
        <div class="nds-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'search'}
            class="nds-tab"
            class:active={tab === 'search'}
            onclick={() => (tab = 'search')}
          >
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ai'}
            class="nds-tab"
            class:active={tab === 'ai'}
            onclick={() => (tab = 'ai')}
          >
            Ask AI
          </button>
        </div>
      {/if}

      <div class="nds-body">
        {#if tab === 'search'}
          <SearchResults {results} {selected} {loading} {query} />
        {:else if effectiveAiUrl}
          <AiChat
            baseUrl={effectiveAiUrl}
            source={effectiveSource}
            initialQuery={query}
          />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .nds-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.7rem;
    border-radius: 0.5rem;
    border: 1px solid var(--sl-color-gray-5, #2c2c2c);
    background: var(--sl-color-bg-nav, #1a1a1a);
    color: var(--sl-color-gray-2, #c0c0c0);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 120ms ease;
  }
  .nds-trigger:hover {
    border-color: var(--mzizi-green, #00875a);
  }
  .nds-trigger kbd {
    font-size: 0.7rem;
    padding: 0.1rem 0.35rem;
    border-radius: 0.3rem;
    background: var(--sl-color-gray-6, #1a1a1a);
    border: 1px solid var(--sl-color-gray-5, #2c2c2c);
  }
  .nds-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 6rem 1rem 1rem;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }
  .nds-modal {
    width: 100%;
    max-width: 640px;
    background: var(--sl-color-bg, #0f0f0f);
    border: 1px solid var(--sl-color-gray-5, #2c2c2c);
    border-radius: 0.75rem;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 70vh;
  }
  .nds-input-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--sl-color-gray-5, #2c2c2c);
    color: var(--sl-color-gray-3, #a0a0a0);
  }
  .nds-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--sl-color-white, #fff);
    font-size: 1rem;
  }
  .nds-esc {
    font-size: 0.7rem;
    padding: 0.1rem 0.35rem;
    border-radius: 0.3rem;
    background: var(--sl-color-gray-6, #1a1a1a);
    border: 1px solid var(--sl-color-gray-5, #2c2c2c);
  }
  .nds-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem 0;
    border-bottom: 1px solid var(--sl-color-gray-5, #2c2c2c);
  }
  .nds-tab {
    padding: 0.45rem 0.85rem;
    background: transparent;
    border: none;
    color: var(--sl-color-gray-3, #a0a0a0);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .nds-tab.active {
    color: var(--mzizi-green, #00875a);
    border-bottom-color: var(--mzizi-green, #00875a);
  }
  .nds-body {
    flex: 1;
    overflow-y: auto;
  }
  @media (max-width: 640px) {
    .nds-overlay {
      padding: 0;
    }
    .nds-modal {
      max-width: none;
      width: 100%;
      height: 100%;
      max-height: 100vh;
      border-radius: 0;
    }
  }
</style>
