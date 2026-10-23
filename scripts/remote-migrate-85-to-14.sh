#!/bin/bash
# Run ON 187.127.207.14. Pulls live DB/uploads/env from 187.52.116.85 then configures site.
set -euo pipefail
SRC="${SRC:-187.52.116.85}"
: "${VPS_PASS:?need VPS_PASS}"

export DEBIAN_FRONTEND=noninteractive
command -v sshpass >/dev/null || { apt-get update -qq && apt-get install -y -qq sshpass; }
export SSHPASS="$VPS_PASS"
SSHSRC="sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=25 root@$SRC"
SCPSRC="sshpass -e scp -o StrictHostKeyChecking=no -o ConnectTimeout=25"

echo "=== pack on SRC ==="
$SSHSRC 'bash -s' <<'PACK'
set -euo pipefail
mkdir -p /tmp/vuaproxy-live
rm -rf /tmp/vuaproxy-live/*
cp -f /var/www/vuaproxy-api/.env /tmp/vuaproxy-live/env.prod
if [ -d /var/www/vuaproxy/uploads ]; then
  tar -czf /tmp/vuaproxy-live/uploads.tar.gz -C /var/www/vuaproxy uploads
else
  mkdir -p /tmp/e/uploads && tar -czf /tmp/vuaproxy-live/uploads.tar.gz -C /tmp/e uploads
fi
# Prefer dumping API tree too if DEST missing files
if [ -d /var/www/vuaproxy-api/src ]; then
  tar -czf /tmp/vuaproxy-live/api-src.tar.gz -C /var/www/vuaproxy-api \
    --exclude=node_modules --exclude=.env --exclude=data/vpn-pool .
fi
if docker ps --format '{{.Names}}' | grep -qx supabase-db; then
  docker exec supabase-db pg_dump -U postgres -d vuaproxy -Fc -f /tmp/vuaproxy.dump
  docker cp supabase-db:/tmp/vuaproxy.dump /tmp/vuaproxy-live/db.dump
else
  URL=$(grep '^DATABASE_URL=' /var/www/vuaproxy-api/.env | cut -d= -f2-)
  pg_dump "$URL" -Fc -f /tmp/vuaproxy-live/db.dump
fi
tar -czf /tmp/vuaproxy-live.tgz -C /tmp/vuaproxy-live .
ls -lh /tmp/vuaproxy-live.tgz
PACK

$SCPSRC "root@$SRC:/tmp/vuaproxy-live.tgz" /tmp/vuaproxy-live.tgz
rm -rf /tmp/vuaproxy-live && mkdir -p /tmp/vuaproxy-live
tar -xzf /tmp/vuaproxy-live.tgz -C /tmp/vuaproxy-live

echo "=== web site ==="
WEB=/var/www/vuaproxy-web
mkdir -p "$WEB" /var/www/vuaproxy/uploads /var/www/vuaproxy-api
if [ -f /tmp/vuaproxy-site.tar.gz ]; then
  find "$WEB" -mindepth 1 -maxdepth 1 -exec rm -rf {} + || true
  tar -xzf /tmp/vuaproxy-site.tar.gz -C "$WEB"
  rm -rf "$WEB/api" "$WEB/.git" "$WEB/node_modules" "$WEB/.vercel"
fi
tar -xzf /tmp/vuaproxy-live/uploads.tar.gz -C /var/www/vuaproxy
if [ -f /tmp/vuaproxy-live/api-src.tar.gz ]; then
  tar -xzf /tmp/vuaproxy-live/api-src.tar.gz -C /var/www/vuaproxy-api
fi
if [ -f /tmp/vuaproxy-api-patch.tar.gz ]; then
  mkdir -p /tmp/vuaproxy-api-patch-x
  tar -xzf /tmp/vuaproxy-api-patch.tar.gz -C /tmp/vuaproxy-api-patch-x
  cp -a /tmp/vuaproxy-api-patch-x/src/. /var/www/vuaproxy-api/src/
fi

echo "=== database ==="
DBCONT=""
for c in vuaproxy-pg supabase-db; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then DBCONT=$c; break; fi
done
if [ -z "$DBCONT" ]; then
  docker run -d --name vuaproxy-pg --restart unless-stopped \
    -e POSTGRES_USER=vuaproxy -e POSTGRES_PASSWORD=vuaproxy -e POSTGRES_DB=vuaproxy \
    -v vuaproxy-pgdata:/var/lib/postgresql/data postgres:16
  sleep 6
  DBCONT=vuaproxy-pg
fi

if [ "$DBCONT" = "supabase-db" ]; then
  docker exec -i "$DBCONT" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='vuaproxy' AND pid <> pg_backend_pid();" || true
  docker exec -i "$DBCONT" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS vuaproxy;"
  docker exec -i "$DBCONT" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE vuaproxy;"
  docker cp /tmp/vuaproxy-live/db.dump "$DBCONT":/tmp/vuaproxy.dump
  docker exec -i "$DBCONT" pg_restore -U postgres -d vuaproxy --clean --if-exists --no-owner --no-acl /tmp/vuaproxy.dump || true
else
  docker exec -i "$DBCONT" psql -U vuaproxy -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='vuaproxy' AND pid <> pg_backend_pid();" || true
  docker exec -i "$DBCONT" psql -U vuaproxy -d postgres -c "DROP DATABASE IF EXISTS vuaproxy;" || true
  docker exec -i "$DBCONT" psql -U vuaproxy -d postgres -c "CREATE DATABASE vuaproxy;" || true
  docker cp /tmp/vuaproxy-live/db.dump "$DBCONT":/tmp/vuaproxy.dump
  docker exec -i "$DBCONT" pg_restore -U vuaproxy -d vuaproxy --clean --if-exists --no-owner --no-acl /tmp/vuaproxy.dump || true
fi

PGIP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$DBCONT" | head -1 | awk '{print $1}')
echo "DBCONT=$DBCONT PGIP=$PGIP"

python3 - <<PY
from pathlib import Path
import re, secrets
env_src = Path("/tmp/vuaproxy-live/env.prod").read_text()
def get(k, default=""):
    m = re.search(rf"^{re.escape(k)}=(.*)$", env_src, re.M)
    return m.group(1).strip() if m else default
pgip = "${PGIP}"
dbcont = "${DBCONT}"
if dbcont == "vuaproxy-pg":
    url = f"postgres://vuaproxy:vuaproxy@{pgip}:5432/vuaproxy"
else:
    m = re.search(r"DATABASE_URL=postgres://([^:]+):([^@]+)@", env_src)
    if m:
        url = f"postgres://{m.group(1)}:{m.group(2)}@{pgip}:5432/vuaproxy"
    else:
        url = f"postgres://postgres@{pgip}:5432/vuaproxy"
keys = ["JWT_SECRET","JWT_DAYS","HOLD_DAYS","PAYOS_CLIENT_ID","PAYOS_API_KEY","PAYOS_CHECKSUM_KEY","PAYOS_MOCK","ADMIN_EMAILS","SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASS","SMTP_SECURE","MAIL_FROM"]
lines = [
    "PORT=3101",
    "HOST=0.0.0.0",
    "WEB_ORIGIN=https://www.vuaproxy.cloud,https://vuaproxy.cloud,https://admin.vuaproxy.cloud,http://187.127.207.14",
    f"DATABASE_URL={url}",
    "UPLOAD_DIR=/var/www/vuaproxy/uploads",
]
for k in keys:
    v = get(k)
    if v:
        lines.append(f"{k}={v}")
if not get("JWT_SECRET"):
    lines.append("JWT_SECRET=" + secrets.token_hex(32))
Path("/var/www/vuaproxy-api/.env").write_text("\n".join(lines) + "\n")
print("env", url.split("@")[-1])
PY

cd /var/www/vuaproxy-api
npm install --omit=dev
node src/migrate.js || true

sed -i 's/\r$//' /tmp/remote-vuaproxy-caddy-cf.sh
bash /tmp/remote-vuaproxy-caddy-cf.sh

$SSHSRC 'pm2 stop vuaproxy-api; pm2 save; echo src-api-stopped' || true
echo MIGRATE_TO_14_DONE
