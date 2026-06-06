# Ephemeral Preview Environments

Two complementary ways to look at a PR without pulling it locally.

| | **Vercel** (auto, every PR) | **NAS** (on-demand, `preview` label) |
|---|---|---|
| Trigger | Push to any PR | Add the `preview` label to the PR |
| Fidelity | Front-end only — sketches & UI | **Full**: backend recording, BullMQ queue, live thumbnails, S3 |
| Backend deps | Disabled (flags off) | Real Postgres / Redis / MinIO (shared) |
| URL | Vercel comments it automatically | `https://pr-<n>.<PREVIEW_DOMAIN>` |
| Cost | Free (Hobby, non-commercial) | Free (your hardware) |
| Use it to… | Quickly eyeball the look & feel | Test the real pipeline end-to-end |

> Why not Vercel for the full app? It's serverless: no long-running BullMQ
> workers, 60 s function cap, and Playwright + Chromium + ffmpeg blow the
> bundle-size limit. The recording pipeline fundamentally can't run there — so
> Vercel is intentionally the *degraded, fast* preview, and the NAS is the
> *full-fidelity* one.

---

## 1. Vercel — fast front-only preview

### How it works
- `vercel.json` forces the backend feature flags **off** at build
  (`BACKEND_RECORDING/NOTIFICATIONS/LIVE_THUMBNAIL=false`). The UI already hides
  recording/queue/notification features when these are off, so the preview
  degrades cleanly to "browse the sketches".
- `next.config.ts` → `outputFileTracingExcludes` keeps `playwright` out of the
  serverless function bundles so deploys don't exceed Vercel's size limit. (This
  is a **no-op for the NAS**, which runs `next start` with full `node_modules`.)

### One-time setup
1. Create a Vercel project linked to this GitHub repo (Framework: **Next.js**).
   Vercel then auto-creates a Preview Deployment + PR comment for every push.
2. In **Project → Settings → Environment Variables**, add for the **Preview**
   environment:
   - `DATABASE_URL` — any syntactically valid Postgres URL (e.g. a free Neon
     instance, or a dummy `postgresql://u:p@localhost:5432/db`). Prisma needs it
     present to instantiate; front pages never query it.
   - Optionally `NEXT_PUBLIC_GITHUB_REPO_URL`.
3. Done. The flags in `vercel.json` handle the rest.

> First deploy may need a small iteration if a route statically reads a missing
> env at build — the fix is always "provide a dummy value" or guard that read.
> Recording/queue API routes will return errors on Vercel by design; the UI
> doesn't surface them.

---

## 2. NAS — full-fidelity, on-demand

### Architecture
One **shared** infrastructure (the existing `docker-compose.yml`: Postgres,
Redis, MinIO) + **one app container per PR**. Each preview is isolated by:

| Resource | Per-PR value | Created/removed by |
|---|---|---|
| Postgres database | `pr_<n>` | `preview-up.sh` / `preview-down.sh` |
| MinIO bucket | `pr-<n>` | `preview-up.sh` / `preview-down.sh` |
| BullMQ key prefix | `pr-<n>` (`BULLMQ_PREFIX`) | the app, on a shared Redis |
| Traefik route | `pr-<n>.<PREVIEW_DOMAIN>` | container labels |

Migrations run automatically on container start (`docker-entrypoint.sh` →
`prisma migrate deploy`) against the fresh `pr_<n>` database.

### Flow
```
add `preview` label ─▶ preview-deploy.yml (self-hosted NAS runner)
                         └─ preview-up.sh: create db + bucket, compose up --build,
                            comment the URL on the PR
push more commits     ─▶ redeploys (same env, label still present)
remove label / close  ─▶ preview-teardown.yml → preview-down.sh: down + drop db + rm bucket
```

### One-time setup on the NAS

**a) Self-hosted GitHub Actions runner**
Install a runner on the NAS with labels `self-hosted` **and** `nas`, with access
to the Docker socket. It builds with the local layer cache, so redeploys are
fast (no registry round-trip).

**b) Networks**
- The shared infra network already exists from the main stack — find its name:
  `docker network ls` (typically `p5-templates_pipeline`). → `SHARED_INFRA_NETWORK`.
- Your Traefik network (e.g. `traefik`). → `TRAEFIK_NETWORK`.
  The preview container attaches to both.

**c) Cloudflare Tunnel + Traefik wildcard**
- Add a DNS/wildcard route `*.<PREVIEW_DOMAIN>` in your tunnel pointing at
  Traefik (same way your prod host is exposed).
- Traefik picks up the per-PR router from the container labels automatically
  (`Host(\`pr-<n>.<PREVIEW_DOMAIN>\`)`, `tls=true`).
- Optional but recommended: put **Cloudflare Access** in front of
  `*.<PREVIEW_DOMAIN>` so previews aren't publicly open.

**d) MinIO needs the `mc` client inside its container**
The scripts call `mc` via `docker exec <minio>`. The official `minio/minio`
image ships `mc`. If yours doesn't, install it or adapt `preview-up.sh`/`down.sh`
to use the AWS CLI.

### GitHub configuration

**Repository → Settings → Secrets and variables → Actions**

Variables (`vars.*`):

| Name | Example |
|---|---|
| `PREVIEW_DOMAIN` | `preview.example.com` |
| `SHARED_INFRA_NETWORK` | `p5-templates_pipeline` |
| `TRAEFIK_NETWORK` | `traefik` |
| `TRAEFIK_ENTRYPOINT` | `websecure` |
| `POSTGRES_HOST` / `REDIS_HOST` / `MINIO_HOST` | `postgres` / `redis` / `minio` |
| `POSTGRES_CONTAINER` / `MINIO_CONTAINER` / `REDIS_CONTAINER` | `postgres` / `minio` / `redis` |
| `POSTGRES_USER` | `social-pipeline-user` |
| `S3_PUBLIC_ENDPOINT` | `https://s3.preview.example.com` |
| `S3_REGION` | `us-east-1` |
| `PREVIEW_WORKER_CONCURRENCY` | `1` |
| `NEXT_PUBLIC_GITHUB_REPO_URL` | _(optional)_ |

Secrets (`secrets.*`):

| Name |
|---|
| `PREVIEW_POSTGRES_PASSWORD` |
| `PREVIEW_S3_ACCESS_KEY` |
| `PREVIEW_S3_SECRET_KEY` |

### Day-to-day use
1. Open a PR.
2. Add the **`preview`** label → wait for the workflow → click the URL in the
   bot comment.
3. Push more commits → the preview updates in place.
4. Remove the label (or close the PR) → everything is cleaned up.

### Manual run (debugging on the NAS)
```bash
cp .env.preview.example .env.preview     # fill in values
set -a; . .env.preview; set +a
PR_NUMBER=123 bash scripts/preview-up.sh
PR_NUMBER=123 bash scripts/preview-down.sh
```

### Troubleshooting
- **404 from Traefik** → wildcard route not reaching Traefik, or the container
  isn't on `TRAEFIK_NETWORK`. Check `docker inspect p5-preview-pr-<n>`.
- **App crashes on boot** → usually `DATABASE_URL`; confirm `pr_<n>` exists and
  the password/secret is right. Logs: `docker logs p5-preview-pr-<n>`.
- **Assets 403/404** → bucket `pr-<n>` missing or not public; re-run
  `preview-up.sh`, check `S3_PUBLIC_ENDPOINT`.
- **Stale jobs across PRs** → each PR uses `BULLMQ_PREFIX=pr-<n>`, so queues are
  isolated; teardown flushes the keys.
- **NAS under load** → lower `PREVIEW_WORKER_CONCURRENCY`, or keep only a couple
  of previews labelled at once.
