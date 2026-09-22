#!/usr/bin/env node
// Turn the brief's graph document into mermaid. The model writes the document — lanes,
// nodes, edges, one flow, each with a `delta` — and never mermaid: everything about the
// drawing (shapes, colours, the band behind what is new, escaping) is decided here, once,
// so the same document gives the same picture on every run and nothing a label contains can
// break the diagram. The idea is gitdiagram's; the escaping table is theirs too (MIT).
//
//   compile.mjs tmp/mr-brief/graph.json                  # both lenses, each under <details>
//   compile.mjs tmp/mr-brief/graph.json --lens flow      # architecture | flow | both
//   compile.mjs tmp/mr-brief/graph.json --flow <id>      # which flow, when the document has several
//   compile.mjs tmp/mr-brief/graph.json --bare           # the fenced blocks only, no <details>
//   compile.mjs tmp/mr-brief/graph.json --strict         # a file reference that does not resolve is an error
//
// File references (`files[]`) are checked against the commit the document names and dropped
// when they do not resolve; what was dropped is listed on stderr.

import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { checkFiles, checkSize } from "./lib/graph-files.mjs";

// ---- escaping: what gitdiagram learnt the hard way. Labels sit inside quotes, which already
// makes brackets and parentheses plain text; what is left is turned into mermaid's own
// `#nn;` entity codes (not HTML's `&#nn;` — mermaid leaves the `&` on the page). `#` goes
// first, since it opens those codes; a leading backtick would turn the label into a markdown
// string and take the diagram down; `|` closes an edge label; `<` `>` would be read as HTML.
const esc = (v) => String(v ?? "")
  .replace(/\s+/g, " ")
  .replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/`/g, "#96;").replace(/\|/g, "#124;")
  .replace(/</g, "#60;").replace(/>/g, "#62;").trim() || "unnamed";
// Sequence text is not quoted: `;` ends a statement and `#` opens an entity code.
const seqText = (v) => String(v ?? "").replace(/\s+/g, " ").replace(/#/g, "#35;").replace(/;/g, "#59;").trim() || "unnamed";
// A participant alias cannot carry ( ) : , ; — they are read as syntax by one renderer or another.
const alias = (v) => String(v ?? "").replace(/[():,;#]/g, " ").replace(/\s+/g, " ").trim() || "unnamed";
const ident = (prefix, id) => `${prefix}_${String(id).replace(/[^A-Za-z0-9_]/g, "_")}`;

const fileHint = (el) => {
  const f = Array.isArray(el.files) ? el.files[0] : null;
  if (!f?.path) return null;
  return f.startLine ? `${basename(f.path)}:${f.startLine}` : basename(f.path);
};

// ---- architecture: a flowchart, one subgraph per lane, delta as colour
const CLASSES = {
  same: "fill:#FFFFFF,stroke:#C3C9BF,stroke-width:1px,color:#191C1F",
  new: "fill:#F2DC5D,stroke:#8A6410,stroke-width:1.5px,color:#191C1F",
  changed: "fill:#FBF1B9,stroke:#8A6410,stroke-width:1.5px,color:#191C1F",
  gone: "fill:#F3F4F2,stroke:#8A8F88,stroke-width:1px,color:#5C6360,stroke-dasharray: 4 3",
};
const classOf = (delta) => ({ added: "new", modified: "changed", removed: "gone" }[delta] || "same");

function shape(node, label) {
  const id = ident("n", node.id);
  switch (node.kind) {
    case "datastore": case "cache": return `${id}[("${label}")]`;
    case "queue": return `${id}[["${label}"]]`;
    case "route": case "ui": return `${id}(["${label}"])`;
    default: return `${id}["${label}"]`;
  }
}

export function architecture(d) {
  const lines = ["flowchart TD"];
  const nodes = d.nodes || [], lanes = [...(d.lanes || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const byClass = new Map(), external = [];
  const emit = (node, indent) => {
    const label = [esc(node.label), node.subtitle ? esc(node.subtitle) : null, fileHint(node) ? esc(fileHint(node)) : null].filter(Boolean).join("<br/>");
    lines.push(`${indent}${shape(node, label)}`);
    const c = classOf(node.delta);
    byClass.set(c, [...(byClass.get(c) || []), ident("n", node.id)]);
    if (node.kind === "external") external.push(ident("n", node.id));
  };
  const placed = new Set();
  for (const lane of lanes) {
    const mine = nodes.filter((n) => n.lane === lane.id);
    if (!mine.length) continue;
    lines.push(`    subgraph ${ident("lane", lane.id)}["${esc(lane.label)}"]`);
    for (const n of mine) { emit(n, "        "); placed.add(n.id); }
    lines.push("    end");
  }
  for (const n of nodes) if (!placed.has(n.id)) emit(n, "    ");
  const edges = d.edges || [], newEdges = [];
  edges.forEach((e, i) => {
    const dashed = e.delta === "removed" || ["event", "queue", "async"].includes(e.kind);
    const arrow = dashed ? "-.->" : "-->";
    const label = e.label ? `|"${esc(e.label)}"|` : "";
    lines.push(`    ${ident("n", e.from)} ${arrow}${label} ${ident("n", e.to)}`);
    if (e.delta === "added") newEdges.push(i);
  });
  for (const [c, ids] of byClass) { lines.push(`    classDef ${c} ${CLASSES[c]}`); lines.push(`    class ${ids.join(",")} ${c}`); }
  for (const id of external) lines.push(`    style ${id} stroke-dasharray: 5 4,stroke:#8A8F88`);
  for (const i of newEdges) lines.push(`    linkStyle ${i} stroke:#8A6410,stroke-width:2px`);
  return lines.join("\n");
}

// ---- flow: a sequence, `added` messages inside a translucent band, `added` participants in a box
const ARROW = { sync: "->>", async: "-)", return: "-->>", self: "->>" };

export function flow(d, flowId) {
  const flows = d.flows || [];
  const f = (flowId && flows.find((x) => x.id === flowId)) || flows.find((x) => ["added", "modified"].includes(x.delta)) || flows[0];
  if (!f) return null;
  const nodeById = new Map((d.nodes || []).map((n) => [n.id, n]));
  const lines = ["sequenceDiagram", "    autonumber"];
  const pid = (node) => ident("p", node);
  for (const p of f.participants || []) {
    const node = nodeById.get(p.node) || {};
    let name = alias(p.label || node.label || p.node);
    if (node.kind === "external") name += " · external";
    const decl = `participant ${pid(p.node)} as ${name}`;
    if (node.delta === "added") lines.push("    box rgba(242, 220, 93, 0.35) new", `        ${decl}`, "    end");
    else lines.push(`    ${decl}`);
  }
  const msgs = f.messages || [], allNew = msgs.length > 0 && msgs.every((m) => m.delta === "added");
  let inBand = false;
  msgs.forEach((m, i) => {
    const isNew = m.delta === "added" && !allNew;
    if (isNew && !inBand) { lines.push("    rect rgba(242, 220, 93, 0.22)"); inBand = true; }
    if (!isNew && inBand) { lines.push("    end"); inBand = false; }
    const to = m.kind === "self" ? m.from : m.to;
    const text = seqText(m.label) + (m.repeat > 1 ? ` ×${m.repeat}` : "");
    lines.push(`    ${inBand ? "    " : ""}${pid(m.from)}${ARROW[m.kind] || "->>"}${pid(to)}: ${text}`);
    if (i === msgs.length - 1 && inBand) lines.push("    end");
  });
  return { title: f.title || d.title, mermaid: lines.join("\n") };
}

export const wrap = (heading, title, body, { bare = false } = {}) => bare
  ? `\`\`\`mermaid\n${body}\n\`\`\``
  : `<details>\n<summary><strong>${heading}</strong> — ${title}</summary>\n\n\`\`\`mermaid\n${body}\n\`\`\`\n\n</details>`;

if (import.meta.url === `file://${resolve(process.argv[1])}`) {
  const args = process.argv.slice(2);
  const flag = (name, dflt = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
  const file = args.find((a, i) => !a.startsWith("--") && !["--lens", "--flow"].includes(args[i - 1]));
  if (!file) { console.error("usage: compile.mjs graph.json [--lens architecture|flow|both] [--flow <id>] [--bare] [--strict]"); process.exit(64); }
  const lens = flag("--lens", "both"), bare = args.includes("--bare");

  const { doc, stripped } = checkFiles(JSON.parse(readFileSync(file, "utf8")), { cwd: process.cwd() });
  for (const s of stripped) console.error(`dropped file reference — ${s}`);
  if (stripped.length && args.includes("--strict")) process.exit(1);
  const tooBig = checkSize(doc);
  if (tooBig.length) { for (const t of tooBig) console.error(`too big to read — ${t}`); console.error("draw the change, not the system: nothing was drawn"); process.exit(1); }

  const out = [];
  if (lens !== "flow" && (doc.nodes || []).length) out.push(wrap("Architecture", doc.title || basename(dirname(resolve(file))), architecture(doc), { bare }));
  if (lens !== "architecture") { const f = flow(doc, flag("--flow")); if (f) out.push(wrap("Flow", f.title, f.mermaid, { bare })); }
  if (!out.length) { console.error("nothing to draw: the document has no nodes and no flows"); process.exit(1); }
  console.log(out.join("\n\n"));
}
