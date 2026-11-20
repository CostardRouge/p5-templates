# Deployment

Read before touching the Dockerfile, `docker-compose.yml`, the deploy workflow or anything about how this reaches production.

## It self-hosts on a NAS, event-driven

2026-08-20 — A push to `main` triggers `.github/workflows/docker-build.yml`, which builds and publishes `ghcr.io/costardrouge/p5-templates`, then POSTs to a Watchtower HTTP API on the maintainer's NAS, which re-pulls the image and recreates the container. This replaced "Watchtower polls Docker Hub every minute": GHCR avoids Docker Hub's pull rate limit, and the webhook removes the polling delay. Tags are `main` and `latest` (moving, what Watchtower re-pulls) plus `sha-<short>` (immutable, what you pin to for a rollback via `APP_IMAGE`). `DEPLOY_WEBHOOK_URL` / `DEPLOY_WEBHOOK_TOKEN` are optional secrets — unset, the image still publishes and only the redeploy step is skipped. Full runbook in `deploy/README.md`. **How to apply**: there is no PaaS and no staging environment. A merge to `main` is a production deploy, within seconds. Rolling back means pinning a `sha-` tag, not reverting and waiting for a rebuild.

2026-08-20 — Upstream note recorded in `deploy/README.md`: `containrrr/watchtower` was archived in December 2025, so the compose file uses the maintained `nickfedor/watchtower` fork. **How to apply**: do not "correct" the image name back to the better-known one.

## The image is built for Playwright, and trimmed hard

2026-08-20 (rev. 2026-10-21) — All three stages start from `mcr.microsoft.com/playwright:v<version>-jammy`, the image of the `playwright` version locked in `package-lock.json` (1.64.1 since 2026-10-21, raised by hand with its image after Dependabot's image-only #406 was closed; 1.62.0 from 2026-10-19, before which the image had sat at 1.59.1 beside a 1.62 client for weeks, the N1 drift of the portfolio audit), so headless Chromium and its system libraries are already present; the runtime stage adds `ffmpeg` and `curl` via apt. Next is configured `output: "standalone"`, so the runtime image ships only the modules the build actually traced (`.next/standalone` + `.next/static` + `public`) instead of the whole `node_modules`. The builder deletes the `prepare` script before installing (`npm pkg delete scripts.prepare`) so husky does not try to install hooks in the image, and a separate `prisma-deps` stage reads the pinned Prisma version out of the lockfile rather than hardcoding it. `prisma.config.ts` carries the datasource URL that both `migrate deploy` and the client need under Prisma 7. **How to apply**: `scripts/__tests__/dockerfile.test.ts` holds the three `FROM` tags to the locked `playwright` version, so a bump of either side alone fails `npm test` — Dependabot is told to ignore both sides (`tooling.md`, Dependabot), and the bump is made by hand, package and three tags in one commit; check that the tag exists before bumping (`curl -sS https://mcr.microsoft.com/v2/playwright/tags/list | tr , '\n' | grep <version>` — every version ships a `-jammy` and a `-noble` variant), because a mismatch between the npm client and the image's bundled browser is the failure you get otherwise. A new server-side runtime dependency that Next cannot trace must be added deliberately, or it will be missing from the standalone output.

## Local infra is the same four services

2026-08-20 — `docker-compose.yml` defines `app`, `redis`, `minio`, `postgres` with named volumes, on a `pipeline` network. The `Makefile` wraps the common combinations (`make help` lists them): `services-up` for infra only, `app-dev` for full-Docker development with hot reload, `app-prod` = rebuild + up, `clean` to stop and drop volumes. **How to apply**: `make clean` removes the volumes — it destroys the local database, presets and MinIO objects. It is the right tool for a corrupt local state and the wrong one for "restart the stack" (that is `make dc-stop` / `dc-up`).


## The NAS hardware (2026-10-10)

An Intel 2nd-generation i7 (Sandy Bridge, amd64), per the maintainer, who expects its integrated GPU to serve headless Chromium. Not yet verified in the container: Sandy Bridge HD graphics is old enough that Chrome may blocklist it or offer no WebGL2, in which case the backend renders on SwiftShader (`recording.md`'s numbers). **How to apply**: amd64 means Google Chrome (with H.264) can go in the image if the server-side front encoder is ever built; check GPU use with `chrome://gpu` from inside the container, and pass the render device through (`/dev/dri`) in `docker-compose.yml`, before quoting any GPU speed.

## Versions and releases ride the same deploy (2026-10-17)

**Decision**: Sketchbook carries one SemVer version in the root `package.json`
(1.0.0 « Lemniscate »), `CHANGELOG.md` as the source, and `.github/release.mjs`
+ `.github/workflows/release.yml` (identical across the portfolio, C13 in
`second-brain`) tag and publish each section on `main`. The Docker build and the
Watchtower call are unchanged: a release is a tag beside the image, not a gate
in front of it. **Why**: the owner made SemVer mandatory on every repo that
ships, and steevepommier.com will show each project's version and changelog.
**How to apply**: the home footer reads the version through `src/lib/version.ts`,
a named JSON import so the client bundle carries only the string. 0.1.0–0.10.0
are backfilled sections (`<!-- commit: sha -->`, first-parent commits of
`main`): GitHub refuses the workflow's own token a tag on a commit whose
workflows differ from `main`'s, so `release.yml` skips them with a warning and
`second-brain`'s "Backfill releases" workflow publishes them with the owner's
token. **Trap**: a tag or release made with `GITHUB_TOKEN` triggers no other
workflow, so a deploy that should follow a release must run inside
`release.yml`'s publish job.

## CI: one install, cached (2026-11-20)

**Decision.** `ci.yml` runs two jobs, `checks` (lint, typecheck, tests in one job) and `build`, instead of four. **Why**: measured on the last 100 runs, `npm ci` was 56% of the runner time (≈235 s of 420 s), paid four times for 10–42 s of real work per job. **How**: `node_modules` is cached on `.nvmrc` + `package-lock.json` (native modules are per ABI) and `npm ci` runs only on a miss; a hit runs `npx prisma generate`, since the client lands in `src/generated/prisma`, outside the cache, and `postinstall` does not run. ESLint's cache (`.next/cache/eslint`) and Next's compiler cache (`.next/cache`) are restored with prefix keys. Typecheck and tests run even when lint fails (`!cancelled()`), so one red run lists every failure. This is PR 1 of the front/back split (Cloudflare Workers Builds, Docker at release): the `build` job goes once Cloudflare's preview build replaces it.

## The image is built at release (2026-11-20)

**Decision.** `docker-build.yml` no longer runs on every push to `main`: it follows the Release workflow (`workflow_run`) and builds only when the commit's `package.json` version has its tag `v<version>` and GHCR has no image `:<version>` yet; "Run workflow" builds `main`'s head by hand. Tags: `main`, `latest` (moving, what the NAS re-pulls), `X.Y.Z`, `X.Y` (release builds only) and `sha-<short>`. **Why**: the public front is on Cloudflare (PR 3 of the split), so the 7–11 min image build on every merge served nobody between releases. **How to apply**: a fix the NAS needs now is either a PATCH release or a manual run. `workflow_run` and not `on: push: tags` because `release.yml` creates the tag with `GITHUB_TOKEN`, and that token's pushes start no workflow (the trap in "Versions and releases"). `workflow_run` uses the workflow file on the default branch: an edit to `docker-build.yml` takes effect once merged, not on its own PR. The first entry of this file ("event-driven") still describes the Watchtower half accurately.
