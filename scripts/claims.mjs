#!/usr/bin/env node
// Build the packet a second reader checks the brief against: every claim it makes (the key
// changes, the risk), and for every link in it, the code it points at — the file around the
// line at the head commit, and the diff hunk that line sits in. The checker is a different
// pass with none of the writer's context, so a claim stands only if this evidence, or code
// the checker reads itself, settles it.
//
//   claims.mjs tmp/mr-brief/brief.md                     # head = HEAD, base = merge-base with origin's HEAD
//   claims.mjs tmp/mr-brief/brief.md --sha <head> --target origin/development
//
// Writes tmp/mr-brief/claims.md (the packet) and claims.json (the claim ids the verdicts use).

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { extractClaims, extractLinks } from "./lib/claims.mjs";
import { pathFromDiffUrl } from "./lib/diff-anchor.mjs";

const args = process.argv.slice(2);
const opt = (k, d = null) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const file = args.find((a, i) => !a.startsWith("--") && !["--sha", "--target"].includes(args[i - 1]));
if (!file) { console.error("usage: claims.mjs <brief.md> [--sha <head>] [--target <remote/branch>]"); process.exit(64); }
const git = (...a) => execFileSync("git", a, { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }).toString();
const head = git("rev-parse", "--verify", `${opt("--sha", "HEAD")}^{commit}`).trim();
let target = opt("--target");
if (!target) { try { target = git("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD").trim(); } catch { target = "origin/main"; } }
const base = git("merge-base", target, head).trim();

const text = readFileSync(file, "utf8");
const claims = extractClaims(text);
if (!claims.length) { console.error("no claims found: expected ### Key changes bullets and a ### Risk blockquote"); process.exit(1); }
const changed = git("diff", "--name-only", base, head).split("\n").filter(Boolean);

const evidence = [], unresolved = [];
for (const l of extractLinks(text)) {
  const where = l.kind === "blob" ? { path: l.path, line: l.line } : pathFromDiffUrl(l.url, changed);
  if (!where) { unresolved.push(l.url); continue; }
  if (evidence.some((e) => e.path === where.path && e.line === where.line)) continue;
  evidence.push({ ...where, window: window(where.path, where.line), hunk: hunk(where.path, where.line) });
}

function window(path, line, before = 10, after = 14) {
  let src; try { src = git("show", `${head}:${path}`); } catch { return null; }
  const all = src.split("\n");
  const from = Math.max(1, line - before), to = Math.min(all.length, line + after);
  return all.slice(from - 1, to).map((t, i) => `${String(from + i).padStart(5)}${from + i === line ? " →" : "  "} ${t}`).join("\n");
}

function hunk(path, line) {
  let diff; try { diff = git("diff", "-U3", base, head, "--", path); } catch { return null; }
  let cur = null, n = 0;
  for (const l of diff.split("\n")) {
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (h) { if (cur?.hit) break; cur = { lines: [l], hit: false }; n = Number(h[1]); continue; }
    if (!cur || l.startsWith("+++") || l.startsWith("---")) continue;
    cur.lines.push(l);
    if (!l.startsWith("-")) { if (n === line) cur.hit = true; n++; }
  }
  return cur?.hit ? cur.lines.slice(0, 40).join("\n") : null;
}

const packet = [
  `# Claims to check — head ${head.slice(0, 12)}, diff against ${base.slice(0, 12)} (${target})`,
  "",
  "Each claim below is a sentence a reviewer will believe without opening the code. Decide each one:",
  "**supported** (the code shows it), **contradicted** (the code shows otherwise), or **unsupported**",
  "(nothing here or in the code you read settles it). Cite `path:line` for every verdict.",
  "For every claim, also list the terms a developer from the next team — who knows the language,",
  "not this spec or this codebase — would have to look up, and that the sentence does not explain.",
  "Then read the diff yourself and report what the brief leaves out: who, twice, who sees, off, config.",
  "",
  "## Claims",
  "",
  ...claims.map((c) => `- \`${c.id}\` (${c.kind}) — ${c.text}`),
  "",
  "## Evidence — the code every link in the brief points at",
  "",
  ...evidence.flatMap((e) => [
    `### ${e.path}:${e.line}`,
    "",
    ...(e.hunk ? ["Diff hunk:", "", "```diff", e.hunk, "```", ""] : ["Not in the diff — unchanged code.", ""]),
    ...(e.window ? ["File at head, around the line:", "", "```", e.window, "```", ""] : []),
  ]),
  ...(unresolved.length ? ["Links that resolved to no changed file:", "", ...unresolved.map((u) => `- ${u}`), ""] : []),
].join("\n");

const dir = dirname(resolve(file));
writeFileSync(join(dir, "claims.md"), packet);
writeFileSync(join(dir, "claims.json"), JSON.stringify({ head, base, claims }, null, 2) + "\n");
console.log(`${claims.length} claims, ${evidence.length} places of evidence${unresolved.length ? `, ${unresolved.length} unresolved link(s)` : ""} → ${join(dir, "claims.md")}`);
