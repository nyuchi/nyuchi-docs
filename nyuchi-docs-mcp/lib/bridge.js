// stdio ⇄ Streamable-HTTP bridge for the hosted nyuchi-docs MCP server.
//
// MCP stdio framing is newline-delimited JSON-RPC. The hosted server at
// docs.nyuchi.com/mcp is stateless (each POST carries one message), so
// the bridge is a straight relay: one stdin line → one POST → one
// stdout line (or none, for notifications answered with 202).

export const DEFAULT_ENDPOINT = 'https://docs.nyuchi.com/mcp';

/**
 * Forward a single JSON-RPC line to the HTTP endpoint.
 * Returns the response body text to emit, or null for no output.
 */
export async function forwardLine(line, endpoint = DEFAULT_ENDPOINT, fetchImpl = fetch) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let res;
  try {
    res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: trimmed,
    });
  } catch (err) {
    return transportError(trimmed, `network error: ${err?.message ?? err}`);
  }

  if (res.status === 202) return null; // notification accepted, no body
  const text = (await res.text()).trim();
  if (!text) return null;
  return text;
}

function transportError(requestLine, message) {
  let id = null;
  try {
    id = JSON.parse(requestLine).id ?? null;
  } catch {
    // unparseable request — respond with a null-id error anyway
  }
  if (id === null) return null; // notification (or garbage): stay silent
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } });
}

/**
 * Run the bridge over the given streams until stdin ends.
 */
export async function runBridge({ stdin, stdout, endpoint = DEFAULT_ENDPOINT, fetchImpl = fetch }) {
  let buffer = '';
  for await (const chunk of stdin) {
    buffer += chunk.toString('utf8');
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      const out = await forwardLine(line, endpoint, fetchImpl);
      if (out) stdout.write(out + '\n');
    }
  }
  if (buffer.trim()) {
    const out = await forwardLine(buffer, endpoint, fetchImpl);
    if (out) stdout.write(out + '\n');
  }
}
