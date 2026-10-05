// The pieces 0.9.0 added around a brief: the commit it describes, the claims a second reader
// checks, the links those claims rest on, the remote everything is built from, and the
// review metrics. All pure — no git, no network.
//   node --test evals/brief.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readHead, stampHead, isStale } from "../scripts/lib/marker.mjs";
import { extractClaims, extractLinks } from "../scripts/lib/claims.mjs";
import { pathFromDiffUrl, diffUrl } from "../scripts/lib/diff-anchor.mjs";
import { parseRemote } from "../scripts/lib/remote.mjs";
import { summarize, countBoxes, median } from "../scripts/lib/metrics.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const example = readFileSync(join(here, "../examples/subscription-addon-cascade.md"), "utf8");

test("marker: a brief names the commit it describes, and knows when it is behind", () => {
  assert.equal(readHead("no marker here"), undefined);
  assert.equal(readHead("<!-- mr-brief v1 -->  BILL-1 · 1 of 2"), null);
  const stamped = stampHead("<!-- mr-brief v1 -->  BILL-1 · 1 of 2\n\nlead", "d1af20fad1500e0fa9f446a4075443e8c90c13f7");
  assert.equal(stamped.split("\n")[0], "<!-- mr-brief v1 head=d1af20fad150 -->  BILL-1 · 1 of 2", "the series line survives");
  assert.equal(readHead(stamped), "d1af20fad150");
  assert.equal(readHead(stampHead(stamped, "abcdef1234567")), "abcdef123456", "re-stamping replaces, never stacks");
  assert.equal(isStale("d1af20fad150", "d1af20fad1500e0fa9f446a4075443e8c90c13f7"), false);
  assert.equal(isStale("d1af20fad150", "467d536b0aa"), true);
  assert.throws(() => stampHead("# not a brief", "abc1234"));
});

test("claims: three key changes and each risk paragraph, links reduced to words", () => {
  const claims = extractClaims(example);
  assert.deepEqual(claims.map((c) => c.id), ["lead", "why", "key-1", "key-2", "key-3", "risk-1", "risk-2"]);
  assert.equal(claims[0].text, "Cancelling a subscription now also cancels every add-on billed against it.", "the series line and the marker are not the lead");
  assert.match(claims[1].text, /^a cancelled customer kept paying/, "the Why label is stripped");
  assert.ok(!claims.some((c) => /\]\(|\*\*/.test(c.text)), "no markdown left in a claim");
  assert.match(claims[5].text, /add-on keeps billing/i);
  assert.match(claims[6].text, /^Rollback/);
});

test("links: blob links carry their path, diff links resolve through the changed files", () => {
  const p = "app/services/crl/revocation_check.rb";
  const gl = diffUrl({ base: "https://gitlab.com/g/r", github: false, mr: 7, path: p, line: 26, oldLine: 0, diffId: 99 });
  const gh = diffUrl({ base: "https://github.com/o/r", github: true, mr: 7, path: p, line: 26 });
  assert.match(gl, /diffs\?diff_id=99#[0-9a-f]{40}_0_26$/, "pinned to the version");
  const text = `- [ ] [a.rb:3](https://gitlab.com/g/r/-/blob/${"a".repeat(40)}/app/a.rb#L3) — x\n- [ ] [r.rb:26](${gl}) — y\n- [ ] [r.rb:26](${gh}) — z\n![img](https://gitlab.com/uploads/x.svg)`;
  const links = extractLinks(text);
  assert.equal(links.length, 3, "an image is not a code link");
  assert.deepEqual({ path: links[0].path, line: links[0].line }, { path: "app/a.rb", line: 3 });
  assert.deepEqual(pathFromDiffUrl(gl, ["app/a.rb", p]), { path: p, line: 26 });
  assert.deepEqual(pathFromDiffUrl(gh, ["app/a.rb", p]), { path: p, line: 26 });
  assert.equal(pathFromDiffUrl(gl, ["app/a.rb"]), null, "a hash that matches no changed file resolves to nothing");
  assert.equal(createHash("sha1").update(p).digest("hex"), "adf3d0af73bda91cbafcc68404f1719fa8d7c1d3", "the hash GitLab itself uses for this path");
});

test("remote: ssh, https and GitHub forms parse to one shape", () => {
  assert.deepEqual(parseRemote("git@gitlab.com:acme/billing/payments.git"), { host: "gitlab.com", project: "acme/billing/payments", github: false, base: "https://gitlab.com/acme/billing/payments", enc: "acme%2Fbilling%2Fpayments" });
  assert.equal(parseRemote("https://user@github.com/kenjione/mr-brief").github, true);
  assert.equal(parseRemote("ssh://git@gitlab.example.com/a/b.git").project, "a/b");
  assert.throws(() => parseRemote("not a url"));
});

test("metrics: medians per group, review-less MRs counted, ticked share only where boxes exist", () => {
  const at = (h) => new Date(Date.UTC(2026, 8, 1) + h * 36e5).toISOString();
  const rows = [
    { iid: 1, brief: true, createdAt: at(0), firstReviewAt: at(2), mergedAt: at(10), reviewComments: 4, boxes: 3, ticked: 2 },
    { iid: 2, brief: true, createdAt: at(0), firstReviewAt: at(4), mergedAt: at(20), reviewComments: 2, boxes: 3, ticked: 1 },
    { iid: 3, brief: false, createdAt: at(0), firstReviewAt: null, mergedAt: at(1), reviewComments: 0, boxes: 0, ticked: 0 },
  ];
  const s = summarize(rows);
  assert.equal(s.withBrief.mrs, 2);
  assert.equal(s.withBrief.firstReviewHours, 3);
  assert.equal(s.withBrief.reviewComments, 3);
  assert.equal(s.withBrief.ticked, 0.5);
  assert.equal(s.without.noReviewComment, 1);
  assert.equal(s.without.firstReviewHours, null);
  assert.equal(s.without.ticked, null);
  assert.equal(median([]), null);
  assert.deepEqual(countBoxes("- [ ] a\n- [x] b\n* [X] c\ntext [ ] d"), { boxes: 3, ticked: 2 });
});
