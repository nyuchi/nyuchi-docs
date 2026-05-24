// Ingest pipeline: fetch a docs sitemap, walk pages, strip to text, chunk,
// embed via Workers AI REST API, and upsert into Vectorize.
//
// Exposed as a small library so the `scripts/ingest.ts` CLI (run under tsx
// outside the Worker runtime) can call it. The chunker + id derivation are
// pure functions so they are unit-testable.

const APPROX_TOKEN_CHARS = 4; // ~4 chars per token for English prose.

export interface ChunkInput {
  url: string;
  title: string;
  breadcrumb: string;
  text: string;
  source: 'nyuchi' | 'bundu';
}

export interface ChunkOutput {
  id: string;
  text: string;
  source: 'nyuchi' | 'bundu';
  url: string;
  title: string;
  breadcrumb: string;
  chunk_index: number;
}

export interface ChunkOptions {
  chunkTokens?: number; // target tokens per chunk
  overlapTokens?: number;
}

/** Split text into ~chunkTokens chunks with overlapTokens overlap, preferring
 *  paragraph boundaries when convenient. */
export function chunkText(
  text: string,
  opts: ChunkOptions = {}
): string[] {
  const chunkTokens = opts.chunkTokens ?? 512;
  const overlapTokens = opts.overlapTokens ?? 64;
  const chunkChars = chunkTokens * APPROX_TOKEN_CHARS;
  const overlapChars = overlapTokens * APPROX_TOKEN_CHARS;

  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return [];
  if (cleaned.length <= chunkChars) return [cleaned];

  const out: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + chunkChars, cleaned.length);
    if (end < cleaned.length) {
      // Try to break on the nearest sentence/space boundary within the last 200 chars.
      const window = cleaned.slice(end - 200, end);
      const lastBreak = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('? '),
        window.lastIndexOf('! '),
        window.lastIndexOf('\n')
      );
      if (lastBreak > 0) {
        end = end - 200 + lastBreak + 1;
      }
    }
    out.push(cleaned.slice(start, end).trim());
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlapChars);
  }
  return out.filter((s) => s.length > 0);
}

/** Deterministic id from source + url + chunk index + content. Re-ingesting
 *  unchanged content produces the same id (upsert dedup). */
export async function deriveChunkId(
  source: string,
  url: string,
  chunkIndex: number,
  text: string
): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${source}|${url}|${chunkIndex}|${text}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  // 16 hex chars = 64-bit prefix, plenty for our scale.
  return Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convert a page worth of HTML into clean prose, dropping nav/footer noise. */
export function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  s = s.replace(/<header[\s\S]*?<\/header>/gi, '');
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  s = s.replace(/<aside[\s\S]*?<\/aside>/gi, '');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return s.replace(/\s+/g, ' ').trim();
}

export function extractTitle(html: string): string {
  const t = /<title>([^<]+)<\/title>/i.exec(html);
  if (t?.[1]) return t[1].replace(/\s+\|.*$/, '').trim();
  const h1 = /<h1[^>]*>([^<]+)<\/h1>/i.exec(html);
  return h1?.[1]?.trim() ?? '';
}

export function deriveBreadcrumb(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    if (parts.length <= 1) return 'Home';
    return parts
      .slice(0, -1)
      .map((p) =>
        p.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      )
      .join(' / ');
  } catch {
    return '';
  }
}

/** Extract <loc> URLs from a sitemap or sitemap index. Recursive for indexes. */
export async function loadSitemapUrls(
  sitemapUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  const res = await fetchImpl(sitemapUrl);
  if (!res.ok) throw new Error(`sitemap ${sitemapUrl}: ${res.status}`);
  const xml = await res.text();
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) =>
    m[1].trim()
  );
  // If this is an index, recurse.
  if (/<sitemapindex/i.test(xml)) {
    const all: string[] = [];
    for (const loc of locs) {
      try {
        const child = await loadSitemapUrls(loc, fetchImpl);
        all.push(...child);
      } catch {
        // skip broken children
      }
    }
    return all;
  }
  return locs;
}

export async function pageToChunks(
  url: string,
  source: 'nyuchi' | 'bundu',
  fetchImpl: typeof fetch = fetch,
  opts: ChunkOptions = {}
): Promise<ChunkOutput[]> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`page ${url}: ${res.status}`);
  const html = await res.text();
  const title = extractTitle(html) || url;
  const breadcrumb = deriveBreadcrumb(url);
  const text = htmlToText(html);
  const pieces = chunkText(text, opts);
  return Promise.all(
    pieces.map(async (piece, i) => ({
      id: await deriveChunkId(source, url, i, piece),
      text: piece,
      source,
      url,
      title,
      breadcrumb,
      chunk_index: i,
    }))
  );
}
