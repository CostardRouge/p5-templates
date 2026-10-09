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

## Security bumps go through `npm update <pkg>`, not `npm audit fix`

2026-10-02 — `npm audit fix` resolves every advisory it can in one pass, and on this tree that drags the `prisma` CLI a minor ahead of `@prisma/client` (7.10 vs 7.9) as a side effect of fixing `@prisma/config`; the CLI generates the client into `src/generated/prisma`, so the two must move together. What is left after a targeted update — `deepmerge-ts` and `mysql2` under the Prisma CLI — is only fixable by downgrading Prisma to 6 (`--force`), and neither is reached at runtime (Postgres, not MySQL). **How to apply**: name the vulnerable packages, `npm update --ignore-scripts <pkg…>` (lockfile only — the ranges in `package.json` already admit the fix), then `npm audit --omit=dev` to confirm, and run check + build. Bump `prisma` and `@prisma/client` together, deliberately, never as a side effect.

## `@types/node` follows the Node the build runs on (2026-10-09)

CI and both Docker stages run Node 24 (the Playwright base image installs `node_24.x` from nodesource, in v1.59 and v1.62 alike), so `@types/node` is `^24`, not the newest major: `^26` typechecked Node-26-only APIs that crash in the container. **How to apply**: bump `@types/node` to the major of the Node in `ci.yml` and the Dockerfile, in the same commit as them, and regenerate the lockfile with npm 11 (`undici-types` moves with it). Node 26 becomes LTS on 2026-10-28; do not follow it before CI does.

## Tailwind is 3.4: variants on data attributes need brackets

2026-10-02 — Headless UI v2 marks state with bare data attributes (`data-focus`, `data-active`, `data-open`), and the short `data-focus:bg-hover` variant is Tailwind **4** syntax: 3.4 compiles it to nothing, silently, so a keyboard-focused menu item had no highlight (`ExportPanel`'s variant menu). **How to apply**: write `data-[focus]:…`; to check a class exists, grep the built CSS under `.next/static/chunks/*.css` after `npm run build` — a missing rule produces no error anywhere else.

## `.gitignore` traps worth knowing

2026-08-20 — `src/generated/prisma` is gitignored, so a fresh clone has no Prisma client until `npm install` runs `prisma generate` via `postinstall`. "Missing module `@/generated/prisma`" on a fresh checkout means that, not a lost file.

2026-08-20 — **`/public/assets/libraries` and `/public/assets/images/samples` are in `.gitignore` but their current contents are tracked anyway** — 21 and 13 files, added before the rules and kept because `.gitignore` does not apply to already-tracked paths. Sketches import straight out of the first one (`import Matter from "@/public/assets/libraries/matter.min.js"`, `scripts.load( "/assets/libraries/decomp.min.js" )`), so those vendored files are load-bearing. **How to apply**: a *new* file dropped into either directory is silently ignored — `git add` refuses it without `-f`, and the sketch that imports it works locally and breaks in CI and in the Docker image. If you vendor a library, force-add it and say so in the commit body. Never untrack what is there: the sketches that import it stop rendering.

## A JS helper's JSDoc is a type contract for the TS tests that call it

2026-09-21 — `npm run typecheck` and `next build` both type-check `__tests__/*.test.ts` against the JSDoc of the `.js` modules they import (`allowJs`), so `@param {number} cfg.width` on a destructured-with-defaults parameter makes the field **required** for every TypeScript caller — a test passing `{ width: 0.3 }` to a function whose signature also destructures `hold` fails typecheck, and the build fails with it, while jest (`diagnostics: false`) stays green. Same for a `{"a"|"b"}` union, which rejects a `string` drawn from an exported list. **How to apply**: a parameter that has a destructuring default is documented as optional, `@param {number} [cfg.width=0.3]`, and the object itself as `[cfg]` when the whole thing can be omitted (which also needs `= {}` on the destructuring); document an enum as `{string}` with the values in prose unless every caller really holds the literal type. Jest passing is not the signal here — run `npm run typecheck` before calling a helper-plus-test done.

2026-08-20 — `.env` and `.env.*` are ignored with a `!.env.example` negation. The negation is required: `setup.sh` copies that template on a fresh clone, and the previous blanket `.env*` made the template impossible to commit. The template must hold no secret value — see `security.md`.
