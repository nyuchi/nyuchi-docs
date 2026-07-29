#!/usr/bin/env node
// Offline structural validation of the `nyuchi-docs-skills` bundle, plus the
// public/internal split this repo depends on.
//
// Two homes for skills here, and the split is a rule rather than a habit:
//
//   nyuchi-docs-skills/   PUBLIC  — published as @nyuchi/nyuchi-docs-skills.
//                                   Consuming the docs; useful to anyone.
//   .claude/skills/       INTERNAL — authoring and maintaining this site.
//                                   Needs a checkout, so it must not ship.
//
// The failure this guards against is a skill drifting into the wrong home: an
// internal skill published to npm hands consumers instructions they cannot act
// on, and a public skill left in `.claude/skills/` reaches nobody who has not
// cloned the repo. Neither errors at runtime, so nothing catches it but a check
// like this one.
//
// Zero dependencies, no network, no credentials — safe as a CI gate.
//
// Usage: node scripts/validate-skills.mjs

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC_PKG = join(REPO_ROOT, "nyuchi-docs-skills")
const INTERNAL_DIR = join(REPO_ROOT, ".claude", "skills")

const errors = []
const fail = (msg) => errors.push(msg)

/** Frontmatter fields + body. Same minimal shape the mzizi-skills validator reads. */
function parseFrontmatter(raw) {
  const text = raw.replace(/^﻿/, "")
  if (!text.startsWith("---")) return null
  const end = text.indexOf("\n---", 3)
  if (end === -1) return null
  const block = text.slice(text.indexOf("\n", 3) + 1, end)
  const body = text.slice(end + 4).trim()
  const fields = {}
  for (const line of block.split("\n")) {
    const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (m) fields[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
  }
  return { fields, body }
}

// ── the published bundle ───────────────────────────────────────────────
const pkg = JSON.parse(readFileSync(join(PUBLIC_PKG, "package.json"), "utf8"))
const index = JSON.parse(readFileSync(join(PUBLIC_PKG, "index.json"), "utf8"))

if (pkg.version !== index.version) {
  fail(
    `version drift: package.json is ${pkg.version} but index.json is ${index.version} — bump both`,
  )
}
if (pkg.publishConfig?.access !== "public") {
  fail(`package.json#publishConfig.access must be "public" — this bundle is the public one`)
}
for (const required of ["index.json", "skills"]) {
  if (!(pkg.files ?? []).includes(required)) {
    fail(`package.json#files is missing "${required}" — it would not ship in the tarball`)
  }
}
for (const required of ["./index.json", "./skills/*"]) {
  if (!pkg.exports?.[required]) fail(`package.json#exports is missing "${required}"`)
}

const listed = new Set()
const entries = Array.isArray(index.skills) ? index.skills : []
if (entries.length === 0) fail("index.json#skills is empty")

for (const entry of entries) {
  if (!entry?.name || !entry.file) {
    fail(`index.json entry missing name or file: ${JSON.stringify(entry)}`)
    continue
  }
  listed.add(entry.name)
  if (!entry.description?.trim()) fail(`${entry.name}: empty index description`)

  const path = join(PUBLIC_PKG, entry.file)
  if (!existsSync(path)) {
    fail(`${entry.name}: index.json points at ${entry.file}, which does not exist`)
    continue
  }
  const parsed = parseFrontmatter(readFileSync(path, "utf8"))
  if (!parsed) {
    fail(`${entry.name}: ${entry.file} has no YAML frontmatter`)
    continue
  }
  if (parsed.fields.name !== entry.name) {
    fail(
      `${entry.name}: frontmatter name is "${parsed.fields.name ?? "(missing)"}" but index.json says "${entry.name}"`,
    )
  }
  if (!parsed.fields.description?.trim()) fail(`${entry.name}: frontmatter has no description`)
  if (!parsed.body) fail(`${entry.name}: frontmatter present but body is empty`)
}

const publicSkillsDir = join(PUBLIC_PKG, "skills")
if (existsSync(publicSkillsDir)) {
  for (const dir of readdirSync(publicSkillsDir)) {
    if (!statSync(join(publicSkillsDir, dir)).isDirectory()) continue
    if (!listed.has(dir)) {
      fail(`nyuchi-docs-skills/skills/${dir}/ is not listed in index.json — no consumer sees it`)
    }
  }
}

// ── the internal set ──────────────────────────────────────────────────
// Every internal skill must be well-formed too — Claude Code silently ignores
// one with broken frontmatter, so a typo means the skill just never fires.
const internalNames = []
if (existsSync(INTERNAL_DIR)) {
  for (const dir of readdirSync(INTERNAL_DIR)) {
    const full = join(INTERNAL_DIR, dir)
    if (!statSync(full).isDirectory()) continue
    const skillFile = join(full, "SKILL.md")
    if (!existsSync(skillFile)) {
      fail(`.claude/skills/${dir}/ has no SKILL.md`)
      continue
    }
    const parsed = parseFrontmatter(readFileSync(skillFile, "utf8"))
    if (!parsed?.fields.name) {
      fail(`.claude/skills/${dir}/SKILL.md has no frontmatter name — it will never load`)
      continue
    }
    if (parsed.fields.name !== dir) {
      fail(`.claude/skills/${dir}/SKILL.md declares name "${parsed.fields.name}" — must match the directory`)
    }
    if (!parsed.fields.description?.trim()) {
      fail(`.claude/skills/${dir}/SKILL.md has no description — nothing will trigger it`)
    }
    internalNames.push(parsed.fields.name)
  }
}

// ── the split itself ──────────────────────────────────────────────────
for (const name of internalNames) {
  if (listed.has(name)) {
    fail(
      `"${name}" exists in BOTH .claude/skills/ and the published bundle — ` +
        `pick one home; a duplicated skill drifts`,
    )
  }
}

if (errors.length) {
  console.error(`✗ skills invalid (${errors.length} problem(s)):\n`)
  for (const e of errors) console.error(`  • ${e}`)
  process.exit(1)
}

console.log(
  `✓ skills valid — ${entries.length} public at v${pkg.version} ` +
    `(${[...listed].sort().join(", ")}); ` +
    `${internalNames.length} internal (${internalNames.sort().join(", ")})`,
)
