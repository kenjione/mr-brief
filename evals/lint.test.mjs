// node --test evals/lint.test.mjs — every fixture in evals/fixtures is linted; pass-* must pass,
// fail-* must fail and name the expected reasons.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lint = join(here, "..", "scripts", "lint.mjs");
const fixtures = join(here, "fixtures");

const EXPECT = {
  "fail-too-long.md": ["lines of text; the limit is 15", "banned opener", "4 key changes", "2 \"- [ ]\" entries", "not a permalink", "carries 2 links", "2 blockquotes", "needs a minutes estimate"],
  "fail-shape.md": ["mr-brief v1", "missing ### Key changes", "**Architecture:** is present but empty", "must begin with **Start →**", "<summary> must be on its own line"],
};

for (const f of readdirSync(fixtures).filter((n) => n.endsWith(".md"))) {
  test(f, () => {
    const r = spawnSync("node", [lint, join(fixtures, f)], { encoding: "utf8" });
    if (f.startsWith("pass-")) {
      assert.equal(r.status, 0, `expected pass, got:\n${r.stdout}`);
      assert.match(r.stdout, /^ok — \d+ lines of text/);
    } else {
      assert.equal(r.status, 1, `expected failure, got:\n${r.stdout}`);
      for (const needle of EXPECT[f] ?? []) assert.ok(r.stdout.includes(needle), `missing reason "${needle}" in:\n${r.stdout}`);
    }
  });
}
