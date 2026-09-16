# Results

Real runs of the skill, one line each. `run.mjs` prints the row; `judge.mjs` fills the score.
Repositories are private and not named here.

| date | run | turns | time | cost | lint | score /16 |
|---|---|---|---|---|---|---|
| 2026-09-15 | GitLab · Rails service · 20-file feature MR (v0.1.0) | 22 | 266s | $1.74 | ok, 11 lines | — |
| 2026-09-15 | same MR, after the contract change (v0.2.0) | 22 | 306s | $1.81 | ok, 13 lines | — |
| 2026-09-15 | GitHub · personal repo · docs-only branch (v0.2.1) | 20 | 315s | $2.57 | ok, 12 lines | — |
| 2026-09-16 | same GitLab MR, sections as headings (v0.3.1) | 14 | 286s | $1.78 | ok, 14 lines | — |
| 2026-09-16 | same MR, v0.3.2 rules, existing brief present | 8 | 168s | $0.85 | ok, 14 lines | — |
| 2026-09-16 | same MR, v0.3.2 rules, `fresh` | 10 | 216s | $1.41 | ok, 13 lines | — |

The GitHub run exercised the `github.com/…/blob/<sha>/…#L` permalink form and the
`.mr-brief.md` fallback when `tmp/` is not ignored; on a docs-only branch it correctly drew
no diagram and used `git merge-tree` to name the two files that would conflict with main.

The v0.3.1 run produced `###` headings, the `rect` band and the `box` on the new participant without being told to, and added a third finding to the details: a 422 from the remote is swallowed because the caller never checks `success?`.

Two lessons from the v0.3.2 pair. With a brief already on the MR, the skill re-emitted it
almost verbatim and verified it instead of re-deriving — hence the rule that an existing
brief is input, not output. Run `fresh`, it applied every new formatting rule (legend with a
fact, `(external)`, grouped glossary, fails-with table) and got the substance worse: it
dropped the verified nil-config defect and asserted that the ORM strips undeclared keys
before the request — false; the gem posts the raw hash (`request.rb:92–105`). Same diff,
same skill, different findings: a brief is one reading, and the author still reads it.

The GitLab runs each surfaced a real defect the description then had to carry — one a duplicate
charge on a repeated write, one a configuration key read from the wrong place. That is what
writing the risk line from the code, rather than from the commit messages, buys.
