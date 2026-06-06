#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Tear down an ephemeral PR preview environment on the NAS.
#
# Removes the app container/image and all per-PR isolated state (database,
# bucket). Redis keys are namespaced by prefix and disappear with the queue;
# they are also flushed best-effort. Idempotent: safe if the env is already gone.
#
# Required env: PR_NUMBER, POSTGRES_USER, POSTGRES_PASSWORD
# Optional env: POSTGRES_CONTAINER, MINIO_CONTAINER, REDIS_CONTAINER,
#               S3_ACCESS_KEY, S3_SECRET_KEY
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.preview.yml"

: "${PR_NUMBER:?PR_NUMBER is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
MINIO_CONTAINER="${MINIO_CONTAINER:-minio}"
REDIS_CONTAINER="${REDIS_CONTAINER:-redis}"
DB_NAME="pr_${PR_NUMBER}"
BUCKET="pr-${PR_NUMBER}"
PROJECT="pr-${PR_NUMBER}"

echo "▶ Tearing down preview for PR #${PR_NUMBER}"

# ── 1. Stop & remove the app container + its locally-built image ──────────────
# These vars only need to be defined for compose to parse the file.
export PR_NUMBER \
       PREVIEW_DOMAIN="${PREVIEW_DOMAIN:-invalid}" \
       SHARED_INFRA_NETWORK="${SHARED_INFRA_NETWORK:-bridge}" \
       TRAEFIK_NETWORK="${TRAEFIK_NETWORK:-bridge}" \
       POSTGRES_USER POSTGRES_PASSWORD \
       S3_ACCESS_KEY="${S3_ACCESS_KEY:-x}" \
       S3_SECRET_KEY="${S3_SECRET_KEY:-x}" \
       S3_PUBLIC_ENDPOINT="${S3_PUBLIC_ENDPOINT:-http://localhost:9000}"
echo "  • Removing app container & image"
docker compose -p "${PROJECT}" -f "${COMPOSE_FILE}" down --rmi local --remove-orphans || true

# ── 2. Drop the Postgres database ─────────────────────────────────────────────
echo "  • Dropping database ${DB_NAME}"
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" \
  dropdb --if-exists -U "${POSTGRES_USER}" "${DB_NAME}" || true

# ── 3. Remove the MinIO bucket ────────────────────────────────────────────────
echo "  • Removing bucket ${BUCKET}"
docker exec "${MINIO_CONTAINER}" sh -c "
  mc alias set local http://localhost:9000 '${S3_ACCESS_KEY:-}' '${S3_SECRET_KEY:-}' >/dev/null 2>&1 || true
  mc rb --force local/${BUCKET} >/dev/null 2>&1 || true
" || true

# ── 4. Flush leftover BullMQ keys (best effort) ───────────────────────────────
echo "  • Flushing Redis keys for prefix pr-${PR_NUMBER}"
docker exec "${REDIS_CONTAINER}" sh -c \
  "redis-cli --scan --pattern 'pr-${PR_NUMBER}:*' | xargs -r redis-cli del >/dev/null 2>&1" || true

echo "✅ Preview torn down for PR #${PR_NUMBER}"
