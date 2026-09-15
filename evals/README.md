# Evals

Three layers, cheapest first.

1. **Shape** — `node --test evals/lint.test.mjs` lints every fixture in `fixtures/`. `pass-*` must pass,
   `fail-*` must fail with the named reasons. Free, runs in CI.
2. **A real run** — `node evals/run.mjs <repo> <ref>` opens a temporary worktree, runs
   `/mr-brief` in a fresh Claude Code session, lints the result and prints a row for
   `results.md`. Costs about two dollars a run.
3. **Substance** — `node evals/judge.mjs brief.md diff.stat` scores the brief against
   `rubric.md` with a fresh model. Not a replacement for reading it yourself.

Add a fixture whenever the linter learns a rule. Add a results row whenever the contract
changes.
