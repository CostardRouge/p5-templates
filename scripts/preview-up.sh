#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Spin up (or update) an ephemeral PR preview environment on the NAS.
#
# Provisions isolated state on the SHARED infrastructure, then launches a single
# app container wired into Traefik. Idempotent: safe to re-run on every push to
# a PR that carries the `preview` label.
#
# Required env (see .env.preview.example):
#   PR_NUMBER, PREVIEW_DOMAIN, SHARED_INFRA_NETWORK, TRAEFIK_NETWORK,
#   POSTGRES_USER, POSTGRES_PASSWORD, S3_ACCESS_KEY, S3_SECRET_KEY,
#   S3_PUBLIC_ENDPOINT
# Optional env:
#   POSTGRES_CONTAINER (default: postgres)  MINIO_CONTAINER (default: minio)
#   POSTGRES_HOST/REDIS_HOST/MINIO_HOST     PREVIEW_WORKER_CONCURRENCY
#   TRAEFIK_ENTRYPOINT  S3_REGION  NEXT_PUBLIC_GITHUB_REPO_URL
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.preview.yml"

: "${PR_NUMBER:?PR_NUMBER is required}"
: "${PREVIEW_DOMAIN:?PREVIEW_DOMAIN is required}"
: "${SHARED_INFRA_NETWORK:?SHARED_INFRA_NETWORK is required}"
: "${TRAEFIK_NETWORK:?TRAEFIK_NETWORK is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY is required}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY is required}"
: "${S3_PUBLIC_ENDPOINT:?S3_PUBLIC_ENDPOINT is required}"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
MINIO_CONTAINER="${MINIO_CONTAINER:-minio}"
DB_NAME="pr_${PR_NUMBER}"
BUCKET="pr-${PR_NUMBER}"
PROJECT="pr-${PR_NUMBER}"
PREVIEW_URL="https://pr-${PR_NUMBER}.${PREVIEW_DOMAIN}"

echo "▶ Provisioning preview for PR #${PR_NUMBER} → ${PREVIEW_URL}"

# ── 1. Postgres database (idempotent create) ──────────────────────────────────
echo "  • Ensuring database ${DB_NAME}"
if ! docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" \
    psql -U "${POSTGRES_USER}" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" \
    | grep -q 1; then
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" \
    createdb -U "${POSTGRES_USER}" "${DB_NAME}"
  echo "    created"
else
  echo "    already exists"
fi

# ── 2. MinIO bucket (idempotent create + public read) ─────────────────────────
echo "  • Ensuring bucket ${BUCKET}"
docker exec "${MINIO_CONTAINER}" sh -c "
  mc alias set local http://localhost:9000 '${S3_ACCESS_KEY}' '${S3_SECRET_KEY}' >/dev/null 2>&1 || true
  mc mb --ignore-existing local/${BUCKET} >/dev/null
  mc anonymous set download local/${BUCKET} >/dev/null 2>&1 || true
" && echo "    ready" || echo "    ⚠ bucket step skipped (check mc availability in ${MINIO_CONTAINER})"

# ── 3. Launch / update the app container ──────────────────────────────────────
echo "  • Building & starting app container"
export PR_NUMBER PREVIEW_DOMAIN SHARED_INFRA_NETWORK TRAEFIK_NETWORK \
       POSTGRES_USER POSTGRES_PASSWORD S3_ACCESS_KEY S3_SECRET_KEY S3_PUBLIC_ENDPOINT
DOCKER_BUILDKIT=1 docker compose -p "${PROJECT}" -f "${COMPOSE_FILE}" up -d --build

echo "✅ Preview up: ${PREVIEW_URL}"
# Emit the URL for the workflow to capture (GITHUB_OUTPUT) or for humans.
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "preview_url=${PREVIEW_URL}" >> "${GITHUB_OUTPUT}"
fi
