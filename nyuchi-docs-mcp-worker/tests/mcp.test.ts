import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/worker.js';

function makeEnv(partial: Partial<Env> = {}): Env {
  return {
    NYUCHI_DOCS: {
      search: vi.fn().mockResolvedValue({ chunks: [] }),
      chatCompletions: vi.fn().mockResolvedValue({ choices: [] }),
    } as never,
    TOP_K: '5',
    ALLOWED_ORIGINS: 'https://docs.nyuchi.com',
    ...partial,
  } as Env;
}

function rpc(body: unknown): Request {
  return new Request('https://worker/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /mcp', () => {
  it('initialize returns protocol version, tools capability and server info', async () => {
    const res = await worker.fetch(rpc({ jsonrpc: '2.0', id: 1, method: 'initialize' }), makeEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: {
        protocolVersion: string;
        capabilities: { tools: object };
        serverInfo: { name: string };
      };
    };
    expect(body.result.protocolVersion).toBe('2025-11-25');
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo.name).toBe('nyuchi-docs');
  });

  it('initialize negotiates: echoes a supported requested version, offers latest otherwise', async () => {
    const older = await worker.fetch(
      rpc({ jsonrpc: '2.0', id: 'v1', method: 'initialize', params: { protocolVersion: '2025-06-18' } }),
      makeEnv()
    );
    const olderBody = (await older.json()) as { result: { protocolVersion: string } };
    expect(olderBody.result.protocolVersion).toBe('2025-06-18');

    const unknown = await worker.fetch(
      rpc({ jsonrpc: '2.0', id: 'v2', method: 'initialize', params: { protocolVersion: '2019-01-01' } }),
      makeEnv()
    );
    const unknownBody = (await unknown.json()) as { result: { protocolVersion: string } };
    expect(unknownBody.result.protocolVersion).toBe('2025-11-25');
  });

  it('notifications/initialized returns 202 with no body', async () => {
    const res = await worker.fetch(
      rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      makeEnv()
    );
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
  });

  it('tools/list exposes the five docs tools', async () => {
    const res = await worker.fetch(rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), makeEnv());
    const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
    expect(body.result.tools.map((t) => t.name)).toEqual([
      'search_docs',
      'ask_docs',
      'read_page',
      'submit_feedback',
      'raise_issue',
    ]);
  });

  it('tools/call search_docs formats AI Search hits', async () => {
    const env = makeEnv({
      NYUCHI_DOCS: {
        search: vi.fn().mockResolvedValue({
          chunks: [
            {
              text: '---\ntitle: Verification\n---\nThe four tiers…',
              item: { key: 'k', attributes: { url: 'https://docs.nyuchi.com/kweli/verification/', title: 'Verification' } },
            },
          ],
        }),
        chatCompletions: vi.fn(),
      } as never,
    });
    const res = await worker.fetch(
      rpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'search_docs', arguments: { query: 'verification tiers' } },
      }),
      env
    );
    const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
    expect(body.result.content[0].text).toContain('Verification');
    expect(body.result.content[0].text).toContain('https://docs.nyuchi.com/kweli/verification/');
  });

  it('tools/call submit_feedback writes to the FEEDBACK store', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const env = makeEnv({ FEEDBACK: { put } });
    const res = await worker.fetch(
      rpc({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'submit_feedback',
          arguments: { message: 'The Kweli overview is missing the wallet phase.', kind: 'missing' },
        },
      }),
      env
    );
    const body = (await res.json()) as { result: { content: Array<{ text: string }>; isError?: boolean } };
    expect(body.result.isError).toBeUndefined();
    expect(put).toHaveBeenCalledOnce();
    expect(put.mock.calls[0][0]).toMatch(/^feedback:/);
    expect(JSON.parse(put.mock.calls[0][1]).kind).toBe('missing');
    expect(body.result.content[0].text).toContain('Feedback recorded');
  });

  it('tools/call raise_issue queues to KV when no GITHUB_TOKEN is configured', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const env = makeEnv({ FEEDBACK: { put } });
    const res = await worker.fetch(
      rpc({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'raise_issue',
          arguments: { title: 'Broken example', body: 'The curl example 404s', page: '/platform/api/' },
        },
      }),
      env
    );
    const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
    expect(put).toHaveBeenCalledOnce();
    expect(put.mock.calls[0][0]).toMatch(/^issue:/);
    expect(body.result.content[0].text).toContain('queued');
  });

  it('rejects non-POST with 405', async () => {
    const res = await worker.fetch(new Request('https://worker/mcp'), makeEnv());
    expect(res.status).toBe(405);
  });

  it('unknown method returns JSON-RPC -32601', async () => {
    const res = await worker.fetch(rpc({ jsonrpc: '2.0', id: 6, method: 'resources/list' }), makeEnv());
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32601);
  });
});
