<script lang="ts">
  import type { Citation as CitationData } from './lib/ai-client.js';

  interface Props {
    citation: CitationData;
  }

  let { citation }: Props = $props();
</script>

<a
  class="nds-citation"
  href={citation.url}
  title={citation.title}
  data-testid="citation"
>
  <sup>{citation.index}</sup>
  <span class="nds-citation-title">{citation.title}</span>
  {#if citation.breadcrumb}
    <span class="nds-citation-crumb">{citation.breadcrumb}</span>
  {/if}
</a>

<style>
  .nds-citation {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    padding: 0.2rem 0.45rem;
    border: 1px solid var(--sl-color-gray-5, #2c2c2c);
    border-radius: 999px;
    background: var(--sl-color-gray-6, #1a1a1a);
    color: var(--sl-color-gray-1, #e0e0e0);
    text-decoration: none;
    font-size: 0.75rem;
    line-height: 1;
  }
  .nds-citation sup {
    color: var(--mzizi-green, #00875a);
    font-weight: 700;
  }
  .nds-citation-crumb {
    color: var(--sl-color-gray-3, #a0a0a0);
  }
  .nds-citation:hover {
    border-color: var(--mzizi-green, #00875a);
  }
</style>
