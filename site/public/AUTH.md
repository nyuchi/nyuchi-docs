# Nyuchi API — Authentication (agent reference)

> This file is served directly by the gateway at
> `https://api.nyuchi.com/AUTH.md` (`text/markdown`, unauthenticated) —
> fetch it directly (`curl https://api.nyuchi.com/AUTH.md`) rather than
> parsing the rendered docs page. It's also mirrored at
> [docs.nyuchi.com/AUTH.md](https://docs.nyuchi.com/AUTH.md) and rendered
> as prose at
> [docs.nyuchi.com/api/authentication](https://docs.nyuchi.com/api/authentication)
> and [docs.nyuchi.com/api/api-keys](https://docs.nyuchi.com/api/api-keys)
> — this file in `nyuchi/api-gateway` is the source; edit it here, not on
> the docs site, so it can never drift from the code it describes.

## Three credential types — don't conflate them

| Credential | Identifies | Has a secret? | Use for |
|---|---|---|---|
| Platform JWT (`Authorization: Bearer …`) | A signed-in person | — | Acting on behalf of a user |
| API key (`X-Client-Id`/`X-Client-Secret`, `nyk_...`/`nys_...`) | Your application | Yes | Server-to-server calls to product namespaces (news, weather, commerce, …) |
| Machine token (`Authorization: Bearer …`, from `POST /v1/auth/token`) | Your application | Exchanged for one | The same as an API key, in standard OAuth `client_credentials` form — **preferred** |
| Sign-in app (`client_id` only, `nya_...`) | Your application, for login purposes only | No | Telling `GET /v1/auth/workos/login` which `redirect_uris` to trust — nothing else |

An API key and a machine token are the **same credential**, not two — the
token is what you get when you exchange the key pair at
`POST /v1/auth/token`, and it carries identical scopes and limits. Use the
token form; the raw header pair stays supported for simple scripts.

Both API keys and sign-in apps are **workspace-scoped**: every one belongs
to a workspace (a family or organization entity) and is managed by that
workspace's managers. `GET /v1/workspaces` lists the workspaces you
belong to, with your role in each. Everything rides on
`https://api.nyuchi.com/v1/*`.

## If you're building a user-facing app: WorkOS AuthKit sign-in

`GET /v1/auth/workos/login` and `GET /v1/auth/workos/callback` are a
**public, multi-tenant** pair of endpoints — every app on the Nyuchi
platform uses the same two routes. There is no per-app gateway
configuration or hardcoded domain allowlist; instead, **your app
registers its own redirect origins on a sign-in app you create for your
workspace.**

### Step 1 — find or create a workspace, then register a sign-in app

```bash
# What workspaces do I belong to, and what's my role in each?
curl https://api.nyuchi.com/v1/workspaces \
  -H "Authorization: Bearer $PLATFORM_JWT"

# Register a sign-in app under one of them (must be a manager: family
# guardian, or org founder/admin)
curl -X POST https://api.nyuchi.com/v1/auth-apps \
  -H "Authorization: Bearer $PLATFORM_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your App",
    "entity_id": "<workspace id from above>",
    "redirect_uris": ["https://your-app.example/auth/callback"]
  }'
```

The response includes a `client_id` (`nya_...`) — **there is no secret to
store**; it's a public identifier, safe to embed in frontend code, same
as an OAuth `client_id` typically is. Update the registered origins any
time with:

```bash
curl -X PATCH https://api.nyuchi.com/v1/auth-apps/{app_id}/redirect-uris \
  -H "Authorization: Bearer $PLATFORM_JWT" \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris": ["https://your-app.example/auth/callback"]}'
```

Only the origin (`scheme://host`) is actually checked — the path can be
anything.

### Step 2 — send the user to /login with your client_id

```
GET /v1/auth/workos/login?return_to=https://your-app.example/auth/callback&client_id=nya_...
```

- `return_to` must be an **absolute URL** whose origin is on the list you
  registered in step 1. A relative path, or an origin you haven't
  registered, gets a `400` — not a redirect. This is deliberate: the
  gateway will not hand a live token to an unverified redirect target.
- Omitting `client_id` only works if your `return_to` origin happens to be
  on the gateway's first-party allowlist (`platform.nyuchi.com`, the
  Nyuchi console). Every third-party app must pass `client_id`.
- The response is `{"authorization_url": "..."}`. Redirect the user there.

### Step 3 — WorkOS redirects back to the gateway, then to you

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
response body privately. Fix `return_to` registration (step 1) instead.

## If you're building a script/service: API keys

For server-to-server calls that aren't acting on behalf of a specific
signed-in user, use an API key instead — a *different* registration from
a sign-in app, and this one does carry a secret:

```bash
# Create a key under a workspace you manage
curl -X POST https://api.nyuchi.com/v1/api-keys \
  -H "Authorization: Bearer $PLATFORM_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Your Service", "entity_id": "<workspace id>", "scopes": ["news"]}'

# Then authenticate requests with either header form:
curl https://api.nyuchi.com/v1/news/articles \
  -H "X-Client-Id: nyk_..." \
  -H "X-Client-Secret: nys_..."

# or combined:
curl https://api.nyuchi.com/v1/news/articles \
  -H "X-API-Key: nyk_....nys_..."
```

Keys are scoped to **public** namespaces only (news, weather, commerce,
and other published surfaces) — `admin`, `pay`, and other internal
namespaces reject external keys regardless of the secret. `client_secret`
is shown once at creation — store it, don't lose it; `POST
/v1/api-keys/{id}/rotate` mints a new one if you do.

### Preferred: exchange the key for a short-lived token

Sending the long-lived secret on every request works, but the standard
OAuth 2.0 `client_credentials` grant is better — the secret stays on your
server and only a cheap 1-hour bearer token travels. Every OAuth client
library already speaks this:

```bash
curl -X POST https://api.nyuchi.com/v1/auth/token \
  -d grant_type=client_credentials \
  -d client_id=nyk_... \
  -d client_secret=nys_...

# → {"access_token": "...", "token_type": "Bearer",
#    "expires_in": 3600, "scope": "news places"}

curl https://api.nyuchi.com/v1/news/articles \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Send the credentials in the **form body**, not as `X-Client-Id` /
`X-Client-Secret` headers — those headers authenticate the request before
it reaches the token endpoint.

Pass `scope` to narrow a token to a subset of the key's namespaces (handy
for handing a task-specific token to a subsystem). You can never widen
beyond what the key already has — an unheld scope returns
`400 invalid_scope`.

**The token carries the same limits as the key.** Namespace scopes,
external-vs-internal separation, expiry and monthly quota are all
enforced on the bearer token exactly as on the header pair — exchanging a
key for a token is a change of transport, never an escalation. Errors
follow RFC 6749 §5.2 (`invalid_client`, `invalid_scope`,
`unsupported_grant_type`).

### What a machine credential can do

A machine credential acts **as the person who created the key**, bounded
by the key's namespace scopes. That is deliberate, and worth understanding
before you provision one: within a permitted namespace the key can do what
its creator can do. Scope keys narrowly, create them under the workspace
they belong to, and rotate them if the creator leaves.

Endpoints that are meaningless or unsafe for a robot — anything that
changes the caller's own identity, such as linking a second sign-in email
— reject machine credentials with `403`.

## Linking a second sign-in email to the same person

Real people use different emails for different contexts — a work email
for one workspace, a personal one, a different work email for another —
and it should all still be one Nyuchi identity, not three. If your user
is already signed in and wants to add another sign-in email:

```
GET /v1/auth/workos/login-link?return_to=https://your-app.example/linked
Authorization: Bearer $PLATFORM_JWT
```

This requires the caller's *own* platform JWT (they must already be
signed in) — completing hosted login with the new email is itself the
proof they own it, so there's no separate verification step. After it
succeeds, that email signs the same person in from then on; the response
redirect carries `#linked=1&email=...`, not a new token (the caller's
existing session doesn't change). If the email is already linked to a
*different* person, this rejects with `409` — it never silently merges
two people. Untangling identities that already exist as separate people
(e.g. before this endpoint existed) is a support action:
`POST /v1/admin/persons/merge`.

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

`/v1/auth/workos/{login,callback,logout}` and `/v1/auth/token`: 30
requests/minute. Every other endpoint defaults to 60/minute. `429`
responses carry a `Retry-After` header — back off, don't loop tightly.

Limits are counted **per API key** when you authenticate with one (either
header form or a machine token), and per client IP otherwise. Two services
sharing an egress IP no longer share a bucket, and moving IPs doesn't
reset your key's.

Machine tokens are minted freshly per request only if you ask for one —
cache the token for its `expires_in` rather than calling `/v1/auth/token`
on every API call, or you'll spend your auth budget on handshakes.

## Further reading

- [Authentication (full guide)](https://docs.nyuchi.com/api/authentication)
- [API keys](https://docs.nyuchi.com/api/api-keys)
- [Security and rate limits](https://docs.nyuchi.com/api/security)
- Testing this flow by hand as a team member? See `docs/AUTH_TESTING.md`
  in this repo instead — different audience, same underlying rules.
