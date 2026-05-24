// Client for the shamwari-docs-ai worker. Streams SSE-style events back as an
// async iterable, with bounded retry on transient network failures.

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Citation {
  index: number;
  url: string;
  title: string;
  breadcrumb?: string;
  snippet?: string;
}

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'citations'; citations: Citation[] }
  | { type: 'error'; error: string }
  | { type: 'done' };

export interface AiClientOptions {
  /** Base URL of the worker. Required. */
  baseUrl: string;
  /** Optional docs source filter. */
  source?: 'nyuchi' | 'bundu';
  /** Max retry attempts on network failure (default 2). */
  maxRetries?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** Override fetch (useful for tests). */
  fetchImpl?: typeof fetch;
}

export interface AiClient {
  chat(messages: ChatMessage[]): AsyncIterable<StreamEvent>;
  health(): Promise<{ ok: boolean }>;
}

export function createAiClient(options: AiClientOptions): AiClient {
  const {
    baseUrl,
    source,
    maxRetries = 2,
    signal,
    fetchImpl = globalThis.fetch,
  } = options;

  if (!baseUrl) {
    throw new Error('createAiClient: baseUrl is required');
  }

  const trimmedBase = baseUrl.replace(/\/$/, '');

  async function attempt(messages: ChatMessage[]): Promise<Response> {
    return fetchImpl(`${trimmedBase}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, source }),
      signal,
    });
  }

  return {
    async *chat(messages: ChatMessage[]): AsyncIterable<StreamEvent> {
      let lastErr: unknown = null;
      let res: Response | null = null;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          res = await attempt(messages);
          if (res.ok && res.body) break;
          if (res.status >= 400 && res.status < 500) {
            // Don't retry client errors.
            yield { type: 'error', error: `HTTP ${res.status}` };
            return;
          }
          lastErr = new Error(`HTTP ${res.status}`);
        } catch (err) {
          lastErr = err;
          if ((err as { name?: string })?.name === 'AbortError') {
            yield { type: 'error', error: 'aborted' };
            return;
          }
        }
        // exponential backoff: 100ms, 200ms, 400ms ...
        if (i < maxRetries) {
          await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)));
        }
      }

      if (!res || !res.ok || !res.body) {
        yield {
          type: 'error',
          error:
            lastErr instanceof Error
              ? lastErr.message
              : 'network error',
        };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE-ish framing: events separated by double newlines, each line
          // either `data: <json>` or a comment `: ...`. We also accept newline-
          // delimited JSON for simplicity.
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const dataLines = part
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim());
            const payload = dataLines.join('');
            if (!payload) continue;
            try {
              const ev = JSON.parse(payload) as StreamEvent;
              yield ev;
              if (ev.type === 'done') return;
            } catch {
              // fall back: treat as raw token
              yield { type: 'token', text: payload };
            }
          }
        }
        // Drain trailing partial frame.
        if (buffer.trim()) {
          try {
            const ev = JSON.parse(
              buffer.replace(/^data:\s*/, '').trim()
            ) as StreamEvent;
            yield ev;
          } catch {
            // ignore
          }
        }
        yield { type: 'done' };
      } finally {
        reader.releaseLock();
      }
    },
    async health() {
      const res = await fetchImpl(`${trimmedBase}/health`, { signal });
      return { ok: res.ok };
    },
  };
}
