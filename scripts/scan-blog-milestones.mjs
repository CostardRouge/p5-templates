#!/usr/bin/env node
// Scanne les nouveaux commits de "code" mergés sur main depuis le dernier scan
// et alimente blog/INBOX.md avec des milestones candidats à trier vers BACKLOG.md.
//
// Déterministe, sans dépendance externe : tourne dans la CI GitHub à chaque push
// sur main (voir .github/workflows/blog-scan.yml). Remplace le Monitor in-session
// qui n'était pas fiable dans l'environnement éphémère de Claude Code Web.
//
// Curseur : blog/.last-scan contient le SHA du dernier commit scanné.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LAST_SCAN = join(ROOT, "blog", ".last-scan");
const INBOX = join(ROOT, "blog", "INBOX.md");

const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();

const HEAD = sh(`git rev-parse ${process.env.SCAN_HEAD || "HEAD"}`);

// Baseline : dernier SHA scanné, ou le parent de HEAD au premier passage.
let base = existsSync(LAST_SCAN) ? readFileSync(LAST_SCAN, "utf8").trim() : "";
if (!base || !isCommit(base)) {
  base = sh("git rev-parse HEAD~1 2>/dev/null || git rev-parse HEAD");
}

function isCommit(ref) {
  try { sh(`git cat-file -e ${ref}^{commit} 2>/dev/null`); return true; }
  catch { return false; }
}

if (base === HEAD) {
  console.log("Rien de neuf (base === HEAD).");
  writeFileSync(LAST_SCAN, HEAD + "\n");
  process.exit(0);
}

// Commits non-merge entre base et HEAD, du plus récent au plus ancien.
const raw = sh(`git log --no-merges --pretty=format:%H%x1f%s ${base}..${HEAD}`);
const lines = raw ? raw.split("\n") : [];
const ASSET_RE = /\.(webm|webp|png|jpe?g|gif|mp4|mov|ico|svg)$/i;
// Fichiers de la machinerie du scanner : un commit qui ne touche QUE ça n'est pas un milestone.
const INFRA = new Set([
  "scripts/scan-blog-milestones.mjs",
  ".github/workflows/blog-scan.yml",
]);
const isInfra = (f) => f.startsWith("blog/") || INFRA.has(f);
const buckets = { perf: [], refactor: [], feat: [], fix: [], autres: [] };
let kept = 0;

for (const line of lines) {
  const [sha, subject] = line.split("\x1f");
  if (!sha || !subject) continue;

  // Fichiers touchés par ce commit.
  let files = [];
  try {
    files = sh(`git diff-tree --no-commit-id --name-only -r ${sha}`)
      .split("\n").map((f) => f.trim()).filter(Boolean);
  } catch { /* ignore */ }

  // Ignore les commits qui ne touchent QUE la machinerie du scanner (auto-générés → pas de boucle).
  if (files.length && files.every(isInfra)) continue;
  // Ignore les commits qui ne touchent QUE des assets (previews / thumbnails / metadata).
  if (files.length && files.every((f) => ASSET_RE.test(f) || f.endsWith("metadata.json"))) continue;
  // Ignore les commits sans matière (sujet « previews », « thumbnails »…).
  if (/^\s*(new\s+)?(thumbnails?|previews?)\b/i.test(subject)) continue;
  if (/\b(preview|previews|thumbnail|thumbnails)\b/i.test(subject) && !/(feat|fix|perf|refactor)/i.test(subject)) continue;

  const entry = `- \`${sha.slice(0, 9)}\` ${subject}`;
  const m = subject.match(/^(perf|refactor|feat|fix)\b/i);
  const key = m ? m[1].toLowerCase() : "autres";
  buckets[key].push(entry);
  kept++;
}

if (kept === 0) {
  console.log("Aucun commit de code pertinent depuis le dernier scan.");
  writeFileSync(LAST_SCAN, HEAD + "\n");
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const titles = {
  perf: "⚡ perf", refactor: "🧩 refactor", feat: "✨ feat", fix: "🐛 fix", autres: "📦 autres",
};
let section = `## 🆕 Scan ${today} — \`${base.slice(0, 9)}\`…\`${HEAD.slice(0, 9)}\`\n\n`;
section += `_${kept} commit(s) de code à trier vers [\`BACKLOG.md\`](./BACKLOG.md)._\n\n`;
for (const k of ["perf", "refactor", "feat", "fix", "autres"]) {
  if (!buckets[k].length) continue;
  section += `### ${titles[k]}\n${buckets[k].join("\n")}\n\n`;
}

const header = `# 📥 INBOX — milestones bruts à trier\n\n` +
  `> Alimenté automatiquement par \`scripts/scan-blog-milestones.mjs\` (CI sur push \`main\`).\n` +
  `> Trie ces entrées vers \`BACKLOG.md\` puis supprime la section ici.\n\n`;

let body = "";
if (existsSync(INBOX)) {
  const prev = readFileSync(INBOX, "utf8");
  body = prev.startsWith("# 📥") ? prev.slice(prev.indexOf("\n\n", prev.indexOf("\n\n") + 1) + 2) : prev;
}
writeFileSync(INBOX, header + section + body);
writeFileSync(LAST_SCAN, HEAD + "\n");
console.log(`INBOX mis à jour : ${kept} commit(s) ajoutés (${base.slice(0, 9)}..${HEAD.slice(0, 9)}).`);
