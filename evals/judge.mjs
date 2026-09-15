#!/usr/bin/env node
// Score a brief against evals/rubric.md with a fresh model, given the diff stat it was
// written from. Prints the eight scores and the total. Costs a small number of tokens.
//
//   node evals/judge.mjs path/to/brief.md path/to/diff.stat
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [brief, stat] = process.argv.slice(2);
if (!brief) { console.error("usage: judge.mjs <brief.md> [diff.stat]"); process.exit(64); }
const here = dirname(fileURLToPath(import.meta.url));
const rubric = readFileSync(join(here, "rubric.md"), "utf8");
const prompt = `You are scoring a merge request description against a rubric. Be strict; 2 is rare.
Return ONLY a JSON object: {"scores":[8 integers 0-2 in rubric order],"total":int,"worst":"one sentence naming the weakest line and why"}.

RUBRIC:
${rubric}

DIFF STAT (what the brief was written from):
${stat ? readFileSync(stat, "utf8") : "(not provided)"}

BRIEF:
${readFileSync(brief, "utf8")}`;
const r = spawnSync("claude", ["-p", prompt, "--output-format", "text"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const m = (r.stdout || "").match(/\{[\s\S]*\}/);
if (!m) { console.error("judge returned no JSON:\n" + r.stdout); process.exit(1); }
const j = JSON.parse(m[0]);
console.log(JSON.stringify(j, null, 2));
