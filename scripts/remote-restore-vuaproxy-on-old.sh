#!/bin/bash
# Restore VuaProxy onto this host (expected: 187.52.116.85) from /tmp/vuaproxy-migrate/
set -euo pipefail

MIG=/tmp/vuaproxy-migrate
test -f "$MIG/api.tar.gz"
test -f "$MIG/uploads.tar.gz"
test -f "$MIG/db.dump"
test -f "$MIG/env.prod"

echo "=== host $(hostname) / $(curl -sS -m 3 ifconfig.me || true) ==="

mkdir -p /var/www/vuaproxy-api /var/www/vuaproxy/uploads
rm -rf /var/www/vuaproxy-api/*
tar -xzf "$MIG/api.tar.gz" -C /var/www/vuaproxy-api
# keep live .env from dump; do not use repo .env
cp -f "$MIG/env.prod" /var/www/vuaproxy-api/.env
chmod 600 /var/www/vuaproxy-api/.env
tar -xzf "$MIG/uploads.tar.gz" -C /var/www/vuaproxy
chown -R www-data:www-data /var/www/vuaproxy/uploads 2>/dev/null || true

python3 <<'PY'
import os, re, subprocess, urllib.parse, secrets

env_path = "/var/www/vuaproxy-api/.env"
text = open(env_path).read()

def get(key, default=""):
    m = re.search(rf"^{re.escape(key)}=(.*)$", text, re.M)
    return (m.group(1).strip() if m else default)

# Resolve local Postgres (supabase-db preferred, else vuaproxy-pg)
pghost = None
for cname in ("supabase-db", "vuaproxy-pg"):
    try:
        ip = subprocess.check_output(
            ["docker", "inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", cname],
            text=True,
        ).strip()
        if ip:
            pghost = ip
            print("docker db", cname, ip)
            break
    except Exception:
        pass
if not pghost:
    pghost = "127.0.0.1"

# Prefer credentials already used by vuammo if present
vuammo = "/var/www/vuammo-api/.env"
dbuser = dbpass = None
port = "5432"
if os.path.exists(vuammo):
    vt = open(vuammo).read()
    m = re.search(r"DATABASE_URL=postgres://([^:]+):([^@]+)@([^:/]+):(\d+)/", vt)
    if m:
        dbuser, dbpass, _h, port = m.group(1), m.group(2), m.group(3), m.group(4)
        print("reuse vuammo db role", dbuser)

if not dbuser:
    dbuser = "vuaproxy"
    dbpass = secrets.token_urlsafe(18)

def dpsql(sql, db="postgres"):
    # try supabase-db first, then vuaproxy-pg
    for cname in ("supabase-db", "vuaproxy-pg"):
        try:
            return subprocess.check_output(
                ["docker", "exec", "-i", cname, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-c", sql],
                text=True,
            )
        except Exception:
            continue
    raise SystemExit("No postgres docker container found")

def dpsql_at(sql, db="postgres"):
    for cname in ("supabase-db", "vuaproxy-pg"):
        try:
            return subprocess.check_output(
                ["docker", "exec", "-i", cname, "psql", "-U", "postgres", "-d", db, "-Atc", sql],
                text=True,
            ).strip()
        except Exception:
            continue
    raise SystemExit("No postgres docker container found")

exists = dpsql_at("SELECT 1 FROM pg_database WHERE datname='vuaproxy'")
if exists != "1":
    dpsql("CREATE DATABASE vuaproxy;")
# Ensure role
role_exists = dpsql_at(f"SELECT 1 FROM pg_roles WHERE rolname='{dbuser}'")
if role_exists != "1":
    dpsql(f"CREATE USER \"{dbuser}\" WITH PASSWORD '{dbpass}';")
else:
    dpsql(f"ALTER USER \"{dbuser}\" WITH PASSWORD '{dbpass}';")
dpsql(f'GRANT ALL PRIVILEGES ON DATABASE vuaproxy TO "{dbuser}";')
dpsql(f'GRANT ALL ON SCHEMA public TO "{dbuser}";', db="vuaproxy")
dpsql(f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "{dbuser}";', db="vuaproxy")
dpsql(f'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "{dbuser}";', db="vuaproxy")

enc_user = urllib.parse.quote(dbuser, safe="")
enc_pass = urllib.parse.quote(dbpass, safe="")
url = f"postgres://{enc_user}:{enc_pass}@{pghost}:{port}/vuaproxy"

# Preserve PayOS / admin / smtp / jwt from source env; rewrite DATABASE_URL + paths
keys_keep = [
    "JWT_SECRET","JWT_DAYS","HOLD_DAYS","PAYOS_CLIENT_ID","PAYOS_API_KEY","PAYOS_CHECKSUM_KEY",
    "PAYOS_MOCK","ADMIN_EMAILS","SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASS","SMTP_SECURE","MAIL_FROM",
    "OCTOPROX_BASE_URL","OCTOPROX_USERNAME","OCTOPROX_PASSWORD","OCTOPROX_PROXY_HOST","OCTOPROX_PROXY_PORT",
]
lines = [
    "PORT=3101",
    "HOST=127.0.0.1",
    "WEB_ORIGIN=https://www.vuaproxy.cloud",
    f"DATABASE_URL={url}",
    "UPLOAD_DIR=/var/www/vuaproxy/uploads",
]
for k in keys_keep:
    v = get(k)
    if v != "":
        lines.append(f"{k}={v}")
if not get("JWT_SECRET"):
    lines.append("JWT_SECRET=" + secrets.token_hex(32))
open(env_path, "w").write("\n".join(lines) + "\n")
os.chmod(env_path, 0o600)
print("ENV rewritten for local DB")
open("/tmp/vuaproxy-db-url.txt", "w").write(url)
PY

# Restore dump into vuaproxy DB as postgres (clean slate)
echo "=== restore dump ==="
for cname in supabase-db vuaproxy-pg; do
  if docker ps --format '{{.Names}}' | grep -qx "$cname"; then
    docker exec -i "$cname" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='vuaproxy' AND pid <> pg_backend_pid();" || true
    docker exec -i "$cname" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS vuaproxy;"
    docker exec -i "$cname" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE vuaproxy;"
    # custom format dump
    if file "$MIG/db.dump" | grep -qi 'PostgreSQL custom'; then
      docker cp "$MIG/db.dump" "$cname":/tmp/vuaproxy.dump
      docker exec -i "$cname" pg_restore -U postgres -d vuaproxy --clean --if-exists --no-owner --no-acl /tmp/vuaproxy.dump || true
    else
      docker exec -i "$cname" psql -U postgres -d vuaproxy < "$MIG/db.dump"
    fi
    DBCONT="$cname"
    break
  fi
done
test -n "${DBCONT:-}"

# Re-grant after restore
python3 <<'PY'
import re, subprocess
env = open("/var/www/vuaproxy-api/.env").read()
m = re.search(r"DATABASE_URL=postgres://([^:]+):([^@]+)@", env)
user = m.group(1)
for cname in ("supabase-db", "vuaproxy-pg"):
    try:
        subprocess.check_call(["docker", "exec", "-i", cname, "psql", "-U", "postgres", "-d", "vuaproxy", "-v", "ON_ERROR_STOP=1", "-c",
            f'GRANT ALL ON SCHEMA public TO "{user}"; GRANT ALL ON ALL TABLES IN SCHEMA public TO "{user}"; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "{user}";'])
        print("grants ok", cname, user)
        break
    except Exception as e:
        print("grant skip", cname, e)
PY

cd /var/www/vuaproxy-api
npm install --omit=dev
node src/migrate.js || true

# nginx path proxy (same pattern as before)
mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/vuaproxy-api-location.conf <<'SNIP'
location /vuaproxy-api/ {
  proxy_pass http://127.0.0.1:3101/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 20m;
}
location /vuaproxy-uploads/ {
  alias /var/www/vuaproxy/uploads/;
  access_log off;
  expires 7d;
}
SNIP

CFG=$(grep -Rl 'proxy_pass http://127.0.0.1:3100' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -1 || true)
if [ -n "$CFG" ]; then
  if ! grep -q 'vuaproxy-api-location.conf' "$CFG"; then
    sed -i '0,/server {/s//server {\n    include \/etc\/nginx\/snippets\/vuaproxy-api-location.conf;/' "$CFG"
  fi
else
  cat > /etc/nginx/conf.d/vuaproxy-api-path.conf <<'NGX'
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  include /etc/nginx/snippets/vuaproxy-api-location.conf;
}
NGX
fi
rm -f /etc/nginx/conf.d/vuaproxy-api.conf
nginx -t && systemctl reload nginx

pm2 delete vuaproxy-api >/dev/null 2>&1 || true
pm2 start /var/www/vuaproxy-api/src/server.js --name vuaproxy-api --cwd /var/www/vuaproxy-api
pm2 save

sleep 2
echo '=== health ==='
curl -sS http://127.0.0.1:3101/health; echo
curl -sS -H 'Host: 187.52.116.85' http://127.0.0.1/vuaproxy-api/health; echo
URL=$(grep '^DATABASE_URL=' /var/www/vuaproxy-api/.env | cut -d= -f2-)
psql "$URL" -Atc "SELECT 'users='||count(*) FROM users;" || true
psql "$URL" -Atc "SELECT 'orders='||count(*) FROM orders;" || true
echo DONE
