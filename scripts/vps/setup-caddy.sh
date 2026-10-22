#!/usr/bin/env bash
# One-time VPS setup: install Caddy and point a domain at the dashboard.
# Usage: sudo bash scripts/vps/setup-caddy.sh dash.example.com [port]
# Requires Debian/Ubuntu and a DNS A record for the domain pointing at this server.
set -euo pipefail

DOMAIN="${1:?usage: sudo bash $0 <domain> [port]}"
PORT="${2:-3000}"

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  echo "Installing Caddy..."
  apt-get update
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

if [[ -f /etc/caddy/Caddyfile ]]; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%s)"
fi

cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
	encode gzip
	reverse_proxy 127.0.0.1:${PORT}
}
EOF

caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

echo
echo "Caddy is serving https://${DOMAIN} -> 127.0.0.1:${PORT}"
echo "Next: set WEB_HOST=127.0.0.1, WEB_TRUST_PROXY=true and"
echo "OAUTH_REDIRECT_URI=https://${DOMAIN}/auth/discord/callback in .env, then: npm run vps:restart"
