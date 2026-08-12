// Gates `visibility: internal` pages (see src/content.config.ts and
// scripts/generate-internal-paths.mjs) behind a WorkOS OIDC login, and
// falls through to the static asset router for everything else — public
// pages are never touched by any of this.
//
// Session model: the cookie *is* the WorkOS ID token. WorkOS already
// signs it; re-verifying that signature (+ exp) on each request is the
// session check, so there's no separate app-level session secret to
// manage or rotate. `docs_oauth_state` is a short-lived cookie carrying
// this request's PKCE verifier + CSRF state + where to return to; it only
// exists for the few minutes of the login redirect round-trip.
//
// Service-to-service bypass: nyuchi-docs-mcp-worker independently verifies
// each MCP caller's own bearer token before deciding whether to read an
// internal page, then forwards INTERNAL_FETCH_KEY on its own fetch to
// this worker so that already-authorized read doesn't have to go through
// a browser OIDC dance. The key is a Wrangler secret shared between the
// two workers; treat it like any other service credential.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { INTERNAL_PATHS } from './internal-paths.generated.js';
import { securityTxtResponse } from './security-txt.js';

export interface Env {
  ASSETS: Fetcher;
  WORKOS_CLIENT_ID: string;
  WORKOS_ISSUER: string;
  /**
   * Optional: only present for a confidential Connect app. The app this
   * gate actually uses — WorkOS's shared "Nyuchi Internal Tools" app,
   * `clientConfidentiality: "Public"` — has no client secret at all
   * (PKCE is the whole story for a public client); omit this var
   * entirely rather than setting it empty. Kept optional, not deleted,
   * so a future confidential app swap doesn't need a code change too.
   */
  WORKOS_CLIENT_SECRET?: string;
  /** Shared secret nyuchi-docs-mcp-worker sends to bypass the browser flow for callers it has already authorized itself. */
  INTERNAL_FETCH_KEY?: string;
}

const SESSION_COOKIE = 'docs_session';
const OAUTH_STATE_COOKIE = 'docs_oauth_state';
const CALLBACK_PATH = '/oauth/callback';
const SECURITY_TXT_PATH = '/.well-known/security.txt';

function isInternalPath(pathname: string): boolean {
  const normalised = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return INTERNAL_PATHS.some((p) => normalised === p || normalised.startsWith(p));
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get('cookie') ?? '';
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function clearCookie(name: string): string {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64url(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(digest));
  return { verifier, challenge };
}

// jose's remote JWKS caches keys internally; module-level so it survives
// across requests to the same isolate instead of re-fetching every time.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksIssuer: string | undefined;

async function verifySession(env: Env, token: string): Promise<JWTPayload | null> {
  try {
    if (!jwks || jwksIssuer !== env.WORKOS_ISSUER) {
      jwks = createRemoteJWKSet(new URL(`${env.WORKOS_ISSUER}/oauth2/jwks`));
      jwksIssuer = env.WORKOS_ISSUER;
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.WORKOS_ISSUER,
      audience: env.WORKOS_CLIENT_ID,
    });
    return payload;
  } catch {
    return null;
  }
}

function redirectToLogin(env: Env, url: URL, verifier: string, challenge: string, state: string): Response {
  const authorizeUrl = new URL(`${env.WORKOS_ISSUER}/oauth2/authorize`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', env.WORKOS_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', `${url.origin}${CALLBACK_PATH}`);
  authorizeUrl.searchParams.set('scope', 'openid');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const stateCookiePayload = JSON.stringify({ state, verifier, redirectTo: url.pathname + url.search });
  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl.toString(),
      'set-cookie': setCookie(OAUTH_STATE_COOKIE, stateCookiePayload, 300),
    },
  });
}

async function handleCallback(env: Env, req: Request, url: URL): Promise<Response> {
  const cookies = parseCookies(req);
  const raw = cookies[OAUTH_STATE_COOKIE];
  if (!raw) return new Response('Login expired — go back and try again.', { status: 400 });

  let saved: { state: string; verifier: string; redirectTo: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return new Response('Malformed login state.', { status: 400 });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== saved.state) {
    return new Response('Login state mismatch — possible CSRF, try again.', { status: 400 });
  }

  const tokenParams: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: env.WORKOS_CLIENT_ID,
    code,
    code_verifier: saved.verifier,
    redirect_uri: `${url.origin}${CALLBACK_PATH}`,
  };
  if (env.WORKOS_CLIENT_SECRET) tokenParams.client_secret = env.WORKOS_CLIENT_SECRET;

  const tokenRes = await fetch(`${env.WORKOS_ISSUER}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(tokenParams),
  });
  if (!tokenRes.ok) {
    return new Response(`Login failed exchanging code: ${tokenRes.status}`, { status: 502 });
  }
  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return new Response('Login response had no id_token.', { status: 502 });

  const payload = await verifySession(env, tokens.id_token);
  if (!payload) return new Response('Login succeeded but the returned token failed verification.', { status: 502 });

  const maxAge = payload.exp ? Math.max(60, payload.exp - Math.floor(Date.now() / 1000)) : 3600;
  return new Response(null, {
    status: 302,
    headers: {
      location: saved.redirectTo || '/',
      'set-cookie': setCookie(SESSION_COOKIE, tokens.id_token, maxAge),
    },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Public and generated per request — see src/worker/security-txt.ts for
    // why this isn't a file in ./public. Answered before anything else so it
    // can never be gated or shadowed by an asset.
    if (url.pathname === SECURITY_TXT_PATH) {
      return securityTxtResponse();
    }

    if (url.pathname === CALLBACK_PATH) {
      const res = await handleCallback(env, req, url);
      // one-shot: the state cookie is spent whether the callback succeeded or not
      res.headers.append('set-cookie', clearCookie(OAUTH_STATE_COOKIE));
      return res;
    }

    if (!isInternalPath(url.pathname)) {
      return env.ASSETS.fetch(req);
    }

    // Trusted service-to-service caller (nyuchi-docs-mcp-worker, having
    // already verified its own end user) — skip the browser flow entirely.
    if (env.INTERNAL_FETCH_KEY && req.headers.get('x-internal-fetch-key') === env.INTERNAL_FETCH_KEY) {
      return env.ASSETS.fetch(req);
    }

    const cookies = parseCookies(req);
    const session = cookies[SESSION_COOKIE];
    if (session && (await verifySession(env, session))) {
      return env.ASSETS.fetch(req);
    }

    const { verifier, challenge } = await pkcePair();
    const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
    return redirectToLogin(env, url, verifier, challenge, state);
  },
} satisfies ExportedHandler<Env>;
