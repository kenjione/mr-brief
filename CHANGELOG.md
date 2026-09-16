# Changelog

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
