#!/bin/bash
# Serve vuaproxy.cloud on 187.127.207.14 via Caddy (Cloudflare origin).
set -euo pipefail

WEB=/var/www/vuaproxy-web
test -f "$WEB/index.html"
mkdir -p /var/www/vuaproxy/uploads

python3 - <<'PY'
from pathlib import Path
import re
p = Path("/var/www/vuaproxy-api/.env")
t = p.read_text() if p.exists() else ""
def setk(text, k, v):
    if re.search(rf"^{re.escape(k)}=", text, re.M):
        return re.sub(rf"^{re.escape(k)}=.*$", f"{k}={v}", text, count=1, flags=re.M)
    return text.rstrip() + f"\n{k}={v}\n"
t = setk(t, "PORT", "3101")
t = setk(t, "HOST", "0.0.0.0")
t = setk(t, "WEB_ORIGIN", "https://www.vuaproxy.cloud,https://vuaproxy.cloud,https://admin.vuaproxy.cloud,http://187.127.207.14")
t = setk(t, "UPLOAD_DIR", "/var/www/vuaproxy/uploads")
p.write_text(t)
print("env ok")
PY

pm2 delete vuaproxy-api >/dev/null 2>&1 || true
pm2 start /var/www/vuaproxy-api/src/server.js --name vuaproxy-api --cwd /var/www/vuaproxy-api
pm2 delete vuaproxy-web >/dev/null 2>&1 || true
pm2 save || true
sleep 1
curl -sS -m 5 http://127.0.0.1:3101/health; echo

# Detect docker bridge IP that reaches host :3101
BRIDGE=$(ip -4 addr show docker0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 || true)
HOSTIP="${BRIDGE:-172.20.0.1}"
# Prefer IP that works from caddy container
if docker exec platform-caddy wget -qO- --timeout=2 "http://${HOSTIP}:3101/health" >/dev/null 2>&1; then
  :
elif docker exec platform-caddy wget -qO- --timeout=2 "http://172.17.0.1:3101/health" >/dev/null 2>&1; then
  HOSTIP=172.17.0.1
elif docker exec platform-caddy wget -qO- --timeout=2 "http://172.20.0.1:3101/health" >/dev/null 2>&1; then
  HOSTIP=172.20.0.1
fi
echo "CADDY_UPSTREAM=$HOSTIP"

CADDY=/srv/platform/infra/caddy/Caddyfile
test -f "$CADDY"
cp -a "$CADDY" "$CADDY.bak.vuaproxy.cf.$(date +%s)"

python3 - "$HOSTIP" <<'PY'
from pathlib import Path
import re, sys
hostip = sys.argv[1]
p = Path("/srv/platform/infra/caddy/Caddyfile")
text = p.read_text()

snippet_api = f"""
(vuaproxy_api) {{
	handle_path /vuaproxy-api* {{
		header {{
			-Content-Encoding
		}}
		reverse_proxy {hostip}:3101 {{
			header_up Accept-Encoding identity
			header_up Host {{host}}
		}}
	}}
	handle_path /vuaproxy-uploads* {{
		root * /var/www/vuaproxy/uploads
		header Cache-Control "public, max-age=604800"
		file_server
	}}
}}
"""

text = re.sub(r"\n?\(vuaproxy_api\) \{[\s\S]*?\n\}\n*", "\n", text)
idx = text.find("(litepage")
if idx < 0:
    idx = text.find(":80 {")
if idx < 0:
    idx = 0
text = text[:idx] + snippet_api + "\n" + text[idx:]

def ensure_import(block_start: str):
    global text
    i = text.find(block_start)
    if i < 0:
        return
    j = text.find("{", i)
    if j < 0:
        return
    if "import vuaproxy_api" in text[j : j + 800]:
        return
    text = text[: j + 1] + "\n\timport vuaproxy_api" + text[j + 1 :]

ensure_import(":80 {")
ensure_import("srv1828363.hstgr.cloud {")
ensure_import("http://187.127.207.14 {")

site = f"""
www.vuaproxy.cloud, vuaproxy.cloud {{
	encode gzip
	handle_path /api/* {{
		header {{
			-Content-Encoding
		}}
		reverse_proxy {hostip}:3101 {{
			header_up Accept-Encoding identity
			header_up Host {{host}}
		}}
	}}
	handle_path /uploads/* {{
		root * /var/www/vuaproxy/uploads
		header Cache-Control "public, max-age=604800"
		file_server
	}}
	@country path_regexp country ^/tat-ca-khu-vuc/
	handle @country {{
		root * /var/www/vuaproxy-web
		rewrite * /khu-vuc-quoc-gia.html
		file_server
	}}
	@product path_regexp product ^/tat-ca-san-pham/.+-[0-9]+/?$
	handle @product {{
		root * /var/www/vuaproxy-web
		rewrite * /product.html
		file_server
	}}
	@cat path_regexp cat ^/tat-ca-san-pham/
	handle @cat {{
		root * /var/www/vuaproxy-web
		rewrite * /tat-ca-san-pham.html
		file_server
	}}
	@chiase path_regexp chiase ^/chia-se/[^/]+
	handle @chiase {{
		root * /var/www/vuaproxy-web
		rewrite * /chia-se-bai.html
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
	handle_path /api/* {{
		header {{
			-Content-Encoding
		}}
		reverse_proxy {hostip}:3101 {{
			header_up Accept-Encoding identity
			header_up Host {{host}}
		}}
	}}
	handle_path /uploads/* {{
		root * /var/www/vuaproxy/uploads
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

text = re.sub(r"\nwww\.vuaproxy\.cloud,\s*vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(r"\nadmin\.vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
p.write_text(text.rstrip() + "\n" + site + "\n")
print("Caddyfile domain blocks written")
PY

docker exec platform-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec platform-caddy caddy reload --config /etc/caddy/Caddyfile || docker restart platform-caddy
sleep 2

echo ===CHECKS===
curl -sS -m 5 http://127.0.0.1:3101/health; echo
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/api/health; echo
curl -sS -m 5 -o /dev/null -w 'home %{http_code}\n' -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -o /dev/null -w 'admin %{http_code}\n' -H 'Host: admin.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' -X POST http://127.0.0.1/api/payos/webhook -H 'Content-Type: application/json' -d '{}'; echo
echo VUAPROXY_CADDY_CF_READY
