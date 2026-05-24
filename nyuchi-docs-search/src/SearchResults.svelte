<script lang="ts">
  import type { SearchHit } from './lib/pagefind.js';

  interface Props {
    results: SearchHit[];
    selected: number;
    loading: boolean;
    query: string;
  }

  let { results, selected, loading, query }: Props = $props();
</script>

<div class="nds-results" role="listbox" aria-label="Search results">
  {#if loading && results.length === 0}
    <p class="nds-empty">Searching…</p>
  {:else if !query.trim()}
    <p class="nds-empty">Ask AI or search docs…</p>
  {:else if results.length === 0}
    <p class="nds-empty">No results for "{query}"</p>
  {:else}
    <ul class="nds-list">
      {#each results as r, i (r.id)}
        <li>
          <a
            href={r.url}
            class="nds-result"
            class:selected={i === selected}
            role="option"
            aria-selected={i === selected}
            data-testid="search-result"
          >
            <div class="nds-result-head">
              <span class="nds-result-title">{r.title}</span>
              <span class="nds-result-crumb">{r.breadcrumb}</span>
            </div>
            <p class="nds-result-snippet">{r.snippet}</p>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .nds-results {
    padding: 0.5rem 0;
  }
  .nds-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .nds-result {
    display: block;
    padding: 0.6rem 1rem;
    color: inherit;
    text-decoration: none;
    border-left: 3px solid transparent;
  }
  .nds-result.selected,
  .nds-result:hover {
    background: var(--sl-color-gray-6, rgba(255, 255, 255, 0.04));
    border-left-color: var(--mzizi-green, #00875a);
  }
  .nds-result-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
  }
  .nds-result-title {
    font-weight: 600;
    color: var(--sl-color-white, #fff);
  }
  .nds-result-crumb {
    font-size: 0.75rem;
    color: var(--sl-color-gray-3, #a0a0a0);
  }
  .nds-result-snippet {
    margin: 0.15rem 0 0;
    font-size: 0.85rem;
    color: var(--sl-color-gray-2, #c0c0c0);
    line-height: 1.4;
  }
  .nds-empty {
    padding: 1.5rem 1rem;
    text-align: center;
    color: var(--sl-color-gray-3, #a0a0a0);
    font-size: 0.9rem;
  }
</style>
