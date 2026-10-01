#!/usr/bin/env node
// PostToolUse hook on Bash. After a `git push` that moved a branch whose MR carries a brief,
// it tells Claude — once per pushed commit — that the description now describes an older
// commit, so Claude can offer one line: refresh the brief? Never blocks, never posts.
// The record it compares against is written by scripts/attach.mjs.
//
// Never fails the session: any error exits 0 and prints nothing.

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const git = (args, cwd) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (input.tool_name !== "Bash") process.exit(0);
  if (!/\bgit\s+push\b/.test(String(input.tool_input?.command ?? ""))) process.exit(0);

  const cwd = input.cwd || process.cwd();
  const dir = join(resolve(cwd, git(["rev-parse", "--git-dir"], cwd)), "mr-brief");
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd).replace(/[^A-Za-z0-9._-]/g, "_");
  const record = join(dir, `attached-${branch}.json`);
  if (!existsSync(record)) process.exit(0);

  const { mr, head } = JSON.parse(readFileSync(record, "utf8"));
  const now = git(["rev-parse", "HEAD"], cwd);
  if (now === head) process.exit(0);
  const told = join(dir, `stale-told-${branch}-${now.slice(0, 12)}`);
  if (existsSync(told)) process.exit(0);
  writeFileSync(told, new Date().toISOString() + "\n");

  const commits = git(["rev-list", "--count", `${head}..${now}`], cwd);
  const files = git(["diff", "--name-only", head, now], cwd).split("\n").filter(Boolean).length;
  const context =
    `mr-brief: the description of MR ${mr} describes ${head.slice(0, 9)}; this push moved the branch to ${now.slice(0, 9)} ` +
    `(${commits} commit(s), ${files} file(s)). Its links are pinned to the old version, so they still land on the code the ` +
    `brief describes, but the claims may no longer hold. Ask the author exactly one line: "The MR brief describes an older ` +
    `commit — refresh it?" yes → run the mr-brief skill (the existing brief is input), then attach with the second yes. ` +
    `no or no answer → nothing; this hook will not mention this commit again.`;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context } }));
  process.exit(0);
} catch {
  process.exit(0);
}
