# mr-brief

When the user asks for a merge request or pull request description, or to open one,
follow `skills/mr-brief/SKILL.md` in this extension exactly. The scripts it names live in
`scripts/` and run with plain Node:

- `node scripts/anchor.mjs path:line` — a permalink that was checked against the commit
- `node scripts/lint.mjs brief.md` — the contract check, run before handing over
- `node scripts/siblings.mjs TICKET` — open GitLab MRs that share the ticket key

Gemini CLI has no pre-command hook, so the brief is written only when asked. Attaching
it to the MR still needs the user's explicit yes.
