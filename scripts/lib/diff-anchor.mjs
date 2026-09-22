import { createHash } from "node:crypto";

// The MR diff, as a map new-line → old-line cursor, the way GitLab's own parser walks it:
// a context line moves both cursors, an added line only the new one, a removed line only
// the old one. GitLab's line anchor wants both numbers; GitHub only the new one.
export function diffPositions(diffText) {
  const pos = new Map(); let o = 0, n = 0, inHunk = false;
  for (const l of diffText.split("\n")) {
    const h = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) { o = Number(h[1]); n = Number(h[2]); inHunk = true; continue; }
    if (!inHunk || l.startsWith("+++") || l.startsWith("---") || l.startsWith("\\")) continue;
    if (l.startsWith("+")) { pos.set(n, o); n++; }
    else if (l.startsWith("-")) { o++; }
    else { pos.set(n, o); o++; n++; }
  }
  return pos;
}

export function diffUrl({ base, github, mr, path, line, oldLine }) {
  if (github) return `${base}/pull/${mr}/files#diff-${createHash("sha256").update(path).digest("hex")}R${line}`;
  return `${base}/-/merge_requests/${mr}/diffs#${createHash("sha1").update(path).digest("hex")}_${oldLine}_${line}`;
}
