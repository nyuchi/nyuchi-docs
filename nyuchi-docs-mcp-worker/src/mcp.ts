// MCP endpoint for docs.nyuchi.com — a stateless Model Context Protocol
// server (Streamable HTTP transport, JSON-RPC 2.0 over POST /mcp).
//
// Read tools ride the same Cloudflare AI Search instance the Ask-AI tab
// uses; write tools land in the FEEDBACK KV namespace and (when a
// GITHUB_TOKEN secret is configured) file real GitHub issues, so agents
// reading the docs can also report problems and raise requests.

import {
  isLegacyRequest,
  McpServer,
  WebStandardStreamableHTTPServerTransport,
  createMcpHandler,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  normaliseCitations,
  type AiSearchInstance,
  type ChatMessage,
  type Env,
} from "./worker.js";
import { getInternalPaths, isInternalPath } from "./auth.js";

export interface CallerAuth {
  authorized: boolean;
  subject?: string;
}

// Protocol negotiation, both eras (2026-07-28 and the 2025 initialize
// handshake), notifications and JSON-RPC errors are the official MCP
// TypeScript SDK v2 (@modelcontextprotocol/server) — see handleMcp below.
const SERVER_INFO = {
  name: "nyuchi-docs",
  title: "Nyuchi Docs",
  version: "2.0.0",
};
const INSTRUCTIONS =
  "Read and search the Nyuchi engineering + product documentation at docs.nyuchi.com, " +
  "and send feedback or raise issues about it. Prefer nyuchi_docs_search to locate pages, " +
  "nyuchi_docs_read_page for full page text, nyuchi_docs_ask for synthesized answers with " +
  "citations. Use nyuchi_docs_submit_feedback for corrections/comments and " +
  "nyuchi_docs_raise_issue for actionable problems. The unprefixed names (search_docs, …) " +
  "are deprecated aliases.";

const DOCS_ORIGIN = "https://docs.nyuchi.com";
const GITHUB_REPO = "nyuchi/nyuchi-docs";
const MAX_PAGE_CHARS = 24_000;
const MAX_WRITE_CHARS = 8_000;

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

const TOOLS = [
  {
    name: "search_docs",
    title: "Search the docs",
    description:
      "Keyword/semantic search over docs.nyuchi.com. Returns matching pages with titles, URLs and snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for" },
        top_k: {
          type: "number",
          description: "Max results (default 5, max 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "ask_docs",
    title: "Ask the docs",
    description:
      "Ask a question and get a synthesized answer grounded in docs.nyuchi.com, with source citations.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question to answer" },
      },
      required: ["question"],
    },
  },
  {
    name: "read_page",
    title: "Read a docs page",
    description:
      "Fetch a docs.nyuchi.com page and return its readable text content. Accepts a path (e.g. /kweli/verification/) or a full docs.nyuchi.com URL.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Page path or full docs.nyuchi.com URL",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "submit_feedback",
    title: "Submit docs feedback",
    description:
      "Send feedback about the documentation — a correction, something confusing, something missing. Stored for the docs team.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The feedback itself" },
        page: {
          type: "string",
          description: "Page path or URL the feedback is about",
        },
        kind: {
          type: "string",
          enum: ["correction", "confusing", "missing", "praise", "other"],
          description: "What kind of feedback this is",
        },
        contact: {
          type: "string",
          description: "Optional contact (email/handle) for follow-up",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "raise_issue",
    title: "Raise a docs issue",
    description:
      "Raise an actionable issue against the documentation (wrong instructions, broken example, outdated page). Files a GitHub issue on nyuchi/nyuchi-docs when configured, otherwise queues it for the docs team.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short issue title" },
        body: { type: "string", description: "What is wrong and where" },
        page: {
          type: "string",
          description: "Page path or URL the issue is about",
        },
      },
      required: ["title", "body"],
    },
  },
] as const;

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], isError: isError || undefined };
}

function str(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v.trim() : "";
}

async function callSearch(env: Env, query: string, topK: number) {
  const res = await env.NYUCHI_DOCS.search({
    messages: [{ role: "user", content: query }],
    ai_search_options: { retrieval: { max_num_results: topK } },
  });
  return normaliseCitations(res.chunks ?? []);
}

// Best-effort: AI Search's index is built by crawling the public site, and
// the crawler gets the same OIDC gate any other unauthenticated visitor
// does, so an internal page landing in this index at all would already be
// a bug elsewhere. This filter is the belt-and-suspenders backstop, not
// the actual access-control boundary — don't rely on it alone.
async function filterCitations<T extends { url: string }>(
  citations: T[],
  auth: CallerAuth,
): Promise<T[]> {
  if (auth.authorized) return citations;
  const internalPaths = await getInternalPaths(DOCS_ORIGIN);
  if (internalPaths.length === 0) return citations;
  return citations.filter((c) => {
    try {
      return !isInternalPath(
        internalPaths,
        new URL(c.url, DOCS_ORIGIN).pathname,
      );
    } catch {
      return true;
    }
  });
}

async function toolSearchDocs(
  env: Env,
  params: Record<string, unknown>,
  auth: CallerAuth,
): Promise<ToolResult> {
  const query = str(params, "query");
  if (!query) return textResult("search_docs: query is required", true);
  const topK = Math.min(
    Math.max(Number(params.top_k) || Number(env.TOP_K ?? "5"), 1),
    10,
  );
  const hits = await filterCitations(await callSearch(env, query, topK), auth);
  if (hits.length === 0)
    return textResult(`No documentation matches for "${query}".`);
  const lines = hits.map(
    (h) =>
      `${h.index}. ${h.title}\n   ${h.url}${h.snippet ? `\n   ${h.snippet}` : ""}`,
  );
  return textResult(lines.join("\n\n"));
}

async function toolAskDocs(
  env: Env,
  params: Record<string, unknown>,
  auth: CallerAuth,
): Promise<ToolResult> {
  const question = str(params, "question");
  if (!question) return textResult("ask_docs: question is required", true);
  const messages: ChatMessage[] = [{ role: "user", content: question }];
  const opts = {
    messages,
    ai_search_options: {
      retrieval: { max_num_results: Number(env.TOP_K ?? "5") },
    },
  };
  const instance: AiSearchInstance = env.NYUCHI_DOCS;
  const [searchRes, chatRes] = await Promise.all([
    instance.search(opts),
    instance.chatCompletions(opts),
  ]);
  const answer = chatRes.choices?.[0]?.message?.content ?? "";
  const sources = (
    await filterCitations(normaliseCitations(searchRes.chunks ?? []), auth)
  )
    .map((c) => `[${c.index}] ${c.title} — ${c.url}`)
    .join("\n");
  if (!answer)
    return textResult(
      "The docs assistant returned no answer for that question.",
      true,
    );
  return textResult(sources ? `${answer}\n\nSources:\n${sources}` : answer);
}

function resolveDocsUrl(pathOrUrl: string): URL | null {
  try {
    const url = pathOrUrl.startsWith("http")
      ? new URL(pathOrUrl)
      : new URL(
          pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`,
          DOCS_ORIGIN,
        );
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
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<(h[1-6]|p|li|tr|pre|br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function toolReadPage(
  env: Env,
  params: Record<string, unknown>,
  auth: CallerAuth,
): Promise<ToolResult> {
  const raw = str(params, "path");
  if (!raw) return textResult("read_page: path is required", true);
  const url = resolveDocsUrl(raw);
  if (!url)
    return textResult(`read_page: only ${DOCS_ORIGIN} pages can be read`, true);

  const internalPaths = await getInternalPaths(DOCS_ORIGIN);
  const internal = isInternalPath(internalPaths, url.pathname);
  if (internal && !auth.authorized) {
    return textResult(
      `read_page: ${url.pathname} is internal-only. Provide a valid Authorization: Bearer <WorkOS token> to read it.`,
      true,
    );
  }

  const headers: Record<string, string> = {
    "user-agent": "nyuchi-docs-mcp/1.0",
  };
  if (internal && auth.authorized && env.INTERNAL_FETCH_KEY) {
    headers["x-internal-fetch-key"] = env.INTERNAL_FETCH_KEY;
  }
  const res = await fetch(url.toString(), { headers });
  if (!res.ok)
    return textResult(
      `read_page: ${url.pathname} responded ${res.status}`,
      true,
    );
  const text = htmlToText(await res.text());
  const clipped =
    text.length > MAX_PAGE_CHARS
      ? `${text.slice(0, MAX_PAGE_CHARS)}\n\n[truncated]`
      : text;
  return textResult(`# ${url.pathname}\n\n${clipped}`);
}

function feedbackKey(prefix: string): string {
  return `${prefix}:${new Date().toISOString()}:${crypto.randomUUID().slice(0, 8)}`;
}

async function toolSubmitFeedback(
  env: Env,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const message = str(params, "message").slice(0, MAX_WRITE_CHARS);
  if (!message) return textResult("submit_feedback: message is required", true);
  if (!env.FEEDBACK) {
    return textResult(
      "Feedback store is not configured on this deployment.",
      true,
    );
  }
  const key = feedbackKey("feedback");
  await env.FEEDBACK.put(
    key,
    JSON.stringify({
      message,
      page: str(params, "page") || undefined,
      kind: str(params, "kind") || "other",
      contact: str(params, "contact") || undefined,
      receivedAt: new Date().toISOString(),
      via: "mcp",
    }),
  );
  return textResult(
    `Feedback recorded for the docs team (ref ${key}). Thank you.`,
  );
}

async function toolRaiseIssue(
  env: Env,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const title = str(params, "title").slice(0, 256);
  const body = str(params, "body").slice(0, MAX_WRITE_CHARS);
  if (!title || !body)
    return textResult("raise_issue: title and body are required", true);
  const page = str(params, "page");
  const fullBody = `${body}${page ? `\n\n**Page:** ${page}` : ""}\n\n---\n_Raised via the docs.nyuchi.com/mcp endpoint._`;

  if (env.GITHUB_TOKEN) {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.GITHUB_TOKEN}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "user-agent": "nyuchi-docs-mcp/1.0",
        },
        body: JSON.stringify({
          title,
          body: fullBody,
          labels: ["docs-feedback", "via-mcp"],
        }),
      },
    );
    if (res.ok) {
      const issue = (await res.json()) as {
        html_url?: string;
        number?: number;
      };
      return textResult(`Issue #${issue.number} created: ${issue.html_url}`);
    }
    // fall through to the KV queue on API failure so the report is not lost
  }

  if (!env.FEEDBACK) {
    return textResult(
      "Issue queue is not configured on this deployment.",
      true,
    );
  }
  const key = feedbackKey("issue");
  await env.FEEDBACK.put(
    key,
    JSON.stringify({
      title,
      body: fullBody,
      receivedAt: new Date().toISOString(),
      via: "mcp",
    }),
  );
  return textResult(`Issue queued for the docs team (ref ${key}).`);
}

async function callTool(
  env: Env,
  name: string,
  args: Record<string, unknown>,
  auth: CallerAuth,
): Promise<ToolResult> {
  switch (name) {
    case "search_docs":
      return toolSearchDocs(env, args, auth);
    case "ask_docs":
      return toolAskDocs(env, args, auth);
    case "read_page":
      return toolReadPage(env, args, auth);
    case "submit_feedback":
      return toolSubmitFeedback(env, args);
    case "raise_issue":
      return toolRaiseIssue(env, args);
    default:
      return textResult(`Unknown tool: ${name}`, true);
  }
}

// ── SDK registration ────────────────────────────────────────────────────

// Service-prefixed names (MCP best practice: tools from several servers share
// one namespace in the client). The original names stay registered as
// deprecated aliases for clients and the npm bridge configured against them.
export const TOOL_NAMES: Record<(typeof TOOLS)[number]["name"], string> = {
  search_docs: "nyuchi_docs_search",
  ask_docs: "nyuchi_docs_ask",
  read_page: "nyuchi_docs_read_page",
  submit_feedback: "nyuchi_docs_submit_feedback",
  raise_issue: "nyuchi_docs_raise_issue",
};

const short = (n: number) => z.string().max(n);

// Zod input schemas: same fields as the JSON Schemas in TOOLS, now with
// bounds. Non-strict: unknown arguments are stripped, as they were ignored.
const SCHEMAS = {
  search_docs: z.object({
    query: short(1000).describe("What to search for"),
    // Clamped into 1–10 (as the tool always did) rather than refused.
    top_k: z
      .number()
      .transform((v) => Math.min(10, Math.max(1, Math.floor(v))))
      .pipe(z.number().int().min(1).max(10))
      .describe("Max results (default 5, max 10)")
      .meta({ type: "integer", minimum: 1, maximum: 10 })
      .optional(),
  }),
  ask_docs: z.object({
    question: short(2000).describe("The question to answer"),
  }),
  read_page: z.object({
    path: short(2000).describe("Page path or full docs.nyuchi.com URL"),
  }),
  submit_feedback: z.object({
    message: short(MAX_WRITE_CHARS).describe("The feedback itself"),
    page: short(2000)
      .describe("Page path or URL the feedback is about")
      .optional(),
    kind: z
      .enum(["correction", "confusing", "missing", "praise", "other"])
      .describe("What kind of feedback this is")
      .optional(),
    contact: short(320)
      .describe("Optional contact (email/handle) for follow-up")
      .optional(),
  }),
  raise_issue: z.object({
    title: short(256).describe("Short issue title"),
    body: short(MAX_WRITE_CHARS).describe("What is wrong and where"),
    page: short(2000)
      .describe("Page path or URL the issue is about")
      .optional(),
  }),
} as const;

const READ = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const ANNOTATIONS: Record<
  (typeof TOOLS)[number]["name"],
  Record<string, boolean>
> = {
  search_docs: READ,
  ask_docs: READ,
  read_page: READ,
  // Writes a feedback record; adds, never changes or deletes.
  submit_feedback: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  // Files a GitHub issue (an external system) when configured.
  raise_issue: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

function createServer(env: Env, auth: CallerAuth): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  const register = (tool: (typeof TOOLS)[number], alias: boolean) => {
    const name = alias ? tool.name : TOOL_NAMES[tool.name];
    server.registerTool(
      name,
      {
        title: alias ? `${tool.title} (deprecated alias)` : tool.title,
        description: alias
          ? `Deprecated alias of ${TOOL_NAMES[tool.name]} — call that instead. ${tool.description}`
          : tool.description,
        inputSchema: SCHEMAS[tool.name],
        annotations: { title: tool.title, ...ANNOTATIONS[tool.name] },
      },
      async (args: Record<string, unknown>) => {
        try {
          return (await callTool(env, tool.name, args, auth)) as never;
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "tool execution failed";
          return textResult(`${TOOL_NAMES[tool.name]}: ${msg}`, true) as never;
        }
      },
    );
  };
  for (const tool of TOOLS) register(tool, false);
  for (const tool of TOOLS) register(tool, true);
  return server;
}

const MAX_BODY = 256 * 1024;

/**
 * Era routing (SDK pattern): 2025-era requests — the initialize handshake,
 * or any request naming neither an MCP-Protocol-Version header nor the
 * 2026-07-28 _meta envelope (the spec lets a server read that as 2025-03-26)
 * — go to a stateless JSON-mode transport; everything else to the modern
 * handler.
 */
async function isLegacyEra(request: Request): Promise<boolean> {
  if (await isLegacyRequest(request, { maxRequestBodySize: MAX_BODY }))
    return true;
  if (request.headers.get("mcp-protocol-version")) return false;
  try {
    const body = (await request.clone().json()) as {
      params?: { _meta?: Record<string, unknown> };
    };
    return !body?.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
  } catch {
    return false;
  }
}

export async function handleMcp(
  req: Request,
  env: Env,
  cors: Record<string, string>,
  auth: CallerAuth,
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "POST JSON-RPC 2.0 messages to this endpoint" }),
      {
        status: 405,
        headers: {
          allow: "POST,OPTIONS",
          "content-type": "application/json",
          ...cors,
        },
      },
    );
  }

  // Clients that omit Accept (or send only application/json) still get one
  // JSON body: the transport requires both media types, so supply them.
  let request = req;
  const accept = (req.headers.get("accept") ?? "").toLowerCase();
  if (
    !(
      accept.includes("application/json") &&
      accept.includes("text/event-stream")
    )
  ) {
    const headers = new Headers(req.headers);
    headers.set("accept", "application/json, text/event-stream");
    request = new Request(req, { headers });
  }

  let res: Response;
  if (await isLegacyEra(request)) {
    const server = createServer(env, auth);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    res = await transport.handleRequest(request);
  } else {
    const handler = createMcpHandler(() => createServer(env, auth), {
      legacy: "reject",
      responseMode: "json",
      maxRequestBodySize: MAX_BODY,
    });
    res = await handler.fetch(request);
  }
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}
