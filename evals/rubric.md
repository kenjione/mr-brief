# Rubric

Score a brief 0–2 on each line. `lint.mjs` already checked the shape; this is about substance.

| # | Question | 0 | 1 | 2 |
|---|---|---|---|---|
| 1 | **Opening sentence** — does it say what is now true that was not, in the reader's words? | restates the ticket or the mechanics | behaviour, but jargon or two ideas | one behaviour, plain, could be read aloud |
| 2 | **Key changes are decisions** — could a reviewer disagree with each? | file lists or "added X" | one or two are decisions | all three are arguable choices, most contentious first |
| 3 | **Reasons are checkable** — can each be verified at one of the three anchors in 30 s? | trust-me claims | some checkable | every claim points at code the reader can open |
| 4 | **Where to look is the reading order** — caller before callee, entry point first? | random or callee-first | mostly right | starts at the entry point, ends at the proof |
| 5 | **Skip clause removes real work** — does it name the bulk a reviewer would otherwise open? | absent or vague | present | names the specific bulk (specs, generated, views) with a size |
| 6 | **Risk is realistic and says loud/silent** | boilerplate or missing | realistic, no failure mode | worst realistic case + how it surfaces + rollback |
| 7 | **Diagram earns its place** — gate honoured, at the right level, marks what is new? | decorative, or missing when wiring moved | right call, weak drawing | right call, right level, new marked, legible |
| 8 | **Nothing invented** — every claim exists in the diff? | a claim the diff does not support | hedged claims | all claims traceable |

16 is the ceiling. A brief under 11 is not ready; under 8, rewrite from the diff.
Record the score with the case in `results.md`, with the model, date, turns and cost from `run.mjs`.
