// MCP endpoint for docs.nyuchi.com — a stateless Model Context Protocol
// server (Streamable HTTP transport, JSON-RPC 2.0 over POST /mcp).
//
// Read tools ride the same Cloudflare AI Search instance the Ask-AI tab
// uses; write tools land in the FEEDBACK KV namespace and (when a
// GITHUB_TOKEN secret is configured) file real GitHub issues, so agents
// reading the docs can also report problems and raise requests.

import {
  normaliseCitations,
  type AiSearchInstance,
  type ChatMessage,
  type Env,
} from './worker.js';

// Latest MCP spec revision this server speaks. Initialize negotiates:
// a supported requested version is echoed back; anything else gets the
// latest (per the MCP lifecycle spec).
const PROTOCOL_VERSION = '2025-11-25';
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const SERVER_INFO = {
  name: 'nyuchi-docs',
  title: 'Nyuchi Docs',
  version: '1.0.0',
};
const INSTRUCTIONS =
  'Read and search the Nyuchi engineering + product documentation at docs.nyuchi.com, ' +
  'and send feedback or raise issues about it. Prefer search_docs to locate pages, ' +
  'read_page for full page text, ask_docs for synthesized answers with citations. ' +
  'Use submit_feedback for corrections/comments and raise_issue for actionable problems.';

const DOCS_ORIGIN = 'https://docs.nyuchi.com';
const GITHUB_REPO = 'nyuchi/nyuchi-docs';
const MAX_PAGE_CHARS = 24_000;
const MAX_WRITE_CHARS = 8_000;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

const TOOLS = [
  {
    name: 'search_docs',
    title: 'Search the docs',
    description:
      'Keyword/semantic search over docs.nyuchi.com. Returns matching pages with titles, URLs and snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for' },
        top_k: { type: 'number', description: 'Max results (default 5, max 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'ask_docs',
    title: 'Ask the docs',
    description:
      'Ask a question and get a synthesized answer grounded in docs.nyuchi.com, with source citations.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to answer' },
      },
      required: ['question'],
    },
  },
  {
    name: 'read_page',
    title: 'Read a docs page',
    description:
      'Fetch a docs.nyuchi.com page and return its readable text content. Accepts a path (e.g. /kweli/verification/) or a full docs.nyuchi.com URL.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Page path or full docs.nyuchi.com URL' },
      },
      required: ['path'],
    },
  },
  {
    name: 'submit_feedback',
    title: 'Submit docs feedback',
    description:
      'Send feedback about the documentation — a correction, something confusing, something missing. Stored for the docs team.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The feedback itself' },
        page: { type: 'string', description: 'Page path or URL the feedback is about' },
        kind: {
          type: 'string',
          enum: ['correction', 'confusing', 'missing', 'praise', 'other'],
          description: 'What kind of feedback this is',
        },
        contact: { type: 'string', description: 'Optional contact (email/handle) for follow-up' },
      },
      required: ['message'],
    },
  },
  {
    name: 'raise_issue',
    title: 'Raise a docs issue',
    description:
      'Raise an actionable issue against the documentation (wrong instructions, broken example, outdated page). Files a GitHub issue on nyuchi/nyuchi-docs when configured, otherwise queues it for the docs team.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short issue title' },
        body: { type: 'string', description: 'What is wrong and where' },
        page: { type: 'string', description: 'Page path or URL the issue is about' },
      },
      required: ['title', 'body'],
    },
  },
] as const;

function rpcResult(id: JsonRpcRequest['id'], result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text }], isError: isError || undefined };
}

function str(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  return typeof v === 'string' ? v.trim() : '';
}

async function callSearch(env: Env, query: string, topK: number) {
  const res = await env.NYUCHI_DOCS.search({
    messages: [{ role: 'user', content: query }],
    ai_search_options: { retrieval: { max_num_results: topK } },
  });
  return normaliseCitations(res.chunks ?? []);
}

async function toolSearchDocs(env: Env, params: Record<string, unknown>): Promise<ToolResult> {
  const query = str(params, 'query');
  if (!query) return textResult('search_docs: query is required', true);
  const topK = Math.min(Math.max(Number(params.top_k) || Number(env.TOP_K ?? '5'), 1), 10);
  const hits = await callSearch(env, query, topK);
  if (hits.length === 0) return textResult(`No documentation matches for "${query}".`);
  const lines = hits.map(
    (h) => `${h.index}. ${h.title}\n   ${h.url}${h.snippet ? `\n   ${h.snippet}` : ''}`
  );
  return textResult(lines.join('\n\n'));
}

async function toolAskDocs(env: Env, params: Record<string, unknown>): Promise<ToolResult> {
  const question = str(params, 'question');
  if (!question) return textResult('ask_docs: question is required', true);
  const messages: ChatMessage[] = [{ role: 'user', content: question }];
  const opts = {
    messages,
    ai_search_options: { retrieval: { max_num_results: Number(env.TOP_K ?? '5') } },
  };
  const instance: AiSearchInstance = env.NYUCHI_DOCS;
  const [searchRes, chatRes] = await Promise.all([
    instance.search(opts),
    instance.chatCompletions(opts),
  ]);
  const answer = chatRes.choices?.[0]?.message?.content ?? '';
  const sources = normaliseCitations(searchRes.chunks ?? [])
    .map((c) => `[${c.index}] ${c.title} — ${c.url}`)
    .join('\n');
  if (!answer) return textResult('The docs assistant returned no answer for that question.', true);
  return textResult(sources ? `${answer}\n\nSources:\n${sources}` : answer);
}

function resolveDocsUrl(pathOrUrl: string): URL | null {
  try {
    const url = pathOrUrl.startsWith('http')
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`, DOCS_ORIGIN);
    if (url.origin !== DOCS_ORIGIN) return null;
    return url;
  } catch {
    return null;
  }
}

// Crude but dependency-free HTML → text: keep the <main> region, drop
// script/style/nav/svg, unwrap tags, collapse whitespace.
function htmlToText(html: string): string {
  const main = html.match(/<main[\s>][\s\S]*?<\/main>/i)?.[0] ?? html;
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<(h[1-6]|p|li|tr|pre|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function toolReadPage(params: Record<string, unknown>): Promise<ToolResult> {
  const raw = str(params, 'path');
  if (!raw) return textResult('read_page: path is required', true);
  const url = resolveDocsUrl(raw);
  if (!url) return textResult(`read_page: only ${DOCS_ORIGIN} pages can be read`, true);
  const res = await fetch(url.toString(), {
    headers: { 'user-agent': 'nyuchi-docs-mcp/1.0' },
  });
  if (!res.ok) return textResult(`read_page: ${url.pathname} responded ${res.status}`, true);
  const text = htmlToText(await res.text());
  const clipped =
    text.length > MAX_PAGE_CHARS ? `${text.slice(0, MAX_PAGE_CHARS)}\n\n[truncated]` : text;
  return textResult(`# ${url.pathname}\n\n${clipped}`);
}

function feedbackKey(prefix: string): string {
  return `${prefix}:${new Date().toISOString()}:${crypto.randomUUID().slice(0, 8)}`;
}

async function toolSubmitFeedback(env: Env, params: Record<string, unknown>): Promise<ToolResult> {
  const message = str(params, 'message').slice(0, MAX_WRITE_CHARS);
  if (!message) return textResult('submit_feedback: message is required', true);
  if (!env.FEEDBACK) {
    return textResult('Feedback store is not configured on this deployment.', true);
  }
  const key = feedbackKey('feedback');
  await env.FEEDBACK.put(
    key,
    JSON.stringify({
      message,
      page: str(params, 'page') || undefined,
      kind: str(params, 'kind') || 'other',
      contact: str(params, 'contact') || undefined,
      receivedAt: new Date().toISOString(),
      via: 'mcp',
    })
  );
  return textResult(`Feedback recorded for the docs team (ref ${key}). Thank you.`);
}

async function toolRaiseIssue(env: Env, params: Record<string, unknown>): Promise<ToolResult> {
  const title = str(params, 'title').slice(0, 256);
  const body = str(params, 'body').slice(0, MAX_WRITE_CHARS);
  if (!title || !body) return textResult('raise_issue: title and body are required', true);
  const page = str(params, 'page');
  const fullBody = `${body}${page ? `\n\n**Page:** ${page}` : ''}\n\n---\n_Raised via the docs.nyuchi.com/mcp endpoint._`;

  if (env.GITHUB_TOKEN) {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'nyuchi-docs-mcp/1.0',
      },
      body: JSON.stringify({ title, body: fullBody, labels: ['docs-feedback', 'via-mcp'] }),
    });
    if (res.ok) {
      const issue = (await res.json()) as { html_url?: string; number?: number };
      return textResult(`Issue #${issue.number} created: ${issue.html_url}`);
    }
    // fall through to the KV queue on API failure so the report is not lost
  }

  if (!env.FEEDBACK) {
    return textResult('Issue queue is not configured on this deployment.', true);
  }
  const key = feedbackKey('issue');
  await env.FEEDBACK.put(
    key,
    JSON.stringify({ title, body: fullBody, receivedAt: new Date().toISOString(), via: 'mcp' })
  );
  return textResult(`Issue queued for the docs team (ref ${key}).`);
}

async function callTool(env: Env, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case 'search_docs':
      return toolSearchDocs(env, args);
    case 'ask_docs':
      return toolAskDocs(env, args);
    case 'read_page':
      return toolReadPage(args);
    case 'submit_feedback':
      return toolSubmitFeedback(env, args);
    case 'raise_issue':
      return toolRaiseIssue(env, args);
    default:
      return textResult(`Unknown tool: ${name}`, true);
  }
}

async function handleMessage(env: Env, msg: JsonRpcRequest): Promise<unknown | null> {
  const { id, method, params = {} } = msg;

  // Notifications (no id) get no response body.
  if (id === undefined && method?.startsWith('notifications/')) return null;

  switch (method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      return rpcResult(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : '';
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        return rpcResult(id, await callTool(env, name, args));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'tool execution failed';
        return rpcResult(id, textResult(`${name}: ${msg}`, true));
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function handleMcp(
  req: Request,
  env: Env,
  cors: Record<string, string>
): Promise<Response> {
  const jsonHeaders = { 'content-type': 'application/json', ...cors };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST JSON-RPC 2.0 messages to this endpoint' }), {
      status: 405,
      headers: { allow: 'POST,OPTIONS', ...jsonHeaders },
    });
  }

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, 'Parse error')), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const messages = Array.isArray(parsed) ? (parsed as JsonRpcRequest[]) : [parsed as JsonRpcRequest];
  const responses = (await Promise.all(messages.map((m) => handleMessage(env, m)))).filter(
    (r): r is Record<string, unknown> => r !== null
  );

  // Pure notification batch → 202 with no body, per Streamable HTTP.
  if (responses.length === 0) {
    return new Response(null, { status: 202, headers: cors });
  }

  const body = Array.isArray(parsed) ? responses : responses[0];
  return new Response(JSON.stringify(body), { headers: jsonHeaders });
}
