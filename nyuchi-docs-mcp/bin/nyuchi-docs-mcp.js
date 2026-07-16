#!/usr/bin/env node
// nyuchi-docs-mcp — stdio MCP server bridging to docs.nyuchi.com/mcp.
// Usage: nyuchi-docs-mcp [endpoint]   (or NYUCHI_DOCS_MCP_URL env var)

import { runBridge, DEFAULT_ENDPOINT } from '../lib/bridge.js';

const endpoint = process.argv[2] || process.env.NYUCHI_DOCS_MCP_URL || DEFAULT_ENDPOINT;

runBridge({ stdin: process.stdin, stdout: process.stdout, endpoint }).catch((err) => {
  process.stderr.write(`nyuchi-docs-mcp: ${err?.message ?? err}\n`);
  process.exit(1);
});
