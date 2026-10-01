#!/usr/bin/env node
// Put a finished brief on its MR / PR — only ever run after the author's second yes.
// Stamps the commit it describes onto line one, refuses a brief that fails lint, writes the
// description, and remembers (in .git/mr-brief/) which MR carries a brief for which commit,
// so the post-push hook can say when the brief has been pushed past.
//
//   attach.mjs tmp/mr-brief/brief.md --mr 2680            # GitLab MR or GitHub PR number
//   attach.mjs tmp/mr-brief/brief.md --mr 2680 --sha <c>  # the commit it describes (default HEAD)
//   attach.mjs tmp/mr-brief/brief.md --mr 2680 --dry      # stamp + lint, write nothing
//
// It writes the description and nothing else: no comment, no thread, no label.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stampHead } from "./lib/marker.mjs";
import { remote, api } from "./lib/remote.mjs";

const args = process.argv.slice(2);
const opt = (k, d = null) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const file = args.find((a, i) => !a.startsWith("--") && !["--mr", "--sha"].includes(args[i - 1]));
const mr = opt("--mr");
if (!file || !mr) { console.error("usage: attach.mjs <brief.md> --mr <iid> [--sha <commit>] [--dry]"); process.exit(64); }
const git = (...a) => execFileSync("git", a, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
const sha = git("rev-parse", "--verify", `${opt("--sha", "HEAD")}^{commit}`);

const body = stampHead(readFileSync(file, "utf8"), sha);
writeFileSync(file, body);
const lint = spawnSync("node", [join(dirname(fileURLToPath(import.meta.url)), "lint.mjs"), file], { encoding: "utf8" });
process.stdout.write(lint.stdout);
if (lint.status !== 0) { console.error("not attached: the brief fails lint"); process.exit(1); }
if (args.includes("--dry")) { console.log(`dry run — stamped head=${sha.slice(0, 12)}, nothing written`); process.exit(0); }

const r = remote();
let url;
if (r.github) {
  execFileSync("gh", ["pr", "edit", mr, "--body-file", resolve(file)], { stdio: ["ignore", "pipe", "pipe"] });
  url = `${r.base}/pull/${mr}`;
} else {
  url = api(r, `projects/${r.enc}/merge_requests/${mr}`, { method: "PUT", input: { description: body } }).web_url;
}

// What the post-push hook reads. Under .git/, so it never shows up as a change.
const dir = join(resolve(git("rev-parse", "--git-dir")), "mr-brief");
const branch = git("rev-parse", "--abbrev-ref", "HEAD").replace(/[^A-Za-z0-9._-]/g, "_");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `attached-${branch}.json`), JSON.stringify({ mr, head: sha, url, at: new Date().toISOString() }) + "\n");
console.log(`attached to ${url} — describes ${sha.slice(0, 12)}`);
