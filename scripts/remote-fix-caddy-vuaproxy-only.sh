#!/bin/bash
# Restore a clean Caddyfile bak, then append vuaproxy snippet + domain sites at the end
# (global options stay first).
set -euo pipefail

HOSTIP=172.16.0.1
for ip in 172.16.0.1 172.17.0.1 172.20.0.1; do
  if docker exec platform-caddy wget -qO- --timeout=2 "http://$ip:3101/health" 2>/dev/null | grep -q ok; then
    HOSTIP=$ip; break
  fi
done
echo "HOSTIP=$HOSTIP"

pm2 restart vuaproxy-api --update-env || true
sleep 1
curl -sS http://127.0.0.1:3101/health; echo

CADDY=/srv/platform/infra/caddy/Caddyfile
# Prefer oldest bak before our broken patches
BAK=$(ls -1t /srv/platform/infra/caddy/Caddyfile.bak.* 2>/dev/null | tail -1 || true)
if [ -z "$BAK" ]; then
  BAK=$(ls -1t /srv/platform/infra/caddy/Caddyfile.bak* 2>/dev/null | tail -1 || true)
fi
# Prefer bak that validates
cp -a "$CADDY" "$CADDY.bak.before-vuaproxy-clean.$(date +%s)"
if [ -n "$BAK" ]; then
  echo "restoring from $BAK"
  cp -a "$BAK" "$CADDY"
fi

python3 - "$HOSTIP" <<'PY'
from pathlib import Path
import re, sys
hostip = sys.argv[1]
p = Path("/srv/platform/infra/caddy/Caddyfile")
text = p.read_text()
# remove any prior vuaproxy bits
text = re.sub(r"\n?\(vuaproxy_api\) \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(r"\n\timport vuaproxy_api", "", text)
text = re.sub(r"\nwww\.vuaproxy\.cloud,\s*vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(r"\nadmin\.vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)

snippet = f"""
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
		file_server
	}}
}}
"""

# Insert snippet after global options block if present, else at top after any leading comments
def insert_after_global(src, block):
    s = src.lstrip("\ufeff")
    if s.startswith("{"):
        depth = 0
        for i, ch in enumerate(s):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    # keep original leading whitespace of src
                    lead = src[: len(src) - len(src.lstrip("\ufeff"))]
                    return lead + s[: i + 1] + "\n" + block + s[i + 1 :]
    return block + "\n" + src

text = insert_after_global(text, snippet)

def ensure_import(marker):
    global text
    i = text.find(marker)
    if i < 0:
        return
    j = text.find("{", i)
    if j < 0:
        return
    if "import vuaproxy_api" in text[j : j + 600]:
        return
    text = text[: j + 1] + "\n\timport vuaproxy_api" + text[j + 1 :]

ensure_import(":80 {")
ensure_import("http://187.127.207.14 {")
ensure_import("srv1828363.hstgr.cloud {")

sites = f"""
www.vuaproxy.cloud, vuaproxy.cloud {{
	encode gzip
	handle /api/* {{
		uri strip_prefix /api
		header {{
			-Content-Encoding
		}}
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
		header {{
			-Content-Encoding
		}}
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

p.write_text(text.rstrip() + "\n" + sites + "\n")
print("Caddyfile rewritten")
PY

docker exec platform-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec platform-caddy caddy reload --config /etc/caddy/Caddyfile
sleep 2
echo ===VERIFY===
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/api/health; echo
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/ | tr '\n' ' ' | grep -oE '<title>[^<]+' | head -1
curl -sS -m 5 -o /dev/null -w 'home %{http_code}\n' -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -o /dev/null -w 'admin %{http_code}\n' -H 'Host: admin.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' -X POST http://127.0.0.1/api/payos/webhook -H 'Content-Type: application/json' -d '{}'; echo
echo CADDY_CLEAN_OK
