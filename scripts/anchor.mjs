#!/usr/bin/env node
// Turn `path:line` into a permalink the reviewer can click, and prove the line
// exists first. A brief with one wrong line number loses the reader's trust in
// all of it, so this refuses to print an anchor it could not verify.
//
//   anchor.mjs app/models/foo.rb:42 lib/bar.rb:7          # at HEAD — a blob permalink
//   anchor.mjs --sha e8c1f0ff app/models/foo.rb:42        # at a given commit
//   anchor.mjs --mr 2680 app/models/foo.rb:42             # into the MR's own diff view, where a comment can be left
//   anchor.mjs --mr 2680 --target origin/main ...         # the diff is against this ref (default: origin's HEAD)
//   anchor.mjs --json ...                                 # machine-readable
//
// With `--mr`, the link opens the changes tab of that MR / PR scrolled to the line, so the
// reviewer reads and comments in one place. That needs the line to be in the diff; a line
// the MR did not touch has no home there and falls back to the blob permalink, marked.
//   GitLab: /-/merge_requests/N/diffs#<sha1(path)>_<old>_<new>   GitHub: /pull/N/files#diff-<sha256(path)>R<new>
//
// Output, per anchor: the markdown link, then the line itself so you can check
// it is the line you meant.

import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { diffPositions, diffUrl } from "./lib/diff-anchor.mjs";

const args = process.argv.slice(2);
let sha = "HEAD", remote = "origin", json = false, mr = null, target = null;
const targets = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--sha") sha = args[++i];
  else if (args[i] === "--remote") remote = args[++i];
  else if (args[i] === "--mr") mr = args[++i];
  else if (args[i] === "--target") target = args[++i];
  else if (args[i] === "--json") json = true;
  else targets.push(args[i]);
}
if (targets.length === 0) {
  console.error("usage: anchor.mjs [--sha <rev>] [--mr <iid> [--target <remote/branch>]] [--remote <name>] [--json] path:line [path:line ...]");
  process.exit(64);
}

function git(...a) {
  return execFileSync("git", a, { stdio: ["ignore", "pipe", "pipe"] }).toString();
}

// git@host:group/repo.git | ssh://git@host/group/repo.git | https://host/group/repo(.git)
function httpsBase(url) {
  let m = url.match(/^git@([^:]+):(.+?)(?:\.git)?\/?$/);
  if (m) return { host: m[1], base: `https://${m[1]}/${m[2]}` };
  m = url.match(/^ssh:\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (m) return { host: m[1], base: `https://${m[1]}/${m[2]}` };
  m = url.match(/^https?:\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (m) return { host: m[1], base: `https://${m[1]}/${m[2]}` };
  throw new Error(`cannot parse remote url: ${url}`);
}

const fullSha = git("rev-parse", "--verify", `${sha}^{commit}`).trim();
const { host, base } = httpsBase(git("remote", "get-url", remote).trim());
const github = host.includes("github.com");
const blob = github ? "blob" : "-/blob";
if (mr && !target) { try { target = git("symbolic-ref", "--quiet", "--short", `refs/remotes/${remote}/HEAD`).trim(); } catch { target = `${remote}/main`; } }

const positions = (path) => { try { return diffPositions(git("diff", "-U3", `${target}...${fullSha}`, "--", path)); } catch { return new Map(); } };

const out = [];
let failed = false;

for (const t of targets) {
  const m = t.match(/^(.+):(\d+)$/);
  if (!m) { out.push({ input: t, error: "expected path:line" }); failed = true; continue; }
  const [, path, lineStr] = m;
  const line = Number(lineStr);

  let content;
  try {
    content = git("show", `${fullSha}:${path}`);
  } catch {
    out.push({ input: t, error: `no such file at ${fullSha.slice(0, 12)}` }); failed = true; continue;
  }
  const lines = content.split("\n");
  const total = content.endsWith("\n") ? lines.length - 1 : lines.length;
  if (line < 1 || line > total) {
    out.push({ input: t, error: `line ${line} is out of range (file has ${total} lines)` }); failed = true; continue;
  }

  const permalink = `${base}/${blob}/${fullSha}/${path}#L${line}`;
  let url = permalink, where = "blob";
  if (mr) {
    const pos = positions(path);
    if (pos.has(line)) { url = diffUrl({ base, github, mr, path, line, oldLine: pos.get(line) }); where = "diff"; }
    else where = "blob (line not in the MR diff — no place to comment on it)";
  }
  out.push({
    input: t, path, line, url, permalink, where,
    markdown: `[${basename(path)}:${line}](${url})`,
    text: lines[line - 1],
  });
}

if (json) {
  console.log(JSON.stringify({ sha: fullSha, anchors: out }, null, 2));
} else {
  for (const a of out) {
    if (a.error) { console.log(`✗ ${a.input} — ${a.error}`); continue; }
    console.log(a.markdown);
    console.log(`    ${String(a.line).padStart(5)} | ${a.text}`);
    if (mr && a.where !== "diff") console.log(`          ↳ ${a.where}`);
  }
}
process.exit(failed ? 1 : 0);
