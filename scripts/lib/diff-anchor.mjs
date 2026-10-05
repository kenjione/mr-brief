import { createHash } from "node:crypto";

// The MR diff, as a map new-line → old-line cursor, the way GitLab's own parser walks it:
// a context line moves both cursors, an added line only the new one, a removed line only
// the old one. GitLab's line anchor wants both numbers; GitHub only the new one.
export function diffPositions(diffText) {
  const pos = new Map(); let o = 0, n = 0, inHunk = false;
  pos.added = new Set(); // new-side lines this diff adds, as opposed to context around them
  for (const l of diffText.split("\n")) {
    const h = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) { o = Number(h[1]); n = Number(h[2]); inHunk = true; continue; }
    if (!inHunk || l.startsWith("+++") || l.startsWith("---") || l.startsWith("\\")) continue;
    if (l.startsWith("+")) { pos.set(n, o); pos.added.add(n); n++; }
    else if (l.startsWith("-")) { o++; }
    else { pos.set(n, o); o++; n++; }
  }
  return pos;
}

// GitLab: `diff_id` pins the link to one version of the MR diff, so a later push cannot move
// the line out from under it — the reader lands on the code the brief describes, and GitLab
// itself says a newer version exists. GitHub has no such pin for the whole PR; its links follow
// the latest push, which is why a pushed-past brief is flagged (see marker.mjs).
export function diffUrl({ base, github, mr, path, line, oldLine, diffId = null }) {
  if (github) return `${base}/pull/${mr}/files#diff-${createHash("sha256").update(path).digest("hex")}R${line}`;
  const pin = diffId ? `?diff_id=${diffId}` : "";
  return `${base}/-/merge_requests/${mr}/diffs${pin}#${createHash("sha1").update(path).digest("hex")}_${oldLine}_${line}`;
}

// The path a diff link points at, from the hash in its fragment, given the files the diff
// touches. GitLab hashes paths with sha1, GitHub with sha256; both are tried.
export function pathFromDiffUrl(url, paths) {
  const m = String(url).match(/#(?:diff-)?([0-9a-f]{40}|[0-9a-f]{64})(?:_(\d+)_(\d+)|R(\d+))/);
  if (!m) return null;
  const hash = m[1], line = Number(m[3] || m[4]);
  for (const p of paths) {
    const h = hash.length === 40 ? createHash("sha1").update(p).digest("hex") : createHash("sha256").update(p).digest("hex");
    if (h === hash) return { path: p, line };
  }
  return null;
}
