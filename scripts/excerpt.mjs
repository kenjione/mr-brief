#!/usr/bin/env node
// The decisive hunk of a changed file, as a ```diff block a reviewer can read inside the
// description — at most N lines, cut around the line you name, never a whole file.
//
//   excerpt.mjs app/x.rb:42 lib/y.rb:7           # against origin/<default branch> … HEAD
//   excerpt.mjs app/x.rb:42 --sha <mr head>       # a specific head, e.g. an open MR
//   excerpt.mjs app/x.rb:42 --target origin/main --lines 8
//
// Line numbers are NEW-side (post-change) numbers, the same ones anchor.mjs verifies.

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const targets = args.filter((a, i) => !a.startsWith("--") && !["--sha", "--target", "--lines"].includes(args[i - 1]));
if (!targets.length) { console.error("usage: excerpt.mjs path:line [path:line…] [--sha <rev>] [--target <remote/branch>] [--lines N]"); process.exit(64); }
const git = (...a) => execFileSync("git", a, { stdio: ["ignore", "pipe", "ignore"] }).toString();
let target = opt("--target", null);
if (!target) { try { target = git("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD").trim(); } catch { target = "origin/main"; } }
const head = opt("--sha", "HEAD");
const max = Number(opt("--lines", 10));
const shortSha = git("rev-parse", "--short", head).trim();

function hunks(path) {
  const out = []; let cur = null;
  for (const l of git("diff", "-U3", `${target}...${head}`, "--", path).split("\n")) {
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (h) { cur = { start: Number(h[1]), lines: [] }; out.push(cur); continue; }
    if (!cur || l.startsWith("+++") || l.startsWith("---") || l.startsWith("\\")) continue;
    cur.lines.push(l);
  }
  // attach new-side line numbers ("-" lines carry none)
  for (const hk of out) { let n = hk.start; hk.lines = hk.lines.map((l) => { const isDel = l.startsWith("-"); const rec = { text: l, n: isDel ? null : n }; if (!isDel) n++; return rec; }); }
  return out;
}

for (const t of targets) {
  const m = t.match(/^(.+):(\d+)$/);
  if (!m) { console.error(`✗ ${t} — expected path:line`); process.exitCode = 1; continue; }
  const [, path, ls] = m; const line = Number(ls);
  const hk = hunks(path).find((h) => h.lines.some((r) => r.n === line));
  if (!hk) { console.error(`✗ ${path}:${line} — not inside a changed hunk against ${target}`); process.exitCode = 1; continue; }
  const idx = hk.lines.findIndex((r) => r.n === line);
  // window: keep the anchor, prefer changed lines around it, cap at max
  let lo = idx, hi = idx;
  while (hi - lo + 1 < max && (lo > 0 || hi < hk.lines.length - 1)) {
    const canLo = lo > 0, canHi = hi < hk.lines.length - 1;
    const wantLo = canLo && (hk.lines[lo - 1].text[0] !== " " || !canHi || hi - idx > idx - lo);
    if (wantLo) lo--; else if (canHi) hi++; else break;
  }
  const win = hk.lines.slice(lo, hi + 1);
  const from = win.find((r) => r.n !== null)?.n, to = [...win].reverse().find((r) => r.n !== null)?.n;
  console.log(`\`${path}:${from}–${to}\` @ ${shortSha}\n\n\`\`\`diff\n${win.map((r) => r.text).join("\n")}\n\`\`\`\n`);
}
