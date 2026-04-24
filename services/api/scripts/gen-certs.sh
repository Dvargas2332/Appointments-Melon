#!/usr/bin/env bash
# gen-certs.sh — Generate a self-signed TLS certificate for the Melon API
# Run this once on the Oracle Cloud VM before starting the production stack.
#
# When you get a real domain, replace the files in nginx/certs/self/ with
# Let's Encrypt certs (or symlink the certbot live/ folder there).
#
# Usage:
#   chmod +x scripts/gen-certs.sh
#   ./scripts/gen-certs.sh
set -euo pipefail

CERT_DIR="$(dirname "$0")/../nginx/certs/self"
mkdir -p "$CERT_DIR"

# Read the public IP (used as the CN / SAN so the cert matches the server)
PUBLIC_IP="${PUBLIC_IP:-$(curl -s --max-time 5 https://ifconfig.me || echo '0.0.0.0')}"

echo "Generating self-signed certificate for IP: $PUBLIC_IP"

openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout  "$CERT_DIR/privkey.pem" \
  -out     "$CERT_DIR/fullchain.pem" \
  -days    825 \
  -subj    "/C=US/ST=State/L=City/O=Melon/CN=${PUBLIC_IP}" \
  -addext  "subjectAltName=IP:${PUBLIC_IP}"

chmod 600 "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR/fullchain.pem"

echo ""
echo "✓ Certificate written to $CERT_DIR"
echo "  Valid for 825 days (~2 years)."
echo ""
echo "When you have a real domain, run:"
echo "  certbot certonly --standalone -d your-domain.com"
echo "  ln -sfn /etc/letsencrypt/live/your-domain.com  nginx/certs/self"
echo "  docker compose -f docker-compose.prod.yml restart nginx"
