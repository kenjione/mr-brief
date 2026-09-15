#!/usr/bin/env node
// Run the skill end to end in a fresh Claude Code session on a repo + ref, lint what it
// wrote, and print a one-line record for evals/results.md.
//
//   node evals/run.mjs /path/to/repo <ref-or-branch> [--target origin/main]
//
// The repo is checked out in a temporary worktree so nothing in your checkout moves.
// Needs `claude` on the path and the plugin installed. Costs real tokens.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [repo, ref] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!repo || !ref) { console.error("usage: run.mjs <repo> <ref> [--target <remote/branch>]"); process.exit(64); }
const here = dirname(fileURLToPath(import.meta.url));
const lint = join(here, "..", "scripts", "lint.mjs");

const wt = mkdtempSync(join(tmpdir(), "mr-brief-eval-"));
const git = (...a) => execFileSync("git", a, { cwd: repo, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
git("worktree", "add", "--detach", wt, ref);

try {
  const allowed = "Bash(git:*),Bash(node:*),Bash(glab:*),Bash(gh:*),Bash(grep:*),Bash(cat:*),Bash(sed:*),Bash(head:*),Bash(tail:*),Bash(wc:*),Bash(ls:*),Bash(mkdir:*),Read,Grep,Glob,Write";
  const t0 = Date.now();
  const r = spawnSync("claude", ["-p", "/mr-brief", "--output-format", "json", "--allowedTools", allowed], { cwd: wt, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = JSON.parse(r.stdout || "{}");
  const brief = ["tmp/mr-brief/brief.md", ".mr-brief.md"].map((p) => join(wt, p)).find(existsSync);
  const lintRes = brief ? spawnSync("node", [lint, brief], { encoding: "utf8" }) : null;
  const record = {
    date: new Date().toISOString().slice(0, 10),
    repo: repo.split("/").pop(), ref,
    turns: out.num_turns, seconds: Math.round((Date.now() - t0) / 1000),
    cost_usd: out.total_cost_usd?.toFixed(2),
    brief: brief ? brief.replace(wt + "/", "") : "NOT WRITTEN",
    lint: lintRes ? (lintRes.status === 0 ? lintRes.stdout.trim() : "FAIL: " + lintRes.stdout.trim().replace(/\n/g, " | ")) : "—",
  };
  console.log(JSON.stringify(record, null, 2));
  if (brief) { console.log("\n--- brief ---\n" + readFileSync(brief, "utf8")); }
  console.log(`\nresults.md line:\n| ${record.date} | ${record.repo}@${ref} | ${record.turns} | ${record.seconds}s | $${record.cost_usd} | ${record.lint.split(" | ")[0]} | score? |`);
} finally {
  git("worktree", "remove", "--force", wt);
  rmSync(wt, { recursive: true, force: true });
}
