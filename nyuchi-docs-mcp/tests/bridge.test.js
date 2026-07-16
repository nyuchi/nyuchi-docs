import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { forwardLine, runBridge } from '../lib/bridge.js';

const ok = (body, status = 200) =>
  Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

describe('forwardLine', () => {
  it('POSTs the line and returns the response body', async () => {
    const fetchImpl = vi.fn().mockReturnValue(ok({ jsonrpc: '2.0', id: 1, result: {} }));
    const out = await forwardLine('{"jsonrpc":"2.0","id":1,"method":"ping"}', 'https://x/mcp', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('https://x/mcp', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(out).id).toBe(1);
  });

  it('returns null for 202 notification responses', async () => {
    const fetchImpl = vi.fn().mockReturnValue(ok('', 202));
    const out = await forwardLine(
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      'https://x/mcp',
      fetchImpl
    );
    expect(out).toBeNull();
  });

  it('returns a JSON-RPC error on network failure for requests with an id', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const out = await forwardLine('{"jsonrpc":"2.0","id":7,"method":"ping"}', 'https://x/mcp', fetchImpl);
    const parsed = JSON.parse(out);
    expect(parsed.id).toBe(7);
    expect(parsed.error.message).toContain('offline');
  });

  it('skips empty lines', async () => {
    const fetchImpl = vi.fn();
    expect(await forwardLine('   ', 'https://x/mcp', fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('runBridge', () => {
  it('relays newline-delimited messages in order', async () => {
    const fetchImpl = vi
      .fn()
      .mockReturnValueOnce(ok({ jsonrpc: '2.0', id: 1, result: { a: 1 } }))
      .mockReturnValueOnce(ok('', 202))
      .mockReturnValueOnce(ok({ jsonrpc: '2.0', id: 2, result: { b: 2 } }));
    const stdin = Readable.from([
      '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n',
      '{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n',
    ]);
    const lines = [];
    const stdout = { write: (s) => lines.push(s.trim()) };
    await runBridge({ stdin, stdout, endpoint: 'https://x/mcp', fetchImpl });
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).id).toBe(1);
    expect(JSON.parse(lines[1]).id).toBe(2);
  });
});
