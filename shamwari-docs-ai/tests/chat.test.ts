import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../src/chat.js';
import type { RetrievedChunk } from '../src/retrieve.js';

const chunks: RetrievedChunk[] = [
  {
    id: 'a',
    score: 0.9,
    text: 'Run `pnpm install` then `pnpm dev`.',
    metadata: {
      source: 'nyuchi',
      url: '/platform/quickstart',
      title: 'Quickstart',
      breadcrumb: 'Platform',
      chunk_index: 0,
    },
  },
  {
    id: 'b',
    score: 0.85,
    text: 'Configure authentication via WorkOS.',
    metadata: {
      source: 'nyuchi',
      url: '/identity/overview',
      title: 'Identity overview',
      breadcrumb: 'Identity',
      chunk_index: 0,
    },
  },
];

describe('buildPrompt', () => {
  it('emits a system message with a CONTEXT block of numbered chunks', () => {
    const { messages } = buildPrompt(
      [{ role: 'user', content: 'how do I start?' }],
      chunks
    );
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('[1] Quickstart');
    expect(messages[0].content).toContain('/platform/quickstart');
    expect(messages[0].content).toContain('[2] Identity overview');
    expect(messages[0].content).toContain('pnpm install');
  });

  it('preserves user/assistant messages after the system prompt', () => {
    const convo = [
      { role: 'user' as const, content: 'q1' },
      { role: 'assistant' as const, content: 'a1' },
      { role: 'user' as const, content: 'q2' },
    ];
    const { messages } = buildPrompt(convo, []);
    expect(messages.length).toBe(4);
    expect(messages[1]).toEqual(convo[0]);
    expect(messages[3]).toEqual(convo[2]);
  });

  it('handles zero chunks gracefully', () => {
    const { messages } = buildPrompt(
      [{ role: 'user', content: 'q' }],
      []
    );
    expect(messages[0].content).toContain('no relevant documentation');
  });

  it('caps history to the last 12 messages', () => {
    const long = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `m${i}`,
    }));
    const { messages } = buildPrompt(long, []);
    // 1 system + 12 trimmed
    expect(messages.length).toBe(13);
    expect(messages[1].content).toBe('m8');
    expect(messages[12].content).toBe('m19');
  });
});
