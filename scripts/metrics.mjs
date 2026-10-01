#!/usr/bin/env node
// Measure, instead of hoping: merged MRs of this repo over a window, with and without an
// mr-brief, side by side. Read-only — it only reads MRs and their notes.
//
//   metrics.mjs                       # last 30 days, up to 60 MRs
//   metrics.mjs --days 90 --limit 150
//   metrics.mjs --json
//
// The numbers are a signal, not a verdict: briefs go on some kinds of MR more than others,
// and a small sample moves a median a lot. Read the counts before the medians.

import { remote, api } from "./lib/remote.mjs";
import { readHead } from "./lib/marker.mjs";
import { summarize, countBoxes } from "./lib/metrics.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const days = opt("--days", 30), limit = opt("--limit", 60);
const since = new Date(Date.now() - days * 864e5).toISOString();
const r = remote();
const rows = [];

if (r.github) {
  for (let page = 1; rows.length < limit && page <= 10; page++) {
    const prs = api(r, `repos/${r.project}/pulls?state=closed&sort=updated&direction=desc&per_page=50&page=${page}`) || [];
    if (!prs.length) break;
    for (const pr of prs) {
      if (rows.length >= limit) break;
      if (!pr.merged_at || pr.merged_at < since) continue;
      const author = pr.user.login;
      const reviews = (api(r, `repos/${r.project}/pulls/${pr.number}/reviews?per_page=100`) || []).filter((x) => x.user?.login !== author && x.submitted_at);
      const comments = (api(r, `repos/${r.project}/pulls/${pr.number}/comments?per_page=100`) || []).filter((x) => x.user?.login !== author);
      const firsts = [...reviews.map((x) => x.submitted_at), ...comments.map((x) => x.created_at)].sort();
      rows.push({ iid: pr.number, brief: readHead(pr.body || "") !== undefined, createdAt: pr.created_at, mergedAt: pr.merged_at, firstReviewAt: firsts[0] || null, reviewComments: comments.length + reviews.filter((x) => x.body).length, ...countBoxes(pr.body || "") });
    }
  }
} else {
  for (let page = 1; rows.length < limit && page <= 10; page++) {
    const mrs = api(r, `projects/${r.enc}/merge_requests?state=merged&updated_after=${since}&order_by=updated_at&per_page=50&page=${page}`) || [];
    if (!mrs.length) break;
    for (const mr of mrs) {
      if (rows.length >= limit) break;
      const author = mr.author.username;
      const notes = (api(r, `projects/${r.enc}/merge_requests/${mr.iid}/notes?sort=asc&order_by=created_at&per_page=100`) || [])
        .filter((n) => !n.system && n.author?.username !== author && !/bot|agent/i.test(n.author?.username || ""));
      rows.push({ iid: mr.iid, brief: readHead(mr.description || "") !== undefined, createdAt: mr.created_at, mergedAt: mr.merged_at, firstReviewAt: notes[0]?.created_at || null, reviewComments: notes.length, boxes: mr.task_completion_status?.count || 0, ticked: mr.task_completion_status?.completed_count || 0 });
    }
  }
}

const s = summarize(rows);
if (args.includes("--json")) { console.log(JSON.stringify({ days, rows, summary: s }, null, 2)); process.exit(0); }
const f = (x, unit = "") => (x == null ? "—" : `${Math.round(x * 10) / 10}${unit}`);
const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);
console.log(`${r.project} · merged in the last ${days} days · ${rows.length} MRs\n`);
console.log(`                              with a brief   without`);
console.log(`MRs                           ${String(s.withBrief.mrs).padEnd(15)}${s.without.mrs}`);
console.log(`hours to first review comment ${f(s.withBrief.firstReviewHours, "h").padEnd(15)}${f(s.without.firstReviewHours, "h")}`);
console.log(`review comments per MR        ${f(s.withBrief.reviewComments).padEnd(15)}${f(s.without.reviewComments)}`);
console.log(`merged with no review comment ${String(s.withBrief.noReviewComment).padEnd(15)}${s.without.noReviewComment}`);
console.log(`hours from open to merge      ${f(s.withBrief.openToMergeHours, "h").padEnd(15)}${f(s.without.openToMergeHours, "h")}`);
console.log(`"Where to look" boxes ticked  ${pct(s.withBrief.ticked)}`);
if (s.withBrief.mrs < 10) console.log(`\nonly ${s.withBrief.mrs} MR(s) with a brief — too few to read anything into the medians yet`);
