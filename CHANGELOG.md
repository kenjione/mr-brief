# Changelog

## 0.6.0
- The reading guide under `<details>`: for each core file, what changed · what to check, and its decisive hunk as a `diff` block cut by `excerpt.mjs` — ten lines at most. Then skip and moved-not-changed. The diff made edible without leaving the description.

## 0.5.0
- `preview.mjs`: the brief rendered by the platform's own Markdown API with the mermaid drawn, light and dark — shown before the second yes.
- `focus.mjs`: the diff sorted into core / tests / views / config / generated, renames named; the `skip:` clause and *Moved, not changed* come from it.

## 0.4.0
- A SessionStart hook checks once a day whether a newer version is published and says so once. Opt out with `~/.claude/.mr-brief-no-update-check`.
- The offer line mentions a pending update too, from the cache.

## 0.3.2
- Architecture pictures mark what is not ours, label calls with the real method, and draw callbacks as labelled returns.
- Ordered checks where the first match wins become a numbered ladder, not diamonds.
- The legend under a picture ends with the one fact the picture cannot say by itself.
- `<details>` may carry a glossary grouped by role and a fails-with table.
- An existing brief on the MR is input, not output: re-derive, re-verify its risk, keep what holds.
- A claim about a library's behaviour is read in its source, never remembered.

## 0.3.1
- Key changes, Where to look and Risk are `###` headings, so the four blocks read as blocks.

## 0.3.0
- Evals: lint fixtures, a real-run harness, a rubric and a judge.
- Drop-in CI jobs that lint a description and comment without blocking.
- `~/.claude/.mr-brief-always` skips the question; attaching still asks.
- Packaged for Cursor, Codex, Gemini CLI, OpenCode and Kimi.

## 0.2.x
- The Architecture line and one sequence across services, shared by every MR of a set, with what is new banded in yellow.
- Verified permalinks (`anchor.mjs`), the contract linter (`lint.mjs`), sibling MRs from the remote (`siblings.mjs`).
- The hook that offers the brief once per branch on the command that opens the MR.

## 0.1.0
- The contract: 15 lines, three key changes, three places to look, one risk, a diagram only when the wiring moved.
