<!-- mr-brief v1 -->  <!-- TICKET · 2 of 3 · after repo_a!11, before repo_c!33 — delete unless this MR is one of a set -->

<!-- One sentence, max 140 chars: who can now do what, in words a developer from the next team understands. Not "This MR ...". -->

**Why:** <!-- 1–2 sentences: the need or the problem — what could not be done, or what went wrong, before. No spec terms without their meaning. -->

<!-- Architecture: ONE line, only if a component, a dependency between services or a table
     was added, removed or moved — then a picture of the components and their arrows.
     Delete both when the shape did not change. -->
**Architecture:**

<!-- Flow: a mermaid block goes HERE, above the bullets — but only if the diff moved a
     call between services, a state machine, a job, a webhook, or an order of operations
     that is the point. Otherwise delete this comment and draw nothing. -->

### Key changes
<!-- Exactly 3 bullets. Bold the claim, put the reason after the dash. Each one a
     decision someone could disagree with, most contentious first. -->
- **** —
- **** —
- **** —

### Where to look · ~N min · skip:
<!-- Three links, in reading order. Each is a QUESTION the reviewer answers at that line,
     on a line this MR changed, and ends with the key change it checks — one per key change.
     Permalink form: <mr-url-base>/-/blob/<head-sha>/<path>#L<line> -->
- [ ] **Start →** [file.rb:00](#) — <what to answer here>? · key change 1
- [ ] [file.rb:00](#) — <what to answer here>? · key change 2
- [ ] [spec.rb:00](#) — <what to answer here>? · key change 3

### Risk
> The worst realistic outcome — does it fail loudly or silently?
>
> Rollback: revert, or what else it takes.

---

<details>
<summary><strong>Reading guide</strong> — N files worth opening, with their hunks · what to skip · glossary</summary>

<!-- Everything true but not needed to start reviewing. Never the diagram. -->

</details>
