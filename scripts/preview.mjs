#!/usr/bin/env node
// Show the brief the way the MR page will show it, before anyone attaches it.
//
//   preview.mjs tmp/mr-brief/brief.md            # writes tmp/mr-brief/preview.html and opens it
//   preview.mjs brief.md --repo /path/to/repo    # detect the platform from that repo's remote
//   preview.mjs brief.md --no-open
//
// The text is rendered by the platform's own Markdown API when its CLI is present —
// `glab api markdown` for GitLab, `gh api /markdown` for GitHub — so headings, task lists,
// tables and <details> come out exactly as the site builds them. Mermaid is drawn in the
// page with the same library both sites use. Without a CLI a built-in renderer covers the
// brief's own Markdown subset, and the page says so.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) { console.error("usage: preview.mjs <brief.md> [--repo <dir>] [--no-open]"); process.exit(64); }
const repo = args.includes("--repo") ? args[args.indexOf("--repo") + 1] : process.cwd();
const noOpen = args.includes("--no-open");
const md = readFileSync(file, "utf8");

function sh(cmd, a, opts = {}) { return execFileSync(cmd, a, { stdio: [opts.input !== undefined ? "pipe" : "ignore", "pipe", "ignore"], ...opts }).toString(); }
function has(cmd) { return spawnSync("which", [cmd], { stdio: "ignore" }).status === 0; }

// ---- where will this land?
let host = "", project = "";
try {
  const url = sh("git", ["remote", "get-url", "origin"], { cwd: repo }).trim();
  const m = url.match(/^(?:git@([^:]+):|ssh:\/\/(?:[^@]+@)?([^/]+)\/|https?:\/\/(?:[^@]+@)?([^/]+)\/)(.+?)(?:\.git)?\/?$/);
  if (m) { host = m[1] || m[2] || m[3]; project = m[4]; }
} catch {}
const isGitHub = /github\.com$/.test(host);

// ---- render
let html = "", renderer = "";
try {
  if (!isGitHub && host && has("glab")) {
    const body = JSON.stringify({ text: md, gfm: true, project });
    const out = sh("glab", ["api", "-X", "POST", "-H", "Content-Type: application/json", "markdown", "--input", "-"], { input: body, cwd: repo });
    html = JSON.parse(out).html; renderer = `GitLab renderer · ${project}`;
  } else if (isGitHub && has("gh")) {
    html = sh("gh", ["api", "-X", "POST", "/markdown", "-f", `text=${md}`, "-f", "mode=gfm", "-f", `context=${project}`], { cwd: repo });
    renderer = `GitHub renderer · ${project}`;
  }
} catch {}
if (!html) { html = builtin(md); renderer = "built-in renderer · approximate"; }

// ---- minimal Markdown for the brief's own subset (fallback only)
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
}
function builtin(src) {
  const out = []; const lines = src.split("\n"); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```mermaid/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre lang="mermaid"><code>${esc(buf.join("\n"))}</code></pre>`); continue; }
    if (/^<!--.*-->\s*(.*)$/.test(l)) { const rest = l.replace(/<!--.*?-->/g, "").trim(); if (rest) out.push(`<p class="series">${inline(rest)}</p>`); i++; continue; }
    if (/^<(details|summary|\/details)/.test(l.trim())) { out.push(l); i++; continue; }
    if (/^### /.test(l)) { out.push(`<h3>${inline(l.slice(4))}</h3>`); i++; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); const cells = (r) => r.split("|").slice(1, -1).map((c) => c.trim()); const head = cells(rows[0]); const body = rows.slice(2).map(cells); out.push(`<table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`); continue; }
    if (/^- \[ \] /.test(l)) { const items = []; while (i < lines.length && /^- \[ \] /.test(lines[i])) items.push(lines[i++].slice(6)); out.push(`<ul class="task-list">${items.map((t) => `<li class="task-list-item"><input type="checkbox" disabled> ${inline(t)}</li>`).join("")}</ul>`); continue; }
    if (/^- /.test(l)) { const items = []; while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2)); out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`); continue; }
    if (/^> /.test(l)) { const q = []; while (i < lines.length && /^> /.test(lines[i])) q.push(lines[i++].slice(2)); out.push(`<blockquote><p>${q.map(inline).join("<br>")}</p></blockquote>`); continue; }
    if (l.trim() === "") { i++; continue; }
    out.push(`<p>${inline(l)}</p>`); i++;
  }
  return out.join("\n");
}

// ---- the page
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>mr-brief preview</title>
<style>
  :root { --bg:#fff; --fg:#28272d; --soft:#626168; --line:#dcdcde; --code:#f1f1f3; --quote:#ececef; --link:#1f75cb; --y:#F2DC5D; --card:#fff; }
  [data-theme=dark] { --bg:#18171d; --fg:#ececef; --soft:#a4a3a8; --line:#3a383f; --code:#2b292f; --quote:#2b292f; --link:#63a6e9; --card:#1f1e24; }
  html,body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans",Ubuntu,sans-serif; }
  .bar { position:sticky; top:0; display:flex; gap:14px; align-items:center; padding:10px 18px; background:var(--card); border-bottom:1px solid var(--line); font-size:12px; color:var(--soft); z-index:2; }
  .bar b { color:var(--fg); font-weight:600; }
  .bar button { margin-left:auto; border:1px solid var(--line); background:transparent; color:var(--fg); border-radius:6px; padding:4px 10px; font-size:12px; cursor:pointer; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 24px 24px 80px; }
  .desc { background:var(--card); border:1px solid var(--line); border-radius:8px; padding: 20px 24px; }
  .desc h3 { font-size:1.05em; font-weight:600; margin:1.4em 0 .5em; padding-bottom:.3em; border-bottom:1px solid var(--line); }
  .desc p { margin:.6em 0; } .desc ul { padding-left:1.4em; margin:.5em 0; } .desc li { margin:.25em 0; }
  .desc .task-list, .desc ul.task-list, .desc .task-list-item { list-style:none; padding-left:0; }
  .desc input[type=checkbox] { margin: 0 .5em 0 0; vertical-align:-1px; }
  .desc code { background:var(--code); padding:.1em .35em; border-radius:4px; font-size:.92em; font-family:ui-monospace,Menlo,Consolas,monospace; }
  .desc a { color:var(--link); text-decoration:none; } .desc a:hover { text-decoration:underline; }
  .desc blockquote { margin:.8em 0; padding:.2em 0 .2em 1em; border-left:3px solid var(--line); color:var(--fg); background:var(--quote); border-radius:0 6px 6px 0; }
  .desc table { border-collapse:collapse; margin:.8em 0; font-size:.95em; } .desc th, .desc td { border:1px solid var(--line); padding:.4em .7em; text-align:left; } .desc th { background:var(--code); }
  .desc details { margin-top:1em; } .desc summary { cursor:pointer; color:var(--soft); }
  .desc pre.mermaid { background:transparent; text-align:center; overflow-x:auto; }
  .desc p.series, .desc p:first-child code { color:var(--soft); font-size:.9em; }
  .desc em { color:var(--soft); }
</style></head>
<body><div class="bar"><b>mr-brief preview</b><span>${esc(renderer)}</span><span>not attached — this is how the description will read</span><button id="t">dark</button></div>
<div class="wrap"><div class="desc" id="desc">${html}</div></div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
(function(){
  var pres = Array.prototype.slice.call(document.querySelectorAll('pre'));
  pres.forEach(function(p){
    var lang = (p.getAttribute('lang')||'') + ' ' + (p.getAttribute('data-canonical-lang')||'') + ' ' + p.className + ' ' + ((p.querySelector('code')||{}).className||'');
    if (/mermaid/i.test(lang)) { var src = p.textContent; var n = document.createElement('pre'); n.className='mermaid'; n.setAttribute('data-src', src); n.textContent = src; p.replaceWith(n); }
  });
  function draw(){ var dark = document.documentElement.getAttribute('data-theme')==='dark';
    document.querySelectorAll('pre.mermaid').forEach(function(n){ n.removeAttribute('data-processed'); n.textContent = n.getAttribute('data-src'); });
    mermaid.initialize({ startOnLoad:false, theme: dark ? 'dark' : 'default', securityLevel:'strict' });
    mermaid.run({ querySelector: 'pre.mermaid' }); }
  var b = document.getElementById('t');
  b.onclick = function(){ var d = document.documentElement.getAttribute('data-theme')==='dark'; document.documentElement.setAttribute('data-theme', d?'light':'dark'); b.textContent = d?'dark':'light'; draw(); };
  if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) { document.documentElement.setAttribute('data-theme','dark'); b.textContent='light'; }
  draw();
})();
</script></body></html>`;

const out = join(dirname(resolve(file)), "preview.html");
writeFileSync(out, page);
console.log(`${renderer}\n${out}`);
if (!noOpen) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawnSync(opener, [out], { stdio: "ignore", shell: process.platform === "win32" });
}
