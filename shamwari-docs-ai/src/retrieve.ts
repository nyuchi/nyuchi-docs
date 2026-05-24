// Embed a query with Workers AI and pull the top-k matching chunks from
// Vectorize. Optionally filters by docs source ("nyuchi" | "bundu").

import type { Env } from './worker.js';

export interface ChunkMetadata {
  source: 'nyuchi' | 'bundu';
  url: string;
  title: string;
  breadcrumb: string;
  chunk_index: number;
}

export interface RetrievedChunk {
  id: string;
  score: number;
  text: string;
  metadata: ChunkMetadata;
}

interface RetrieveOptions {
  topK?: number;
  source?: 'nyuchi' | 'bundu';
}

interface EmbeddingResponse {
  data: number[][];
}

export async function embed(env: Env, text: string): Promise<number[]> {
  const res = (await env.AI.run(env.EMBED_MODEL, {
    text: [text],
    // Route through AI Gateway when configured for caching + observability.
    gateway: env.AI_GATEWAY_ID
      ? { id: env.AI_GATEWAY_ID, skipCache: false }
      : undefined,
  } as Record<string, unknown>)) as unknown as EmbeddingResponse;
  if (!res?.data?.[0]) throw new Error('embed: empty response');
  return res.data[0];
}

export async function retrieve(
  env: Env,
  query: string,
  opts: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const vector = await embed(env, query);
  const topK = opts.topK ?? 5;
  const filter = opts.source ? { source: opts.source } : undefined;
  const result = await env.VECTORIZE.query(vector, {
    topK,
    returnMetadata: 'all',
    filter,
  } as Record<string, unknown>);
  const matches = (result?.matches ?? []) as Array<{
    id: string;
    score: number;
    metadata?: Record<string, unknown> & { text?: string };
  }>;
  return matches
    .filter((m) => m.metadata && typeof m.metadata.text === 'string')
    .map((m) => {
      const meta = m.metadata!;
      return {
        id: m.id,
        score: m.score,
        text: String(meta.text),
        metadata: {
          source: (meta.source as 'nyuchi' | 'bundu') ?? 'nyuchi',
          url: String(meta.url ?? ''),
          title: String(meta.title ?? ''),
          breadcrumb: String(meta.breadcrumb ?? ''),
          chunk_index: Number(meta.chunk_index ?? 0),
        },
      };
    });
}
