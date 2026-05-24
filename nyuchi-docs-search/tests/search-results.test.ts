import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import SearchResults from '../src/SearchResults.svelte';
import type { SearchHit } from '../src/lib/pagefind.js';

const sample: SearchHit[] = [
  {
    id: '1',
    url: '/platform/quickstart',
    title: 'Platform quickstart',
    breadcrumb: 'Platform',
    snippet: 'Get started with the Nyuchi platform in five minutes.',
  },
  {
    id: '2',
    url: '/analytics/connect-data',
    title: 'Connect data',
    breadcrumb: 'Analytics',
    snippet: 'Wire data sources into your analytics workspace.',
  },
];

describe('SearchResults', () => {
  it('renders the empty prompt when query is blank', () => {
    const { getByText } = render(SearchResults, {
      props: { results: [], selected: 0, loading: false, query: '' },
    });
    expect(getByText(/ask ai or search docs/i)).toBeInTheDocument();
  });

  it('renders a "no results" message when nothing matches', () => {
    const { getByText } = render(SearchResults, {
      props: { results: [], selected: 0, loading: false, query: 'frobnicate' },
    });
    expect(getByText(/no results/i)).toBeInTheDocument();
  });

  it('renders each ranked hit with title + breadcrumb + snippet', () => {
    const { getAllByTestId, getByText } = render(SearchResults, {
      props: { results: sample, selected: 0, loading: false, query: 'plat' },
    });
    const items = getAllByTestId('search-result');
    expect(items).toHaveLength(2);
    expect(getByText('Platform quickstart')).toBeInTheDocument();
    expect(getByText('Platform')).toBeInTheDocument();
    expect(
      getByText(/Get started with the Nyuchi platform/i)
    ).toBeInTheDocument();
  });

  it('marks the selected hit with aria-selected', () => {
    const { getAllByTestId } = render(SearchResults, {
      props: { results: sample, selected: 1, loading: false, query: 'a' },
    });
    const items = getAllByTestId('search-result');
    expect(items[1].getAttribute('aria-selected')).toBe('true');
    expect(items[0].getAttribute('aria-selected')).toBe('false');
  });
});
