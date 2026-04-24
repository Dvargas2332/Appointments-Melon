#!/usr/bin/env bash
# init-vm.sh — First-time setup on Oracle Cloud VM
# Run from services/api/:
#   bash scripts/init-vm.sh 68.233.124.190
set -euo pipefail

PUBLIC_IP="${1:-}"
if [[ -z "$PUBLIC_IP" ]]; then
  echo "Usage: bash scripts/init-vm.sh <PUBLIC_IP>"
  exit 1
fi

echo "==> Generating TLS certificate..."
bash "$(dirname "$0")/gen-certs.sh" "$PUBLIC_IP"

echo "==> Running Prisma migrations..."
docker compose -f docker-compose.prod.yml run --rm api \
  node -e "const{execSync}=require('child_process');execSync('npx prisma migrate deploy',{stdio:'inherit'})"

echo "==> Starting stack..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✓ Done. API running at https://${PUBLIC_IP}"
echo "  Check status: docker compose -f docker-compose.prod.yml ps"
echo "  Check logs:   docker compose -f docker-compose.prod.yml logs -f"
