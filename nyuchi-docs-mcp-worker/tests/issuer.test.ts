// WORKOS_ISSUER is parsed — never concatenated — into an https origin, and a
// token's `iss` must equal that origin exactly. The site gate keeps an
// identical copy of the normaliser; both are exercised here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { normaliseIssuer, verifyBearerAuth } from '../src/auth.js';
import { normaliseIssuer as gateNormaliseIssuer } from '../../site/src/worker/gate.js';

for (const [name, normalise] of [
  ['mcp worker', normaliseIssuer],
  ['site gate', gateNormaliseIssuer],
] as const) {
  describe(`normaliseIssuer (${name})`, () => {
    it('is null when unset or blank', () => {
      expect(normalise(undefined)).toBeNull();
      expect(normalise('   ')).toBeNull();
    });

    it('accepts a bare host or an https origin in any case, and returns the origin', () => {
      expect(normalise('https://identity.example.test')).toBe('https://identity.example.test');
      expect(normalise('identity.example.test')).toBe('https://identity.example.test');
      expect(normalise('https://identity.example.test/')).toBe('https://identity.example.test');
      expect(normalise('HTTPS://Identity.Example.Test')).toBe('https://identity.example.test');
    });

    it('drops any path, query or fragment', () => {
      expect(normalise('https://identity.example.test/x/y?z=1#f')).toBe('https://identity.example.test');
    });

    it('treats anything that is not an https origin as unconfigured', () => {
      for (const bad of [
        'http://identity.example.test',
        'javascript://identity.example.test',
        'https://user:pass@identity.example.test',
        'user@identity.example.test',
        'https://',
      ]) {
        expect(normalise(bad), bad).toBeNull();
      }
    });
  });
}

describe('verifyBearerAuth binds iss to the normalised origin', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts iss equal to the origin and rejects prefix, slash and http variants', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
    const fetched: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      fetched.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'content-type': 'application/json' } });
    });
    const sign = (iss: string) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(iss)
        .setSubject('user_123')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
    const req = async (iss: string) =>
      new Request('https://docs.test/mcp', { headers: { authorization: `Bearer ${await sign(iss)}` } });
    const configured = 'HTTPS://Iss-Bind.Example.Test/some/path';

    expect(await verifyBearerAuth(await req('https://iss-bind.example.test'), configured)).toEqual({
      authorized: true,
      subject: 'user_123',
    });
    expect(fetched).toEqual(['https://iss-bind.example.test/oauth2/jwks']);
    for (const iss of [
      'https://iss-bind.example.test.evil.test',
      'https://iss-bind.example.test/',
      'http://iss-bind.example.test',
    ]) {
      expect(await verifyBearerAuth(await req(iss), configured), iss).toEqual({ authorized: false });
    }
  });

  it('fails closed on an issuer that is not an https origin', async () => {
    const res = await verifyBearerAuth(
      new Request('https://docs.test/mcp', { headers: { authorization: 'Bearer a.b.c' } }),
      'http://iss-bind.example.test'
    );
    expect(res).toEqual({ authorized: false });
  });
});
