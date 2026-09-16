#!/usr/bin/env node
// Sort the changed files into what a reviewer must read and what they can skip, and name
// the renames so nobody reads a moved file line by line.
//
//   focus.mjs                      # against origin/<default branch>
//   focus.mjs origin/main          # against a given target
//   focus.mjs --json
//
// Buckets are heuristics over paths; they are printed, not hidden, so the author can
// disagree. "core" is what is left after everything skippable is taken out.

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const json = args.includes("--json");
const targetArg = args.find((a) => !a.startsWith("--"));
const git = (...a) => execFileSync("git", a, { stdio: ["ignore", "pipe", "ignore"] }).toString();

let target = targetArg;
if (!target) {
  try { target = git("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD").trim(); } catch { target = "origin/main"; }
}
const range = `${target}...HEAD`;

const RULES = [
  ["generated", /(^|\/)(db\/schema\.rb|db\/structure\.sql|Gemfile\.lock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|go\.sum|composer\.lock)$|\.min\.(js|css)$|(^|\/)(dist|build|vendor|node_modules|coverage)\//],
  ["tests",     /(^|\/)(spec|test|tests|__tests__|features|cypress)\/|[._](spec|test)\.[a-z]+$/],
  ["views",     /(^|\/)(app\/views|views|templates|assets|public|stylesheets|javascripts)\/|\.(haml|erb|slim|html|css|scss|sass|svg|png|jpg|gif|ico)$/],
  ["config",    /(^|\/)(config|\.github|\.gitlab|ci|\.circleci)\/|(^|\/)(\.gitlab-ci\.yml|\.gitignore|Gemfile|package\.json|tsconfig\.json|\.rubocop\.yml|\.editorconfig|Dockerfile|docker-compose\.yml|Makefile|Rakefile|Procfile)$|\.(yml|yaml|toml|ini|env)$/],
  ["docs",      /\.(md|markdown|rst|txt)$|(^|\/)(docs?|documentation)\//],
  ["migrations",/(^|\/)db\/migrate\//],
];
function bucket(path) { for (const [name, re] of RULES) if (re.test(path)) return name; return "core"; }

// --name-status with rename detection; numstat for sizes
const status = git("diff", "--name-status", "-M50%", range).trim().split("\n").filter(Boolean);
const numstat = new Map(git("diff", "--numstat", "-M50%", range).trim().split("\n").filter(Boolean).map((l) => { const [a, d, ...p] = l.split("\t"); return [p.join("\t"), { added: +a || 0, deleted: +d || 0 }]; }));
const sizeOf = (p) => numstat.get(p) || [...numstat.entries()].find(([k]) => k.endsWith(p) || k.includes(`=> ${p}`))?.[1] || { added: 0, deleted: 0 };

const files = [], renames = [];
for (const line of status) {
  const [code, a, b] = line.split("\t");
  if (code.startsWith("R")) {
    const sim = Number(code.slice(1));
    const sz = sizeOf(b);
    renames.push({ from: a, to: b, similarity: sim, ...sz, pure: sim === 100 || (sz.added + sz.deleted) === 0 });
    if (sim < 100) files.push({ path: b, bucket: bucket(b), status: `R${sim}`, ...sz });
  } else {
    files.push({ path: a, bucket: bucket(a), status: code, ...sizeOf(a) });
  }
}
const buckets = {};
for (const f of files) { (buckets[f.bucket] ||= { files: 0, added: 0, deleted: 0, paths: [] }); const b = buckets[f.bucket]; b.files++; b.added += f.added; b.deleted += f.deleted; b.paths.push(f.path); }
const order = ["core", "migrations", "config", "views", "tests", "docs", "generated"];
const skip = order.filter((b) => b !== "core" && buckets[b]);
const excludes = skip.flatMap((b) => buckets[b].paths).map((p) => `':!${p}'`);

if (json) { console.log(JSON.stringify({ range, buckets, renames, coreDiff: `git diff ${range} -- . ${excludes.join(" ")}` }, null, 2)); process.exit(0); }

console.log(`${range}\n`);
for (const b of order) if (buckets[b]) console.log(`${b.padEnd(11)} ${String(buckets[b].files).padStart(3)} files  +${buckets[b].added} −${buckets[b].deleted}`);
if (renames.length) {
  console.log(`\nrenamed or moved — ${renames.filter((r) => r.pure).length} pure, nothing to read:`);
  for (const r of renames) console.log(`  ${r.from} → ${r.to}${r.pure ? "" : `  (${r.similarity}% similar, +${r.added} −${r.deleted} to read)`}`);
}
const core = buckets.core?.paths || [];
console.log(`\nread closely (${core.length}):`); for (const p of core) console.log(`  ${p}`);
const skipLine = skip.map((b) => `${buckets[b].files} ${b}`).join(", ");
console.log(`\nskip: ${skipLine || "nothing"}${renames.some((r) => r.pure) ? `, ${renames.filter((r) => r.pure).length} pure renames` : ""}`);
console.log(`\ncore-only diff:\n  git diff ${range} -- . ${excludes.join(" ")}`);
