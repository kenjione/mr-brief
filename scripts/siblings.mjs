#!/usr/bin/env node
// List the open merge requests that share a ticket key, across the GitLab group the
// current repo lives in. The group is read from the remote URL, so it is never guessed.
//
//   siblings.mjs PAY-412            # key given
//   siblings.mjs                    # key taken from the branch name ([A-Z]+-\d+)
//
// Prints repo!iid, source → target, head sha and title. Only titles that carry the key
// count; a match in the body is usually another ticket referring to this one.

import { execFileSync } from "node:child_process";

function sh(cmd, args) {
  return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

let key = process.argv[2];
if (!key) {
  const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  key = (branch.match(/[A-Z][A-Z0-9]+-\d+/) || [])[0];
}
if (!key) { console.error("no ticket key given and none in the branch name"); process.exit(64); }

const url = sh("git", ["remote", "get-url", "origin"]);
const m = url.match(/^(?:git@[^:]+:|ssh:\/\/(?:[^@]+@)?[^/]+\/|https?:\/\/(?:[^@]+@)?[^/]+\/)(.+?)(?:\.git)?\/?$/);
if (!m) { console.error(`cannot parse remote url: ${url}`); process.exit(1); }
const project = m[1];
const group = project.split("/").slice(0, -1).join("/");
if (!group) { console.error(`no group in ${project}; is this GitLab?`); process.exit(1); }

const enc = encodeURIComponent(group);
const raw = sh("glab", ["api", `groups/${enc}/search?scope=merge_requests&search=${encodeURIComponent(key)}&per_page=50`]);
const mrs = JSON.parse(raw)
  .filter((mr) => mr.state === "opened" && mr.title.includes(key))
  .map((mr) => ({
    ref: mr.references?.full ?? `!${mr.iid}`,
    repo: (mr.references?.full ?? "").split("!")[0].split("/").pop(),
    branch: `${mr.source_branch} → ${mr.target_branch}`,
    sha: (mr.sha || "").slice(0, 12),
    title: mr.title,
    url: mr.web_url,
  }))
  .sort((a, b) => a.repo.localeCompare(b.repo) || a.ref.localeCompare(b.ref));

if (mrs.length === 0) { console.log(`no open MRs in ${group} with ${key} in the title`); process.exit(0); }
for (const mr of mrs) console.log(`${mr.ref}\n    ${mr.branch}  @ ${mr.sha}\n    ${mr.title}\n    ${mr.url}`);

const dup = mrs.filter((a, i) => mrs.findIndex((b) => b.repo === a.repo && b.title === a.title) !== i);
if (dup.length) console.log(`\n⚠ ${dup.length} MR(s) share a repo and a title with another — a duplicate, not a series.`);
