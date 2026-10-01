// What a brief claims, and where it says to look. Pure functions over the brief's text, so
// the packet a checker reads is built the same way every time and can be tested.

// The three key changes and the risk paragraphs — the sentences a reviewer will believe.
export function extractClaims(text) {
  const lines = String(text).split("\n");
  const claims = [];
  const section = (name) => lines.findIndex((l) => new RegExp(`^###\\s+${name}\\b`, "i").test(l.trim()));
  const kc = section("Key changes");
  if (kc >= 0) {
    for (let i = kc + 1; i < lines.length && !/^###\s/.test(lines[i]); i++) {
      const m = lines[i].match(/^\s*-\s+(.*\S)\s*$/);
      if (m) claims.push({ id: `key-${claims.filter((c) => c.kind === "key change").length + 1}`, kind: "key change", text: plain(m[1]) });
    }
  }
  const rk = section("Risk");
  if (rk >= 0) {
    let para = [];
    const flush = () => { if (para.length) claims.push({ id: `risk-${claims.filter((c) => c.kind === "risk").length + 1}`, kind: "risk", text: plain(para.join(" ")) }); para = []; };
    for (let i = rk + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l.startsWith(">")) { if (l.trim() === "" && !para.length) continue; break; }
      const body = l.replace(/^>\s?/, "").trim();
      if (!body) flush(); else para.push(body);
    }
    flush();
  }
  return claims;
}

// Markdown links, links stripped down to their words; bold and code marks dropped.
function plain(s) {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\s+/g, " ").trim();
}

// Every code link in the brief, as { url, kind, sha?, path?, line? }. Blob links carry their
// path; diff links carry a hash of it, resolved later against the files the diff touches.
export function extractLinks(text) {
  const out = [], seen = new Set();
  for (const [, url] of String(text).matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    if (seen.has(url)) continue; seen.add(url);
    const blob = url.match(/\/(?:-\/)?blob\/([0-9a-f]{7,40})\/([^#?]+)#L(\d+)/);
    if (blob) { out.push({ url, kind: "blob", sha: blob[1], path: decodeURIComponent(blob[2]), line: Number(blob[3]) }); continue; }
    if (/\/(?:-\/merge_requests\/\d+\/diffs|pull\/\d+\/files)/.test(url) && /#/.test(url)) out.push({ url, kind: "diff" });
  }
  return out;
}
