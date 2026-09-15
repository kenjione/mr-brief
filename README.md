# mr-brief

Write merge request descriptions a reviewer actually reads.

Not a summary of the diff — the diff is already there. A **brief**: one sentence, a
diagram when the wiring moved, three decisions someone could argue with, three linked
places to look, one risk line. Fifteen lines of text, hard limit.

Every element has to earn its place by the same test: **does it remove reading, or add
it?** A picture instead of a paragraph. A permalink instead of a path to copy. A bolded
claim instead of a sentence to parse.

## The problem

Large, AI-assisted changes produce large merge requests. Reviewers stop reading past
a few hundred changed lines and start pattern-matching, and the review turns into
`LGTM`. A longer description does not fix that — it is the same failure one screen
earlier.

The fix is a shorter description with a harder shape. Research on review practice is
consistent on one point: description quality moves review outcomes more than diff
size does. A 1000-line change with a good description reviews better than a 100-line
change with a vague one.

## What it produces

````
<!-- mr-brief v1 -->  BILL-412 · 2 of 2 · after payments-api!318

Cancelling a subscription now also cancels every add-on billed against it.

```mermaid
sequenceDiagram ...
```

- **Cancelled state is re-read from the provider every sweep** — never from the cached
  expiry, so a stale copy cannot keep an add-on billing
- **The sweep is fail-soft per subscription** — one unreachable provider no longer
  aborts the rest of the run
- **A 404 from the cancel call counts as success** — no add-ons, still cancelled

**Where to look** · ~8 min · skip the 300 lines of specs and the migration
- [ ] **Start →** [poll_subscriptions_worker.rb:45](#L45) — where a flag becomes a cascade
- [ ] [addon_cancellation.rb:21](#L21) — 404 swallowed into false; the arguable bit
- [ ] [poll_subscriptions_worker_spec.rb:92](#L92) — a failing cascade does not stop the sweep

> **Risk:** an add-on keeps billing after cancellation — visible as last_error, retried.
> Rollback: flip the polling setting off; a full revert also rolls back the migration.
````

Full version: [`examples/subscription-addon-cascade.md`](examples/subscription-addon-cascade.md).

## The rules that do the work

| Element | Limit |
|---|---|
| Whole brief | 15 lines of text; the diagram does not count |
| Series line | 1 line, only when the MR is one of a set |
| What changes | 1 sentence, 140 characters |
| Flow | one mermaid block, above the bullets, only when the wiring moved |
| Key changes | 3 bullets, claim in bold, reason after the dash |
| Where to look | 3 permalinks as checkboxes, in reading order |
| Risk | 1-2 lines, one blockquote |

The formatting is not decoration — each piece removes work. A permalink is one click
instead of a path to copy. A checkbox survives an interruption: the reviewer can see
where they stopped. Bold claims mean someone reading only the bold still understands
the MR. One `skip:` clause removes more reading on a 70-file MR than any bullet adds.

Three and three is a forcing function. If a change needs more than three claims, the
honest output is *split this MR*, and the skill says so before it writes anything.

## Opt-in by design

The skill never writes an MR description because it felt like it. When it notices an
MR is about to happen, it asks once, in one line:

> Want me to write an mr-brief for this MR? (15 lines, 3 places to look, diagram only
> if the wiring moved) — yes / no / show me the shape first

Then:

- **no** ends it for the session. No second offer, no hint, no bringing it up on the
  next MR.
- **yes** produces the brief *in the conversation*. Attaching it to the MR needs a
  second yes, because a description is outward-facing.
- Self-review comments are proposed, never posted on their own.
- `/mr-brief` skips the question — typing it is the yes.

The offer is timed by a hook, not by guesswork. `hooks/offer.mjs` watches for a command
that opens an MR — `glab mr create`, `gh pr create`, any wrapper whose command contains
`mr create` or `pr create`, `git push -o merge_request.create` — stops that one call, and asks Claude to put the question. The
offer is recorded in `.git/mr-brief/offered-<branch>`, so the same branch is never
interrupted twice: on a no, the command simply runs. To be asked again on a branch,
`rm .git/mr-brief/offered-<branch>`.

Two ways to change the default, both one line:

| You want | Do |
|---|---|
| Never be asked; only `/mr-brief` | remove `hooks/hooks.json` after install, or add `disable-model-invocation: true` to the skill's frontmatter |
| Never be asked; always write one | `touch ~/.claude/.mr-brief-always` (or under `$CLAUDE_CONFIG_DIR`) — attaching still asks |

## Install

```bash
claude plugin marketplace add kenjione/mr-brief
claude plugin install mr-brief@mr-brief
```

Then `/mr-brief` on a branch that is ready for review. See [INSTALL.md](INSTALL.md)
for the template-only route, which needs no agent at all.

## What ships

```
skills/mr-brief/SKILL.md              the rules — 170 lines
skills/mr-brief/reference/diagrams.md when and how to draw, loaded only if the gate passes
hooks/offer.mjs                       the once-per-branch offer, on the command that opens an MR
scripts/anchor.mjs                    path:line → verified permalink, refuses a line that does not exist
scripts/lint.mjs                      checks a brief against the contract; exit 1 with reasons
scripts/siblings.mjs                  open MRs sharing the branch's ticket key, group taken from the remote
templates/                            the empty shape, for GitLab and GitHub, usable with no agent
examples/                             one full brief
evals/                                lint fixtures + tests, a real-run harness, a rubric and a judge
ci/                                   drop-in jobs that lint an MR/PR description and comment, never block
.cursor/skills/mr-brief/              synced copy of the skill for Cursor (scripts/sync-runtimes.mjs)
```

Tested on GitLab (a 20-file feature MR, twice) and on GitHub (a docs-only branch); see `evals/results.md`.

`anchor.mjs` exists because one wrong line number costs the reader's trust in the whole
brief, and line numbers after a diff are exactly what a model gets wrong. `lint.mjs` is
the same check the skill runs before handing over; it also works as a soft CI check on
the MR description.

## Works with

GitLab and GitHub. Both render mermaid in descriptions natively. The skill writes the
brief to `tmp/mr-brief/brief.md` when `tmp/` is already ignored, else `.mr-brief.md`, and
attaches it with whatever the repo uses: `glab mr create --description-file`, `gh pr
create --body-file`, or your team's own wrapper.

## What it deliberately does not do

- It does not review the code. Use a review tool for that.
- It does not draw a diagram of every change. Most changes do not move any wiring,
  and a decorative diagram trains reviewers to scroll past the ones that matter.
- It does not make a 2000-line MR reviewable. It makes the size visible.

## Measuring whether it works

Three numbers, before and after, over two weeks:

- time to first review comment — expect it to drop
- substantive comments per MR (threads minus `LGTM`) — expect it to rise
- share of approvals with zero comments — that is the rubber stamp; expect it to fall

MIT licensed.
