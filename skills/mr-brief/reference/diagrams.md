# Diagrams

## One document, two outputs

You describe the picture as data and never draw it. `tmp/mr-brief/graph.json` is a PR Lens
graph document: lanes, nodes, edges and one flow, each carrying a `delta`. Two scripts read
it; both first check every `files` reference against the commit the document names and
drop one that does not resolve, telling you which.

- `render.mjs` — when `npx` is there: validates, draws the **architecture** lens (lanes,
  typed nodes, NEW / CHANGED badges) and the **data-flow** lens (a sequence) with the PR Lens
  renderer, uploads the SVGs on GitLab and prints the image lines. Nothing else.
- `compile.mjs` — without `npx`, or on GitHub where nothing can be uploaded: prints the
  same document as mermaid, each lens inside `<details>` with a descriptive summary.

**One picture, once.** The SVG stands in the open above Key changes with one italic legend
line under it; the mermaid appears only where there is no SVG, and then folded. The compiler
decides shapes, colours, the translucent band behind what is new, and escaping — so the same
document gives the same picture on every run, and nothing a label contains can break it.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/render.mjs"  tmp/mr-brief/graph.json --mr <iid>
node "${CLAUDE_PLUGIN_ROOT}/scripts/compile.mjs" tmp/mr-brief/graph.json
```

The document, in the parts that matter (`pr-lens validate` checks the rest):

```json
{ "schemaVersion": "0.2.0", "kind": "graph", "id": "billing-sweep", "generatedAt": "…",
  "title": "…", "summary": "…", "lenses": ["architecture", "data-flow"],
  "provenance": { "repo": {"host":"gitlab.com","owner":"g","name":"r"}, "base": {"ref":"main","sha":"…40 hex…"}, "head": {"ref":"feat","sha":"…"}, "generator": {"name":"mr-brief","version":"0.8.0"} },
  "lanes": [ { "id": "billing", "label": "billing (this repo)", "order": 0, "delta": "modified" } ],
  "nodes": [ { "id": "sweep", "label": "Sweep worker", "kind": "job", "delta": "added", "lane": "billing", "subtitle": "nightly · retry 3",
               "files": [ { "path": "app/workers/sweep_worker.rb", "startLine": 12 } ] } ],
  "edges": [ { "id": "e1", "from": "sweep", "to": "pay", "kind": "http", "delta": "added", "label": "cancel add-ons" } ],
  "flows": [ { "id": "f1", "title": "One sweep run", "delta": "added", "participants": [{"node":"sweep"},{"node":"pay"}],
              "messages": [ { "id": "m1", "from": "sweep", "to": "pay", "label": "POST cancel", "kind": "sync", "delta": "added" } ] } ],
  "stats": { "filesChanged": 20, "additions": 402, "deletions": 2 } }
```

- `delta` is the highlight: `added` · `modified` · `removed` · `unchanged`. Nothing else marks
  what is new — so every lane, node, edge and message carries one. Added nodes come out
  yellow, added edges heavy, added messages inside one translucent band, an added participant
  in a box. When every message is new the band is left out: mark nothing, say so in the legend.
- `kind` picks the shape and the icon: nodes `service app module function route job queue
  datastore cache external ui config test package other`; edges `call http rpc event queue
  data dependency`; messages `sync` · `async` · `return` · `self`. A `self` message is a guard
  or a decision. An `external` node is drawn with a dashed frame — the part we cannot change.
- `files` on a node is its `path:line` — the file hint in the node and the permalink in the
  SVG. One per node, the line where the change is. `startLine` is checked against the commit.
- One lane per service or boundary, this repo's lane first (`order: 0`); external systems are
  `external` nodes in their own lane.
- **Size is a hard ceiling, refused before anything is drawn:** at most **7 nodes, 9 edges;
  5 participants and 10 messages** in the flow. Over it, both scripts stop and say what to
  cut. This is the *draw the change* rule made mechanical: the nodes the diff touched plus
  the one or two they talk to; a datastore or a page is a message, not a lifeline; guards
  are one `self` message. If the change genuinely has more parts, the MR has more parts too
  — say so in the size check instead of drawing them all.
- **Labels ≤ 22 characters** — the renderer cuts longer ones. Put the rest in `subtitle`.
- Never a real identifier, token or customer value in a label — the same rule as everywhere.

The mermaid shown in the sections below is what the compiler produces from such a document.
It is here so you know what the reader sees, not for you to type.

## Two kinds of picture

**Architecture** shows the shape: the components and the dependencies between them, and
which of those this MR added, removed or moved. **Flow** shows what happens: who calls whom,
in what order, and where a request is refused. They answer different questions and have
separate gates; a small MR has neither, a feature MR may have both, architecture first.

### Architecture — the scenario end to end

The shape of a feature is shown the way UML shows behaviour across parts: a **sequence
diagram of the whole scenario**, one lifeline per service, top to bottom. It answers the
question a class or component sketch cannot — *who calls whom, in what order, and where
this MR sits in it* — and every developer reads it without a legend.

- One lifeline per service or external caller, 3–5 of them. The current repo's lifeline
  is the heavy one; a `(you are here)` in its alias says so in mermaid.
- 8–12 messages: the calls between services, plus a self-message where a service makes a
  decision that matters (`replayed? → whole family dies`). Nothing internal beyond that.
- Replies dashed. Refusals named on the reply (`charge — or refuse, reason named`).
- **Label a message with the real call when it is short** — `evaluate(chain:)`,
  `find_pinned(pseudonym:)`. It ties the arrow to a line of code the way `file.rb:163` ties
  a node to one. Over ~30 characters, say what it does instead.
- **Mark what is not ours.** A third-party library or another team's service is the part
  the reviewer cannot change. In a sequence, put `(library)` or `(external)` in the alias;
  in a flowchart, wrap it in a `subgraph` with a dashed frame:
  `style Lib stroke-dasharray: 5 4,stroke:#8A8F88`. Then the legend can say *everything
  outside the dashed frame is ours*.
- **A callback is a labelled return, not a second call.** When the callee calls back up
  (`isValid(chain:) → Bool`), draw it as a dashed reply carrying the method name. An arrow
  that runs against the reading direction without that label reads as a layering mistake.
- In a **series**, this one picture is drawn for the whole set and repeated in every MR,
  identical apart from the heavy lifeline — and the `rect` band, which moves to the
  messages *this* MR adds. Wherever the reviewer lands, they see the whole
  feature and their place in it.
- When an MR's own flow is the same exchange at the same grain, it gets no second picture
  — the series sequence already is it. A second picture is for a *different* view, such
  as the gates inside one service as an activity diagram.

```
sequenceDiagram
    autonumber
    participant CL as Client app
    participant BI as billing (you are here)
    participant PR as provider
    participant PA as payments
    rect rgba(242, 220, 93, 0.22)
    CL->>BI: cancel subscription
    BI->>BI: already cancelled? → stop
    BI->>PR: subscription state?
    PR-->>BI: cancelled · blocked
    BI->>BI: mark cancelled, queue the add-on sweep
    BI-->>CL: 200 cancelled
    end
    CL->>PA: charge
    PA->>PA: subscription still live?
    PA->>PR: pinned subscription
    PR-->>PA: state · blocked
    PA-->>CL: charge — or refuse, reason named
```

### Flow

## Which type

| The change moved | Use |
|---|---|
| Who calls whom, in what order | `sequenceDiagram` |
| A lifecycle: states and transitions | `stateDiagram-v2` |
| Checks or steps whose *position* in a flow is the change | `flowchart TD` |
| Ordered checks where the **first match wins** | a numbered ladder — a 3-row table, not diamonds |
| Nothing above | no diagram |

## The ladder: first match wins

A classifier, a chain of guards, a precedence order — anything where the rungs are tried
in order and the first that matches decides — is clearer as a numbered ladder than as a
flowchart of diamonds. It is also plain Markdown, so it renders everywhere:

```markdown
| # | when | result |
|---|---|---|
| 1 | the previous credential was revoked for a reason not on the allowlist | refuse |
| 2 | the purchase is dead or blocked | refuse |
| 3 | a required attribute is gone from the profile | refuse |
| — | nothing matched | issue |
```

If the ladder *is* the headline change, it stands where the flow diagram would and counts
as text — four or five lines. Otherwise it goes under `<details>`.

## Draw the change, not the system

- Steps that were already there and did not move are not in the picture. Include an
  unchanged node only when a new one cannot be placed without it.
- 5–9 nodes, and every label legible at page width. If labels have shrunk, cut nodes.
- `TD` for anything linear. `LR` divides the page width by the chain length; keep it for
  two or three nodes or a real fan-out.
- Draw the flow *after* the change. Never a before/after pair.

## Label in the reader's words

- A node says what it is in words a reviewer already knows. `subscription still
  live?` needs no glossary; `ledger clear?` is the author's shorthand. The precise
  term goes in the bullets or the `<details>` block.
- A gate is a rounded rectangle `(...)` with a **refusal edge** — the edge is what makes
  it a gate. Diamonds `{...}` grow with their label; keep them for a real multi-way branch.
- A gate carries a short predicate someone can answer — `(subscription still live?)`, never
  `(subscription)` — and every gate reads the same way round, so *no* always refuses.
- Put the file and line in the node on a second line, basename only:
  `P(subscription still live?<br/>ensure_subscription_live.rb:23)`. `<br/>` renders in both
  GitLab and GitHub, in node labels and in `participant … as` aliases. Now the diagram
  and *Where to look* point at the same places.
- Do not use mermaid's `click` for links. Both renderers run mermaid in strict mode and
  drop click handlers silently.

## Mark what this MR added

The picture shows the flow after the change, and `delta` is how the reader tells the new
part from the rest: yellow nodes, heavy edges, one translucent band behind the run of
messages this MR adds, a box around a participant it introduces. That is the compiler's
job; yours is to set `delta` honestly on every element — `unchanged` is a claim too.

Then one short italic line under the picture. It starts with the colour key and ends with
**the one non-obvious fact the picture cannot say by itself**:

*Yellow: added by this MR. The flag is read once, at the top — passing nil is the whole
off-switch.*

The legend belongs to the picture and does not count against the text limit. A legend that
only decodes colours is a wasted line. When everything in the picture is new, nothing is
marked — say so in the legend.

## Honesty

- Every arrow maps to a call in the diff or in code the diff touches. If you cannot point
  at the line, delete the arrow.
- Draw at the level where the headline change happens. If the change is in the caller, a
  picture of the callee's internals cannot contain it.
- No real identifier, token, national ID, email or customer name in a label. Field names
  only.
