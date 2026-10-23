#!/bin/bash
set -euo pipefail
SRC="${SRC:-187.52.116.85}"
: "${VPS_PASS:?}"
export SSHPASS="$VPS_PASS"
command -v sshpass >/dev/null || { apt-get update -qq && apt-get install -y -qq sshpass; }
SSHSRC="sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=25 root@$SRC"

echo "=== plain SQL dump from SRC ==="
$SSHSRC 'bash -s' <<'PACK'
set -euo pipefail
URL=$(grep '^DATABASE_URL=' /var/www/vuaproxy-api/.env | cut -d= -f2-)
if docker ps --format '{{.Names}}' | grep -qx supabase-db; then
  docker exec supabase-db pg_dump -U postgres -d vuaproxy --no-owner --no-acl -f /tmp/vuaproxy.sql
  docker cp supabase-db:/tmp/vuaproxy.sql /tmp/vuaproxy.sql
else
  pg_dump "$URL" --no-owner --no-acl -f /tmp/vuaproxy.sql
fi
# also copy payos secrets etc
grep -E '^(PAYOS_|ADMIN_|JWT_|SMTP_|MAIL_)' /var/www/vuaproxy-api/.env > /tmp/vuaproxy-env.keys || true
ls -lh /tmp/vuaproxy.sql
PACK
sshpass -e scp -o StrictHostKeyChecking=no "root@$SRC:/tmp/vuaproxy.sql" /tmp/vuaproxy.sql
sshpass -e scp -o StrictHostKeyChecking=no "root@$SRC:/tmp/vuaproxy-env.keys" /tmp/vuaproxy-env.keys || true

echo "=== ensure postgres 16 container ==="
if ! docker ps --format '{{.Names}}' | grep -qx vuaproxy-pg; then
  docker rm -f vuaproxy-pg 2>/dev/null || true
  docker run -d --name vuaproxy-pg --restart unless-stopped \
    -e POSTGRES_USER=vuaproxy -e POSTGRES_PASSWORD='VpR0xy_14!' -e POSTGRES_DB=vuaproxy \
    -v vuaproxy-pgdata:/var/lib/postgresql/data postgres:16
  sleep 8
else
  # reset password to known value
  docker exec -i vuaproxy-pg psql -U vuaproxy -d postgres -c "ALTER USER vuaproxy WITH PASSWORD 'VpR0xy_14!';" || true
fi
PGIP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' vuaproxy-pg | awk '{print $1}')
echo "PGIP=$PGIP"

docker exec -i vuaproxy-pg psql -U vuaproxy -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='vuaproxy' AND pid <> pg_backend_pid();" || true
docker exec -i vuaproxy-pg psql -U vuaproxy -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS vuaproxy;"
docker exec -i vuaproxy-pg psql -U vuaproxy -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE vuaproxy OWNER vuaproxy;"
# Strip PG17-only settings so restore works on postgres:16
sed -i '/transaction_timeout/d' /tmp/vuaproxy.sql
docker exec -i vuaproxy-pg psql -U vuaproxy -d vuaproxy -v ON_ERROR_STOP=0 < /tmp/vuaproxy.sql
# Fail only if core tables missing
docker exec -i vuaproxy-pg psql -U vuaproxy -d vuaproxy -Atc "SELECT count(*) FROM users;" | grep -Eq '^[0-9]+$'
echo "DB restored rows:" 
docker exec -i vuaproxy-pg psql -U vuaproxy -d vuaproxy -Atc "SELECT 'users='||count(*) FROM users; SELECT 'orders='||count(*) FROM orders;"

python3 - <<PY
from pathlib import Path
import re
env_path = Path("/var/www/vuaproxy-api/.env")
t = env_path.read_text() if env_path.exists() else ""
keys = Path("/tmp/vuaproxy-env.keys").read_text() if Path("/tmp/vuaproxy-env.keys").exists() else ""
url = f"postgres://vuaproxy:VpR0xy_14!@${PGIP}:5432/vuaproxy"
def setk(text, k, v):
    if re.search(rf"^{re.escape(k)}=", text, re.M):
        return re.sub(rf"^{re.escape(k)}=.*$", f"{k}={v}", text, count=1, flags=re.M)
    return text.rstrip() + f"\n{k}={v}\n"
# merge keys from source
for line in keys.splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        t = setk(t, k.strip(), v.strip())
t = setk(t, "PORT", "3101")
t = setk(t, "HOST", "0.0.0.0")
t = setk(t, "DATABASE_URL", url)
t = setk(t, "WEB_ORIGIN", "https://www.vuaproxy.cloud,https://vuaproxy.cloud,https://admin.vuaproxy.cloud,http://187.127.207.14")
t = setk(t, "UPLOAD_DIR", "/var/www/vuaproxy/uploads")
env_path.write_text(t if t.endswith("\n") else t + "\n")
print("DATABASE_URL host", "${PGIP}")
PY

cd /var/www/vuaproxy-api
npm install --omit=dev >/dev/null
node src/migrate.js || true
pm2 delete vuaproxy-api >/dev/null 2>&1 || true
pm2 start src/server.js --name vuaproxy-api --cwd /var/www/vuaproxy-api
pm2 save || true
sleep 1
curl -sS http://127.0.0.1:3101/health; echo

# Pick host IP reachable from caddy
HOSTIP=172.16.0.1
for ip in 172.16.0.1 172.17.0.1 172.20.0.1; do
  if docker exec platform-caddy wget -qO- --timeout=2 "http://$ip:3101/health" 2>/dev/null | grep -q ok; then
    HOSTIP=$ip; break
  fi
done
echo "HOSTIP=$HOSTIP"

CADDY=/srv/platform/infra/caddy/Caddyfile
cp -a "$CADDY" "$CADDY.bak.fix.$(date +%s)"

python3 - "$HOSTIP" <<'PY'
from pathlib import Path
import re, sys
hostip = sys.argv[1]
p = Path("/srv/platform/infra/caddy/Caddyfile")
text = p.read_text()
# strip old domain blocks
text = re.sub(r"\nwww\.vuaproxy\.cloud,\s*vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(r"\nadmin\.vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
# refresh path snippet
text = re.sub(r"\n?\(vuaproxy_api\) \{[\s\S]*?\n\}\n*", "\n", text)
snippet = f"""
(vuaproxy_api) {{
	handle_path /vuaproxy-api* {{
		header {{ -Content-Encoding }}
		reverse_proxy {hostip}:3101 {{
			header_up Accept-Encoding identity
			header_up Host {{host}}
		}}
	}}
	handle_path /vuaproxy-uploads* {{
		root * /var/www/vuaproxy/uploads
		file_server
	}}
}}
"""
idx = text.find(":80 {")
if idx < 0:
    idx = 0
text = text[:idx] + snippet + text[idx:]

def ensure_import(marker):
    global text
    i = text.find(marker)
    if i < 0:
        return
    j = text.find("{", i)
    if j < 0:
        return
    if "import vuaproxy_api" in text[j:j+600]:
        return
    text = text[:j+1] + "\n\timport vuaproxy_api" + text[j+1:]

ensure_import(":80 {")
ensure_import("http://187.127.207.14 {")
ensure_import("srv1828363.hstgr.cloud {")

# Put domain sites at the VERY TOP so they win over catch-alls
sites = f"""
# --- vuaproxy cloudflare origin ---
www.vuaproxy.cloud, vuaproxy.cloud {{
	encode gzip
	handle /api/* {{
		uri strip_prefix /api
		header {{ -Content-Encoding }}
		reverse_proxy {hostip}:3101 {{
			header_up Accept-Encoding identity
			header_up Host {{host}}
		}}
	}}
	handle /uploads/* {{
		root * /var/www/vuaproxy
		file_server
	}}
	@country path_regexp ^/tat-ca-khu-vuc/
	handle @country {{
		rewrite * /khu-vuc-quoc-gia.html
		root * /var/www/vuaproxy-web
		file_server
	}}
	@product path_regexp ^/tat-ca-san-pham/.+-[0-9]+
	handle @product {{
		rewrite * /product.html
		root * /var/www/vuaproxy-web
		file_server
	}}
	@cat path_regexp ^/tat-ca-san-pham/
	handle @cat {{
		rewrite * /tat-ca-san-pham.html
		root * /var/www/vuaproxy-web
		file_server
	}}
	handle {{
		root * /var/www/vuaproxy-web
		try_files {{path}} {{path}}.html {{path}}/index.html /index.html
		file_server
	}}
}}

admin.vuaproxy.cloud {{
	encode gzip
	header X-Robots-Tag "noindex, nofollow"
	handle /api/* {{
		uri strip_prefix /api
		header {{ -Content-Encoding }}
		reverse_proxy {hostip}:3101 {{
			header_up Accept-Encoding identity
			header_up Host {{host}}
		}}
	}}
	handle /uploads/* {{
		root * /var/www/vuaproxy
		file_server
	}}
	handle {{
		root * /var/www/vuaproxy-web
		rewrite / /admin.html
		try_files {{path}} {{path}}.html /admin.html
		file_server
	}}
}}

"""
p.write_text(sites + text)
print("wrote domain sites at top")
PY

docker exec platform-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec platform-caddy caddy reload --config /etc/caddy/Caddyfile
sleep 2

echo ===VERIFY===
curl -sS -m 5 http://127.0.0.1:3101/health; echo
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/api/health; echo
curl -sS -m 5 -o /dev/null -w 'home %{http_code}\n' -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -o /dev/null -w 'title-check ' -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/ | head -c 0
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/ | tr '\n' ' ' | grep -oE '<title>[^<]+' | head -1
curl -sS -m 5 -o /dev/null -w 'admin %{http_code}\n' -H 'Host: admin.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' -X POST http://127.0.0.1/api/payos/webhook -H 'Content-Type: application/json' -d '{}'; echo
echo FIX14_DONE
