import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// This lightweight check complements Gitleaks; it never prints matching values.
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16})\b/,
  /\b(?:sk-proj-|sk-live-)[A-Za-z0-9_-]{20,}/
];
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const paths = git("ls-files", "--cached", "--others", "--exclude-standard").trim().split("\n");
// Build output is ignored by Git but still needs scrutiny before release.
function addBuildFiles(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) addBuildFiles(path);
    else if (entry.isFile()) paths.push(path);
  }
}
addBuildFiles("dist");
const failures = [];
for (const path of paths) {
  if (!existsSync(path)) continue;
  if (/^\.env(?:\.|$)/.test(path) && path !== ".env.example") failures.push(`Environment file: ${path}`);
  const data = readFileSync(path, "utf8");
  if (patterns.some((pattern) => pattern.test(data))) failures.push(`Potential credential: ${path}`);
}
// Scan every reachable commit snapshot, including files removed in later commits.
for (const commit of git("rev-list", "--all").trim().split("\n").filter(Boolean)) {
  for (const path of git("ls-tree", "-r", "--name-only", commit).trim().split("\n").filter(Boolean)) {
    const data = git("show", `${commit}:${path}`);
    if (patterns.some((pattern) => pattern.test(data))) failures.push(`Potential historical credential: ${commit.slice(0, 8)}:${path}`);
  }
}
if (failures.length) {
  console.error([...new Set(failures)].join("\n"));
  process.exitCode = 1;
} else console.log("No known credential patterns found in working files or reachable history. This is not a security guarantee.");
