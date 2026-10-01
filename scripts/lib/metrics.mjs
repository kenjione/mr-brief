// Does a brief change how an MR gets reviewed? Pure aggregation over merged MRs, split by
// whether the description carries an mr-brief, so the numbers are computed one way and can
// be tested. The signals are weak on purpose — what the platform already records:
//   hours to the first review comment by someone other than the author,
//   review comments per MR, hours from opening to merge,
//   and, for briefs only, how many "Where to look" boxes reviewers ticked.

export function median(xs) {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const hours = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 36e5 : null);

// One row per MR: { iid, brief, createdAt, mergedAt, firstReviewAt, reviewComments, boxes, ticked }
export function summarize(rows) {
  const group = (brief) => {
    const g = rows.filter((r) => r.brief === brief);
    const withBoxes = g.filter((r) => r.boxes > 0);
    return {
      mrs: g.length,
      firstReviewHours: median(g.map((r) => hours(r.createdAt, r.firstReviewAt))),
      reviewComments: median(g.map((r) => r.reviewComments)),
      openToMergeHours: median(g.map((r) => hours(r.createdAt, r.mergedAt))),
      noReviewComment: g.filter((r) => !r.firstReviewAt).length,
      ticked: withBoxes.length ? withBoxes.reduce((s, r) => s + r.ticked, 0) / withBoxes.reduce((s, r) => s + r.boxes, 0) : null,
    };
  };
  return { withBrief: group(true), without: group(false) };
}

// Ticked task boxes in a description, for platforms that do not count them (GitHub).
export function countBoxes(text) {
  const all = String(text).match(/^\s*[-*]\s+\[[ xX]\]/gm) || [];
  return { boxes: all.length, ticked: all.filter((b) => /\[[xX]\]/.test(b)).length };
}
