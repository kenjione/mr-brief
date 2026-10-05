---
name: mr-brief
description: "Write a merge/pull request description a reviewer actually reads: one sentence, a diagram when the wiring moved, three key decisions, three linked places to look, one risk line. Hard limit of 15 lines of text. Opt-in: OFFERS itself in one line and writes nothing until the author says yes. TRIGGER when asked to open, describe, update or improve an MR/PR, or before handing a branch over for review."
license: MIT
allowed-tools:
  - AskUserQuestion
  - Agent
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

## Review mode — someone else's MR

`/mr-brief review <iid | url>` is for the reviewer, on an MR that came without a brief. It
is asked for explicitly, so there is no Step 0. It writes **only to your machine**: nothing
is attached, posted, uploaded or commented, and the checkout never moves.

1. Fetch the MR without checking it out, and use its refs everywhere below:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/mr-ref.mjs" <iid>     # prints --sha <head> --target <target>
   ```
2. `focus.mjs <target> --sha <head>`, then read the core diff the same way as for a brief.
3. Write `tmp/mr-brief/review-<iid>.md`: the lead sentence, **three questions to settle**
   instead of key changes (the decisions you would push back on, each with its anchor), the
   three places to look, the risk as you read it, and the reading guide (step 8, delegated).
   The picture, when a gate passes, comes from `compile.mjs` as folded mermaid — never
   uploaded to someone else's project.
4. Check the questions' premises with the `claim-checker` (step 9): a question built on a
   misread is worse than none.
5. Preview it (step 10) and stop. What you post on the MR, and where, is yours to decide.

## The contract

**15 lines of visible text.** The diagram does not count.

| Element | Limit |
|---|---|
| Series line | 1 line, only when the MR is one of a set |
| What changes | 1 sentence, 140 chars: **who can now do what**, in words a developer from the next team understands |
| Why | `**Why:**` 1–2 sentences, 280 chars: the need or the problem — what someone could not do, or what went wrong, before this MR |
| Architecture | 1 line + the scenario as a sequence across services, only if a service now calls another it did not, or the MR is one of a set |
| Flow | one picture above the key changes, only if the wiring moved — a rendered SVG when the renderer is there; the mermaid form always under `<details>` |
| Key changes | `###` heading; exactly **3** bullets, `**what** — why`. The first is **the change itself**: what the MR makes possible and how. Then the two most arguable decisions. Every *why* answers the reader's "why so?" |
| Where to look | `###` heading carrying `~N min` and `skip:`; a **`**Start →**` line** — where the scenario is entered — then exactly **3** checkboxes, each a **question the reviewer answers at a line this MR changed**, ending `· key change N` — one for each key change |
| Risk | `###` heading; the only blockquote: the worst one or two realistic risks — including any **high** one the claim-checker found that the brief left out — then the rollback |

If the change does not fit in three claims, say so before writing: *"this is N separable
changes — split it, or the reviewer skims."* Write it if they decline, but say it once.

## The shape

```markdown
<!-- mr-brief v1 -->  TICKET · 2 of 3 · after repo_a!11, before repo_c!33

One sentence: who can now do what, in everyday words.

**Why:** the need or the problem behind it — what could not be done, or what went wrong, before.

**Architecture:** one line on what now talks to what that did not before. Then its picture.

![architecture](…uploaded SVG, when the renderer is there…)
*Yellow: added by this MR. One sentence on the fact the picture cannot say by itself.*

<details>
<summary><strong>Flow</strong> — the scenario end to end</summary>

```mermaid
sequenceDiagram ...       %% compiled from graph.json — never typed
```

</details>

### Key changes
- **The claim in bold** — the reason, after the dash
- **The next claim** — its reason
- **The third** — its reason

### Where to look · ~12 min · skip the 890 lines of specs
**Start →** [routes.rb:12](…/diffs#…_12) — where the new scenario is entered; follow `create` down
- [ ] [file.rb:21](…/diffs#…_21) — is X compared with what we sent, not with what came back? · key change 1
- [ ] [other.rb:103](…/diffs#…_103) — can two calls both get past this before either writes? · key change 3
- [ ] [spec.rb:92](…/diffs#…_92) — does the failing case leave the rest running? · key change 2

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
   is not "still holding", it is stale output. Write the graph document again and let
   `render.mjs` or `compile.mjs` draw it. `/mr-brief fresh` means: do not
   read the existing description at all — use it only to test the skill itself.
3. **Size check** — three claims, or say so.
4. **Anchors** — never type a `path:line` by hand. The script verifies the line exists
   and builds the link. For an MR that already exists, pass its number: the link then opens
   the MR's **own changes tab at that line**, where the reviewer can leave a comment without
   leaving the page — a blob permalink cannot take a comment. Without a number (the MR is
   not created yet) it is a blob permalink at the head commit.
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/anchor.mjs" --mr <iid> --sha <head> app/x.rb:42 lib/y.rb:7
   ```
   On GitLab the link is pinned to the pushed version of the diff whose head is `<head>`
   (`diffs?diff_id=…`), so a later push cannot move the line. The script says when no pushed
   version matches — push first, or the links will drift.
   A line the MR did not touch has no place in the diff; the script falls back to the
   permalink and says so — then ask whether that is the line to send the reviewer to.
   Reading order is call order: the caller before what it calls. `grep` the class name
   if unsure. The reading guide's file links come from the same call.
5. **Series** — if the branch carries a ticket key, list the open MRs that share it and
   order them by dependency (the MR whose output the next one reads goes first). The
   script reads the group from the remote, so nothing is guessed:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/siblings.mjs" TICKET
   ```
   Two MRs from the same repo with the same title are a duplicate, not a series — say so.
6. **Two picture gates, both default no.** *Architecture* — only if a service now calls
   another it did not before, or the MR is one of a set. *Flow* — only if a call between
   services, a state machine, a job or sweep, a webhook, or an order of operations moved.
   Most MRs get none; a feature MR may get both. When a gate passes, **write the graph
   document**, `tmp/mr-brief/graph.json` (`reference/diagrams.md`, *One document*): lanes,
   nodes, edges and one flow, each carrying a `delta`, each node naming its `files`. **You
   never type mermaid.** Then:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/render.mjs" tmp/mr-brief/graph.json --mr <iid>   # npx there: SVGs uploaded + mermaid source
   node "${CLAUDE_PLUGIN_ROOT}/scripts/compile.mjs" tmp/mr-brief/graph.json             # no npx, or GitHub: the mermaid is the picture
   ```
   Both check every `files` reference against the commit and drop one that does not
   resolve — read what they dropped — and both **refuse a document over 7 nodes or 5
   participants**: cut it, do not argue with it. Paste what they print above Key changes. **One
   picture, once:** with SVGs uploaded, the image lines stand in the open with one italic
   legend line under them and no mermaid anywhere — a second copy of the same picture is not
   a source, it is clutter. Without SVGs, `compile.mjs` prints the picture as mermaid inside
   `<details>` with a descriptive summary, and that is the picture. Pictures are regenerated
   on every run, never carried over from an earlier brief. In a series the architecture
   picture is the **same in every MR of the set**, with this repo's lane first — that is the
   series map. Read `reference/diagrams.md` before writing the document.
7. **Write** to a path git already ignores — `tmp/mr-brief/brief.md` when `git
   check-ignore -q tmp/` passes, otherwise `.mr-brief.md` (and say it wants a `.gitignore`
   line). Never under `.git/`: the Write tool treats it as sensitive and refuses. Then
   **lint**:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/lint.mjs" tmp/mr-brief/brief.md
   ```
8. **Reading guide, delegated.** Spawn the plugin's `reading-guide` agent (a smaller model than
   yours, so you do not spend your own budget opening every file — not the smallest: a test
   run on haiku misread the files). Give it the scripts directory (`${CLAUDE_PLUGIN_ROOT}/scripts`, resolved), the MR
   number if there is one, the head sha, the target, the lead sentence, the three key changes
   and the core files from `focus.mjs`. It writes `tmp/mr-brief/reading-guide.md`: per file,
   the link, *what changed · what to check*, and the decisive hunk cut by `excerpt.mjs`.
   **Read what it wrote** — you own the brief — fix a line that restates the hunk or misses
   the trap, then paste it under `<details>`:
   ```markdown
   ---

   <details>
   <summary><strong>Reading guide</strong> — 8 files with their decisive hunks · what to skip</summary>

   **Reading guide**

   **[worker.rb:22](link)** — posts the usage after five guards · the reply is never read, so a 422 is a silent loss
   `app/workers/worker.rb:15–24` @ 1bbdfe2
   ```diff
   +    return unless product_code.present?
   ```

   Skip: 7 spec files (they all stub `.create`), 2 admin views, `schema.rb`.
   Moved, not changed: `a.rb → b.rb`.

   </details>
   ```
   Ten diff lines per file at most; plumbing files get the one line and no hunk; pure
   renames are one line, never an entry. No subagents in this runtime → do it yourself the
   same way, with the same scripts.
9. **Check the claims with a second reader.** The writer is the worst judge of its own
   claims: one real run asserted library behaviour the library's source contradicts. Build
   the packet, then spawn the plugin's `claim-checker` agent on it — it has none of your
   context, reads the code and library sources itself, and returns a verdict per claim:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/claims.mjs" tmp/mr-brief/brief.md --sha <head> --target <target>
   ```
   - **supported** → keep it; if the checker cites a better line, consider it for an anchor.
   - **contradicted** → rewrite the claim to what the code does, or drop it. Never argue it back.
   - **unsupported** → add the anchor that settles it and re-check, or soften it to what you
     can show, or drop it.
   - **why** it marks *missing* for a key change → the text after the dash restates how, not
     why. Rewrite it as the answer to "why so?" — who it protects, what would go wrong
     otherwise. If it marks key change 1 as *not the change itself*, reorder or rewrite.
   - **jargon** it lists for a claim → say in the same sentence what the term means in
     everyday words, or replace it. The checker reads as a developer from the next team.
   - **check_at / question** it gives for a key change → when it differs from your place to
     look for that claim, take the checker's line and question unless yours is sharper; re-run
     `anchor.mjs` for the new line.
   - **omitted** — what the brief left out, found by asking who, twice, who sees, off and
     config of the diff. A **high** one goes into Risk, in one plain sentence on what can
     happen and to whom: it is exactly what a reviewer must not miss, and the reason this
     check exists. If there are more than two, Risk names the worst two and the reading guide
     lists the rest under **Open questions**, each with its line. A **medium** one goes to
     Open questions. Never drop one because it makes the MR look worse — the author reads the
     brief before anyone else, and can fix it first.
   Then lint again, and tell the author in one line per changed claim what the checker found.
   No subagents in this runtime → read `claims.md` cold, as if someone else wrote the brief,
   and apply the same three verdicts.
10. **Preview it the way the MR will show it**, then show that:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs" tmp/mr-brief/brief.md
   ```
   The platform's own Markdown renderer draws the text (`glab api markdown` / `gh api
   /markdown`), the page draws any mermaid, and a toggle shows both themes. Nobody says yes
   to a description they have only seen as raw Markdown in a chat.
11. **Attach** — only on a second yes — with the script, never by hand. It stamps the
   commit the brief describes onto line one (`<!-- mr-brief v1 head=<sha> -->`), refuses a
   brief that fails lint, writes the description and nothing else, and records the MR so the
   post-push hook can tell when the brief has been pushed past:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/attach.mjs" tmp/mr-brief/brief.md --mr <iid> --sha <head>
   ```
   No MR yet: create it first with the brief as its description (`glab mr create
   --description-file …` / `gh pr create --body-file …`), then re-run the anchors with `--mr`
   so the links land in its diff, and attach.

**After a push.** When the plugin's hook says the branch moved past the commit the brief
describes, ask the author the one line it gives you. On yes, re-run the brief — the existing
one is input — and attach with a second yes. GitLab links stay pinned to the version they
were written for, so an old brief never sends a reader to the wrong line; it can still claim
something the new commits changed.

## Words

Write it the way you would say it to a colleague at their desk.

- **Every claim answers "why so?"** The reader is a person who wants to understand, not a
  parser checking facts. A sentence that says what happens and not why it matters leaves
  them guessing — and guessing is how a reviewer stops reading.
- **One idea per sentence.** No semicolon stacking a second thought onto a first, no
  clause starting with "which".
- **The everyday word wins**: *dead* over *deactivated*, *stolen* over *captured*,
  *asks for* over *declares*.
- **No term without its meaning.** A spec term (`qesApproval`, `transaction_data`, `DPoP`),
  an acronym or a class name appears only in a sentence that also says what it is in
  everyday words — *the wallet's signed "yes" (`qesApproval`)* — or not at all. That the
  change is about the term is no excuse: that is exactly when the reviewer needs to know
  what it means. The test: a developer from the next team, who has never read this spec,
  understands the lead, the why and every bold claim.
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

- **What changes** — what a person or a service can now do, or what now happens to
  them. Not the state of the code. Subject first, active verb.
  Bad: `This MR introduces a new worker and refactors the subscription model.`
  Bad: `A presentation whose qesApproval misses the dispatched bytes fails.` (true, and
  unreadable to anyone who has not read the spec)
  Good: `A service can now ask a user to sign documents from their phone wallet, and gets a
  token only for the documents the user saw and approved.`
- **Why** — the reason this MR exists, before anything about how. For a feature, the
  scenario: who needs what. For a fix, what broke and who noticed. It is the line a
  reviewer uses to judge every decision below: *does this serve that?*
  Bad: `**Why:** CS-03 §7.3 compliance.`
  Good: `**Why:** a signature must be for the document the user saw. Until now nothing
  checked that the wallet's approval was for the documents we sent.`
- **Architecture** — what now talks to what that did not before, in one line:
  `billing gains a nightly sweep worker and now asks the provider whether a subscription is still live.`
  Key changes say what was decided; the flow says what happens; this says what now
  exists that did not. Absent when the shape did not change — say so only in a series.
- **Key changes** — the reader of every bullet asks one question: **why so?** The text
  after the dash is the answer, in terms of a person or a consequence — who is protected,
  what would go wrong otherwise, what someone can now do. Not the mechanism said again.
  If, after reading your answer, they would still ask "why?", go one level deeper.
  **The first bullet is the change itself** — for a feature, what it makes possible and how
  it works at the step that matters; for a fix, what was broken and what now holds. Then
  the two decisions most worth arguing about. Read only the bold, top to bottom: it should
  tell the story the lead started.
  Bad: `**Signing codes bypass the account login path** — a separate code type with no
  account behind it, so PKCE is always required` (a detail of step 8 of the flow, first;
  the feature is nowhere; "why bypass?" is never answered)
  Good: `**The Signer approves in their wallet, and we check the "yes" is for exactly these
  documents** — otherwise a "yes" to one contract could be used to sign another`
  Bad: `Added PollSubscriptionsWorker`. Good: `**The sweep is fail-soft per row** — one
  unreachable provider no longer stops everyone else's add-ons from being cancelled`.
  Each must still be a decision someone could disagree with, the first included: *we
  check it ourselves* is a decision too.
  **Each reason must be checkable in thirty seconds at one of the three places to look.**
  A claim the reviewer cannot verify from the links you gave them is a "trust me", and a
  brief has no room for those. If a claim needs a fourth place, the claim or the place is
  wrong.
- **Where to look** — where each key change can be **proven wrong**, not where the code
  starts. For each key change, the one line *this MR changed* where its decision is made —
  the comparison, the guard, the write, the missing lock — not the caller, not a comment,
  not a line of context. Then the entry is the **question the reviewer answers there**,
  and its tag says which claim it checks:
  Bad: `[wallet_answer.rb:207] — where a verified answer becomes an approval`
  (names a place; the reviewer still does not know what to look for)
  Good: `[wallet_answer.rb:207] — is the wallet's "yes" compared with exactly the
  bytes we sent, and does an answer with no "yes" fail too? · key change 1`
  Ask what would make the claim false — the edge case, the concurrent call, the missing
  branch. A question whose answer is visibly "yes" in the hunk is a wasted place. Order the
  three in reading order. One link per entry.
  **Above them, the `**Start →**` line** — where the scenario this MR adds is entered: the
  new route, the branch in an existing endpoint that now leads somewhere new, the job's
  `perform`, the webhook handler. Not the first check, not the most interesting line: the
  door. One line, one link, no checkbox, and what to follow down from it. Find it by walking
  *up* from the key changes until the caller is code this MR did not write. `~N min` and one
  `skip:` clause in the heading: naming what *not* to read removes more work on a 70-file
  MR than any bullet adds. `anchor.mjs` says when a line is context the MR did not change —
  then the decision is somewhere else.
- **Risk** — worst *realistic* outcome; loud or silent; then revert-and-done or what more.
  Not the risk you already knew while writing: the worst one in the diff, which is often the
  one the checker found. *Anyone who scans the QR can sign, and the service is never told
  who it expected* beats *the provisioner is still a stub*. Say who it happens to.
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
- [ ] Every anchor came from `anchor.mjs` with `--mr` when the MR exists, and the printed line is the line you meant
- [ ] Every key change can be checked at one of the three anchors in thirty seconds
- [ ] The `**Start →**` line is the door into the scenario — a new route, a new branch in an entry point, a job's `perform` — not the first check
- [ ] Each place to look is a question, on a line this MR changed, tagged with the key change it checks — the three tags cover all three
- [ ] Each picture passes its gate, is drawn at the level of the headline change, and was drawn by this run — not carried over
- [ ] No mermaid was typed: any block came out of `compile.mjs`, sits under `<details>`, and only because there is no SVG
- [ ] Every arrow in it exists in the code
- [ ] The lead says who can now do what, and `**Why:**` says what could not be done before — both readable without the spec
- [ ] The first key change is the change itself, and the bold of the three reads as the story of the MR
- [ ] After each dash there is an answer to "why so?" in terms of a person or a consequence — not the mechanism again
- [ ] Every **high** finding the checker marked *omitted* is in Risk, the rest are under Open questions
- [ ] Every key change and risk came back **supported** from the claim-checker, or was rewritten until it did, and no term it flagged is left unexplained
- [ ] It was attached with `attach.mjs`, so line one names the commit it describes
- [ ] Nothing was attached without a second yes, and nothing was posted as a comment or thread; the reading guide covers each core file once, hunks cut by `excerpt.mjs`, none for a rename
