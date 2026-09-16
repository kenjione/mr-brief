#!/usr/bin/env node
// Check a brief against the contract. Exit 0 and print `ok`, or list every
// failure and exit 1. Meant to run before attaching, and as a soft check in CI.
//
//   lint.mjs .mr-brief.md

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: lint.mjs <brief.md>"); process.exit(64); }
const src = readFileSync(file, "utf8");
const lines = src.split("\n");
const fail = [];

// ---- marker
if (!/<!--\s*mr-brief v1\s*-->/.test(lines[0] ?? "")) fail.push("first line must carry <!-- mr-brief v1 -->");

// ---- carve out what does not count as text: mermaid blocks (+ one legend line), <details>
let inMermaid = false, inDetails = false, afterMermaid = false, mermaidBlocks = 0, mermaidAt = -1;
const text = []; // {i, s}
lines.forEach((raw, i) => {
  const s = raw.trimEnd();
  if (/^```mermaid\s*$/.test(s)) { inMermaid = true; mermaidBlocks++; mermaidAt = i; return; }
  if (inMermaid) { if (/^```\s*$/.test(s)) { inMermaid = false; afterMermaid = true; } return; }
  if (afterMermaid) { afterMermaid = false; if (/^[*_].*[*_]\s*$/.test(s.trim())) return; } // legend
  if (/^<details>/.test(s.trim())) { inDetails = true; return; }
  if (inDetails) { if (/^<\/details>/.test(s.trim())) inDetails = false; return; }
  if (s.trim() === "" || s.trim() === ">") return; // blank, or the bare quote line that separates two quote paragraphs
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

// ---- key changes: exactly 3 bold-claim bullets between the two headings
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
  if ((lines[dOpen + 2] ?? "x").trim() !== "") fail.push("blank line required after <summary>");
  const dClose = lines.findIndex((l, i) => i > dOpen && l.trim() === "</details>");
  if (dClose > 0 && (lines[dClose - 1] ?? "x").trim() !== "") fail.push("blank line required before </details>");
}

if (fail.length) { fail.forEach((f) => console.log(`✗ ${f}`)); process.exit(1); }
console.log(`ok — ${text.length} lines of text${mermaidBlocks === 1 ? ", one picture" : mermaidBlocks === 2 ? ", two pictures" : ""}`);
