# Diagrams

Loaded only when the gate in `SKILL.md` passes. The diagram sits above the key changes
and is never collapsed: it is the one element that replaces reading instead of adding to
it.

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

The diagram shows the flow after the change, so mark the part that is new:

```
flowchart TD
    R[charge request] --> P(subscription still live?<br/>charge_request.rb:163)
    P -- no --> X[refuse]
    P -- yes --> I[issue]
    classDef step fill:#FFFFFF,stroke:#C3C9BF,stroke-width:1px,color:#191C1F
    classDef new  fill:#F2DC5D,stroke:#8A6410,stroke-width:1.5px,color:#191C1F
    classDef stop fill:#A8392B,stroke:#7A2A1F,stroke-width:1px,color:#FFFFFF
    class R,I step
    class P new
    class X stop
```

Then one short italic line under the block. It starts with the colour key and ends with
**the one non-obvious fact the picture cannot say by itself**:

*Yellow: added by this MR. The flag is read once, at the top — passing nil is the whole
off-switch.*

The legend belongs to the diagram and does not count against the text limit. A legend that
only decodes colours is a wasted line.

- Give **every** node a class. Mermaid's default lilac boxes are what makes a diagram look
  unconsidered, and an explicit fill is the only styling that survives GitLab.
- `fill` and `color` always together. A fill with the renderer's default text colour is
  unreadable in whichever theme you did not look at.
- Three classes at most: unchanged, added, refuses. A fourth is a legend nobody reads.
- Sequence diagrams cannot take `classDef`; they have two tools of their own, and both
  must be **translucent** so the text keeps reading in either theme:
  - a `rect` band behind the messages this MR added —
    `rect rgba(242, 220, 93, 0.22)` … `end`. One band per run of new messages; a
    band around everything says nothing.
  - a `box` around a participant this MR introduced —
    `box rgba(242, 220, 93, 0.35) new` / `participant PA as payments` / `end`.
  Never an opaque `rgb(...)`: the band paints over the text colour of the other theme.
- When everything in the diagram is new, mark nothing and say so in the legend.
- Never `%%{init}%%` themes. The diagram must read on a light and a dark page.

## Syntax that breaks in one renderer or the other

- Parentheses, colons or commas inside a `participant … as` alias.
- Unquoted `;` or `#` inside a label — both are control characters.
- Markdown inside labels. Backticks and bold render literally.
- Arrow spelling mixed within one diagram: `->>` solid call, `-->>` dashed return.

## Honesty

- Every arrow maps to a call in the diff or in code the diff touches. If you cannot point
  at the line, delete the arrow.
- Draw at the level where the headline change happens. If the change is in the caller, a
  picture of the callee's internals cannot contain it.
- No real identifier, token, national ID, email or customer name in a label. Field names
  only.
