#!/usr/bin/env node
// The skill is one Markdown file; other runtimes want it at their own path. This copies
// skills/mr-brief/ to each runtime directory, or with --check fails if any copy drifted.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "skills", "mr-brief");
const targets = [join(root, ".cursor", "skills", "mr-brief")];
const check = process.argv.includes("--check");

function files(dir, base = dir) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p, base) : [p.slice(base.length + 1)]; });
}
let drift = 0;
for (const t of targets) {
  for (const rel of files(src)) {
    const a = readFileSync(join(src, rel), "utf8");
    const dst = join(t, rel);
    if (check) { if (!existsSync(dst) || readFileSync(dst, "utf8") !== a) { console.log(`drift: ${dst}`); drift++; } }
    else { mkdirSync(dirname(dst), { recursive: true }); writeFileSync(dst, a); }
  }
}
if (check) { console.log(drift ? `${drift} file(s) out of sync — run node scripts/sync-runtimes.mjs` : "runtime copies in sync"); process.exit(drift ? 1 : 0); }
console.log("synced");
