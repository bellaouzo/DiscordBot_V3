# Dashboard Hosting

The web dashboard runs inside the bot process (`src/Web/WebServer.ts`), so it shares the Discord client and the SQLite databases. On a VPS, put [Caddy](https://caddyserver.com) in front of it for the domain and HTTPS.

```
browser ──HTTPS──▶ Caddy :443 ──▶ bot (pm2 "discord_bot") 127.0.0.1:3000
```

## 1. DNS

Create an `A` record for the dashboard domain (e.g. `dash.example.com`) pointing at the VPS IP.

## 2. Discord Developer Portal

Under **OAuth2 → Redirects**, add `https://dash.example.com/auth/discord/callback`. Copy the client secret.

## 3. Caddy

From the repo on the VPS:

```bash
sudo bash scripts/vps/setup-caddy.sh dash.example.com
```

This installs Caddy (Debian/Ubuntu), writes `/etc/caddy/Caddyfile` (old file backed up), and opens ports 80/443 if `ufw` is active. See [deploy/Caddyfile.example](../deploy/Caddyfile.example) to do it by hand.

## 4. `.env` on the VPS

```bash
CLIENT_SECRET=...
SESSION_SECRET=...            # e.g. output of: openssl rand -hex 32
OAUTH_REDIRECT_URI=https://dash.example.com/auth/discord/callback
WEB_PORT=3000
WEB_HOST=127.0.0.1            # only Caddy can reach the bot directly
WEB_TRUST_PROXY=true          # login cookies are marked secure over HTTPS
```

## 5. Deploy

```bash
npm run vps:restart
curl -s https://dash.example.com/api/health
```

`npm run build` copies `src/Web/public` into `dist/Web/public`; without that step the dashboard 404s in production.

## Health check

`GET /api/health` needs no login and returns `200` once the bot is connected:

```json
{ "status": "ok", "uptimeSeconds": 1234, "gatewayPingMs": 42, "guilds": 3 }
```

It returns `503` with `"status": "starting"` while the bot is still logging in.

## Logs

```bash
pm2 logs discord_bot --lines 200 --nostream   # bot + web server
journalctl -u caddy -n 100 --no-pager         # proxy / certificates
```
