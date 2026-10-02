// Verifies a caller's own WorkOS-issued bearer token (Authorization:
// Bearer <token> on the incoming MCP JSON-RPC request) so this worker
// knows *who is asking* before deciding whether to surface
// `visibility: internal` content (see nyuchi-docs's
// site/src/content.config.ts and scripts/generate-internal-paths.mjs).
//
// Deliberately checks only signature + issuer + expiry, not audience —
// any token from the Nyuchi Identity WorkOS project proves identity
// regardless of which app requested it, which is what "is this a real
// Nyuchi person" needs here. Contrast with agentgateway's OIDC policy,
// which *does* pin a specific client_id because it's terminating a
// browser login for one particular app, not accepting bearer tokens
// minted for arbitrary Nyuchi-internal clients.

import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksIssuer: string | undefined;

/**
 * The AuthKit issuer origin, from configuration only (WORKOS_ISSUER) — no
 * compiled-in default. Accepts a bare host or an https origin; trims
 * whitespace and any trailing slash. Null when unset.
 */
export function normaliseIssuer(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const origin = /^https?:\/\//.test(value) ? value : `https://${value}`;
  return origin.replace(/\/+$/, '');
}

export async function verifyBearerAuth(
  req: Request,
  configuredIssuer: string | undefined
): Promise<{ authorized: boolean; subject?: string }> {
  const issuer = normaliseIssuer(configuredIssuer);
  if (!issuer) {
    // Fail closed: without a configured issuer no token can be verified.
    if (req.headers.has('authorization')) console.error('[auth] WORKOS_ISSUER is not configured');
    return { authorized: false };
  }
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { authorized: false };

  try {
    if (!jwks || jwksIssuer !== issuer) {
      jwks = createRemoteJWKSet(new URL(`${issuer}/oauth2/jwks`));
      jwksIssuer = issuer;
    }
    const { payload } = await jwtVerify(match[1], jwks, { issuer });
    return { authorized: true, subject: typeof payload.sub === 'string' ? payload.sub : undefined };
  } catch {
    return { authorized: false };
  }
}

// The manifest is generated at nyuchi-docs build time (see
// scripts/generate-internal-paths.mjs) and served statically at
// /internal-paths.json — this worker is a separate deploy from that
// site, so it reads the list over HTTP rather than importing it, with a
// short in-isolate cache since it rarely changes.
let cachedPaths: readonly string[] | undefined;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getInternalPaths(docsOrigin: string): Promise<readonly string[]> {
  if (cachedPaths && Date.now() - cachedAt < CACHE_TTL_MS) return cachedPaths;
  try {
    const res = await fetch(`${docsOrigin}/internal-paths.json`);
    if (!res.ok) return cachedPaths ?? [];
    const data = (await res.json()) as { internalPaths?: string[] };
    cachedPaths = data.internalPaths ?? [];
    cachedAt = Date.now();
    return cachedPaths;
  } catch {
    return cachedPaths ?? [];
  }
}

export function isInternalPath(paths: readonly string[], pathname: string): boolean {
  const normalised = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return paths.some((p) => normalised === p || normalised.startsWith(p));
}
