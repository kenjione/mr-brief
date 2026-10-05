#!/usr/bin/env node
// Someone else's MR / PR, made readable here without touching the checkout: fetches its head
// commit and its target branch into remote-tracking refs and prints what every other script
// needs — head sha, target ref, title, author, whether it already carries a brief.
//
//   mr-ref.mjs 2649                  # number in this repo
//   mr-ref.mjs https://gitlab.com/group/repo/-/merge_requests/2649
//   mr-ref.mjs 1338 --json
//
// Read-only on the platform. Locally it only fetches refs — into refs/mr-brief/<iid>, outside
// refs/remotes/, so a `git fetch --prune` does not delete them — and the working tree never moves.

import { execFileSync } from "node:child_process";
import { remote, api } from "./lib/remote.mjs";
import { readHead } from "./lib/marker.mjs";

const args = process.argv.slice(2);
const ref = args.find((a) => !a.startsWith("--"));
if (!ref) { console.error("usage: mr-ref.mjs <iid | url> [--json]"); process.exit(64); }
const iid = (String(ref).match(/(?:merge_requests|pull)\/(\d+)/) || [, ref])[1];
if (!/^\d+$/.test(iid)) { console.error(`not an MR number or URL: ${ref}`); process.exit(64); }
const git = (...a) => execFileSync("git", a, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

const r = remote();
let meta;
if (r.github) {
  const pr = api(r, `repos/${r.project}/pulls/${iid}`);
  meta = { title: pr.title, author: pr.user.login, target: pr.base.ref, source: pr.head.ref, head: pr.head.sha, url: pr.html_url, description: pr.body || "", state: pr.state };
  git("fetch", "-q", "origin", `refs/pull/${iid}/head:refs/mr-brief/${iid}`, pr.base.ref);
} else {
  const mr = api(r, `projects/${r.enc}/merge_requests/${iid}`);
  meta = { title: mr.title, author: mr.author.username, target: mr.target_branch, source: mr.source_branch, head: mr.sha, url: mr.web_url, description: mr.description || "", state: mr.state };
  git("fetch", "-q", "origin", `refs/merge-requests/${iid}/head:refs/mr-brief/${iid}`, mr.target_branch);
}

const head = git("rev-parse", `refs/mr-brief/${iid}`);
const target = `origin/${meta.target}`;
const brief = readHead(meta.description);
const out = {
  iid, platform: r.github ? "github" : "gitlab", title: meta.title, author: meta.author, state: meta.state, url: meta.url,
  head, target, source: meta.source,
  files: git("diff", "--name-only", `${target}...${head}`).split("\n").filter(Boolean).length,
  hasBrief: brief !== undefined, briefHead: brief || null,
};
if (args.includes("--json")) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`${out.platform === "github" ? "#" : "!"}${iid} · ${out.title} · by ${out.author} · ${out.state}`);
console.log(`head ${head.slice(0, 12)} · target ${target} · ${out.files} files · ${out.url}`);
if (out.state === "merged" && out.files === 0) console.log("merged: its changes are already in the target, so the diff against it is empty — nothing to read");
console.log(out.hasBrief ? `carries an mr-brief${out.briefHead ? ` for ${out.briefHead.slice(0, 9)}` : ""}` : "no mr-brief in the description");
console.log(`\nuse:  --sha ${head} --target ${target}`);
