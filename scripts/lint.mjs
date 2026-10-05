#!/usr/bin/env node
// Check a brief against the contract. Exit 0 and print `ok`, or list every
// failure and exit 1. Meant to run before attaching, and as a soft check in CI.
//
//   lint.mjs .mr-brief.md
//   lint.mjs desc.md --head <sha>      # also say whether the brief still describes that commit
//
// A stale brief is a note, not a failure: the shape is still right, the content may not be.

import { readFileSync } from "node:fs";
import { MARKER, readHead, isStale } from "./lib/marker.mjs";

const argv = process.argv.slice(2);
const file = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--head");
const current = argv.includes("--head") ? argv[argv.indexOf("--head") + 1] : null;
if (!file) { console.error("usage: lint.mjs <brief.md> [--head <sha>]"); process.exit(64); }
const src = readFileSync(file, "utf8");
const lines = src.split("\n");
const fail = [];

// ---- marker
if (!MARKER.test(lines[0] ?? "")) fail.push("first line must carry <!-- mr-brief v1 -->");
const notes = [];
const head = readHead(src);
if (current && head && isStale(head, current)) notes.push(`stale — the brief describes ${head.slice(0, 9)}, the MR is at ${current.slice(0, 9)}: re-run /mr-brief, or check the claims still hold`);
if (current && head === null) notes.push("the brief names no commit (no head= on line one) — it cannot tell when it went stale");

// ---- carve out what does not count as text: mermaid blocks (+ one legend line), <details>
let inMermaid = false, inDetails = false, afterMermaid = false, mermaidBlocks = 0, mermaidAt = -1, pictures = 0, pictureAt = -1, foldedPictures = 0, foldedAt = -1;
const text = []; // {i, s}
lines.forEach((raw, i) => {
  const s = raw.trimEnd();
  if (inDetails) { // everything under details is out of scope — but a mermaid block there is a folded picture, and pictures have a place
    if (/^<\/details>/.test(s.trim())) inDetails = false;
    else if (/^```mermaid\s*$/.test(s)) { foldedPictures++; if (foldedAt < 0) foldedAt = i; }
    return;
  }
  if (/^```mermaid\s*$/.test(s)) { inMermaid = true; mermaidBlocks++; mermaidAt = i; return; }
  if (inMermaid) { if (/^```\s*$/.test(s)) { inMermaid = false; afterMermaid = true; } return; }
  if (afterMermaid) { afterMermaid = false; if (/^[*_].*[*_]\s*$/.test(s.trim())) return; } // legend
  if (/^<details>/.test(s.trim())) { inDetails = true; return; }
  if (s.trim() === "" || s.trim() === ">" || /^-{3,}$/.test(s.trim())) return; // blank, the bare quote separator, or a rule
  if (/^!\[[^\]]*\]\([^)]+\)\s*$/.test(s.trim())) { pictures++; pictureAt = i; afterMermaid = true; return; } // a rendered picture; the next italic line is its legend
  if (i === 0) return; // marker / series line
  text.push({ i, s });
});

// ---- 15 lines
if (text.length > 15) fail.push(`${text.length} lines of text; the limit is 15`);

// ---- first sentence
const lead = text[0]?.s ?? "";
if (lead.length > 140) fail.push(`opening sentence is ${lead.length} chars; the limit is 140`);
const banned = /^(this (mr|pr|change|commit)\b|in this (change|mr|pr)\b|as part of\b|refactor(ed|s)?\b|various improvements|minor fixes|added?\b|updated?\b)/i;
if (banned.test(lead)) fail.push(`opening sentence starts with a banned opener: "${lead.split(/\s+/).slice(0, 3).join(" ")}…"`);

// ---- why: the need or the problem, right after the lead
const whyAt = lines.findIndex((l) => /^\*\*Why:\*\*/.test(l.trim()));
if (whyAt < 0) fail.push("missing **Why:** — one or two sentences on the need or the problem this MR answers");
else {
  const why = lines[whyAt].trim().replace(/^\*\*Why:\*\*\s*/, "");
  if (!why) fail.push("**Why:** is present but empty");
  if (why.length > 280) fail.push(`**Why:** is ${why.length} chars; the limit is 280`);
  if (text[0] && text[0].i === whyAt) fail.push("**Why:** comes after the lead sentence, not before it");
}

// ---- key changes: exactly 3 bold-claim bullets between the two headings
const kcStartForWhy = lines.findIndex((l) => /^(###\s+|\*\*)Key changes(\*\*)?/.test(l.trim()));
if (whyAt >= 0 && kcStartForWhy >= 0 && whyAt > kcStartForWhy) fail.push("**Why:** must sit above Key changes, under the lead");
const kcStart = lines.findIndex((l) => /^(###\s+|\*\*)Key changes(\*\*)?/.test(l.trim()));
const wlStart = lines.findIndex((l) => /^(###\s+|\*\*)Where to look(\*\*)?/.test(l.trim()));
if (kcStart < 0) fail.push("missing ### Key changes heading");
if (wlStart < 0) fail.push("missing ### Where to look heading");
if (kcStart >= 0 && wlStart > kcStart) {
  const bullets = lines.slice(kcStart + 1, wlStart).filter((l) => /^- /.test(l.trim()));
  if (bullets.length !== 3) fail.push(`${bullets.length} key changes; there must be exactly 3`);
  bullets.forEach((b, n) => {
    if (!/^- \*\*[^*]+\*\*\s+—/.test(b.trim())) fail.push(`key change ${n + 1} must be "- **claim** — reason"`);
  });
}
if (mermaidAt >= 0 && kcStart >= 0 && mermaidAt > kcStart) fail.push("every picture must sit above **Key changes**");
if (pictureAt >= 0 && kcStart >= 0 && pictureAt > kcStart) fail.push("every picture must sit above **Key changes**");
if (foldedAt >= 0 && kcStart >= 0 && foldedAt > kcStart && pictures === 0) fail.push("a folded picture is still the picture — its <details> must sit above **Key changes**");
if (pictures > 2) fail.push(`${pictures} rendered pictures; at most two — architecture and flow`);
if (mermaidBlocks > 2) fail.push(`${mermaidBlocks} mermaid blocks; at most two — architecture and flow`);
const archLine = lines.find((l) => /^\*\*Architecture:\*\*/.test(l.trim()));
if (archLine && archLine.trim() === "**Architecture:**") fail.push("**Architecture:** is present but empty — fill it or delete it");
if (archLine && kcStart >= 0 && lines.indexOf(archLine) > kcStart) fail.push("**Architecture:** must sit above **Key changes**");

// ---- where to look: exactly 3 checkboxes, each a link, first one Start →
const boxes = lines.filter((l) => /^- \[ \]/.test(l.trim()));
if (boxes.length !== 3) fail.push(`${boxes.length} "- [ ]" entries; there must be exactly 3`);
boxes.forEach((b, n) => {
  const links = (b.match(/\]\(https?:\/\//g) || []).length;
  if (links === 0) fail.push(`where-to-look ${n + 1} is not a permalink`);
  if (links > 1) fail.push(`where-to-look ${n + 1} carries ${links} links; one place per entry`);
});
if (boxes[0] && !/\*\*Start →\*\*/.test(boxes[0])) fail.push('first where-to-look entry must begin with **Start →**');
// Each entry is a question the reviewer answers at that line, tagged with the key change it
// checks — so the three places verify the three claims instead of naming three locations.
const covered = new Set();
boxes.forEach((b, n) => {
  const after = b.replace(/^.*?\]\(https?:\/\/[^)]*\)/, "");
  if (!/\?/.test(after)) fail.push(`where-to-look ${n + 1} names a place, not a question — say what the reviewer answers at that line`);
  const tag = after.match(/·\s*key change\s+([1-3])\s*$/i);
  if (!tag) fail.push(`where-to-look ${n + 1} must end with "· key change N" — the claim it checks`);
  else covered.add(tag[1]);
});
if (boxes.length === 3 && covered.size && covered.size < 3) fail.push(`where-to-look checks key change ${[...covered].sort().join(", ")} only — each of the three needs its place`);
if (wlStart >= 0 && !/~\d+\s*min/.test(lines[wlStart])) fail.push("### Where to look heading needs a minutes estimate (~N min)");

// ---- risk: exactly one blockquote group, carrying **Risk
const quoteGroups = [];
let inQ = false;
lines.forEach((l) => { const q = /^>/.test(l.trim()); if (q && !inQ) quoteGroups.push(l); inQ = q; });
if (quoteGroups.length !== 1) fail.push(`${quoteGroups.length} blockquotes; exactly one, on the risk`);
const riskHead = lines.findIndex((l) => /^###\s+Risk\b/.test(l.trim()));
const riskQuoteOld = lines.some((l) => /^>\s*\*\*Risk/.test(l.trim()));
if (riskHead < 0 && !riskQuoteOld) fail.push("missing ### Risk heading above the blockquote");
if (riskHead >= 0 && !/^>/.test((lines[riskHead + 1] ?? "").trim())) fail.push("### Risk must be followed directly by the blockquote");

// ---- headings: no emoji
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
lines.forEach((l, i) => { if (/^(#|\*\*)/.test(l.trim()) && emoji.test(l)) fail.push(`line ${i + 1}: emoji in a heading`); });

// ---- details block hygiene
const dOpen = lines.findIndex((l) => /^<details\b/.test(l.trim()));
if (dOpen >= 0) {
  const sameLine = lines[dOpen].trim() !== "<details>";
  if (sameLine || !/^<summary>.*<\/summary>$/.test((lines[dOpen + 1] ?? "").trim())) fail.push("<summary> must be on its own line right after <details>");
  if (/^<summary>\s*(details|more|notes?)\s*<\/summary>$/i.test((lines[dOpen + 1] ?? "").trim())) fail.push("<summary> is a bare word — say what is inside (e.g. <strong>Reading guide</strong> — 8 files …)");
  if ((lines[dOpen + 2] ?? "x").trim() !== "") fail.push("blank line required after <summary>");
  const dClose = lines.findIndex((l, i) => i > dOpen && l.trim() === "</details>");
  if (dClose > 0 && (lines[dClose - 1] ?? "x").trim() !== "") fail.push("blank line required before </details>");
}

// ---- reading guide: eight files at most, or it is the diff again
{
  const rg = lines.findIndex((l) => /^\*\*Reading guide\*\*\s*$/.test(l.trim()));
  if (rg >= 0) {
    const end = lines.findIndex((l, i) => i > rg && l.trim() === "</details>");
    const entries = lines.slice(rg + 1, end < 0 ? undefined : end).filter((l) => /^\*\*\[[^\]]+\]\(/.test(l.trim())).length;
    if (entries > 8) fail.push(`reading guide has ${entries} files; at most 8 — keep the core, move the rest to the Skip line`);
  }
}

notes.forEach((n) => console.log(`note: ${n}`));
if (fail.length) { fail.forEach((f) => console.log(`✗ ${f}`)); process.exit(1); }
const pics = mermaidBlocks + pictures;
console.log(`ok — ${text.length} lines of text${pics === 1 ? ", one picture" : pics === 2 ? ", two pictures" : pics > 2 ? `, ${pics} pictures` : ""}`);
