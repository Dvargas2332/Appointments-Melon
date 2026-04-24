#!/usr/bin/env bash
# deploy.sh — Build, push, and restart the Melon API on Oracle Cloud VM
# Usage: ./deploy.sh [--no-push]
#
# Prerequisites on the VM:
#   - Docker + Docker Compose v2 installed
#   - SSH key auth configured
#   - .env.production present at $REMOTE_DIR
#   - nginx/certs present at $REMOTE_DIR/nginx/certs (Let's Encrypt or manual)
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
IMAGE_NAME="${IMAGE_NAME:-melon-api}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
FULL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"

REMOTE_USER="${REMOTE_USER:-ubuntu}"          # SSH user on Oracle Cloud VM
REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST to the Oracle VM public IP}"
REMOTE_DIR="${REMOTE_DIR:-/opt/melon-api}"    # Deployment directory on VM
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa}"           # Path to your private SSH key

NO_PUSH="${1:-}"

log() { echo -e "\033[1;34m[deploy]\033[0m $*"; }
die() { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

# ── 1. Build Docker image ──────────────────────────────────────────────────────
log "Building image $FULL_IMAGE ..."
docker build \
  --platform linux/amd64 \
  --tag "$FULL_IMAGE" \
  --tag "${IMAGE_NAME}:latest" \
  .

# ── 2. Save and transfer image ─────────────────────────────────────────────────
if [[ "$NO_PUSH" != "--no-push" ]]; then
  log "Saving image and transferring to $REMOTE_HOST ..."
  docker save "$FULL_IMAGE" | gzip | \
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no \
      "${REMOTE_USER}@${REMOTE_HOST}" \
      "gunzip | docker load"
fi

# ── 3. Copy production compose files ──────────────────────────────────────────
log "Copying compose files and nginx config ..."
ssh -i "$SSH_KEY" "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}/nginx/certs/self"

scp -i "$SSH_KEY" \
  docker-compose.prod.yml \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.prod.yml"

scp -i "$SSH_KEY" \
  nginx/nginx.conf \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/nginx/nginx.conf"

scp -i "$SSH_KEY" \
  scripts/gen-certs.sh \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/scripts/gen-certs.sh"

# Generate self-signed cert only if it doesn't exist yet
ssh -i "$SSH_KEY" "${REMOTE_USER}@${REMOTE_HOST}" bash <<'GENCERT'
  CERT="${REMOTE_DIR:-/opt/melon-api}/nginx/certs/self/fullchain.pem"
  if [[ ! -f "$CERT" ]]; then
    echo "No certificate found — generating self-signed cert..."
    chmod +x "${REMOTE_DIR:-/opt/melon-api}/scripts/gen-certs.sh"
    cd "${REMOTE_DIR:-/opt/melon-api}"
    bash scripts/gen-certs.sh
  else
    echo "Certificate already exists, skipping gen-certs."
  fi
GENCERT

# ── 4. Deploy on the VM ────────────────────────────────────────────────────────
log "Deploying on $REMOTE_HOST ..."
ssh -i "$SSH_KEY" "${REMOTE_USER}@${REMOTE_HOST}" bash <<REMOTE
  set -euo pipefail
  cd "${REMOTE_DIR}"

  # Run Prisma migrations before restarting the container
  echo "Running Prisma migrations..."
  docker run --rm \
    --env-file .env.production \
    "${FULL_IMAGE}" \
    node -e "const { execSync } = require('child_process'); execSync('npx prisma migrate deploy', { stdio: 'inherit' });"

  export DOCKER_IMAGE="${FULL_IMAGE}"
  docker compose -f docker-compose.prod.yml pull --quiet 2>/dev/null || true
  docker compose -f docker-compose.prod.yml up -d --remove-orphans

  echo "Waiting for health check..."
  sleep 10
  docker compose -f docker-compose.prod.yml ps
REMOTE

log "✓ Deployment complete — ${FULL_IMAGE} is live on ${REMOTE_HOST}"
