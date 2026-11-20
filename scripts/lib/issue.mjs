// Issue lines: `Closes #12` right under the marker, one per issue, so the merge closes it.
// The ticket on the series line, or a bare `#12`, only links. A line is an issue line only
// when it holds nothing but closing keywords and references, so a lead such as
// "Fixes #12 for guests" stays the lead. Every reference needs its own keyword: GitHub
// closes only #1 in "Closes #1, #2". The keyword is case-free, the Jira key is not:
// "Fixes login-2 crash" is prose. An HTML comment on the line is ignored.

const ci = (w) => w.replace(/[a-z]/g, (c) => `[${c}${c.toUpperCase()}]`);
const KW = `(?:${["close", "closes", "closed", "closing", "fix", "fixes", "fixed", "fixing", "resolve", "resolves", "resolved", "resolving", "implement", "implements", "implemented", "implementing", "part of"].map(ci).join("|")})`;
const REF = String.raw`(?:(?:[\w.-]+(?:\/[\w.-]+)*)?#\d+|[A-Z][A-Z0-9]+-\d+|https?:\/\/\S+?\/(?:issues|work_items)\/\d+|https?:\/\/\S+?\/browse\/[A-Z][A-Z0-9]+-\d+)`;
const ONE = `${KW}\\s+${REF}`;
const AND = `(?:\\s*,\\s*(?:${ci("and")}\\s+)?|\\s+${ci("and")}\\s+)`;
const PATTERN = new RegExp(`^(?:${ONE}(?:${AND}${ONE})*|${ci("no issue")})\\.?$`);

export const stripComments = (s) => String(s).replace(/<!--[\s\S]*?-->/g, "").trim();

// Whether one line is an issue line.
export const isIssueLine = (s) => { const t = stripComments(s); return t !== "" && PATTERN.test(t); };

// Line indexes of the issue block: from line 1 down to the first line that is neither blank
// (a comment alone counts as blank) nor an issue line.
export function issueLines(lines) {
  const at = new Set();
  for (let i = 1; i < lines.length; i++) {
    if (stripComments(lines[i]) === "") continue;
    if (!isIssueLine(lines[i])) break;
    at.add(i);
  }
  return at;
}
