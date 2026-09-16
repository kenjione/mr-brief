#!/usr/bin/env node
// SessionStart hook. Once a day at most, asks GitHub for the published plugin.json and,
// if it carries a higher version than the one installed, tells the user once — via
// systemMessage, which Claude Code shows to the person, not to the model.
//
// Never blocks, never fails the session: 1.5 s timeout, any error exits 0 silently.
// Opt out with an empty file at $CLAUDE_CONFIG_DIR/.mr-brief-no-update-check.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cfg = process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || "", ".claude");
const OPT_OUT = join(cfg, ".mr-brief-no-update-check");
const CACHE = join(cfg, ".mr-brief-update.json");
const URL = process.env.MR_BRIEF_UPDATE_URL || "https://raw.githubusercontent.com/kenjione/mr-brief/main/.claude-plugin/plugin.json";
const DAY = 24 * 60 * 60 * 1000;

const cmp = (a, b) => {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
};

try {
  if (existsSync(OPT_OUT)) process.exit(0);
  const installed = JSON.parse(readFileSync(join(here, "..", ".claude-plugin", "plugin.json"), "utf8")).version;
  let cache = {};
  try { cache = JSON.parse(readFileSync(CACHE, "utf8")); } catch {}

  if (!cache.checkedAt || Date.now() - cache.checkedAt > DAY) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    try {
      const res = await fetch(URL, { signal: ctl.signal });
      if (res.ok) cache.latest = (await res.json()).version;
      cache.checkedAt = Date.now();
    } finally { clearTimeout(t); }
    writeFileSync(CACHE, JSON.stringify(cache));
  }

  if (cache.latest && cmp(cache.latest, installed) > 0 && cache.notified !== cache.latest) {
    cache.notified = cache.latest;
    writeFileSync(CACHE, JSON.stringify(cache));
    process.stdout.write(JSON.stringify({
      systemMessage: `mr-brief ${cache.latest} is out (you have ${installed}). Update: claude plugin update mr-brief@mr-brief`,
    }));
  }
} catch {}
process.exit(0);
