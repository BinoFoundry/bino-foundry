# VPS setup — binofoundry.temukreatif.id (no Docker)

Put the **website** (React SPA) and **API** (Node/Express) on one VPS. Nginx serves the built frontend and forwards `/api` to the API on port `5050`. Supabase stays in the cloud (database + file storage).

**Target URL:** https://binofoundry.temukreatif.id

**Time:** ~30–45 minutes if DNS and Supabase are ready.

### Server layout (standard split)

| Path | Role |
|------|------|
| `/opt/bino-foundry` | Git repo, builds, `.env.production`, Node API (not exposed by nginx) |
| `/var/www/bino-foundry` | **Public web root** — only published `frontend/dist` files |
| `127.0.0.1:5050` | API process (PM2), proxied at `/api` |

Nginx serves static files from `/var/www` and never points at your source tree. After each build, run `sudo npm run deploy:web` to sync `frontend/dist` → `/var/www/bino-foundry`.

---

## What you need before starting

| Item | Notes |
|------|--------|
| VPS | Ubuntu 22.04 or 24.04 recommended; 1 GB RAM minimum, 2 GB+ better for `npm ci` |
| SSH access | Root or sudo user |
| Domain DNS | **A record** `binofoundry` → your VPS public IPv4 (at `temukreatif.id` DNS panel) |
| Supabase project | URL + **service role** key (Settings → API) |
| Git access | Clone this repo on the server (HTTPS or deploy key) |

Optional: wait until DNS works before SSL:

```bash
dig +short binofoundry.temukreatif.id
# should print your VPS IP
```

---

## 1. Prepare Supabase (once)

In [Supabase](https://supabase.com) → **SQL Editor**, run every file under `database/migrations/` **in order**:

1. `000001_initial_catalog.sql`
2. `000002_storage_buckets_supabase.sql`
3. `000003_sunglasses_builder_catalog.sql`
4. `000004_frame_render_views.sql`
5. `000005_drop_sunglasses_frame_colors.sql`
6. `000006_bracelet_charms_spacers.sql`

If a migration was already applied, skip it (Supabase will error on duplicate objects — that is fine).

Copy for later:

- **Project URL** → `SUPABASE_URL`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (never expose in the browser)

---

## 2. First login on the VPS

SSH in (replace with your IP):

```bash
ssh root@YOUR_VPS_IP
```

Update packages and install basics:

```bash
apt update && apt upgrade -y
apt install -y git nginx certbot python3-certbot-nginx ufw
```

Allow SSH and web traffic:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## 3. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # v20.x
npm -v
```

Install PM2 (keeps the API running after logout):

```bash
npm install -g pm2
```

---

## 4. Clone the app and create the web root

```bash
mkdir -p /opt
cd /opt
git clone YOUR_REPO_URL bino-foundry
cd bino-foundry

sudo mkdir -p /var/www/bino-foundry
```

If the repo is private, use a deploy key or copy the project with `rsync` from your laptop instead of `git clone`.

---

## 5. Configure environment

### 5a. API — repo root `.env.production`

```bash
cp deploy/env/.env.production.example .env.production
nano .env.production
```

Set at least:

```env
APP_ENV=production
NODE_ENV=production
PORT=5050
TRUST_PROXY=1

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

CORS_ORIGINS=https://binofoundry.temukreatif.id

ADMIN_API_KEY=choose_a_long_random_secret
```

`TRUST_PROXY=1` is required behind nginx.  
`CORS_ORIGINS` must match the **exact** site URL (https, no trailing slash).

Cloudinary lines are optional if you use Supabase Storage only.

### 5b. Frontend — build-time variables

Same-origin API (recommended with this nginx config):

```bash
cat > frontend/.env.production <<'EOF'
VITE_API_BASE_URL=
VITE_API_PREFIX=/api
VITE_ADMIN_API_KEY=same_value_as_ADMIN_API_KEY
EOF
```

Leave `VITE_API_BASE_URL` **empty** so the browser calls `https://binofoundry.temukreatif.id/api/...` through nginx.

> `VITE_ADMIN_API_KEY` is embedded in the built JS. Use a strong key and treat admin as trusted users only.

Validate config:

```bash
APP_ENV=production npm run env:check
```

---

## 6. Build the app

```bash
cd /opt/bino-foundry
npm ci
npm run build:all
```

This produces:

- `backend/dist/server.js` — API (stays under `/opt/bino-foundry`)
- `frontend/dist/` — build output (not served directly by nginx)

If `env:check` fails, fix `.env.production` and run again.

---

## 7. Publish the website to `/var/www`

Copy the built SPA into the nginx document root (owned by `www-data`):

```bash
cd /opt/bino-foundry
sudo npm run deploy:web
```

This runs `rsync` with `--delete` so removed assets do not linger. Confirm:

```bash
ls -la /var/www/bino-foundry/index.html
```

---

## 8. Start the API with PM2

From repo root:

```bash
cd /opt/bino-foundry
pm2 start deploy/pm2/ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Run the command `pm2 startup` prints (it registers PM2 on boot).

Check API locally on the server:

```bash
curl -s http://127.0.0.1:5050/api/status
```

Expect JSON with `"appEnv":"production"` (or similar).

View logs if needed:

```bash
pm2 logs bino-foundry-api
```

---

## 9. Configure nginx

```bash
cd /opt/bino-foundry
cp deploy/nginx/binofoundry.temukreatif.id.conf /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/binofoundry.temukreatif.id.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Open **http://binofoundry.temukreatif.id** in a browser (HTTP only for now). You should see the site; API calls go to `/api/...`.

---

## 10. Enable HTTPS (Let’s Encrypt)

```bash
certbot --nginx -d binofoundry.temukreatif.id
```

Follow prompts (email, agree to terms). Certbot edits nginx for TLS and auto-renewal.

Test renewal:

```bash
certbot renew --dry-run
```

Use **https://binofoundry.temukreatif.id** from now on.

---

## 11. Smoke test checklist

| Check | How |
|-------|-----|
| Site loads | https://binofoundry.temukreatif.id |
| API status | https://binofoundry.temukreatif.id/api/status |
| Health | https://binofoundry.temukreatif.id/api/health |
| Admin | https://binofoundry.temukreatif.id/admin — save a test item if keys match |
| API docs | https://binofoundry.temukreatif.id/api/docs |
| PM2 | `pm2 status` → `online` |

---

## 12. Deploy updates later

On the VPS after `git pull` (or uploading new files):

```bash
cd /opt/bino-foundry
git pull
npm ci
npm run build:all
sudo npm run deploy:web
pm2 restart bino-foundry-api
```

No nginx reload needed unless you change nginx config or static paths.

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| `502 Bad Gateway` on `/api` | `pm2 status`; `pm2 logs bino-foundry-api`; confirm `curl http://127.0.0.1:5050/api/status` works |
| Site 404 / blank | `ls /var/www/bino-foundry/index.html`; re-run `npm run build:all` then `sudo npm run deploy:web` |
| CORS errors in browser | `CORS_ORIGINS` must be `https://binofoundry.temukreatif.id`; restart API: `pm2 restart bino-foundry-api` |
| Admin save 401 | `ADMIN_API_KEY` (server) must match `VITE_ADMIN_API_KEY` (rebuild frontend after changing) |
| API startup: Supabase errors | Re-run migrations; verify `SUPABASE_URL` and service role key |
| certbot fails | DNS must point to this VPS; port 80 open (`ufw status`) |
| Upload fails | Migration `000002`; bucket policies; check Network tab for `/api/...` errors |

**Logs**

```bash
pm2 logs bino-foundry-api
tail -f /var/log/nginx/error.log
```

**Alternative to PM2:** systemd unit at [`deploy/systemd/bino-foundry-api.service`](./systemd/bino-foundry-api.service) — set `WorkingDirectory=/opt/bino-foundry` and `EnvironmentFile=/opt/bino-foundry/.env.production`.

---

## Optional: separate API subdomain

Only if you want the API on `api.binofoundry.temukreatif.id`:

1. DNS **A** record for `api.binofoundry`
2. Set `VITE_API_BASE_URL=https://api.binofoundry.temukreatif.id` in `frontend/.env.production` and rebuild
3. Set `CORS_ORIGINS=https://binofoundry.temukreatif.id`
4. Add a second nginx `server` block proxying to `127.0.0.1:5050` (see comments in [`nginx/bino-foundry.conf`](./nginx/bino-foundry.conf))

The single-domain setup above is simpler and is the default for this guide.

---

## Related docs

- [deploy/README.md](./README.md) — overview and Docker option
- [docs/setup/GETTING_STARTED.md](../docs/setup/GETTING_STARTED.md) — local dev
- [docs/environment/README.md](../docs/environment/README.md) — env variables
