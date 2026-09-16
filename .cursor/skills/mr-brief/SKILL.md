---
name: mr-brief
description: "Write a merge/pull request description a reviewer actually reads: one sentence, a diagram when the wiring moved, three key decisions, three linked places to look, one risk line. Hard limit of 15 lines of text. Opt-in: OFFERS itself in one line and writes nothing until the author says yes. TRIGGER when asked to open, describe, update or improve an MR/PR, or before handing a branch over for review."
license: MIT
allowed-tools:
  - AskUserQuestion
  - Bash
  - Read
  - Grep
  - Glob
  - Write
metadata:
  tags: "code review, merge request, pull request, gitlab, github, mermaid"
  category: "productivity"
---

# mr-brief

A description is not documentation of the diff — the diff is already there. It exists
to get a reviewer from *nothing* to *able to review* in about thirty seconds.

One rule decides everything below: **every element must remove reading, not add it.**

## Step 0 — ask

This skill is **opt-in per merge request**. A description appearing under an author's
name that they did not ask for is a failure, however good it is.

- **Invoked explicitly** (`/mr-brief`, or the author asked in their own words): that is
  the yes. Skip the gate.
- **Arrived on your own** — the plugin's hook stopped an MR-opening command, or a branch
  looks ready — ask one line, before reading the diff:

  > Want me to write an mr-brief for this MR? (15 lines, 3 places to look, diagram only if the wiring moved) — yes / no / show me the shape first

- **Once per branch.** The hook records the offer in `.git/mr-brief/`; never re-offer.
- **"no" is final. Silence is no.** Do not hint, do not raise it on the next commit.
- **"show me the shape first"**: print `templates/gitlab/Brief.md`, ask once more, stop.
- **Always-write flag.** If `$CLAUDE_CONFIG_DIR/.mr-brief-always` exists (default
  `~/.claude`), skip the question and write. Attaching still waits for a yes.

Attaching the brief to the MR stays behind a **second yes**. Show the brief in the
conversation first. **The skill writes the description and nothing else**: it never posts
comments, threads or review notes on the MR — what a reviewer should know about a file
goes into the reading guide, inside the description.

## The contract

**15 lines of visible text.** The diagram does not count.

| Element | Limit |
|---|---|
| Series line | 1 line, only when the MR is one of a set |
| What changes | 1 sentence, 140 chars |
| Architecture | 1 line + the scenario as a sequence across services, only if a service now calls another it did not, or the MR is one of a set |
| Flow | one picture above the key changes, only if the wiring moved — a rendered SVG when the renderer is there, else mermaid |
| Key changes | `###` heading; exactly **3** bullets, `**claim** — reason`, most contentious first |
| Where to look | `###` heading carrying `~N min` and `skip:`; exactly **3** permalinks as checkboxes, in reading order |
| Risk | `###` heading; 1–2 lines, the only blockquote |

If the change does not fit in three claims, say so before writing: *"this is N separable
changes — split it, or the reviewer skims."* Write it if they decline, but say it once.

## The shape

```markdown
<!-- mr-brief v1 -->  TICKET · 2 of 3 · after repo_a!11, before repo_c!33

One sentence saying what is now true that was not before.

**Architecture:** one line on what now talks to what that did not before. Then its picture.

```mermaid
sequenceDiagram ...       %% the scenario end to end; a translucent rect band on what this MR adds
```
*Yellow: added by this MR. One sentence on the fact the picture cannot say by itself.*

### Key changes
- **The claim in bold** — the reason, after the dash
- **The next claim** — its reason
- **The third** — its reason

### Where to look · ~12 min · skip the 890 lines of specs
- [ ] **Start →** [file.rb:21](permalink#L21) — the entry point, top to bottom
- [ ] [other.rb:103](permalink#L103) — the decision most worth arguing about
- [ ] [spec.rb:92](permalink#L92) — the test that proves the interesting case

### Risk
> The worst realistic outcome, and whether it fails loudly or silently.
>
> Rollback: revert, or what else it takes.

---

<details>
<summary><strong>Reading guide</strong> — 8 files worth opening, with their hunks · what to skip · glossary</summary>

Everything true but not needed to start reviewing. Never the diagram.

</details>
```

Sections are `###` headings, not bold lines. Both renderers give a heading its own space
and weight, so the four blocks read as four blocks — a reviewer who has seen one brief
knows where the risk is in the next before it has finished loading. Bold text in the
flow does not do that.

## Procedure

1. **The real delta** — against the *remote* target, never the local copy. Sort it first:
   ```bash
   git fetch origin --quiet
   node "${CLAUDE_PLUGIN_ROOT}/scripts/focus.mjs"          # core / tests / views / config / generated, renames named
   git diff origin/<target>...HEAD -- . ':!spec' …          # the core-only diff focus.mjs prints
   ```
   Read the core files closely and the rest only as far as the brief needs. The `skip:`
   clause is written from focus.mjs's counts, and pure renames go under `<details>` as
   *Moved, not changed* — a reviewer should never read a moved file line by line.
2. **Read the diff, not the commit messages.** Commits say what was meant; the brief
   says what the code now does. **An existing brief on the MR is input, not output.**
   If the description already carries the `<!-- mr-brief v1 -->` marker, re-derive every
   section from the diff anyway, then keep only what still holds — and tell the author
   what changed between the two. Never re-emit the old text because it is there.
   The risk it names is a hypothesis to re-verify against the code, never something to
   drop because the new draft did not happen to find it. **Pictures are the exception:
   they are rebuilt every run**, with whatever this version draws — an old mermaid block
   is not "still holding", it is stale output. If `npx` is there, render and replace it;
   the old block moves under `<details>` as source or goes. `/mr-brief fresh` means: do not
   read the existing description at all — use it only to test the skill itself.
3. **Size check** — three claims, or say so.
4. **Anchors** — never type a `path:line` by hand. The script verifies the line exists
   and builds the permalink:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/anchor.mjs" app/x.rb:42 lib/y.rb:7   # add --sha <head> for an open MR
   ```
   Reading order is call order: the caller before what it calls. `grep` the class name
   if unsure.
5. **Series** — if the branch carries a ticket key, list the open MRs that share it and
   order them by dependency (the MR whose output the next one reads goes first). The
   script reads the group from the remote, so nothing is guessed:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/siblings.mjs" TICKET
   ```
   Two MRs from the same repo with the same title are a duplicate, not a series — say so.
6. **Two picture gates, both default no.** Pictures are regenerated on every run, never
   carried over from an earlier brief. When a gate passes and `npx` is available,
   write `tmp/mr-brief/graph.json` (see `reference/diagrams.md`, *Rendered*) and run
   `render.mjs --mr <iid>`: it validates, draws both lenses with the PR Lens renderer and
   uploads the SVGs; paste the image lines it prints above Key changes and move the mermaid
   under `<details>` as the source. Without `npx`, or on GitHub, the mermaid is the picture. *Architecture* — only if a service now
   calls another it did not before, or the MR is one of a set; one line of text, then
   the scenario end to end as a sequence diagram, one lifeline per service, this repo's
   lifeline heavy. *Flow* — only if a
   call between services, a state machine, a job or sweep, a webhook, or an order of
   operations moved. Most MRs get none; a feature MR may get both. In a series the
   architecture picture is the **same in every MR of the set**, with this repo framed —
   that is the series map. Read `reference/diagrams.md` before drawing either.
7. **Write** to a path git already ignores — `tmp/mr-brief/brief.md` when `git
   check-ignore -q tmp/` passes, otherwise `.mr-brief.md` (and say it wants a `.gitignore`
   line). Never under `.git/`: the Write tool treats it as sensitive and refuses. Then
   **lint**:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/lint.mjs" tmp/mr-brief/brief.md
   ```
8. **Preview it the way the MR will show it**, then show that:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs" tmp/mr-brief/brief.md
   ```
   The platform's own Markdown renderer draws the text (`glab api markdown` / `gh api
   /markdown`), the page draws the mermaid, and a toggle shows both themes. Nobody says yes
   to a description they have only seen as raw Markdown in a chat.
9. **Add the reading guide under `<details>`** — the diff made edible without leaving the
   description. For each core file from `focus.mjs` (eight at most): one line — *what
   changed · what to check* — with the file as a permalink, then the **decisive hunk** as a
   ```` ```diff ```` block cut by the script, never by hand and never a whole file:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/excerpt.mjs" app/x.rb:42 lib/y.rb:7 --sha <head> --lines 10
   ```
   ```markdown
   **Reading guide**

   **[worker.rb:22](permalink)** — posts the usage after five guards · the reply is never read, so a 422 is a silent loss
   `app/workers/worker.rb:15–24` @ 1bbdfe2
   ```diff
   +    return unless product_code.present?
   +
   +    InvoiceManager::BillableUsage.create(
   ```

   Skip: 7 spec files (they all stub `.create`), 2 admin views, `schema.rb`.
   Moved, not changed: `a.rb → b.rb`.
   ```
   *What changed* is the decision, not a restatement; *what to check* is the trap or the
   question a reviewer cannot see from the hunk alone. Ten diff lines per file at most;
   plumbing files get the one line and no hunk. Pure renames are one line, never an entry.
   The `@ sha` says which revision the hunk shows — after a new push, re-run the brief.
10. **Attach** — only on a second yes:
   ```bash
   glab mr create --description-file tmp/mr-brief/brief.md      # gh pr create --body-file …
   ```
   For an MR that already exists, `glab mr update` takes no file; PUT the JSON yourself
   and read the description back to confirm it round-tripped:
   ```bash
   node -e 'require("fs").writeFileSync("tmp/mr-brief/body.json", JSON.stringify({description: require("fs").readFileSync("tmp/mr-brief/brief.md","utf8")}))'
   glab api -X PUT -H "Content-Type: application/json" "projects/<group%2Frepo>/merge_requests/<iid>" --input tmp/mr-brief/body.json
   ```

## Words

Write it the way you would say it to a colleague at their desk.

- **One idea per sentence.** No semicolon stacking a second thought onto a first, no
  clause starting with "which".
- **The everyday word wins**: *dead* over *deactivated*, *stolen* over *captured*,
  *asks for* over *declares*.
- **A term the reader would look up gets one line of plain English, or it goes.** Domain
  words are fine when the change is about them; a word that lives only inside one class
  is the author's shorthand.
- **Active voice, present tense.** "The sweep skips", not "will be skipped".
- **No claim the diff does not contain.** No "faster" without a number.
- **A claim about what a library or framework does is read in its source, not remembered.**
  "The ORM drops unknown keys", "the client raises on 4xx" — open the gem and point at the
  line, or leave the claim out. A confident wrong sentence about a dependency is the most
  expensive thing a brief can carry, because nobody checks it.
- **Bold the claim, not the topic.** Someone reading only the bold still understands the MR.
- **Banned openers**: `This MR/PR …`, `In this change …`, `As part of …`, `Refactored …`,
  `Various improvements …`, `Minor fixes …`, `Added …`, `Updated …`.

## Each part

- **What changes** — behaviour, not mechanics. Subject first, active verb.
  Bad: `This MR introduces a new worker and refactors the subscription model.`
  Good: `Cancelling a subscription now also cancels every add-on billed against it.`
- **Architecture** — what now talks to what that did not before, in one line:
  `billing gains a nightly sweep worker and now asks the provider whether a subscription is still live.`
  Key changes say what was decided; the flow says what happens; this says what now
  exists that did not. Absent when the shape did not change — say so only in a series.
- **Key changes** — each a decision someone could disagree with. If nobody could, delete
  it. Bad: `Added PollSubscriptionsWorker`. Good: `**The sweep is fail-soft per row** — one
  unreachable provider no longer aborts the rest`.
  **Each reason must be checkable in thirty seconds at one of the three places to look.**
  A claim the reviewer cannot verify from the links you gave them is a "trust me", and a
  brief has no room for those. If a claim needs a fourth place, the claim or the place is
  wrong.
- **Where to look** — the entry point, the riskiest decision, the test that proves the
  interesting case. One link per entry; a second link smuggled into the first entry is a
  fourth place to look. `**Start →**` on the first. `~N min` and one `skip:` clause in the
  heading: naming what *not* to read removes more work on a 70-file MR than any bullet adds.
- **Risk** — worst *realistic* outcome; loud or silent; then revert-and-done or what more.
- **`<details>`** — `<summary>` on its own line, blank line before and after the Markdown
  inside, or it renders as raw text. A bare `Details` summary renders as a footnote nobody
  opens: put a `---` rule above the block and make the summary **say what is inside** —
  `<strong>Reading guide</strong> — 8 files with their hunks · what to skip · glossary`.
  `<strong>` survives both sanitizers; the rule and the summary count as no text lines. In the risk blockquote a bare `>` line separates the risk from the
  rollback — consecutive `>` lines fold into one paragraph otherwise. Holds what a reviewer may want *after* starting.
  Two things earn their place there: a **glossary grouped by role** — *Entry · Boundary ·
  Deciding · Errors* — one line per part; and, when the MR adds refusal or error paths, a
  **fails-with table**: `| outcome | error the caller sees | reached when |`, one row per
  outcome. Say in the row whether it is loud or silent.
- **No emoji headings**, no decorative rules, no `🚀 Summary`.

## Before handing over

`lint.mjs` checks the shape. You check what it cannot:

- [ ] The author said yes, or invoked the skill themselves
- [ ] Every anchor came from `anchor.mjs`, and the printed line is the line you meant
- [ ] Every key change can be checked at one of the three anchors in thirty seconds
- [ ] The first anchor is the caller, not something it calls
- [ ] Each picture passes its gate, is drawn at the level of the headline change, and was drawn by this run — not carried over
- [ ] Every arrow in it exists in the code
- [ ] Nothing was attached without a second yes, and nothing was posted as a comment or thread; the reading guide covers each core file once, hunks cut by `excerpt.mjs`, none for a rename
