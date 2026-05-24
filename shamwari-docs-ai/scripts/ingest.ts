#!/usr/bin/env tsx
// Ingest CLI: walk a docs sitemap, chunk + embed + upsert to Vectorize via
// the Cloudflare REST API. Run with:
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
//     pnpm --filter shamwari-docs-ai ingest -- \
//       --sitemap https://docs.nyuchi.com/sitemap-index.xml --source nyuchi
//
// We intentionally don't run inside the Worker — large ingests would blow
// past CPU limits. The REST API gives us the same Vectorize index.

import {
  loadSitemapUrls,
  pageToChunks,
  type ChunkOutput,
} from '../src/ingest.js';

interface Args {
  sitemap: string;
  source: 'nyuchi' | 'bundu';
  index: string;
  embedModel: string;
  dryRun: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> & { dryRun?: boolean } = {
    index: 'shamwari-docs',
    embedModel: '@cf/baai/bge-base-en-v1.5',
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--sitemap': args.sitemap = next; i++; break;
      case '--source': args.source = next as 'nyuchi' | 'bundu'; i++; break;
      case '--index': args.index = next; i++; break;
      case '--embed-model': args.embedModel = next; i++; break;
      case '--limit': args.limit = Number(next); i++; break;
      case '--dry-run': args.dryRun = true; break;
    }
  }
  if (!args.sitemap || !args.source) {
    console.error(
      'Usage: ingest --sitemap <url> --source nyuchi|bundu [--index shamwari-docs] [--limit N] [--dry-run]'
    );
    process.exit(1);
  }
  return args as Args;
}

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || '125a2dfbc21f76a25c980609609e8218';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function embedBatch(
  texts: string[],
  model: string
): Promise<number[][]> {
  if (!API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN required');
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text: texts }),
    }
  );
  if (!res.ok) {
    throw new Error(`embed ${model}: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    result?: { data?: number[][] };
    success?: boolean;
    errors?: unknown;
  };
  if (!json.success || !json.result?.data) {
    throw new Error(`embed: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.result.data;
}

async function upsertVectors(
  index: string,
  vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, unknown>;
  }>
): Promise<void> {
  if (!API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN required');
  // Vectorize V2 upsert expects NDJSON.
  const ndjson = vectors
    .map((v) => JSON.stringify({ id: v.id, values: v.values, metadata: v.metadata }))
    .join('\n');
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${index}/upsert`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        'content-type': 'application/x-ndjson',
      },
      body: ndjson,
    }
  );
  if (!res.ok) {
    throw new Error(`upsert: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Loading sitemap: ${args.sitemap}`);
  let urls = await loadSitemapUrls(args.sitemap);
  console.log(`  ${urls.length} URLs`);
  if (args.limit) urls = urls.slice(0, args.limit);

  const allChunks: ChunkOutput[] = [];
  let pageCount = 0;
  for (const url of urls) {
    try {
      const chunks = await pageToChunks(url, args.source);
      allChunks.push(...chunks);
      pageCount++;
      if (pageCount % 5 === 0) {
        console.log(`  ${pageCount}/${urls.length} pages, ${allChunks.length} chunks`);
      }
    } catch (e) {
      console.warn(`  skip ${url}: ${(e as Error).message}`);
    }
  }
  console.log(`Total chunks: ${allChunks.length}`);

  if (args.dryRun) {
    console.log('Dry run — exiting without embed/upsert.');
    return;
  }
  if (allChunks.length === 0) {
    console.log('Nothing to ingest.');
    return;
  }

  const BATCH = 50;
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const slice = allChunks.slice(i, i + BATCH);
    const embeddings = await embedBatch(
      slice.map((c) => c.text),
      args.embedModel
    );
    const vectors = slice.map((c, j) => ({
      id: c.id,
      values: embeddings[j],
      metadata: {
        text: c.text,
        source: c.source,
        url: c.url,
        title: c.title,
        breadcrumb: c.breadcrumb,
        chunk_index: c.chunk_index,
      },
    }));
    await upsertVectors(args.index, vectors);
    console.log(`  upserted ${Math.min(i + BATCH, allChunks.length)}/${allChunks.length}`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
