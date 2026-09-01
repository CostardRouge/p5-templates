# Deployment

Read before touching the Dockerfile, `docker-compose.yml`, the deploy workflow or anything about how this reaches production.

## It self-hosts on a NAS, event-driven

2026-08-20 — A push to `main` triggers `.github/workflows/docker-build.yml`, which builds and publishes `ghcr.io/costardrouge/p5-templates`, then POSTs to a Watchtower HTTP API on the maintainer's NAS, which re-pulls the image and recreates the container. This replaced "Watchtower polls Docker Hub every minute": GHCR avoids Docker Hub's pull rate limit, and the webhook removes the polling delay. Tags are `main` and `latest` (moving, what Watchtower re-pulls) plus `sha-<short>` (immutable, what you pin to for a rollback via `APP_IMAGE`). `DEPLOY_WEBHOOK_URL` / `DEPLOY_WEBHOOK_TOKEN` are optional secrets — unset, the image still publishes and only the redeploy step is skipped. Full runbook in `deploy/README.md`. **How to apply**: there is no PaaS and no staging environment. A merge to `main` is a production deploy, within seconds. Rolling back means pinning a `sha-` tag, not reverting and waiting for a rebuild.

2026-08-20 — Upstream note recorded in `deploy/README.md`: `containrrr/watchtower` was archived in December 2025, so the compose file uses the maintained `nickfedor/watchtower` fork. **How to apply**: do not "correct" the image name back to the better-known one.

## The image is built for Playwright, and trimmed hard

2026-08-20 — Both build stages start from `mcr.microsoft.com/playwright:v1.59.1-jammy` so headless Chromium and its system libraries are already present; the runtime stage adds `ffmpeg` and `curl` via apt. Next is configured `output: "standalone"`, so the runtime image ships only the modules the build actually traced (`.next/standalone` + `.next/static` + `public`) instead of the whole `node_modules`. The builder deletes the `prepare` script before installing (`npm pkg delete scripts.prepare`) so husky does not try to install hooks in the image, and a separate `prisma-deps` stage reads the pinned Prisma version out of the lockfile rather than hardcoding it. `prisma.config.ts` carries the datasource URL that both `migrate deploy` and the client need under Prisma 7. **How to apply**: when bumping `playwright` in `package.json`, bump the base image tag in the same commit — a mismatch between the npm client and the image's bundled browser is the failure you get. A new server-side runtime dependency that Next cannot trace must be added deliberately, or it will be missing from the standalone output.

## Local infra is the same four services

2026-08-20 — `docker-compose.yml` defines `app`, `redis`, `minio`, `postgres` with named volumes, on a `pipeline` network. The `Makefile` wraps the common combinations (`make help` lists them): `services-up` for infra only, `app-dev` for full-Docker development with hot reload, `app-prod` = rebuild + up, `clean` to stop and drop volumes. **How to apply**: `make clean` removes the volumes — it destroys the local database, presets and MinIO objects. It is the right tool for a corrupt local state and the wrong one for "restart the stack" (that is `make dc-stop` / `dc-up`).
