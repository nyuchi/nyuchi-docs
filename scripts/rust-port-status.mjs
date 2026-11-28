#!/usr/bin/env node
// Refreshes the generated tables in the Rust port status page.
//
//   node scripts/rust-port-status.mjs --routes <routes.json> [--audit <audit.md>] [--write]
//
// --routes  nyuchi-api routing/routes.json (the 522-route table).
// --audit   nyuchi-servers-api docs/parity/audit.md (optional; its "By owner" table is copied).
// --write   rewrite the marked blocks in the page; without it, print them.
//
// Reads two local files and writes one. No network, no secrets.
import { readFileSync, writeFileSync } from "node:fs";

const PAGE = new URL(
  "../site/src/content/docs/engineering/rust-port-status.md",
  import.meta.url,
);
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const routesPath = arg("routes");
if (!routesPath) {
  console.error(
    "usage: rust-port-status.mjs --routes <routes.json> [--audit <audit.md>] [--write]",
  );
  process.exit(2);
}

const TRANCHES = {
  1: "Hot public reads",
  2: "Other reads",
  3: "Writes",
  4: "Auth, identity, keys, trust, money",
};
const routes = JSON.parse(readFileSync(routesPath, "utf8")).routes;
const rows = Object.entries(TRANCHES).map(([t, name]) => {
  const r = routes.filter((e) => String(e.tranche) === t);
  const n = (k, v) => r.filter((e) => e[k] === v).length;
  return [
    `${t} ${name}`,
    r.length,
    n("port", "not_started"),
    n("port", "built"),
    n("port", "proven"),
    n("mode", "python"),
    n("mode", "shadow"),
    n("mode", "rust"),
  ];
});
const total = rows.reduce(
  (a, r) => a.map((v, i) => (i ? v + r[i] : "Total")),
  new Array(8).fill(0),
);
const head = [
  "Tranche",
  "Routes",
  "Port not started",
  "Port built",
  "Port proven",
  "Mode python",
  "Mode shadow",
  "Mode rust",
];
const table = (h, body) =>
  [h, h.map(() => "---"), ...body]
    .map((r) => `| ${r.join(" | ")} |`)
    .join("\n");
const routing = table(head, [...rows, total]);

const byRouter = new Map();
for (const e of routes)
  byRouter.set(e.router, (byRouter.get(e.router) ?? 0) + 1);
const routers = `${routes.length} routes in ${byRouter.size} router modules, counted from \`routing/routes.json\`.`;

let owners = "_No audit supplied._";
const auditPath = arg("audit");
if (auditPath) {
  const m = readFileSync(auditPath, "utf8").match(
    /## By owner\n\n([\s\S]*?)\n\n/,
  );
  if (m) owners = m[1].trim().replaceAll(" (this agent)", "");
}

const block = (name, body) => [
  `<!-- rust-port-status:${name}:start -->`,
  "",
  body,
  "",
  `<!-- rust-port-status:${name}:end -->`,
];
const replace = (text, name, body) => {
  const re = new RegExp(
    `<!-- rust-port-status:${name}:start -->[\\s\\S]*?<!-- rust-port-status:${name}:end -->`,
  );
  if (!re.test(text)) throw new Error(`marker ${name} missing in the page`);
  return text.replace(re, block(name, body).join("\n"));
};

if (process.argv.includes("--write")) {
  let text = readFileSync(PAGE, "utf8");
  text = replace(text, "routing", `${routing}\n\n${routers}`);
  text = replace(text, "owners", owners);
  writeFileSync(PAGE, text);
} else {
  console.log(`${routing}\n\n${routers}\n\n${owners}`);
}
