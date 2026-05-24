import { describe, expect, it, vi } from 'vitest';
import { createAiClient } from '../src/lib/ai-client.js';

function makeStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('createAiClient', () => {
  it('throws if baseUrl is missing', () => {
    // @ts-expect-error testing runtime guard
    expect(() => createAiClient({})).toThrow(/baseUrl/);
  });

  it('parses SSE-style token/citations/done events', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        makeStreamResponse([
          'data: {"type":"token","text":"Hello "}\n\n',
          'data: {"type":"token","text":"world"}\n\n',
          'data: {"type":"citations","citations":[{"index":1,"url":"/a","title":"A"}]}\n\n',
          'data: {"type":"done"}\n\n',
        ])
      );
    const c = createAiClient({ baseUrl: 'https://x', fetchImpl });
    const events = [];
    for await (const ev of c.chat([{ role: 'user', content: 'hi' }])) events.push(ev);
    expect(events).toEqual([
      { type: 'token', text: 'Hello ' },
      { type: 'token', text: 'world' },
      { type: 'citations', citations: [{ index: 1, url: '/a', title: 'A' }] },
      { type: 'done' },
    ]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('retries on 5xx and gives up after maxRetries', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('boom', { status: 503 }));
    const c = createAiClient({
      baseUrl: 'https://x',
      fetchImpl,
      maxRetries: 2,
    });
    const events = [];
    for await (const ev of c.chat([{ role: 'user', content: 'hi' }])) events.push(ev);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('does not retry on 4xx', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('nope', { status: 400 }));
    const c = createAiClient({
      baseUrl: 'https://x',
      fetchImpl,
      maxRetries: 3,
    });
    const events = [];
    for await (const ev of c.chat([{ role: 'user', content: 'hi' }])) events.push(ev);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(events[0]).toEqual({ type: 'error', error: 'HTTP 400' });
  });

  it('reports health', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const c = createAiClient({ baseUrl: 'https://x/', fetchImpl });
    const h = await c.health();
    expect(h.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://x/health',
      expect.anything()
    );
  });
});
