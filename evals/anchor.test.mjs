// The diff-view anchor: the line the reviewer lands on must be the line the brief named,
// on both hosts, with GitLab's old/new pair walked the way its own parser walks a hunk.
//   node --test evals/anchor.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { diffPositions, diffUrl } from "../scripts/lib/diff-anchor.mjs";

const diff = [
  "diff --git a/app/x.rb b/app/x.rb",
  "--- a/app/x.rb",
  "+++ b/app/x.rb",
  "@@ -10,4 +10,6 @@ class X",
  " ctx",          // old 10 → new 10
  "-gone",         // old 11
  "+added one",    //           new 11  (old cursor 12)
  "+added two",    //           new 12  (old cursor 12)
  " ctx",          // old 12 → new 13
  " ctx",          // old 13 → new 14
  "@@ -40,2 +42,3 @@ def y",
  " ctx",          // old 40 → new 42
  "+late",         //           new 43  (old cursor 41)
  " ctx",          // old 41 → new 44
].join("\n");

test("new-side lines map to GitLab's old cursor; removed and untouched lines have no home", () => {
  const p = diffPositions(diff);
  assert.equal(p.get(10), 10);
  assert.equal(p.get(11), 12, "an added line carries the old line that follows it");
  assert.equal(p.get(12), 12);
  assert.equal(p.get(13), 12);
  assert.equal(p.get(43), 41);
  assert.equal(p.get(44), 41);
  assert.equal(p.has(20), false, "a line outside every hunk is not in the diff");
  assert.deepEqual([...p.added].sort((a, b) => a - b), [11, 12, 43], "only added lines count as changed; context does not");
});

test("urls: GitLab sha1 file hash + old_new, GitHub sha256 + R<new>", () => {
  const gl = diffUrl({ base: "https://gitlab.com/g/r", github: false, mr: 2680, path: "app/x.rb", line: 11, oldLine: 12 });
  assert.equal(gl, `https://gitlab.com/g/r/-/merge_requests/2680/diffs#${createHash("sha1").update("app/x.rb").digest("hex")}_12_11`);
  const gh = diffUrl({ base: "https://github.com/o/r", github: true, mr: 1338, path: "app/x.rb", line: 42 });
  assert.equal(gh, `https://github.com/o/r/pull/1338/files#diff-${createHash("sha256").update("app/x.rb").digest("hex")}R42`);
});
