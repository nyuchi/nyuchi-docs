// Pulls docs/AUTH.md through from the live gateway (GET /AUTH.md on
// api.nyuchi.com) into site/public/AUTH.md, so docs.nyuchi.com/AUTH.md is a
// mirror of the canonical copy in nyuchi/api-gateway rather than a
// hand-maintained duplicate that can silently drift.
//
// Best-effort, not a build gate: if the gateway is unreachable at build
// time (network policy, a deploy in progress, a CI sandbox with restricted
// egress), this logs a warning and leaves whatever's already committed in
// site/public/AUTH.md in place — a docs build should never hard-fail just
// because the live API happened to be down for a few seconds.

import { writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(SCRIPT_DIR, '..', 'public', 'AUTH.md');
const SOURCE_URL = process.env.AUTH_MD_SOURCE_URL ?? 'https://api.nyuchi.com/AUTH.md';
const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

try {
  const response = await fetchWithTimeout(SOURCE_URL, TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const body = await response.text();
  if (!body.trim().startsWith('#')) {
    throw new Error('response does not look like markdown (missing leading heading)');
  }
  await writeFile(OUT, body);
  console.log(`sync-auth-md: pulled ${body.length} bytes from ${SOURCE_URL}`);
} catch (err) {
  const existing = await readFile(OUT, 'utf-8').catch(() => null);
  console.warn(
    `sync-auth-md: could not fetch ${SOURCE_URL} (${err.message}) — ` +
      (existing
        ? 'keeping the committed copy of public/AUTH.md as-is.'
        : 'and no committed copy exists either! public/AUTH.md will 404.')
  );
}
