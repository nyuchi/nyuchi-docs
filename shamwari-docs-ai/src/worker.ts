// shamwari-docs-ai: Cloudflare Worker serving Ask-AI for nyuchi-docs +
// bundu-docs. Routes:
//   POST /chat    streaming SSE chat answer with retrieval-grounded citations
//   GET  /health  liveness probe

import { retrieve, type RetrievedChunk } from './retrieve.js';
import { runChat } from './chat.js';

export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  CHAT_MODEL: string;
  EMBED_MODEL: string;
  AI_GATEWAY_ID?: string;
  TOP_K?: string;
  ALLOWED_ORIGINS?: string;
}

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  source?: 'nyuchi' | 'bundu';
}

const WILDCARD_PATTERNS = [/^https:\/\/[a-z0-9-]+\.vercel\.app$/i];

function buildCorsHeaders(env: Env, origin: string | null): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isLocalhost = origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const isAllowed =
    !!origin &&
    (allowed.includes(origin) ||
      WILDCARD_PATTERNS.some((re) => re.test(origin)) ||
      isLocalhost);
  return {
    'access-control-allow-origin': isAllowed ? origin : 'null',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function sseFrame(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const cors = buildCorsHeaders(env, req.headers.get('origin'));

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { 'content-type': 'application/json', ...cors },
      });
    }

    if (req.method === 'POST' && url.pathname === '/chat') {
      return handleChat(req, env, cors, ctx);
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
} satisfies ExportedHandler<Env>;

async function handleChat(
  req: Request,
  env: Env,
  cors: Record<string, string>,
  _ctx: ExecutionContext
): Promise<Response> {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }

  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser?.content) {
    return new Response(JSON.stringify({ error: 'no user message' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }

  const topK = Number(env.TOP_K ?? '5');
  let chunks: RetrievedChunk[] = [];
  try {
    chunks = await retrieve(env, lastUser.content, {
      topK,
      source: body.source,
    });
  } catch (err) {
    console.error('retrieve failed', err);
    // Continue without retrieval — model still answers, just unsourced.
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const token of runChat(env, messages, chunks)) {
          controller.enqueue(enc.encode(sseFrame({ type: 'token', text: token })));
        }
        if (chunks.length > 0) {
          controller.enqueue(
            enc.encode(
              sseFrame({
                type: 'citations',
                citations: chunks.map((c, i) => ({
                  index: i + 1,
                  url: c.metadata.url,
                  title: c.metadata.title,
                  breadcrumb: c.metadata.breadcrumb,
                  snippet: c.text.slice(0, 240),
                })),
              })
            )
          );
        }
        controller.enqueue(enc.encode(sseFrame({ type: 'done' })));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        controller.enqueue(enc.encode(sseFrame({ type: 'error', error: msg })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
      ...cors,
    },
  });
}
