---
title: Engineering
description: "Where Nyuchi publishes its architecture, the problems it is solving and its engineering standards."
---

Engineering is where we publish how the platform is built and why: the architecture, the problems we are solving, design decisions, and the standards every repository follows. How engineering is done with agents (roles, briefs, releases, triage, incidents) is in [Playbooks](/playbooks/).

## What belongs here

- **Architecture.** How the platform fits together, with the decisions behind it. Platform and API architecture today lives in the [Platform](/platform/) and [API Docs](/api/) sections; new architecture write-ups go here.
- **Problems we are solving.** The problem, what was tried, what was decided and what is still open.
- **Standards and reference.** The rules every repository follows, and the intended state of our settings.

## Architecture

| Page                                                                           | What it is                                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Durin: the secrets broker](/engineering/durin/)                               | The platform-neutral broker that serves named secrets to authenticated apps, and the cutover that moves the Nyuchi API off its secrets                |
| [Rust port: migration status](/engineering/rust-port-status/)                  | Where the 522 Python routes stand in the Rust rebuild, as a dated snapshot generated from the route table and the parity audit                        |
| Page                                                                           | What it is                                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Durin: the secrets broker](/engineering/durin/)                               | The platform-neutral broker that serves named secrets to authenticated apps, and the cutover that moves the Nyuchi API off its secrets                |
| [The four gateways and the Rust architecture](/engineering/rust-architecture/) | The four gateways, the core, origin and edge layout, deny-by-default access, WorkOS permissions-claim authorization, and the shadow and cutover rules |

## Standards and reference

| Page                                                    | What it is                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [Engineering guide](/engineering/guide/)                | Mission, conventions, agent behaviour, security rules, versioning and branches. The org `AGENTS.md` points here |
| [Contributing](/engineering/contributing/)              | Commits, signing, DCO, branches, pull requests, dependencies and licensing                                      |
| [README standard](/engineering/readme-standard/)        | How every repository opens                                                                                      |
| [Org settings and rulesets](/engineering/org-settings/) | Intended state of GitHub org and repository settings, rulesets, supply chain, all checks green                  |
| [DPIA pre-assessment](/engineering/dpia-preassessment/) | The security and privacy template a release copies when it handles personal data                                |

GitHub's own community files (`SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, the PR and issue templates) stay in [`nyuchi/.github`](https://github.com/nyuchi/.github), with the reusable workflows and the scripts and settings that implement them.
