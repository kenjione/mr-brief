#!/usr/bin/env node
// Draw the brief's pictures with the PR Lens renderer (MIT, offline) and, on GitLab, upload
// them so the description can show them as images. One graph document gives both pictures:
// the "architecture" lens (lanes, nodes, edges — what is new and what only moved) and the
// "data-flow" lens (a sequence). One picture, once: where the SVGs are uploaded nothing else
// is printed; where they cannot be (GitHub, no upload API) the same document is printed as
// mermaid under <details>, and that is the picture.
//
//   render.mjs tmp/mr-brief/graph.json                    # validate + render to tmp/mr-brief/render/
//   render.mjs tmp/mr-brief/graph.json --mr 2322          # …and upload to the MR's project, print the markdown
//   render.mjs tmp/mr-brief/graph.json --theme light      # light | dark | both (default both; light is what gets embedded)
//
// Needs `npx` (Node ≥ 18).

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { checkFiles, checkSize } from "./lib/graph-files.mjs";
import { architecture, flow, wrap } from "./compile.mjs";

const CLI = "@coldtea/pr-lens-cli@0.6.1";
const args = process.argv.slice(2);
const given = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--mr" && args[args.indexOf(a) - 1] !== "--theme");
const mr = args.includes("--mr") ? args[args.indexOf("--mr") + 1] : null;
const theme = args.includes("--theme") ? args[args.indexOf("--theme") + 1] : "both";
if (!given) { console.error("usage: render.mjs graph.json [--mr <iid>] [--theme light|dark|both]"); process.exit(64); }

const outDir = join(dirname(resolve(given)), "render");
mkdirSync(outDir, { recursive: true });
const npx = (a) => spawnSync("npx", ["--yes", CLI, ...a], { encoding: "utf8" });

// 0. file references are checked against the commit the document names; a reference that does
//    not resolve is dropped (it only drove a permalink) and the checked document is what gets drawn
const { doc, stripped } = checkFiles(JSON.parse(readFileSync(given, "utf8")), { cwd: process.cwd() });
for (const s of stripped) console.error(`dropped file reference — ${s}`);
const tooBig = checkSize(doc);
if (tooBig.length) { for (const t of tooBig) console.error(`too big to read — ${t}`); console.error("draw the change, not the system: nothing was drawn or uploaded"); process.exit(1); }
let file = given;
if (stripped.length) { file = join(outDir, "graph.checked.json"); writeFileSync(file, JSON.stringify(doc, null, 2)); }

// 1. validate against the contract — a bad document fails here, not in the reviewer's face
const v = npx(["validate", file]);
if (v.status !== 0) { process.stderr.write(v.stdout + v.stderr); process.exit(1); }

// 2. render
const r = npx(["render", file, "-o", outDir, "--theme", theme]);
if (r.status !== 0) { process.stderr.write(r.stdout + r.stderr); process.exit(1); }
const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));
const assets = (manifest.assets || manifest.renders || manifest.views || []).map((a) => ({ ...a, path: join(outDir, a.file || a.path || a.filename || "") }));
const pick = (lens, th) => assets.find((a) => (a.lens || "").includes(lens) && (a.theme || "") === th) || assets.find((a) => basename(a.path).startsWith(`${lens}-${th}`));
const light = { architecture: pick("architecture", "light"), flow: pick("data-flow", "light") };
console.log(`rendered ${assets.length} SVG(s) into ${outDir}`);

// 3. the same document as mermaid, for where an image cannot be shown
const mermaidFallback = () => {
  const source = [];
  if ((doc.nodes || []).length) source.push(wrap("Architecture", doc.title || "architecture", architecture(doc)));
  const f = flow(doc);
  if (f) source.push(wrap("Flow", f.title, f.mermaid));
  return source.join("\n\n");
};

// 4. upload (GitLab only) and print the markdown to paste above Key changes
if (!mr) { for (const [k, a] of Object.entries(light)) if (a) console.log(`  ${k}: ${a.path}`); process.exit(0); }
const url = execFileSync("git", ["remote", "get-url", "origin"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
const m = url.match(/^(?:git@([^:]+):|ssh:\/\/(?:[^@]+@)?([^/]+)\/|https?:\/\/(?:[^@]+@)?([^/]+)\/)(.+?)(?:\.git)?\/?$/);
if (!m) { console.error(`cannot parse remote: ${url}`); process.exit(1); }
const host = m[1] || m[2] || m[3], project = m[4];
if (/github\.com$/.test(host)) { console.log("GitHub: no upload API for description images — the mermaid below is the picture.\n"); console.log(mermaidFallback()); process.exit(0); }
const enc = encodeURIComponent(project);
for (const [k, a] of Object.entries(light)) {
  if (!a || !existsSync(a.path)) continue;
  const up = JSON.parse(execFileSync("glab", ["api", "-X", "POST", `projects/${enc}/uploads`, "--form", `file=@${a.path}`], { stdio: ["ignore", "pipe", "pipe"] }).toString());
  console.log(`${k}: ${up.markdown || `![${k}](${up.url})`}`);
}
