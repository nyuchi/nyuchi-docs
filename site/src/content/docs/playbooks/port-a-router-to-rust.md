---
title: Port a router to Rust
description: "Operations playbook: how an agent ports one FastAPI router of the Nyuchi API to Rust, proves it, and hands the route flip to the owner."
sidebar:
  label: Port a router to Rust
---

Source: the porting write-ups in `nyuchi/nyuchi-api` (`docs/architecture/rust-routing.md`, `rust-port-places.md`, `rust-port-profiles.md`, `rust-port-news-events.md`, `rust-port-tranche2.md`) and `AGENTS.md` in `nyuchi/nyuchi-servers-api`. Architecture and the meaning of `port` and `mode` are in [The four gateways and the Rust architecture](/engineering/rust-architecture/). Counts are in [Rust port: migration status](/engineering/rust-port-status/).

This is a procedure. Where it and a repository's own `AGENTS.md` disagree, the repository wins.

## Before you start

1. **Claim one router module**, not a route at a time and not several. Routers are the `router` field in `routing/routes.json`. Check the open pull requests for the same router first: two agents on one router is the waste to avoid.
2. **Read the Python router and everything it touches**: dependencies, auth, rate limits, response models, the error shape it writes, and the stores it reads. Write down what it does, including what is odd. Parity is the goal, so an odd behaviour is ported, then listed.
3. **Check the tranche.** Tranche 4 (identity, keys, tokens, trust, money) is not started without the owner's approval of that route, and the pull request names who approved it. Tranche 3 writes need the store adapter and the idempotency story settled first.
4. **Decide where it lands.** A route Python has goes in `nyuchi/nyuchi-api` (`rust/crates/core`, `origin`). A route that is internal to the platform, or a namespace Python never had, goes in `nyuchi/nyuchi-servers-api` and is a new scope under deny-by-default access. New scopes are never added to the Python key catalogue.

## Build it, in three layers

1. **`core`: the decision.** Pure code, no I/O, builds for `wasm32`. The handler takes a store trait, and an in-memory fake implements it for tests. Validation order, error bodies and status codes are copied from Python, not improved.
2. **`origin`: the adapter.** The `axum` route, the real store adapter (MongoDB, Postgres, a signed upstream), the access-policy entry and the headers. No `unwrap()` or `expect()` outside tests; a configuration error stops the process at startup and names the variable, never a value.
3. **Access.** In the Servers API, add the route to `access::POLICY` with its scope; a route not in the table is not served. Authorization is the token's `permissions` claim, and the key must carry the scope too.

Errors keep **Python's shape** when the route is a port, even where RFC 9457 would be better. Changing an error shape is a contract change for clients and the owner's call. A route the Servers API adds new answers RFC 9457 problems.

## Hold it to Python

The proof compares both implementations on the same cases. Nothing is typed by hand.

1. **Seed synthetic data.** A committed seed file (for example `rust/parity/<router>/seed.json`) with invented documents. No real person, key or token ever goes in a seed, a golden file or a test.
2. **Record goldens from the real Python app.** A script runs the FastAPI app through its test client with every middleware, and writes status, the compared headers (content type, `Cache-Control`, security headers, CORS, rate-limit), the body and a SHA-256 of the exact body bytes. A `--write` mode regenerates and a `--check` mode fails when the file is stale; a Python test runs `--check` in CI. Freeze the clock and the settings the route reads, so Rust is held to exact bytes.
3. **Run the goldens against Rust twice.** Once against the handlers over the in-memory store (`core/tests/*_parity.rs`), once through the real `axum` router with every compared header (`origin/tests/*_http.rs`).
4. **Break it on purpose.** Mutate one thing in the Rust (a reversed sort, a changed `Cache-Control`) and confirm a test fails. A check that cannot fail proves nothing.
5. **`built` is as far as a fake goes.** To reach `proven`, run Python and Rust against one real store (a throwaway `mongod` or Postgres, loaded with the synthetic seed) and compare answers, including the visibility rules for a person-bound route. The proof script is named in the table entry. Say in the pull request what the proof found, including differences, and list each difference that is on purpose.

## Update the table, and nothing more

In `nyuchi-api`, edit `routing/routes.json` for the routes you ported and regenerate:

```sh
python scripts/rust_routes.py --write
python scripts/rust_routes.py --check
```

- Set `port` to `built` when the Rust route exists and its parity tests run in CI, and to `proven` only after the real-store proof passes. Set `proof` to the path of the test that reproduces it. `proof` is required from `built` on.
- **Do not change `mode`.** `python` to `shadow` to `rust` is the owner's, per route. A pull request that moves a `mode` away from `python` is not merged by an agent.
- A route that answers only anonymous callers is marked `anonymous_only`, so the router keeps a credentialed request on Python.
- For a namespace Python never had, the entry goes in `routing/rust_only.json`, and that is the owner's review.

## Before you open the pull request

Run the gates the repository runs. In `nyuchi-servers-api`, from `rust/`:

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo check -p servers-core --target wasm32-unknown-unknown
cargo build -p servers-origin --release --locked
cargo-deny --locked check
```

In `nyuchi-api`, the same set for `gateway-core`, `gateway-origin` and `gateway-edge` (with and without `--features router`), plus the Python parity tests. The ledger tests need a throwaway Postgres and print "skipped" without one; CI makes a skip a failure.

Then, in the pull request body:

- The router, the route list, and the Python files they replace.
- What the proof showed and what it did not: a fake store is `built`, not `proven`. Say "not run" for anything you did not run.
- Every difference from Python, each with its reason.
- For tranche 4, who approved the route.
- No secret, token value, personal datum, internal hostname or IP anywhere, in a seed, a golden, a log line or the description.

Open the pull request against `main`, small, and send it through the merge queue when every check is green. A conflict is resolved and every feature kept; a conflicting pull request is never closed.

## After it merges

- Tell the docs lead, so [Rust port: migration status](/engineering/rust-port-status/) is refreshed and a release note is written where the repository expects one.
- If you found that the table, the proof or this playbook is wrong, say so in the pull request or an issue. Do not work around it silently.

## What stays with the owner

Flipping a route's `mode`, the Worker route and DNS, deploying the origin or router, setting the kill switch, supplying values for the WorkOS settings, and approving any tranche 4 route.
