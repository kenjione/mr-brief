# Install

## Claude Code

```bash
claude plugin marketplace add kenjione/mr-brief
claude plugin install mr-brief@mr-brief
```

Then, on a branch that is ready for review:

```
/mr-brief
```

It reads the diff against the remote target branch and writes `tmp/mr-brief/brief.md` (or `.mr-brief.md` when `tmp/` is not ignored).

Left to itself, a hook offers the brief once per branch, at the moment a command opens
an MR, and stops at a no — see *Opt-in by design* in the README, including the one-line
edits for "never ask me" and "never ask, just write it". Requires `node` on the path,
which Claude Code already needs.

## Without the plugin system

Copy the skill into your Claude config:

```bash
git clone https://github.com/kenjione/mr-brief.git
cp -r mr-brief/skills/mr-brief ~/.claude/skills/mr-brief
```

## As a repository template (no agent needed)

The template works on its own — a reviewer-shaped form beats a blank box even when
nobody runs an agent.

```bash
# GitLab
mkdir -p .gitlab/merge_request_templates
curl -sL https://raw.githubusercontent.com/kenjione/mr-brief/main/templates/gitlab/Brief.md \
  -o .gitlab/merge_request_templates/Brief.md

# GitHub
curl -sL https://raw.githubusercontent.com/kenjione/mr-brief/main/templates/github/pull_request_template.md \
  -o .github/pull_request_template.md
```

GitLab picks the template up in the MR form's *Description* dropdown. To make it the
default for every MR: **Settings → Merge requests → Default description template**.

## Check a brief by hand

```bash
node scripts/lint.mjs tmp/mr-brief/brief.md
node scripts/anchor.mjs app/models/foo.rb:42       # verified permalink for one line
```
