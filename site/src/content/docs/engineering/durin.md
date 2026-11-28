---
title: "Durin: the secrets broker"
description: "Design of Durin, the platform-neutral secrets broker: threat model, caller identity, policy, response handling, audit, availability, disaster recovery, deployment recipes and the cutover order for the Nyuchi API."
sidebar:
  label: Durin, the secrets broker
---

**Status: phase 1, designed and built, not deployed.** Durin lives in [`bundu-labs/durin`](https://github.com/bundu-labs/durin) (private). Nothing in this page has been run against production. Where a fact about a platform could not be verified, it says so.

Decision (owner, 2026-11-28): the Fly app `nyuchi-api` holds about 50 Fly secrets and serves the production API. Fly secrets are write-only, so the values cannot be copied to a new app. Instead, `nyuchi-api` becomes the secrets app, hosting Durin, and the API code moves to a new app that fetches its secrets from Durin at boot. No secret is re-entered or migrated. Fly apps cannot be renamed, so the secrets app keeps the name `nyuchi-api`.

The owner's naming rule applies: servers and apps get Lord of the Rings names. The broker is **Durin**: the Doors of Durin open only to the right word. The repository is `bundu-labs/durin`; the crates are `bundu-durin` (the broker, binary `durin`) and `bundu-durin-client` (the boot-time client), in one workspace.

## Principle: Durin belongs to no platform

Durin works on Fly, Proxmox, Coolify or anywhere else. Fly is the first deployment target, nothing more. So:

- The crates contain no Fly code: no 6PN, no `.internal`, no `Fly-Src`, no `fly.toml`. Those appear only in the deployment recipes below and in `deploy/` in the repository.
- Three things vary per deployment, and each is a seam, not a branch: the **transport** (mutual TLS by default), the **caller identity** (an `Authenticator` trait) and the **secret source** (a `SecretSource` trait).
- The policy of who may read which names is a plain JSON file.

## Threat model

What Durin protects: the values of the secrets it serves, and the integrity of "caller X may read names Y".

| Threat                                                              | Control                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A compromised or misconfigured app reads secrets it was never given | Per-caller allowlist of names. A request containing any name outside it is refused whole (403), so a probe learns nothing about other values                                                                   |
| Another workload on the network pretends to be a caller             | mTLS with a client certificate pinned by SHA-256, or a per-caller token stored only as a hash and compared in constant time. The network is not the control                                                    |
| Eavesdropping or tampering on the wire                              | TLS 1.3 only, with a required client certificate in the default mode. A private network is defence in depth                                                                                                    |
| Guessing, flooding, slow clients                                    | Header and body size caps, a cap on names per request, a deadline for the whole request, a per-caller rate limit, a block on a peer that keeps failing, a connection cap                                       |
| A value leaking through Durin's own output                          | Values live in a type that prints redacted and wipes on drop; the response is written straight into a wiped buffer; no log call accepts a value; a test fails the build if a value or token appears in the log |
| A deployment mistake                                                | Durin refuses to start if a name in the policy is missing from the source, if a certificate caller is configured without mTLS, or if plaintext is set on a public or wildcard address                          |
| A stolen bearer token                                               | Tokens are per caller and revocable by removing the hash; prefer mTLS, where there is no bearer to steal in transit                                                                                            |

Out of scope, and said plainly: **an attacker who controls the host that runs Durin** reads the same environment or files Durin does. Durin narrows who else can read the secrets; it does not make the host trustworthy. Values sit in process memory and the environment; memory is wiped on drop on a best-effort basis (the operating system may have swapped it). Durin holds values read at boot, so a rotated value needs a restart.

## Caller identity

The server maps what a connection presented to a caller id through an `Authenticator`. Two are built in; the trait is the extension point for platform identity.

### Built in

- **mTLS client certificate (the default).** The TLS layer requires a client certificate that chains to the configured client CA. Durin then pins the caller by the SHA-256 of the certificate's DER, listed in the policy. A valid certificate from the right CA that is not pinned is refused (401). Rotation: list the old and new hashes together, then remove the old one. Platform-neutral, no external dependency.
- **Per-caller token.** `Authorization: Bearer <token>`. The policy stores only the SHA-256 of each token; Durin hashes what it receives and compares every stored hash in constant time, with no early exit. `durin gen-token` makes a 256-bit token and its hash.

### Researched for platform identity (not built in phase 1)

What was checked against Fly's documentation and public endpoints on 2026-11-28:

| Option                  | What is verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Assessment                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fly machine OIDC token  | A machine POSTs to `/v1/tokens/oidc` over the `/.fly/api` Unix socket with an `aud` of its choosing and gets a JWT (Fly docs, OpenID Connect). The org's discovery document at `https://oidc.fly.io/<org>/.well-known/openid-configuration` was fetched: issuer `https://oidc.fly.io/<org>`, JWKS at `.../.well-known/jwks`, signing algorithm RS256, an RSA key set with one key, claims including `app_name`, `org_name`, `machine_id`, `region`, `image_digest`, `sub` as `<org>:<app>:<machine>` | **Strongest for Fly.** Cryptographic, audience-bound, short-lived, issued per machine, and no bootstrap credential on the caller. Fly-specific, so it is a provider, not the core |
| `Fly-Src` header        | Documented only in a Fly community post: added by Fly's proxy to Flycast requests, `instance=;app=;org=;ts=`, signed with ed25519 (`Fly-Src-Signature`), public key at `/.fly/fly-src.pub`. The post itself warns that apps in the same org can send traffic straight to a machine and set any `Fly-Src`, and that an SSRF in a trusted client yields a valid header. Not in Fly's reference pages                                                                                                   | Weaker: bypassable by any same-org app that talks to the machine directly, and only present on proxied (Flycast) traffic. Not chosen                                              |
| Per-app bootstrap token | Works anywhere                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Needs one secret on each caller: this is the built-in token mode, the portable fallback                                                                                           |
| Fly 6PN source address  | Same-org apps reach each other by 6PN address. Addresses can change when a machine moves host (Fly docs, Private networking)                                                                                                                                                                                                                                                                                                                                                                         | An address is not an identity. Rejected                                                                                                                                           |

**Choice.** The core default is **mTLS**: the most secure option that is verifiably supported on every target and that does not depend on one platform. For Fly, the recommended end state is a **Fly OIDC provider** (an `Authenticator` that verifies the RS256 token against the org JWKS, checks `iss`, `aud`, `exp`, a short `iat` window and a `jti` replay cache, and maps `app_name` to a caller). It is deliberately not in phase 1: it needs a JWT and RSA verification dependency and a JWKS fetch, which belong in a separate, reviewed provider crate and not in the platform-neutral core.

**Consequence to accept.** Until the Fly OIDC provider exists, each caller needs one credential (a client certificate and key, or a token) delivered to it. That is a secret on the caller, which cuts across the "new apps set no secrets of their own" goal by exactly one secret per app, and it can be a file or a Fly secret that exists only to unlock Durin. Closing that gap is the reason to build the OIDC provider next.

**Not verified.** No token was requested from a machine, no JWT was verified, and `Fly-Src` was not tested; all three would need a running machine. The OIDC token lifetime is stated two ways on the same Fly page (15 minutes and an example with a 10 minute spread). The JWKS served by the org's OIDC endpoint was read, not used. Whether Fly's `[[files]]` secret-backed files suit certificate material under load was read in the reference, not tried.

## Policy: a per-caller allowlist of secret names

A plain JSON file, reviewed like code. It holds ids, hashes and names; never a value or a token.

```json
{
  "version": 1,
  "rate_limit": { "per_minute": 60, "burst": 10 },
  "callers": [
    { "id": "api", "cert_sha256": ["<hex>"], "allow": ["DATABASE_URL", "API_KEY"] },
    { "id": "shamwari-core", "token_sha256": ["<hex>"], "allow": ["NYUCHI_AI_SERVICE_API_KEY"] }
  ]
}
```

Rules enforced at load: caller ids are lower case; names are letters, digits, `_`, `.`, `-` (so a name can never be a path); names beginning `DURIN_` are reserved and never served; a credential hash cannot belong to two callers; every caller needs a credential and at least one name. Unknown fields are errors. The names the source must hold are the union of every caller's allowlist, and Durin does not start if any is missing.

## The listener

Durin listens on one configured address with plain HTTP(S) (`listen` in its config). It is not a platform feature, so "internal only" is a deployment rule: bind a private address, and expose no public service.

- Modes: `mtls` (TLS 1.3, client certificate required, the recommendation), `tls` (server authentication only, callers use tokens), `plaintext` (refused unless the address is loopback or private, not a wildcard, and `i_understand_this_is_unencrypted` is true).
- One request per connection, `Connection: close`, no chunked bodies, no pipelining. Responses carry `Cache-Control: no-store`.
- Routes: `POST /v1/secrets` with `{"names":["A","B"]}`, `GET /health`, `GET /ready`. Errors are RFC 9457 problem documents.

A Fly deployment adds: no `[http_service]` and no `[[services]]`, so Fly's proxy routes nothing to the app, and `fly ips list` prints no addresses. Other apps in the organisation reach the machines over the private network, by `durin.internal`, or `durin.process.nyuchi-api.internal` for a process group (the per-process-group DNS form is in Fly's private networking docs). Fly's private network is defence in depth here; mutual TLS stays the control.

## Response handling

- A value is held in `Secret`: `Debug` and `Display` print `<redacted>`, it is wiped on drop, and `expose` is called in one place, the response writer.
- The response body is written straight into a buffer that is wiped on drop, with no intermediate string or JSON tree holding a copy.
- No log call accepts a value; the logger takes names, codes and addresses.
- The client crate has no function that writes a value to the environment, a file or a log. `Secrets` prints names only. Callers must not re-export values into `std::env` or a child process environment; the type gives no help to do so.
- Requests are all or nothing: one disallowed name refuses the whole request, and the 403 names only the offending names, which the caller supplied.

## Audit log

One JSON line per request on stderr (collect it with the platform's log shipper):

```json
{"event":"fetch","ts":"2026-11-28T14:00:00Z","request_id":"6a3f-2","caller":"api","method":"mtls","peer":"fdaa::1","names":["DATABASE_URL"],"status":200,"outcome":"ok"}
```

Failed authentication logs the peer and what was presented (`token`, `cert` or `none`), never the credential. Handshake failures, blocked peers, bad requests and refused connections are logged the same way. The log-leak test runs every path and asserts that no secret value, no source value that is in no policy and no token appears in the captured log.

## Availability and failure behaviour

- **Two machines.** Durin keeps no state apart from rate-limit counters, so any machine answers any request. Run at least two, in different hosts or regions, so one can restart without an app failing to boot. A rate limit is per machine; the effective limit is the configured one times the number of machines.
- **Fail closed by default.** If the client cannot reach Durin after its retries (3 retries with backoff, 3 s connect timeout, 5 s per read and write), `fetch` returns an error and the app should refuse to start. A 401 or 403 is never retried.
- **Cached last fetch, only when asked for.** `CachePolicy::InMemory { max_age }` returns the last good answer from the process's memory if it is at most `max_age` old and covers every name asked for, and only after a connection or server failure. A 401 or 403 is never covered by the cache, so revoking a caller still takes effect. There is no disk cache.
- Durin itself fails closed at boot: a missing secret, a bad policy or bad TLS material stops it.
- `SIGTERM` ends the process at once; connections are short and clients retry. Rotation of a value is a restart.

## Disaster recovery

Fly secrets are write-only, so **the source of truth cannot be Fly**. If `nyuchi-api` is deleted or its secrets are lost, nothing in Fly can restore them.

- Keep every secret value in the owner's vault (1Password, or erebor for operator-held values), and treat the Fly secrets as a deployed copy. A vault backend for Durin is the next `SecretSource`.
- Before the cutover, confirm that **every one of the about 50 names** is present in the vault with a verified value. Fly shows names and digests only, so this cannot be checked from Fly; check by rebuilding a throwaway copy of an app from the vault values.
- Keep the policy file, the Durin configuration and the certificate authority's private key (offline) in the vault or in version control as appropriate. The policy and configuration hold no secret and belong in git.
- Recovery order: recreate the Fly app, set secrets from the vault, deploy Durin from a tagged release, re-issue client certificates or tokens if the CA was lost.

## Deployment recipes (examples, not deployed)

All are under `deploy/` in the repository.

**Fly.** Durin as its own app (`deploy/fly/fly.toml`, app `durin`): no services, two machines, `DURIN_CONFIG` pointing at a config that uses `source: env`, and the TLS material delivered with `[[files]]` entries that read base64 Fly secrets into files (Fly's configuration reference describes `secret_name` this way). Or, for the cutover, as a process group of an existing app (below).

**Docker or Proxmox.** `deploy/docker/compose.yml`: the image, a read-only root, all capabilities dropped, the port published on a private address only, the config and TLS files mounted read-only, and a directory source fed by Docker secrets.

**Coolify.** `deploy/coolify/README.md`: the Dockerfile build pack, no public domain, secrets as environment variables marked secret or file mounts, the config under `/etc/durin`.

## Cutover order for the Nyuchi API (documented, not executed)

Throughout, the legacy API keeps serving until the new one is proven. Do the steps in order and stop at the first doubt.

**Step 0. Preconditions.** Every secret name is in the vault with a verified value (above). A tagged Durin release exists. Policy and config are reviewed.

1. **Ship Durin as a second, internal-only component of `nyuchi-api`.** Add the `durin` binary to the `nyuchi-api` image, and add a process group for it (in `fly.toml`: `[processes]` with `app` set to the current command, `uvicorn gateway.main:app --host 0.0.0.0 --port 8080`, and `durin = "/usr/local/bin/durin serve"`; scope `[http_service]`, the health checks and the existing `[[vm]]` to the `app` group; give Durin its own `[[vm]]` and two machines; deliver its config and TLS files with `[[files]]` limited to the `durin` group). Durin's process sees the same environment as the legacy API, so its source is `env` and no secret moves. Durin has no `[[services]]` entry, so nothing public changes. **Rollback:** scale the `durin` group to zero, or redeploy the previous release (`fly releases` then `fly deploy --image <previous>`); the legacy group is unchanged throughout.
2. **Create the new API app.** It sets no secrets; at boot it fetches its names from Durin over the private network using `bundu-durin-client`, and refuses to start if Durin does not answer. Prove it against a private test hostname and compare its behaviour with `api.nyuchi.com`. **Rollback:** destroy or scale the new app to zero; nothing public pointed at it.
3. **Move the public hostnames and certificates** (`api.nyuchi.com`, `auth.nyuchi.com`) to the new app. Keep the old app serving until the new one is proven; add the certificates on the new app before changing DNS, lower the TTL first, and watch error rates. **Rollback:** point the names back at the old app (its certificates stay in place until step 5).
4. **Re-point every caller of `nyuchi-api.internal`** to the new app (the list is below). **Rollback:** change each caller's URL back; the legacy group still serves until step 5.
5. **Only then remove the legacy API code** from `nyuchi-api` so it runs Durin alone: drop the `app` process group and the API from the image. Before this, re-point the monitoring scrape (below), because the old `:9091` metrics target disappears. **Rollback:** redeploy the release from before this step (the image history keeps it); the vault is the backstop if anything about the app itself is lost.

## Callers of `nyuchi-api.internal` found in code search

A search of the estate checked out on the owner's machine (`/Users/bryanfawcett/GitHub`) on 2026-11-28 found:

| Caller                                                                                                                       | How it reaches the app                                                                                                                          | Action at step 4                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shamwari core (`bundu-labs/shamwari`, `shamwari-ai/shamwari`)                                                                | `NYUCHI_API_URL=http://nyuchi-api.internal:8080` in `core/fly.toml`, `.env.example`, `core/nyuchi_api.py` default; sends `Host: api.nyuchi.com` | Change the URL and the default to the new app. The runbook (`docs/core-fly-runbook.md`) also says Core reaches it over 6PN only if both apps are in one Fly org |
| nyuchi-monitoring (Prometheus, `nyuchi/data-infra`)                                                                          | `dns_sd_configs` on `nyuchi-api.internal` port 9091 for `/metrics`, in `monitoring/prometheus/prometheus.yml.tmpl`                              | Point the job at the new app, before step 5                                                                                                                     |
| mukoko-news-pipeline fly-worker and enrichment agent (`nyuchi/mukoko-news-pipeline`, `mukoko-dev/mukoko-ingestion-pipeline`) | Tests use `http://nyuchi-api.internal:8000/` for `/internal/news/events`; the live value is a deployment variable and was not checked           | Check the live `NYUCHI_API_URL` of each Fly app; port 8000 does not match the API's 8080, so this may be stale                                                  |

Not callers over Fly's network, though the name appears: `nyuchi-platform/console/backend` rejects `.internal` and `.flycast` origins on purpose (an SSRF guard, tested); `wt-weather-backend` and `mukoko-weather` use `https://nyuchi-api.internal` as a placeholder origin for a Worker service binding; the Vercel and Worker callers (`mukoko-news`, `nyuchi-identity`) use `https://api.nyuchi.com` and follow the hostname at step 3. The doc `nyuchi-api/docs/architecture/shamwari.md` and the comment in `fly.toml` describe `:8080` and `:9091` and should change with the cutover. Callers outside the checked-out repositories (other Fly apps with their own secrets, scripts on other machines) were not searched: run `fly status` for each app in the organisation and check their environment variable names before step 4.

## What phase 1 does not do

- No deploy of any kind, no Fly secret, DNS or certificate change.
- No Fly OIDC provider and no vault source yet.
- No hot reload: values and policy are read at boot.
- No `Dockerfile` run on the author's machine (no Docker there); CI builds the image.
