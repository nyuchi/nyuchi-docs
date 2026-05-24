import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/worker.js';

function makeEnv(partial: Partial<Env> = {}): Env {
  return {
    NYUCHI_DOCS: {
      search: vi.fn(),
      chatCompletions: vi.fn(),
    } as never,
    TOP_K: '5',
    ALLOWED_ORIGINS: 'https://docs.nyuchi.com',
    ...partial,
  } as Env;
}

async function readSseEvents(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  return text
    .split('\n\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) return null;
      return JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
    })
    .filter((v): v is Record<string, unknown> => v !== null);
}

describe('GET /health', () => {
  it('returns ok with a timestamp', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://worker/health'),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; ts: number };
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe('number');
  });
});

describe('OPTIONS preflight', () => {
  it('returns 204 with CORS headers', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://worker/chat', {
        method: 'OPTIONS',
        headers: { origin: 'https://docs.nyuchi.com' },
      }),
      env
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://docs.nyuchi.com');
  });

  it('refuses unknown origins', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://worker/chat', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example.com' },
      }),
      env
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('null');
  });
});

describe('POST /chat', () => {
  it('rejects invalid JSON', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://worker/chat', {
        method: 'POST',
        body: '<not json>',
        headers: { 'content-type': 'application/json' },
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it('rejects bodies with no user message', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://worker/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'assistant', content: 'hi' }] }),
        headers: { 'content-type': 'application/json' },
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it('503s when the requested source has no binding', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://worker/chat', {
        method: 'POST',
        body: JSON.stringify({
          source: 'bundu',
          messages: [{ role: 'user', content: 'hi' }],
        }),
        headers: { 'content-type': 'application/json' },
      }),
      env
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('bundu');
  });

  it('translates an AI Search response into citations → token → done SSE frames', async () => {
    const env = makeEnv();
    (env.NYUCHI_DOCS.search as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      chunks: [
        {
          id: 'a',
          score: 0.9,
          text: 'WorkOS handles auth at identity.nyuchi.com.',
          item: {
            key: '/identity/overview',
            attributes: {
              url: 'https://docs.nyuchi.com/identity/overview',
              title: 'Identity overview',
              breadcrumb: 'Identity',
            },
          },
        },
      ],
    });
    (env.NYUCHI_DOCS.chatCompletions as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'You configure WorkOS via identity.nyuchi.com.',
          },
          finish_reason: 'stop',
        },
      ],
    });

    const res = await worker.fetch(
      new Request('https://worker/chat', {
        method: 'POST',
        body: JSON.stringify({
          source: 'nyuchi',
          messages: [{ role: 'user', content: 'how does auth work?' }],
        }),
        headers: { 'content-type': 'application/json' },
      }),
      env
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const events = await readSseEvents(res);
    expect(events.map((e) => e.type)).toEqual(['citations', 'token', 'done']);
    const citations = events[0] as { citations: Array<Record<string, unknown>> };
    expect(citations.citations[0]).toMatchObject({
      index: 1,
      url: 'https://docs.nyuchi.com/identity/overview',
      title: 'Identity overview',
      breadcrumb: 'Identity',
    });
    expect(events[1]).toMatchObject({
      type: 'token',
      text: 'You configure WorkOS via identity.nyuchi.com.',
    });
  });

  it('skips the citations frame when the search returned no chunks', async () => {
    const env = makeEnv();
    (env.NYUCHI_DOCS.search as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      chunks: [],
    });
    (env.NYUCHI_DOCS.chatCompletions as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      choices: [{ message: { content: 'I do not have that in the docs.' } }],
    });

    const res = await worker.fetch(
      new Request('https://worker/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'unknowable' }],
        }),
        headers: { 'content-type': 'application/json' },
      }),
      env
    );
    const events = await readSseEvents(res);
    expect(events.map((e) => e.type)).toEqual(['token', 'done']);
  });

  it('emits an error frame when the AI Search call throws', async () => {
    const env = makeEnv();
    (env.NYUCHI_DOCS.search as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('rate limited')
    );
    (env.NYUCHI_DOCS.chatCompletions as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      choices: [{ message: { content: 'unused' } }],
    });

    const res = await worker.fetch(
      new Request('https://worker/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'q' }],
        }),
        headers: { 'content-type': 'application/json' },
      }),
      env
    );
    const events = await readSseEvents(res);
    expect(events).toContainEqual({ type: 'error', error: 'rate limited' });
  });
});
