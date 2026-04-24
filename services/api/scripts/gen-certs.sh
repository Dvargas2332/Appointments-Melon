#!/usr/bin/env bash
# gen-certs.sh — Generate a self-signed TLS certificate for the Melon API
# Run once on the Oracle Cloud VM before starting the production stack.
#
# Usage:
#   bash scripts/gen-certs.sh 68.233.124.190
#   PUBLIC_IP=68.233.124.190 bash scripts/gen-certs.sh
set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/nginx/certs/self"
mkdir -p "$CERT_DIR"

# Accept IP as argument or env var; last resort: detect automatically
PUBLIC_IP="${1:-${PUBLIC_IP:-}}"
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP="$(hostname -I | awk '{print $1}')"
fi

echo "Generating self-signed certificate for: $PUBLIC_IP"

# Install openssl if missing (Ubuntu/Debian VM)
if ! command -v openssl &>/dev/null; then
  echo "openssl not found — installing..."
  sudo apt-get update -qq && sudo apt-get install -y -qq openssl
fi

openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout  "$CERT_DIR/privkey.pem" \
  -out     "$CERT_DIR/fullchain.pem" \
  -days    825 \
  -subj    "/C=US/ST=State/L=City/O=Melon/CN=${PUBLIC_IP}" \
  -addext  "subjectAltName=IP:${PUBLIC_IP}"

chmod 600 "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR/fullchain.pem"

echo ""
echo "✓ Certificate written to: $CERT_DIR"
echo "  Valid for 825 days (~2 years)."
echo ""
echo "To migrate to Let's Encrypt when you have a domain:"
echo "  certbot certonly --standalone -d your-domain.com"
echo "  ln -sfn /etc/letsencrypt/live/your-domain.com $CERT_DIR"
echo "  docker compose -f docker-compose.prod.yml restart nginx"
