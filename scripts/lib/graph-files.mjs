// Every `files[]` entry in a graph document names a path and a line range. Before a picture
// is drawn, each one is checked against the commit it claims to describe — the same rule
// anchor.mjs applies to permalinks. A reference that does not resolve is dropped, not
// retried: it only drove a file hint on a node, so the picture stays right without it and
// nobody pays for another model call. The caller is told what was dropped, so the author
// can look.

import { execFileSync } from "node:child_process";

const CARRIERS = ["lanes", "nodes", "edges"];

export function gitExists(rev, path, cwd) {
  try {
    execFileSync("git", ["cat-file", "-e", `${rev}:${path}`], { cwd, stdio: "ignore" });
    return true;
  } catch { return false; }
}

export function gitLineCount(rev, path, cwd) {
  try {
    const out = execFileSync("git", ["show", `${rev}:${path}`], { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString();
    return out.split("\n").length - (out.endsWith("\n") ? 1 : 0);
  } catch { return -1; }
}

function revisionFor(ref, doc) {
  const side = ref.revision === "base" ? "base" : "head";
  return doc?.provenance?.[side]?.sha || (side === "base" ? null : "HEAD");
}

function badReference(ref, doc, io) {
  if (!ref || typeof ref.path !== "string") return "no path";
  if (/^\/|^[A-Za-z]:|\\|(^|\/)\.\.(\/|$)/.test(ref.path)) return `path "${ref.path}" is not repository-relative`;
  const rev = revisionFor(ref, doc);
  if (!rev) return `"${ref.path}" is on the base side but the document names no base sha`;
  if (!io.exists(rev, ref.path)) return `"${ref.path}" is not in ${rev.slice(0, 9)}`;
  if (ref.startLine != null) {
    const n = io.lineCount(rev, ref.path);
    const last = ref.endLine ?? ref.startLine;
    if (n >= 0 && last > n) return `"${ref.path}" has ${n} lines, not ${last}`;
  }
  return null;
}

// Returns a new document with unresolvable file references removed, plus the list of what
// was removed and why. `io` is injectable for tests; the default asks git in `cwd`.
export function checkFiles(doc, { cwd = process.cwd(), io } = {}) {
  const ops = io || { exists: (r, p) => gitExists(r, p, cwd), lineCount: (r, p) => gitLineCount(r, p, cwd) };
  const stripped = [];
  const clean = (owner, where) => {
    if (!Array.isArray(owner.files)) return owner;
    const kept = owner.files.filter((ref) => {
      const why = badReference(ref, doc, ops);
      if (why) stripped.push(`${where}: ${why}`);
      return !why;
    });
    return kept.length === owner.files.length ? owner : { ...owner, files: kept };
  };
  const out = { ...doc };
  for (const key of CARRIERS) if (Array.isArray(doc[key])) out[key] = doc[key].map((el) => clean(el, `${key}/${el.id}`));
  if (Array.isArray(doc.flows)) {
    out.flows = doc.flows.map((flow) => {
      const f = clean(flow, `flows/${flow.id}`);
      if (!Array.isArray(flow.messages)) return f;
      return { ...f, messages: flow.messages.map((m) => clean(m, `flows/${flow.id}/${m.id}`)) };
    });
  }
  return { doc: out, stripped };
}

// A picture that shows the system instead of the change is the failure both pictures exist
// to prevent, and it is a failure of size before anything else. These are hard ceilings: a
// document over them is refused before anything is drawn or uploaded, and the message says
// what to cut. Draw the change: the nodes the diff touched and the one or two they talk to.
export const LIMITS = { nodes: 7, edges: 9, participants: 5, messages: 10 };

export function checkSize(doc) {
  const problems = [];
  const n = (doc.nodes || []).length, e = (doc.edges || []).length;
  if (n > LIMITS.nodes) problems.push(`${n} nodes, at most ${LIMITS.nodes} — drop the ${n - LIMITS.nodes} the diff did not touch, or fold them into their lane`);
  if (e > LIMITS.edges) problems.push(`${e} edges, at most ${LIMITS.edges} — keep the calls this MR added or changed and the one that leads into them`);
  for (const f of doc.flows || []) {
    const p = (f.participants || []).length, m = (f.messages || []).length;
    if (p > LIMITS.participants) problems.push(`flow "${f.id}": ${p} participants, at most ${LIMITS.participants} — a datastore or a page is a message, not a lifeline`);
    if (m > LIMITS.messages) problems.push(`flow "${f.id}": ${m} messages, at most ${LIMITS.messages} — one exchange per hop, guards as one self message`);
  }
  return problems;
}
