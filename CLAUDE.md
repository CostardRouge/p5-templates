# Instructions for LLM agents (Claude Code, Codex, Cursor, etc.)

Agents read this file at the start of every session. These rules override the agent's default behaviour and apply for the whole session, not only the first turn.

## Context

- **Sketchbook** — a Next.js 16 (App Router, Turbopack) / React 19 / TypeScript-strict app for building, parameterizing and exporting visuals from creative-coding sketches. Rendering is engine-agnostic: p5.js, GSAP and Three.js sketches all drive the same `SketchEngine` contract (`src/engines/types.ts`). Prisma 7 + PostgreSQL for persistence, BullMQ + Redis for the recording queue, MinIO/S3 for artefacts, Playwright + FFmpeg for headless capture. Package manager: **npm** — the lockfile is `package-lock.json` (it is the only lockfile; keep it that way).
- Deploys as a Docker image: a push to `main` builds and publishes `ghcr.io/costardrouge/p5-templates`, and a Watchtower HTTP-API call re-pulls it on the maintainer's NAS (`deploy/README.md`, `.github/workflows/docker-build.yml`).
- Commands: `npm run dev` (dev server) · `npm run watch` (dev server + sketch-metadata watcher) · `npm run build` · `npm test` · `npm run lint` / `lint:fix` · `npm run typecheck` · **`npm run check`** = lint + typecheck + test. CI runs lint, typecheck, test and build as four parallel jobs on Node 24.
- Several agent sessions may run **in parallel** on this repo. Git history must stay readable: **one commit = one task**.
- **Local sessions: never `git push`** — the developer tests locally and pushes himself. **Cloud / web sessions (ephemeral container): push the working branch and open a pull request**, it is the only way the code gets out. Never push to `main` either way.

## Rule 1 — Automatic commit at the end of every task (MANDATORY)

As soon as a task requested by the user is finished (feature, fix, refactor, content…), the agent MUST create a commit before handing back. No need to ask permission: it is the expected behaviour.

### Exact procedure

1. **Check the state**: `git status --porcelain` and `git diff --stat`.
2. **Select only the task's files**:
   - Stage file by file with `git add <path>` (never `git add -A`, `git add .` or `git commit -a`).
   - A modified file unrelated to the task (parallel session, tooling noise) stays **unstaged**. Do not touch it, stash it or reset it.
   - If one file holds changes from this task AND another, prefer `git add -p <file>` to stage only the relevant hunks. If inextricable, stage the whole file and say so in the commit body ("also contains …").
   - Never stage: `.env` and any secret file, `.idea/`, `.vscode/`, `.next/` (including `.next/cache/eslint`), `/tmp/p5-templates-build`, `node_modules/`, `.DS_Store`, `src/generated/prisma/` — unless the task is explicitly about them. If one of these turns out to be *tracked*, say so: it must be untracked and gitignored, not carefully avoided at every commit.
   - Exception, and it is not optional: the **pre-commit hook regenerates and stages** `src/sketches/metadata.json`, `src/generated/sketchModuleRegistry.ts` and `src/generated/sketchOptionsRegistry.ts` whenever a sketch or template asset is part of the commit. Those three belong in your commit — do not unstage them.
   - Check with `git diff --cached --stat` before committing.
3. **Commit with a readable message** (format below). Always use a HEREDOC to keep title + body:

   ```bash
   git commit -m "$(cat <<'EOF'
   Imperative title, ≤ 72 characters, no trailing period

   Why this change, what it does concretely, non-obvious decisions.
   One line per idea. Mention the files/areas touched if useful.

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

4. Do not push (local sessions). End the reply with a recap: short hash + commit title + the list of files that were modified but deliberately left uncommitted, if any, so the user knows where every change comes from.
5. If a git hook changes or refuses something: read the output, fix, recommit. Never `--no-verify`.

### Commit message format

- Title: English imperative, clear sentence, ≤ 72 chars, no `feat:`-style prefix, no trailing period. Real examples from this repo: `Add sketch-specific SEO metadata to shared /embed links`, `Fix engine double-mount race exposed by Next 16.3 dev mode`, `Include export dimensions in downloaded filenames`. A handful of older commits use `fix(scope):` prefixes; prose imperative is the dominant style and the one to follow.
- Blank line, then a body, mandatory whenever the title is not enough: the why, the how in 2–6 lines, the trade-offs, what remains to do. The body is what lets someone find, weeks later, which feature produced this diff.
- A commit never mixes two tasks. If a session handles several distinct tasks, make several successive commits.
- No empty commit, no "WIP" commit, no commit for an unfinished task. If the task is interrupted, leave the work uncommitted and say so.

### When is a task "finished"?

- The requested code is written and verified: `npm run check` green, plus `npm run build` for anything touching a sketch or a route (the build compiles every sketch route and is what catches broken imports). For rendering changes, a visual check — the `verify` skill in `.claude/skills/verify/` drives the running app headlessly and captures canvas pixels.
- A plain question, an exploration or an explanation produces no commit (nothing to commit).

## Rule 2 — Project memory in `MEMORY.md` + `docs/memory/` (MANDATORY)

The repo carries its own long-term memory, read locally and in the cloud alike:

- `MEMORY.md` at the root — the index, imported below and therefore loaded every session: how to maintain the memory, how the maintainer works, direction and decisions at a glance, open items, and a table of topic files.
- `docs/memory/<topic>.md` — one file per area, loaded on demand. Not imported here on purpose: the split keeps the per-session prompt small.

Obligations:

- Read `MEMORY.md`, then the topic file(s) for the area you are about to touch, before acting — to understand previous choices and not re-propose what was rejected. The table at the bottom of `MEMORY.md` maps areas to files.
- Every task writes to memory by default. At the end of each task (feature, fix, refactor, content, and any exploration that learned something), ask: "what should a future agent know that is neither in the code nor in `git log`?" — decisions and their reasons, rejected options, traps and remedies, working preferences. Write it in the matching topic file (update the existing entry first; delete what became false; add a short dated decision → why → how to apply entry otherwise), and update the index if a cross-cutting decision, an open item or a new topic file is involved. If, exceptionally, there is nothing worth keeping, say so explicitly in the final message ("no memory update: …") — silence is not an option.
- The memory update is part of the task: it is staged in the same commit (rule 1).
- Memory is written in English, dense and factual; no session narration, no duplication of what the code, `git log` or this file already say; each fact stated once, cross-referenced by file name elsewhere.
- The project command `/memorize` (`.claude/commands/memorize.md`) does this consolidation on demand over a whole conversation.

@MEMORY.md

## Rule 3 — Sync with `main` before working a branch (MANDATORY)

Every time you start OR resume work on an existing branch, bring `main` in
first, before writing any code. A branch that drifts becomes a pull request
nobody can merge, and conflicts found at the end — after the work is verified —
are the expensive kind.

1. `git fetch origin main`, then check: `git merge-base --is-ancestor origin/main HEAD`.
   If that passes, you are up to date; carry on.
2. Otherwise **merge** it: `git merge origin/main`. Merge, not rebase — the
   branch is usually already pushed with an open PR, and rebasing means a
   force-push that rewrites it (see the no-history-rewriting rule below). The
   repo does this too: `4f34e97 Merge remote-tracking branch 'origin/main'
   into claude/…`.
3. Resolve every conflict, then **re-verify** — a clean textual merge is not a
   correctness argument. Read the hunks in files BOTH sides touched: `main` may
   have moved the code your change hooks into. It has happened twice on this
   branch alone — the content-item dispatch moved out of a deleted
   `layouts/freeLayout.js` into `slides.render()`, and per-sketch image
   collection moved into a shared `collectSketchImagePaths`. In both cases the
   merge was clean and the feature would have silently stopped working.
4. Re-run `npm run check` and `npm run build` after the merge, and re-run
   whatever empirical check the feature has. `npm ci` if `package.json` moved —
   a new dependency on `main` fails the build with a module-not-found that
   looks like a merge error and is not.

`git merge-tree --write-tree --name-only HEAD origin/main` previews the
conflicts without touching the working tree, which is the cheap way to see what
you are in for before starting.

## Verification — trust the disk, not the context

- A tool answering "success" is not proof. Before saying a change is done, prove it through the repo: `git status --porcelain`, `git diff`, `grep` for the expected value, `git show HEAD:<file>` compared to the file on disk.
- What you hold in context (an earlier `Read`, an old `ls`, a summarised conversation) can be stale: it has produced sessions where `Edit` reported success while nothing changed on disk, and where an agent described a tree that had not existed for weeks. Signature: `git status` clean right after an announced change. Re-read from disk before concluding.
- Never state an absence ("this feature is missing", "that file does not exist") without a `git`/`grep` check made in the current turn.

## Other rules

- Never rewrite history (`rebase -i`, `commit --amend`, `reset --hard`, `push --force`, `filter-repo`) without an explicit request.
- Do not modify `.git/config`, the hooks or branch settings.
- **Sketches live in `src/sketches/<engine>/`** — `p5`, `gsap`, `threejs`, `html`. Not `src/templates/`, not `src/p5-sketches`: both names appear in older docs and in this file's own history, and neither has existed since the "Standardize on sketch" rename (4946ea6). Path aliases: `@/*` → `src/*`, `@/p5/*` → `src/sketches/p5/*`, same shape for `@/gsap/*`, `@/threejs/*`, `@/html/*`, `@/public/*` → `public/*`. Prefer them over deep relative imports. See `docs/memory/sketches.md` before adding or editing a sketch.
- **Never hand-edit generated files**: `src/sketches/metadata.json`, `src/generated/sketchModuleRegistry.ts`, `src/generated/sketchOptionsRegistry.ts` (regenerate with `npm run sketch:meta:write`) and `src/generated/prisma` (from `npx prisma generate`). `src/sketches/__tests__/sketches.test.ts` fails the build on drift.
- **Two TypeScript compilers are installed on purpose**: `typescript` 6.x (JS API, needed by ts-jest, typescript-eslint and `next build`) and `typescript7` (native, what `npm run typecheck` runs). Moving `typescript` to 7 breaks lint and test immediately — see `docs/memory/tooling.md`.
- **Style is machine-enforced** — `@stylistic` via ESLint, with spacing inside `( … )`, `[ … ]`, `{ … }`, double quotes, semicolons, one item per line in multi-item literals and calls. Do not hand-format: run `npm run lint:fix` and match the surrounding code.
- **`docs/` is historical** — dozens of point-in-time write-ups, many describing code that has since changed (the `function sketch( p, options, assets )` signature in `SKETCH_CREATION_GUIDE.md` is the classic trap). Verify against current source before relying on any snippet there. `docs/memory/` is the exception: it is maintained.
- Schema changes go through `prisma/schema.prisma` + `npx prisma migrate dev`; never edit generated migration SQL afterwards.

## Related files

- `AGENTS.md`: points to this file for tools that do not read `CLAUDE.md`.
- `MEMORY.md` + `docs/memory/`: project long-term memory (rule 2).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
