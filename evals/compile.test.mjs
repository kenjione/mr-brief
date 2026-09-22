// The compiler is the only thing that writes mermaid. These tests pin what it draws from a
// document — and that nothing a label contains can break the diagram.
//   node --test evals/compile.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { architecture, flow, wrap } from "../scripts/compile.mjs";
import { checkFiles, checkSize, LIMITS } from "../scripts/lib/graph-files.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const doc = JSON.parse(readFileSync(join(here, "fixtures/graph.json"), "utf8"));

test("architecture: one subgraph per lane, delta as class, file hint in the node", () => {
  const m = architecture(doc);
  assert.match(m, /^flowchart TD/);
  assert.match(m, /subgraph lane_billing\["billing \(this repo\)"\]/, "inside quotes, parentheses are plain text");
  assert.match(m, /n_sweep\["Add-on sweep<br\/>nightly · retry 3<br\/>addon_sweep_worker\.rb:12"\]/);
  assert.match(m, /n_row\[\("Subscription row<br\/>state, last_error"\)\]/, "a datastore is a cylinder");
  assert.match(m, /class n_sweep new/);
  assert.match(m, /class n_row changed/);
  assert.match(m, /class n_provider,n_payments same/);
  assert.match(m, /style n_provider stroke-dasharray/, "an external node gets the dashed frame");
  assert.match(m, /n_sweep -->\|"cancel add-ons \[all\]"\| n_payments/, "brackets in a quoted label stay");
  const hostile = architecture({ ...doc, nodes: [{ id: "x", label: '`ref #12 <b>a|b</b> "q"', kind: "module", delta: "added" }] });
  assert.match(hostile, /n_x\["#96;ref #35;12 #60;b#62;a#124;b#60;\/b#62; #quot;q#quot;"\]/, "what breaks the lexer becomes an entity code");
  assert.equal((m.match(/linkStyle/g) || []).length, 3, "every added edge is emphasised");
});

test("flow: added participant in a box, added messages in one band, self and return arrows", () => {
  const { title, mermaid: m } = flow(doc);
  assert.equal(title, "One sweep run");
  assert.match(m, /box rgba\(242, 220, 93, 0\.35\) new\n\s+participant p_sweep as Add-on sweep\n\s+end/);
  assert.match(m, /participant p_provider as Provider · external/);
  assert.equal((m.match(/rect rgba/g) || []).length, 1, "consecutive added messages share one band");
  assert.match(m, /p_provider-->>p_sweep: cancelled flag/);
  assert.match(m, /p_sweep->>p_payments: cancel add-ons#59; one call per add-on ×3/, "a semicolon is an entity code, repeat is shown");
  assert.match(m, /p_sweep->>p_sweep: any failure/);
  assert.match(m, /end\s*$/, "the band is closed");
});

test("flow: when every message is new nothing is banded", () => {
  const allNew = { ...doc, flows: [{ ...doc.flows[0], messages: doc.flows[0].messages.map((x) => ({ ...x, delta: "added" })) }] };
  assert.doesNotMatch(flow(allNew).mermaid, /rect rgba/);
});

test("wrap: the fragment sits under a descriptive spoiler by default", () => {
  const w = wrap("Flow", "One sweep run", "sequenceDiagram");
  assert.match(w, /^<details>\n<summary><strong>Flow<\/strong> — One sweep run<\/summary>\n\n```mermaid\nsequenceDiagram\n```\n\n<\/details>$/);
  assert.equal(wrap("Flow", "x", "sequenceDiagram", { bare: true }), "```mermaid\nsequenceDiagram\n```");
});

test("file references that do not resolve are dropped, and named", () => {
  const io = {
    exists: (rev, path) => path === "app/workers/addon_sweep_worker.rb",
    lineCount: () => 10,
  };
  const withBad = { ...doc, nodes: [...doc.nodes, { id: "ghost", label: "Ghost", kind: "module", delta: "added", lane: "billing", files: [{ path: "app/nowhere.rb" }] }] };
  const { doc: clean, stripped } = checkFiles(withBad, { io });
  assert.equal(stripped.length, 2);
  assert.match(stripped[0], /nodes\/sweep: "app\/workers\/addon_sweep_worker\.rb" has 10 lines, not 12/);
  assert.match(stripped[1], /nodes\/ghost: "app\/nowhere\.rb" is not in 222222222/);
  assert.deepEqual(clean.nodes.find((n) => n.id === "ghost").files, []);
  assert.deepEqual(withBad.nodes.find((n) => n.id === "ghost").files.length, 1, "the input is not mutated");
});

test("a picture of the system is refused by size, with what to cut", () => {
  assert.deepEqual(checkSize(doc), [], "the fixture is the size a picture should be");
  const big = {
    ...doc,
    nodes: Array.from({ length: LIMITS.nodes + 2 }, (_, i) => ({ id: `n${i}`, label: `N${i}`, kind: "module", delta: "unchanged" })),
    flows: [{ id: "f", participants: Array.from({ length: LIMITS.participants + 2 }, (_, i) => ({ node: `n${i}` })), messages: [] }],
  };
  const problems = checkSize(big);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /9 nodes, at most 7 — drop the 2/);
  assert.match(problems[1], /flow "f": 7 participants, at most 5/);
});
