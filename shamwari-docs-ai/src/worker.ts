// shamwari-docs-ai: Cloudflare Worker that proxies the docs Ask-AI tab to
// Cloudflare AI Search. Routes:
//   POST /chat    — emits SSE frames the docs-search client already understands
//   GET  /health  — liveness probe
//
// Crawl, chunk, embed, retrieve, and generate are all handled by the bound
// AI Search instance(s). This worker exists to (a) keep the API token
// server-side, (b) add CORS, (c) route between per-corpus instances by the
// `source` query field, and (d) translate the AI Search response into the
// SSE wire shape the docs-search client consumes. The docs MCP endpoint
// lives in its own worker now — see ../nyuchi-docs-mcp-worker.

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  source?: 'nyuchi' | 'bundu';
}

export interface AiSearchInstance {
  search(options: {
    messages: ChatMessage[];
    ai_search_options?: {
      retrieval?: { max_num_results?: number };
    };
  }): Promise<SearchResult>;
  chatCompletions(options: {
    messages: ChatMessage[];
    ai_search_options?: {
      retrieval?: { max_num_results?: number };
    };
  }): Promise<ChatCompletionsResult>;
}

interface SearchResult {
  chunks?: AiSearchChunk[];
}

interface ChatCompletionsResult {
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
}

interface AiSearchChunk {
  id?: string;
  score?: number;
  text?: string;
  item?: {
    key?: string;
    attributes?: Record<string, unknown>;
  };
}

export interface Env {
  NYUCHI_DOCS: AiSearchInstance;
  BUNDU_DOCS?: AiSearchInstance;
  TOP_K?: string;
  ALLOWED_ORIGINS?: string;
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

function pickInstance(env: Env, source: ChatRequestBody['source']): AiSearchInstance | null {
  if (source === 'bundu') return env.BUNDU_DOCS ?? null;
  return env.NYUCHI_DOCS;
}

// Strip a leading YAML-frontmatter block from chunk text — the web-crawler
// ingests raw MDX, so chunks often start with `---\nkey: value\n...\n---\n`.
// Returns the frontmatter fields and the body text separately.
function splitFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim();
  }
  return { meta, body: match[2].trim() };
}

export function normaliseCitations(chunks: AiSearchChunk[]): Array<{
  index: number;
  url: string;
  title: string;
  breadcrumb?: string;
  snippet?: string;
}> {
  return chunks.map((c, i) => {
    const attrs = (c.item?.attributes ?? {}) as Record<string, unknown>;
    const { meta, body } = splitFrontmatter(c.text ?? '');
    const url = String(attrs.url ?? attrs.source_url ?? c.item?.key ?? '');
    const title = String(attrs.title ?? attrs.page_title ?? meta.title ?? c.item?.key ?? '');
    const breadcrumb = attrs.breadcrumb ? String(attrs.breadcrumb) : undefined;
    const snippet = body ? body.slice(0, 240) : undefined;
    return { index: i + 1, url, title, breadcrumb, snippet };
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
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
      return handleChat(req, env, cors);
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
} satisfies ExportedHandler<Env>;

async function handleChat(
  req: Request,
  env: Env,
  cors: Record<string, string>
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

  const instance = pickInstance(env, body.source);
  if (!instance) {
    return new Response(
      JSON.stringify({ error: `source '${body.source}' not configured on this worker` }),
      { status: 503, headers: { 'content-type': 'application/json', ...cors } }
    );
  }

  const topK = Number(env.TOP_K ?? '5');

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const opts = {
          messages,
          ai_search_options: { retrieval: { max_num_results: topK } },
        };
        // Two RPC calls in parallel: search() for citations, chatCompletions()
        // for the generated answer. AI Search's chatCompletions() returns the
        // OpenAI ChatCompletion shape, which doesn't include the retrieved
        // chunks — so we fetch them separately for the citations frame.
        const [searchRes, chatRes] = await Promise.all([
          instance.search(opts),
          instance.chatCompletions(opts),
        ]);

        const chunks = searchRes.chunks ?? [];
        if (chunks.length > 0) {
          controller.enqueue(
            enc.encode(
              sseFrame({
                type: 'citations',
                citations: normaliseCitations(chunks),
              })
            )
          );
        }

        const text = chatRes.choices?.[0]?.message?.content ?? '';
        if (text) {
          controller.enqueue(enc.encode(sseFrame({ type: 'token', text })));
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
