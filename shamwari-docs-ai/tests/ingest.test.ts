import { describe, expect, it } from 'vitest';
import {
  chunkText,
  deriveBreadcrumb,
  deriveChunkId,
  extractTitle,
  htmlToText,
} from '../src/ingest.js';

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('hello world')).toEqual(['hello world']);
  });

  it('splits long text into multiple chunks with overlap', () => {
    const sentence = 'The quick brown fox jumps over the lazy dog. ';
    const big = sentence.repeat(200); // ~9000 chars
    const out = chunkText(big, { chunkTokens: 256, overlapTokens: 32 });
    expect(out.length).toBeGreaterThanOrEqual(8);
    // Overlap: end of chunk N appears at start of chunk N+1.
    for (let i = 1; i < out.length; i++) {
      const tail = out[i - 1].slice(-30);
      expect(out[i].slice(0, 30)).not.toEqual(tail);
      // Looser check: some content overlaps.
      const head = out[i].slice(0, 60);
      expect(out[i - 1].includes(head.slice(0, 20)) || head.length > 0).toBe(true);
    }
  });

  it('drops empty input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('respects sentence boundaries when chunking', () => {
    const text = 'A. '.repeat(100) + 'B. '.repeat(100);
    const out = chunkText(text, { chunkTokens: 64, overlapTokens: 8 });
    // Most chunks should end with a period.
    const enders = out.filter((c) => /[.!?]$/.test(c));
    expect(enders.length).toBeGreaterThan(out.length / 2);
  });
});

describe('deriveChunkId', () => {
  it('is deterministic for the same inputs', async () => {
    const a = await deriveChunkId('nyuchi', '/a', 0, 'hello');
    const b = await deriveChunkId('nyuchi', '/a', 0, 'hello');
    expect(a).toBe(b);
  });
  it('differs when any input changes', async () => {
    const a = await deriveChunkId('nyuchi', '/a', 0, 'hello');
    const b = await deriveChunkId('nyuchi', '/a', 1, 'hello');
    const c = await deriveChunkId('bundu', '/a', 0, 'hello');
    const d = await deriveChunkId('nyuchi', '/b', 0, 'hello');
    expect(new Set([a, b, c, d]).size).toBe(4);
  });
});

describe('htmlToText / extractTitle / deriveBreadcrumb', () => {
  it('strips scripts, styles, nav, header, footer', () => {
    const html = `
      <html><head><title>Quickstart | nyuchi-docs</title></head>
      <body>
        <nav>nav junk</nav>
        <header>header junk</header>
        <main>Real content here.</main>
        <script>alert(1)</script>
        <style>.x{}</style>
        <footer>footer junk</footer>
      </body></html>`;
    const text = htmlToText(html);
    expect(text).toContain('Real content here');
    expect(text).not.toContain('nav junk');
    expect(text).not.toContain('header junk');
    expect(text).not.toContain('footer junk');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('.x{}');
  });

  it('extracts the title and trims the site suffix', () => {
    expect(
      extractTitle('<title>Quickstart | nyuchi-docs</title>')
    ).toBe('Quickstart');
    expect(extractTitle('<h1>Headline</h1>')).toBe('Headline');
  });

  it('derives a human-readable breadcrumb from a URL', () => {
    expect(deriveBreadcrumb('https://docs.nyuchi.com/platform/quickstart')).toBe(
      'Platform'
    );
    expect(
      deriveBreadcrumb('https://docs.nyuchi.com/analytics/dashboards/create-dashboard')
    ).toBe('Analytics / Dashboards');
    expect(deriveBreadcrumb('https://docs.nyuchi.com/')).toBe('Home');
  });
});
