// Thin wrapper around the Pagefind UI/search runtime that Starlight bundles
// alongside the built site at `/pagefind/pagefind.js`. The dynamic import is
// guarded so the package is safe to render server-side (returns a no-op client).

export interface PagefindResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}

export interface PagefindResultData {
  url: string;
  meta: { title?: string; [k: string]: unknown };
  excerpt: string;
  sub_results?: Array<{ title: string; url: string; excerpt: string }>;
}

export interface SearchHit {
  id: string;
  url: string;
  title: string;
  breadcrumb: string;
  snippet: string;
}

export interface PagefindClient {
  search(query: string): Promise<SearchHit[]>;
}

interface PagefindRuntime {
  search(query: string): Promise<{ results: PagefindResult[] }>;
}

let runtimePromise: Promise<PagefindRuntime | null> | null = null;

async function loadPagefind(
  baseUrl = '/pagefind/pagefind.js'
): Promise<PagefindRuntime | null> {
  if (typeof window === 'undefined') return null;
  if (!runtimePromise) {
    runtimePromise = import(/* @vite-ignore */ baseUrl).catch(
      () => null
    ) as Promise<PagefindRuntime | null>;
  }
  return runtimePromise;
}

function deriveBreadcrumb(url: string): string {
  try {
    const parts = url
      .split('?')[0]
      .split('#')[0]
      .split('/')
      .filter(Boolean);
    if (parts.length <= 1) return 'Home';
    return parts
      .slice(0, -1)
      .map((p) =>
        p
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      )
      .join(' / ');
  } catch {
    return '';
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

export function createPagefindClient(
  options: { baseUrl?: string } = {}
): PagefindClient {
  return {
    async search(query: string): Promise<SearchHit[]> {
      const q = query.trim();
      if (!q) return [];
      const runtime = await loadPagefind(options.baseUrl);
      if (!runtime) return [];
      const { results } = await runtime.search(q);
      const top = results.slice(0, 10);
      const hydrated = await Promise.all(top.map((r) => r.data()));
      return hydrated.map((d, i) => ({
        id: top[i].id,
        url: d.url,
        title: typeof d.meta?.title === 'string' ? d.meta.title : d.url,
        breadcrumb: deriveBreadcrumb(d.url),
        snippet: stripHtml(d.excerpt ?? ''),
      }));
    },
  };
}
