---
title: "The four gateways and the Rust architecture"
description: "How the four API gateways divide the work, how the Rust services are laid out (core, origin, edge), how access is denied by default and authorized from the WorkOS permissions claim, and how a route moves from Python to Rust."
sidebar:
  label: Gateways and Rust architecture
---

**Status: built in the repositories, not serving production traffic.** The Nyuchi API (Python, FastAPI) still answers every production route except twenty shadowed reads. The Rust rebuild of the Nyuchi API and the Nyuchi Servers API are built and tested; neither has moved a route. The migration status page has the numbers. Where this page and the code disagree, the code is the fact.

Decision (owner, 2026-11-29): `nyuchi/nyuchi-servers-api` (Rust) must do everything the Python Nyuchi API (`nyuchi/nyuchi-api`, 522 routes) does, and the Nyuchi API is being rebuilt in Rust. Earlier decisions it builds on: "move everything over to Rust" (2026-11-13) and "the Nyuchi API splits into B2B and the new Nyuchi Servers picks up the internal usage" (2026-10-20).

## The four gateways

| Gateway                | Who calls it                                | Repository                                              |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Mzizi API              | Anyone, free and public (the registry)      | `api.mzizi.dev` (`mzizi-dev/mzizi-api`)                 |
| Nyuchi API (B2B)       | External customers, with scoped `nyk_` keys | `api.nyuchi.com` (`nyuchi/nyuchi-api`)                  |
| Mukoko API (consumer)  | Person-facing app surfaces                  | `api.mukoko.com` (no DNS yet)                           |
| **Nyuchi Servers API** | Internal callers only, no public address    | `nyuchi/nyuchi-servers-api`, on its own internal domain |

All four are rebuilt in Rust on the same layout. The [API playbook](/playbooks/api/) decides contracts, errors, auth and limits across the four.

The Servers API is the one door to the data layer for backend services: a service that needs MongoDB, the Postgres ledger or the Shamwari ground corpus asks this API instead of holding a database credential (owner, 2026-11-13). It is never served to customers, apps or the public.

## Core, origin, edge

Every Rust service is a Cargo workspace with three layers, the same in both repositories.

| Layer    | Crate (Servers API) | What it is                                                                                                                                                  |
| -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`   | `servers-core`      | Decisions only: parsing, validation, rules, the traits for stores and keys. No I/O. Builds natively and for `wasm32`, so the edge and the tests share it.   |
| `origin` | `servers-origin`    | The `axum` binary, shipped as a distroless container. It owns the adapters (MongoDB, Postgres, HTTP clients), the access policy, rate limits and readiness. |
| `edge`   | `servers-edge`      | A `workers-rs` Cloudflare Worker with no public route. It checks the caller's token, then forwards to the origin over a private path.                       |

The rules that follow from the split:

- **Stores are traits in `core`** (`KeyStore`, `UsageSink`, and one per namespace) with an in-memory fake for tests and an adapter in `origin`. A handler that cannot be tested over the fake is in the wrong layer.
- **The origin verifies every credential itself.** It trusts no header the edge adds, except the one client-address header the deployment names.
- **Nothing crashes.** A handler panic becomes a `500` and the process keeps serving. Requests have timeouts and body limits, shutdown drains, and a configuration error stops the process at startup with a message that names the variable and never a value.
- **Errors are RFC 9457 problems.** `/health` is liveness, `/ready` checks each dependency and answers only `ready` or a bare `503`. The per-dependency report is `GET /internal/readiness`, behind the `ops` scope.

The Nyuchi API rebuild has the same three layers plus a `paypal` crate, and its edge Worker also carries the route router described below.

## Access: deny by default

The Servers API serves a route only if one table lists it.

- **One table, `access::POLICY`,** lists every route and what it needs. A route it does not list is not served, whatever the router holds: a stranger gets `401`, a caller `404`. A test walks the table so a route with no scope cannot pass.
- **Only `/health` and `/ready` answer without a credential.** Every other route needs an internal key **and** a bearer token, and both must carry the route's scope. A key or token valid for one scope fails on any other with `403`.
- **Scopes are small and named per namespace**: `ops` (version, contract, who is calling), `shamwari`, `weather-read` and `weather-write` (neither implies the other), and `maps` (read-only, `GET` only). New scopes live in the Rust build, never in the Python key catalogue.
- **Rate limits run before any authentication work.** Per client address, per presented client id (existing or not), and per address for failed authentications, after which that address is refused with no key lookup. A refusal is `429` with `Retry-After`. The defaults are unmeasured guesses and are set by environment variables.
- **Every answer carries `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`**, except a maps success, which passes through the maps origin's own cache policy.

## Authorization from the WorkOS permissions claim

Identity is WorkOS (see [Identity](/playbooks/identity/)). What a caller may do is read from **one place**: the access token's `permissions` claim.

1. **The edge checks the token.** When the three WorkOS settings (issuer, audience, key-set address) are all set, every request but `/health` needs a bearer token that is `RS256` (`none` and HMAC algorithms are refused), whose key is found by `kid` in the issuer's key set, whose signature verifies, and whose issuer, audience, `exp` and `nbf` match (30 seconds of leeway). A failure is a `401` problem with `WWW-Authenticate: Bearer`; an unreachable key set is a `503`. The settings are all set or none: some-but-not-all answers `503` rather than half-working.
2. **The origin decides per route.** It reads only the `permissions` array of strings. The space-separated `scope` string, a role and a group are not read, and a `permissions` value that is not an array of strings grants nothing. The route's scope must be in `permissions`.
3. **The internal key is a second, separate check.** The key must be active, unexpired, under its monthly limit, of type `internal` and carry the same scope. Key type, key lookup (static list now, the Postgres ledger when configured) and metering are behind traits.

The edge makes no authorization decision beyond the token check. Authorization from `permissions` only is the owner's rule (`nyuchi/nyuchi-servers-api#57`); it is breaking for any caller whose token carries only `scope`, and none is in production.

## How a route moves from Python to Rust

The Nyuchi API moves one route at a time, under the rulebook in `docs/architecture/rust-routing.md` in `nyuchi/nyuchi-api`. The Python service keeps serving a route until Rust has proven it.

**The table.** `routing/routes.json` holds one entry per route the Python app serves (522 today, in the order FastAPI matches them). Each entry has a `tranche`, a `port` (how far the Rust code has got) and a `mode` (who answers in production).

| Field     | Values                                                                               | Meaning                                                                                 |
| --------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `port`    | `not_started`, `built`, `proven`                                                     | A claim about the Rust code. `proven` means the parity tests pass against both sides.   |
| `mode`    | `python`, `shadow`, `rust`                                                           | A claim about production. `shadow` needs `port` built or proven; `rust` needs `proven`. |
| `tranche` | 1 hot public reads, 2 other reads, 3 writes, 4 auth, identity, keys, trust and money | The order of work. Tranche 4 never moves without the owner approving that route.        |

**The router.** The edge crate built with its `router` feature is a Worker in front of both origins. Each request is looked up in the compiled-in table:

- `python`: the Python origin, untouched. So are unmatched paths, wrong methods, trailing-slash redirects and preflights, because Python writes those answers today.
- `shadow`: the client gets Python's answer. For a bounded sample of GETs the same request is mirrored to Rust after that answer exists, and the two are compared by status and a hash of the body. Only counts are kept, by route template, never by path, id, header or body. A mirror can never delay or change the client's answer.
- `rust`: the Rust origin. A GET that fails there (error, timeout or `5xx`) is asked of Python once. A write is never replayed.
- **Kill switch.** One Worker variable sends every route to Python at once.
- **`rust_only`.** A namespace Python never had (the Maps API under `/v1/maps`) is matched first from its own file, and is never sent to Python.

**The rules that matter to a porter:**

1. A route moves by a one-line change to `mode` in `routing/routes.json`; the entry already names its proof.
2. `python`, then `shadow`, then `rust`. Rollback is setting `mode` back to `python`.
3. A proof runs the same cases against Python and Rust over the same seeded data and compares path, method, status, headers, body and the RFC 9457 error shape.
4. **Only the owner flips a route.** Agents build, test and open pull requests that change `port` and `proof`. A change of `mode` away from `python` is the owner's.

The procedure a porting agent follows is the Port a router to Rust playbook, and the current counts are on the migration status page.

## What is not built

Written plainly so nothing here is read as done:

- The router has not run in a Workers runtime; its decisions are tested over fakes.
- No route is `rust`. Twenty tranche 1 reads are `shadow` (owner, 2026-11-14), and the shadow comparison has not run against a real Rust origin.
- Deploys, Worker routes, DNS and the Fly origins are the owner's, and are not done by the repositories described here.
- The Servers API ledger stores are built and tested against an assumed copy of the schema, and are not deployed.
