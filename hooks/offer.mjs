#!/usr/bin/env node
// PreToolUse hook. Fires on every Bash call; does nothing unless the command is
// about to open a merge/pull request. Then, once per branch, it stops that one
// call and asks Claude to offer the brief. The offer is recorded in .git/, so the
// same branch is never interrupted twice — a "no" is final, and a re-run of the
// same command goes straight through.
//
// If $CLAUDE_CONFIG_DIR/.mr-brief-always exists (default ~/.claude), the question is
// skipped and the brief is written straight away; attaching still needs a yes.
//
// Never fails the session: any error exits 0 and the tool call proceeds.

import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OPENS_AN_MR = [
  /\b(?:mr|pr)\s+create\b/,                    // glab mr create, gh pr create, any wrapper
  /\bgit\s+push\b[^\n]*merge_request\.create/,
];

const ALWAYS_FLAG = join(process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || "", ".claude"), ".mr-brief-always");

const ALWAYS =
  "mr-brief: an MR is about to be opened. The author has set the always-write flag, so do not ask —\n" +
  "run the mr-brief skill now, show the brief, then attach it with --description-file (glab / gh)\n" +
  "or your wrapper's file option. Attaching still needs the author's yes.";

const OFFER =
  "mr-brief: an MR is about to be opened and no brief has been offered on this branch.\n" +
  "Before running that command again, ask the author exactly one line:\n\n" +
  "  Want me to write an mr-brief for this MR? (15 lines, 3 places to look, diagram only if the wiring moved) — yes / no / show me the shape first\n\n" +
  "yes → run the mr-brief skill, then attach the result with --description-file (glab / gh) or your wrapper's file option.\n" +
  "no, or no answer → re-run the command exactly as it was. This hook will not interrupt this branch again.";

// One line about a newer version, from the cache the SessionStart hook keeps. No network.
function newer(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0; }
  return false;
}
function updateNote() {
  try {
    const cfg = process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || "", ".claude");
    const cache = JSON.parse(readFileSync(join(cfg, ".mr-brief-update.json"), "utf8"));
    const installed = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ".claude-plugin", "plugin.json"), "utf8")).version;
    return newer(cache.latest, installed)
      ? `\n\nAlso mention, once: mr-brief ${cache.latest} is out (installed ${installed}) — claude plugin update mr-brief@mr-brief`
      : "";
  } catch { return ""; }
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
}

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (input.tool_name !== "Bash") process.exit(0);

  const command = String(input.tool_input?.command ?? "");
  if (!OPENS_AN_MR.some((re) => re.test(command))) process.exit(0);

  // A brief is already being attached — nothing to offer.
  if (/mr-brief\.md/.test(command)) process.exit(0);

  const cwd = input.cwd || process.cwd();
  const gitDir = git(["rev-parse", "--git-dir"], cwd);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd).replace(/[^A-Za-z0-9._-]/g, "_");

  const markerDir = join(cwd, gitDir, "mr-brief");
  const marker = join(markerDir, `offered-${branch}`);
  if (existsSync(marker)) process.exit(0);

  mkdirSync(markerDir, { recursive: true });
  writeFileSync(marker, new Date().toISOString() + "\n");

  // Exit 2 stops this one tool call and hands stderr to Claude as the reason.
  process.stderr.write((existsSync(ALWAYS_FLAG) ? ALWAYS : OFFER) + updateNote());
  process.exit(2);
} catch {
  process.exit(0);
}
