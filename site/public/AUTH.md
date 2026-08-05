# Nyuchi API — Authentication (agent reference)

> This file is pulled through from `nyuchi/api-gateway`'s `docs/AUTH.md` —
> served live at `https://api.nyuchi.com/AUTH.md` — by
> `site/scripts/sync-auth-md.mjs` on every docs build. **Don't hand-edit
> this file**; it gets overwritten at build time. Edit `docs/AUTH.md` in
> `nyuchi/api-gateway` instead — this committed copy only exists as the
> fallback used if that build-time fetch fails. Rendered prose versions of
> the same content live at
> [docs.nyuchi.com/api/authentication](https://docs.nyuchi.com/api/authentication)
> and [docs.nyuchi.com/api/api-keys](https://docs.nyuchi.com/api/api-keys).

## Two credential types

| Credential | Identifies | Use for |
|---|---|---|
| Platform JWT (`Authorization: Bearer …`) | A signed-in person | Acting on behalf of a user |
| API key (`X-Client-Id`/`X-Client-Secret`, or `client_id` alone for `/login`) | Your application | Server-to-server calls, and registering your app's WorkOS redirect origins |

Both ride on the same base URL: `https://api.nyuchi.com/v1/*`.

## If you're building a user-facing app: WorkOS AuthKit sign-in

`GET /v1/auth/workos/login` and `GET /v1/auth/workos/callback` are a
**public, multi-tenant** pair of endpoints — every app on the Nyuchi
platform uses the same two routes. There is no per-app gateway
configuration or hardcoded domain allowlist; instead, **your app
registers its own redirect origins on its own API key.**

### Step 1 — get an API key

Sign in to `platform.nyuchi.com`, create an API key, and note its
`client_id` (`nyk_...`).

### Step 2 — register your redirect origin

```bash
curl -X PATCH https://api.nyuchi.com/v1/api-keys/{key_id}/redirect-uris \
  -H "Authorization: Bearer $PLATFORM_JWT" \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris": ["https://your-app.example/auth/callback"]}'
```

Only the origin (`scheme://host`) is actually checked — the path can be
anything. Call this again any time to add or change origins; it fully
replaces the list, so include every origin you still want.

### Step 3 — send the user to /login with your client_id

```
GET /v1/auth/workos/login?return_to=https://your-app.example/auth/callback&client_id=nyk_...
```

- `return_to` must be an **absolute URL** whose origin is on the list you
  registered in step 2. A relative path, or an origin you haven't
  registered, gets a `400` — not a redirect. This is deliberate: the
  gateway will not hand a live token to an unverified redirect target.
- Omitting `client_id` only works if your `return_to` origin happens to be
  on the gateway's first-party allowlist (`platform.nyuchi.com`, the
  Nyuchi console). Every third-party app must pass `client_id`.
- The response is `{"authorization_url": "..."}`. Redirect the user there.

### Step 4 — WorkOS redirects back to the gateway, then to you

AuthKit authenticates the user and redirects to the gateway's own
`WORKOS_REDIRECT_URI` with a one-time `code`. The gateway exchanges it,
mints a platform JWT, and 302s the browser to **your** `return_to` with
the token in the URL fragment (never the query string, so it never hits
server logs or `Referer`):

```
302 https://your-app.example/auth/callback#access_token=...&person_id=...&is_new_user=...&expires_in=...
```

Parse `window.location.hash` client-side and strip it from the URL so a
page refresh doesn't reprocess it.

### The fail-closed default — read this before scripting the flow

If `return_to`/`state` is missing when `/callback` runs — because the
caller never sent one, or WorkOS didn't round-trip it — the endpoint
returns **`400`, not the token.** It does not fall back to rendering the
JWT in the JSON response unless you explicitly pass
`allow_direct_token_response=true`. This exists because that fallback
used to be the default, and a real browser landing there put a live,
30-day access token on screen and in browser history for a real user.

**Never build an integration that sets `allow_direct_token_response=true`
by default, and never drive this flow through an actual browser without a
registered `return_to`.** The flag is for scripted, server-to-server code
exchanges only — e.g. an automated test harness that already has a
one-time `code` and wants the JSON body directly:

```bash
curl "https://api.nyuchi.com/v1/auth/workos/callback?code=$CODE&allow_direct_token_response=true"
```

If you're an agent hitting a `400` here and considering just adding
`allow_direct_token_response=true` to make it pass — stop. That flag is
for non-browser, server-to-server callers that already control the
response body privately. Fix `return_to` registration (step 2) instead.

## If you're building a script/service: API keys

For server-to-server calls that aren't acting on behalf of a specific
signed-in user, use the API key headers instead of a platform JWT:

```bash
curl https://api.nyuchi.com/v1/news/articles \
  -H "X-Client-Id: nyk_..." \
  -H "X-Client-Secret: nys_..."

# or combined:
curl https://api.nyuchi.com/v1/news/articles \
  -H "X-API-Key: nyk_....nys_..."
```

Keys are scoped to **public** namespaces only (news, weather, commerce,
and other published surfaces) — `admin`, `pay`, and other internal
namespaces reject external keys regardless of the secret.

## Using the platform JWT

```bash
curl https://api.nyuchi.com/v1/identity/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

There is no refresh endpoint. The token is valid 30 days (web) / 1 year
(native). When it expires, send the user through `/v1/auth/workos/login`
again — AuthKit's own session usually makes that instant.

## Retired — do not build against these

`/v1/auth/exchange`, `/v1/auth/refresh`, and `/v1/auth/otp/*` (the
pre-WorkOS Stytch email/SMS flow) have been removed entirely. WorkOS
AuthKit is the sole sign-in path.

## Rate limits

`/v1/auth/workos/{login,callback,logout}`: 30 requests/minute per client
IP. Every other endpoint defaults to 60/minute. `429` responses carry a
`Retry-After` header — back off, don't loop tightly.

## Further reading

- [Authentication (full guide)](https://docs.nyuchi.com/api/authentication)
- [API keys](https://docs.nyuchi.com/api/api-keys)
- [Security and rate limits](https://docs.nyuchi.com/api/security)
