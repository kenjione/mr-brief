# For coding agents

The skill lives in `skills/mr-brief/SKILL.md`; `.cursor/skills/mr-brief/` is a synced copy
for Cursor. Any other agent that reads Markdown instructions can load the same file. The
scripts in `scripts/` are plain Node with no dependencies and work from any runtime:

- `scripts/anchor.mjs path:line` — verified permalink
- `scripts/lint.mjs brief.md` — contract check
- `scripts/siblings.mjs TICKET` — open MRs sharing the ticket (GitLab)

The hook in `hooks/` is Claude Code specific; elsewhere, invoke the skill explicitly.
