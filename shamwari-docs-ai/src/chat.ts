// Build a retrieval-grounded prompt and stream tokens from Workers AI.

import type { Env } from './worker.js';
import type { RetrievedChunk } from './retrieve.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `You are the documentation assistant for the Nyuchi platform and the Bundu Foundation projects (Mzizi, the Ubuntu doctrine). Answer the user's question using ONLY the provided documentation context.

Rules:
- Be concise and accurate. If the context does not contain the answer, say so plainly — do not invent facts.
- When you draw on a context chunk, cite it with a bracketed number like [1] or [2] that corresponds to its index in the CONTEXT block.
- Prefer short paragraphs and code samples over walls of text.
- Don't repeat the question back. Answer directly.`;

export function buildPrompt(
  messages: ChatMessage[],
  chunks: RetrievedChunk[]
): { messages: ChatMessage[] } {
  const contextBlock =
    chunks.length === 0
      ? 'CONTEXT: (no relevant documentation chunks found)'
      : 'CONTEXT:\n' +
        chunks
          .map(
            (c, i) =>
              `[${i + 1}] ${c.metadata.title} — ${c.metadata.url}\n${c.text}`
          )
          .join('\n\n---\n\n');

  const sys: ChatMessage = {
    role: 'system',
    content: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
  };

  // Keep the last ~6 turns for context budget.
  const trimmed = messages.slice(-12);
  return { messages: [sys, ...trimmed] };
}

interface StreamChunkPiece {
  response?: string;
  text?: string;
}

export async function* runChat(
  env: Env,
  messages: ChatMessage[],
  chunks: RetrievedChunk[]
): AsyncIterable<string> {
  const { messages: prompt } = buildPrompt(messages, chunks);

  const aiOpts: Record<string, unknown> = {
    messages: prompt,
    stream: true,
    max_tokens: 768,
  };
  if (env.AI_GATEWAY_ID) {
    aiOpts.gateway = { id: env.AI_GATEWAY_ID, skipCache: false };
  }

  const result = (await env.AI.run(env.CHAT_MODEL, aiOpts as never)) as unknown;

  // Workers AI returns a ReadableStream for stream:true. Lines look like
  // `data: {"response":"..."}\n\n` then `data: [DONE]\n\n`.
  if (!(result instanceof ReadableStream)) {
    // Non-streaming fallback (some models). Yield once.
    const r = result as StreamChunkPiece;
    if (r.response) yield r.response;
    else if (r.text) yield r.text;
    return;
  }

  const reader = result.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const lines = part.split('\n').filter((l) => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload) as StreamChunkPiece;
            const text = obj.response ?? obj.text ?? '';
            if (text) yield text;
          } catch {
            // ignore malformed frame
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
