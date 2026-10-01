// Where this checkout lives: host, project path, https base, and which platform's API to
// call. Every script that talks to GitLab or GitHub reads it from here, so a remote is
// parsed one way only.

import { execFileSync } from "node:child_process";

export function parseRemote(url) {
  const m = String(url).trim().match(/^(?:git@([^:]+):|ssh:\/\/(?:[^@]+@)?([^/]+)\/|https?:\/\/(?:[^@]+@)?([^/]+)\/)(.+?)(?:\.git)?\/?$/);
  if (!m) throw new Error(`cannot parse remote url: ${url}`);
  const host = m[1] || m[2] || m[3], project = m[4];
  const github = /(^|\.)github\.com$/.test(host);
  return { host, project, github, base: `https://${host}/${project}`, enc: encodeURIComponent(project) };
}

export function remote(name = "origin", cwd = process.cwd()) {
  return parseRemote(execFileSync("git", ["remote", "get-url", name], { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString());
}

// `glab api` / `gh api`, parsed. Throws with the CLI's own message when it fails.
export function api(r, path, { method = "GET", input = null } = {}) {
  const cli = r.github ? "gh" : "glab";
  const args = ["api", ...(method !== "GET" ? ["-X", method] : []), ...(input ? ["-H", "Content-Type: application/json", "--input", "-"] : []), path];
  const out = execFileSync(cli, args, { input: input ? JSON.stringify(input) : undefined, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString();
  return out.trim() ? JSON.parse(out) : null;
}
