# Tooling

Read before touching TypeScript, ESLint, the git hooks, the merge drivers or anything in `scripts/`.

## Two TypeScript compilers, and why moving to one breaks the repo

2026-08-20 — TypeScript 7 is the native (Go) port and its npm package no longer exports the classic JS compiler API — which ts-jest and typescript-eslint still require, and which they exclude by peer range. So the tree carries both: `typescript` 6.x (JS-based, full API) for ts-jest, typescript-eslint and `next build`, and `typescript7` (an alias of `typescript@7`) for `npm run typecheck`. **How to apply**: `npm run typecheck` is the authority on type errors — it covers everything in `tsconfig.json`, tests included, in about 8s where TS 6 takes ~33s, and the two agree on this codebase. Do not "simplify" by promoting `typescript` to 7: lint and test break immediately. Note also that `tsconfig.json` sets `types: ["node", "jest"]` explicitly, because TS 6+ stopped auto-including every `node_modules/@types` package — a missing global type is usually that, not a missing dependency.

## Formatting is enforced, not agreed

2026-08-20 — There is no Prettier: `@stylistic` rules inside `eslint.config.mjs` are the formatter, and `opencode.json` explicitly disables Prettier (along with uv and ruff) so an agent's editor integration cannot fight them. The style is unusual on purpose — spacing inside `( … )`, `[ … ]` and `{ … }`, double quotes, semicolons, and one item per line as soon as an array, object, call or import has more than one entry. `lint-staged` runs `eslint --fix` on every staged `js/jsx/ts/tsx/mjs/cjs` file at commit time. **How to apply**: do not hand-format to match; write it roughly and run `npm run lint:fix`. On a PR, commenting `/fix-lint` triggers `.github/workflows/lint-fix.yml`, which runs `lint:fix` and pushes the result back to the branch (collaborators only, never to a fork).

## Generated-file merge conflicts are resolved by git, not by hand

2026-08-20 — Two branches that each add a sketch will always conflict in the generated catalogue, and a textual 3-way merge of those files is meaningless. `.gitattributes` therefore sets `merge=union` on `sketchModuleRegistry.ts` and `sketchOptionsRegistry.ts` (append-style maps — git's built-in union keeps both sides, and GitHub honours it too) and `merge=sketch-metadata` on `metadata.json`, a custom driver in `scripts/git-merge-metadata.mjs` that unions the JSON array by sketch identity. A driver name is only a label until it is defined in git config, which is per-clone and not committable — so `scripts/setup-git-merge-drivers.mjs` wires it up from the `prepare` script on every `npm install`, and exits silently outside a work tree. **How to apply**: if a `metadata.json` conflict ever shows up as raw conflict markers, the driver is not configured — run `npm install` (or the script directly) rather than resolving it by hand.

## Hooks: what actually runs

2026-08-20 — `.husky/pre-commit` regenerates and stages the sketch catalogue when a sketch or template asset is in the commit, then runs `lint-staged`. `.husky/pre-push` is entirely commented out — it would run `npm run build` with `NEXT_BUILD_DIR=/tmp/p5-templates-build`, and `.github/workflows/lint-fix.yml` records the reason as "a known issue with NEXT_BUILD_DIR resolution". CI workflows set `HUSKY: 0` during `npm ci` so hooks do not run in Actions. **How to apply**: nothing validates a push locally today — run `npm run check` yourself, plus `npm run build` for sketch or route changes. Never `--no-verify`: the pre-commit hook is what keeps the generated catalogue from drifting, and skipping it produces a commit that fails `sketches.test.ts` in CI.

## `.gitignore` traps worth knowing

2026-08-20 — `src/generated/prisma` is gitignored, so a fresh clone has no Prisma client until `npm install` runs `prisma generate` via `postinstall`. "Missing module `@/generated/prisma`" on a fresh checkout means that, not a lost file.

2026-08-20 — **`/public/assets/libraries` and `/public/assets/images/samples` are in `.gitignore` but their current contents are tracked anyway** — 21 and 13 files, added before the rules and kept because `.gitignore` does not apply to already-tracked paths. Sketches import straight out of the first one (`import Matter from "@/public/assets/libraries/matter.min.js"`, `scripts.load( "/assets/libraries/decomp.min.js" )`), so those vendored files are load-bearing. **How to apply**: a *new* file dropped into either directory is silently ignored — `git add` refuses it without `-f`, and the sketch that imports it works locally and breaks in CI and in the Docker image. If you vendor a library, force-add it and say so in the commit body. Never untrack what is there: the sketches that import it stop rendering.

2026-08-20 — `.env` and `.env.*` are ignored with a `!.env.example` negation. The negation is required: `setup.sh` copies that template on a fresh clone, and the previous blanket `.env*` made the template impossible to commit. (The file itself is still missing — see the open item in `MEMORY.md`.)
