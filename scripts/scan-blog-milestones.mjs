#!/usr/bin/env node
// Scans the new "code" commits merged to main since the last scan and feeds
// blog/INBOX.md with candidate milestones to triage into BACKLOG.md.
//
// Deterministic, no external dependency: runs in GitHub CI on every push to
// main (see .github/workflows/blog-scan.yml). Replaces the in-session monitor
// which was unreliable in the ephemeral Claude Code Web environment.
//
// Cursor: blog/.last-scan holds the SHA of the last scanned commit.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LAST_SCAN = join(ROOT, "blog", ".last-scan");
const INBOX = join(ROOT, "blog", "INBOX.md");

const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();

const HEAD = sh(`git rev-parse ${process.env.SCAN_HEAD || "HEAD"}`);

// Baseline: last scanned SHA, or HEAD's parent on the first run.
let base = existsSync(LAST_SCAN) ? readFileSync(LAST_SCAN, "utf8").trim() : "";
if (!base || !isCommit(base)) {
  base = sh("git rev-parse HEAD~1 2>/dev/null || git rev-parse HEAD");
}

function isCommit(ref) {
  try { sh(`git cat-file -e ${ref}^{commit} 2>/dev/null`); return true; }
  catch { return false; }
}

if (base === HEAD) {
  console.log("Nothing new (base === HEAD).");
  writeFileSync(LAST_SCAN, HEAD + "\n");
  process.exit(0);
}

// Non-merge commits between base and HEAD, newest first.
const raw = sh(`git log --no-merges --pretty=format:%H%x1f%s ${base}..${HEAD}`);
const lines = raw ? raw.split("\n") : [];
const ASSET_RE = /\.(webm|webp|png|jpe?g|gif|mp4|mov|ico|svg)$/i;
// Scanner machinery files: a commit touching ONLY these is not a milestone.
const INFRA = new Set([
  "scripts/scan-blog-milestones.mjs",
  ".github/workflows/blog-scan.yml",
]);
const isInfra = (f) => f.startsWith("blog/") || INFRA.has(f);
const buckets = { perf: [], refactor: [], feat: [], fix: [], other: [] };
let kept = 0;

for (const line of lines) {
  const [sha, subject] = line.split("\x1f");
  if (!sha || !subject) continue;

  // Files touched by this commit.
  let files = [];
  try {
    files = sh(`git diff-tree --no-commit-id --name-only -r ${sha}`)
      .split("\n").map((f) => f.trim()).filter(Boolean);
  } catch { /* ignore */ }

  // Skip commits that only touch the scanner machinery (auto-generated → no loop).
  if (files.length && files.every(isInfra)) continue;
  // Skip commits that only touch assets (previews / thumbnails / metadata).
  if (files.length && files.every((f) => ASSET_RE.test(f) || f.endsWith("metadata.json"))) continue;
  // Skip no-substance commits ("previews", "thumbnails"… subjects).
  if (/^\s*(new\s+)?(thumbnails?|previews?)\b/i.test(subject)) continue;
  if (/\b(preview|previews|thumbnail|thumbnails)\b/i.test(subject) && !/(feat|fix|perf|refactor)/i.test(subject)) continue;

  const entry = `- \`${sha.slice(0, 9)}\` ${subject}`;
  const m = subject.match(/^(perf|refactor|feat|fix)\b/i);
  const key = m ? m[1].toLowerCase() : "other";
  buckets[key].push(entry);
  kept++;
}

if (kept === 0) {
  console.log("No relevant code commits since the last scan.");
  writeFileSync(LAST_SCAN, HEAD + "\n");
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const titles = {
  perf: "⚡ perf", refactor: "🧩 refactor", feat: "✨ feat", fix: "🐛 fix", other: "📦 other",
};
let section = `## 🆕 Scan ${today} — \`${base.slice(0, 9)}\`…\`${HEAD.slice(0, 9)}\`\n\n`;
section += `_${kept} code commit(s) to triage into [\`BACKLOG.md\`](./BACKLOG.md)._\n\n`;
for (const k of ["perf", "refactor", "feat", "fix", "other"]) {
  if (!buckets[k].length) continue;
  section += `### ${titles[k]}\n${buckets[k].join("\n")}\n\n`;
}

const header = `# 📥 INBOX — raw milestones to triage\n\n` +
  `> Fed automatically by \`scripts/scan-blog-milestones.mjs\` (CI on push to \`main\`).\n` +
  `> Triage these entries into \`BACKLOG.md\`, then delete the section here.\n\n`;

let body = "";
if (existsSync(INBOX)) {
  const prev = readFileSync(INBOX, "utf8");
  body = prev.startsWith("# 📥") ? prev.slice(prev.indexOf("\n\n", prev.indexOf("\n\n") + 1) + 2) : prev;
}
writeFileSync(INBOX, header + section + body);
writeFileSync(LAST_SCAN, HEAD + "\n");
console.log(`INBOX updated: ${kept} commit(s) added (${base.slice(0, 9)}..${HEAD.slice(0, 9)}).`);
