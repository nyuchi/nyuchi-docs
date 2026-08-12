// /.well-known/security.txt — RFC 9116 vulnerability-disclosure contact.
//
// Served from the gate worker rather than checked into `site/public/` on
// purpose: RFC 9116 makes `Expires` mandatory and requires it to be less than
// a year out, so a static file quietly becomes non-compliant the moment it
// ages past that. `site/wrangler.toml` sets `run_worker_first = true`, so
// every request already passes through src/worker/gate.ts before the asset
// router — deriving `Expires` per request there means the file can never
// expire, however long it is between deploys.
//
// Mirrors nyuchi/nhimbe and nyuchi/kweli, which serve the same file from a
// dynamic route for the same reason.

/** Days ahead to set `Expires`. Well inside RFC 9116's one-year maximum. */
const EXPIRY_DAYS = 180;

const CANONICAL = 'https://docs.nyuchi.com/.well-known/security.txt';

export function buildSecurityTxt(now: Date = new Date()): string {
  const expires = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // No `Policy:` field: this repo has no SECURITY.md and there is no
  // published Nyuchi disclosure policy document to point at yet. RFC 9116
  // makes the field optional — a URI that 404s is worse than its absence.
  return `# Nyuchi Docs (docs.nyuchi.com) — security contact (RFC 9116)
# Please report vulnerabilities privately; do not open a public GitHub issue.

Contact: mailto:security@nyuchi.com
Expires: ${expires.toISOString()}
Preferred-Languages: en
Canonical: ${CANONICAL}
`;
}

export function securityTxtResponse(): Response {
  return new Response(buildSecurityTxt(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Deliberately far shorter than EXPIRY_DAYS so no cached copy can
      // outlive the `Expires` it was generated with.
      'cache-control': 'public, max-age=3600',
    },
  });
}
