// nyuchi-docs-mcp: the dedicated Cloudflare Worker for the docs MCP
// server at docs.nyuchi.com/mcp (route) and
// nyuchi-docs-mcp.nyuchi.workers.dev/mcp (direct). Split out of
// shamwari-docs-ai so the MCP endpoint has its own worker, deploys,
// and observability; shamwari-docs-ai keeps the Ask-AI /chat proxy.
//
// Routes:
//   POST /mcp     — Model Context Protocol endpoint (JSON-RPC 2.0,
//                   Streamable HTTP transport; src/mcp.ts)
//   GET  /health  — liveness probe
//
// Read tools ride the bound Cloudflare AI Search instance; write tools
// land in the FEEDBACK KV namespace (+ optional GITHUB_TOKEN secret to
// file real GitHub issues on nyuchi/nyuchi-docs).

import { handleMcp } from './mcp.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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

export interface FeedbackStore {
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  NYUCHI_DOCS: AiSearchInstance;
  TOP_K?: string;
  ALLOWED_ORIGINS?: string;
  /** KV namespace for MCP feedback + queued issues. */
  FEEDBACK?: FeedbackStore;
  /** Optional secret — when set, raise_issue files real GitHub issues. */
  GITHUB_TOKEN?: string;
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
    'access-control-allow-headers': 'content-type,authorization,mcp-session-id,mcp-protocol-version',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

// Strip a leading YAML-frontmatter block from chunk text — the web-crawler
// ingests raw MDX, so chunks often start with `---\nkey: value\n...\n---\n`.
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

    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      return handleMcp(req, env, cors);
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
} satisfies ExportedHandler<Env>;
