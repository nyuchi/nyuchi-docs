---
title: Engineering
description: "Where Nyuchi publishes its architecture, the problems it is solving and its engineering standards."
---

Engineering is where we publish how the platform is built and why: the architecture, the problems we are solving, design decisions, and the standards every repository follows. How engineering is done with agents (roles, briefs, releases, triage, incidents) is in [Playbooks](/playbooks/).

## What belongs here

- **Architecture.** How the platform fits together, with the decisions behind it. Platform and API architecture today lives in the [Platform](/platform/) and [API Docs](/api/) sections; new architecture write-ups go here.
- **Problems we are solving.** The problem, what was tried, what was decided and what is still open.
- **Standards and reference.** The rules every repository follows, and the intended state of our settings.

## Standards and reference

| Page                                                    | What it is                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [Engineering guide](/engineering/guide/)                | Mission, conventions, agent behaviour, security rules, versioning and branches. The org `AGENTS.md` points here |
| [Contributing](/engineering/contributing/)              | Commits, signing, DCO, branches, pull requests, dependencies and licensing                                      |
| [README standard](/engineering/readme-standard/)        | How every repository opens                                                                                      |
| [Org settings and rulesets](/engineering/org-settings/) | Intended state of GitHub org and repository settings, rulesets, supply chain, all checks green                  |
| [DPIA pre-assessment](/engineering/dpia-preassessment/) | The security and privacy template a release copies when it handles personal data                                |

GitHub's own community files (`SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, the PR and issue templates) stay in [`nyuchi/.github`](https://github.com/nyuchi/.github), with the reusable workflows and the scripts and settings that implement them.
