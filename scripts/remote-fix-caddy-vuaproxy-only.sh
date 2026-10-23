#!/bin/bash
# Serve vuaproxy via host matchers in :80.
# platform-caddy has no /var/www bind mount, so static is served by a sibling
# caddy container on host network :3102, then reverse_proxied.
set -euo pipefail

HOSTIP=172.16.0.1
for ip in 172.16.0.1 172.17.0.1 172.20.0.1; do
  if docker exec platform-caddy wget -qO- --timeout=2 "http://$ip:3101/health" 2>/dev/null | grep -q ok; then
    HOSTIP=$ip; break
  fi
done
echo "HOSTIP=$HOSTIP"

WEB=/var/www/vuaproxy-web
test -f "$WEB/index.html"
mkdir -p /var/www/vuaproxy/uploads
chmod -R a+rX "$WEB" /var/www/vuaproxy/uploads || true

# Static sidecar on same Docker network as platform-caddy (container has no /var/www)
cat >/tmp/vuaproxy-static.Caddyfile <<'EOF'
:3102 {
	handle_path /uploads/* {
		root * /srv/uploads
		file_server
	}
	handle {
		root * /srv/web
		try_files {path} {path}.html {path}/index.html /index.html
		file_server
	}
}
EOF

NET=$(docker inspect platform-caddy -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
echo "CADDY_NET=$NET"
docker rm -f vuaproxy-static >/dev/null 2>&1 || true
docker run -d --name vuaproxy-static --restart unless-stopped --network "$NET" \
  -v /var/www/vuaproxy-web:/srv/web:ro \
  -v /var/www/vuaproxy/uploads:/srv/uploads:ro \
  -v /tmp/vuaproxy-static.Caddyfile:/etc/caddy/Caddyfile:ro \
  caddy:2-alpine >/dev/null
sleep 2
STATIC_UP=vuaproxy-static:3102
docker exec platform-caddy wget -qO- --timeout=3 "http://$STATIC_UP/" | head -c 120; echo
TITLE0=$(docker exec platform-caddy wget -qO- --timeout=3 "http://$STATIC_UP/" | tr '\n' ' ' | grep -oE '<title>[^<]+' | head -1 || true)
echo "static_title=$TITLE0"
test -n "$TITLE0"

pm2 delete vuaproxy-web >/dev/null 2>&1 || true
pm2 restart vuaproxy-api --update-env || true
pm2 save || true
sleep 1
curl -sS http://127.0.0.1:3101/health; echo

CADDY=/srv/platform/infra/caddy/Caddyfile
cp -a "$CADDY" "$CADDY.bak.vuaproxy.host.$(date +%s)"

if grep -q 'vuaproxy cloudflare origin' "$CADDY" || grep -c 'vuaproxy_api' "$CADDY" | grep -vq '^0$'; then
  BAK=$(ls -1 /srv/platform/infra/caddy/Caddyfile.bak.* 2>/dev/null | head -1 || true)
  if [ -n "$BAK" ]; then
    echo "restore $BAK"
    cp -a "$BAK" "$CADDY"
  fi
fi

STATIC_UP=vuaproxy-static:3102
python3 - "$HOSTIP" "$STATIC_UP" <<'PY'
from pathlib import Path
import re, sys
hostip = sys.argv[1]
static_up = sys.argv[2]
p = Path("/srv/platform/infra/caddy/Caddyfile")
text = p.read_text()

text = re.sub(r"\n?\(vuaproxy_api\) \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(r"\n\timport vuaproxy_api", "", text)
text = re.sub(r"\nwww\.vuaproxy\.cloud,\s*vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(r"\nadmin\.vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(
    r"\n\t# --- vuaproxy host handlers ---[\s\S]*?\n\t# --- end vuaproxy host handlers ---\n",
    "\n",
    text,
)

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
		uri strip_prefix /vuaproxy-uploads
		rewrite * /uploads{{uri}}
		reverse_proxy {static_up}
	}}
}}
"""

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
                    lead = src[: len(src) - len(s)]
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
    if "import vuaproxy_api" in text[j : j + 800]:
        return
    text = text[: j + 1] + "\n\timport vuaproxy_api" + text[j + 1 :]

ensure_import(":80 {")
ensure_import("http://187.127.207.14 {")
ensure_import("srv1828363.hstgr.cloud {")

handlers = f"""
	# --- vuaproxy host handlers ---
	@vuaproxy host www.vuaproxy.cloud vuaproxy.cloud
	handle @vuaproxy {{
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
		handle {{
			reverse_proxy {static_up}
		}}
	}}
	@vuaproxy_admin host admin.vuaproxy.cloud
	handle @vuaproxy_admin {{
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
		handle {{
			reverse_proxy {static_up}
		}}
	}}
	# --- end vuaproxy host handlers ---
"""

i = text.find(":80 {")
if i < 0:
    raise SystemExit("no :80 block")
j = text.find("{", i)
insert_at = j + 1
nl = text.find("\n", j)
if nl > 0:
    insert_at = nl + 1
text = text[:insert_at] + handlers + text[insert_at:]
p.write_text(text)
print("injected host handlers into :80 (static via", static_up, ")")
PY

# HTTPS for Cloudflare Full (self-signed via tls internal)
python3 - "$HOSTIP" "$STATIC_UP" <<'PY'
from pathlib import Path
import re, sys
hostip, static_up = sys.argv[1], sys.argv[2]
p = Path("/srv/platform/infra/caddy/Caddyfile")
text = p.read_text()
text = re.sub(r"\nwww\.vuaproxy\.cloud,\s*vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(r"\nadmin\.vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
site = f"""
www.vuaproxy.cloud, vuaproxy.cloud {{
	tls internal
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
	handle {{
		reverse_proxy {static_up}
	}}
}}

admin.vuaproxy.cloud {{
	tls internal
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
	handle {{
		reverse_proxy {static_up}
	}}
}}
"""
p.write_text(text.rstrip() + "\n" + site + "\n")
print("HTTPS tls internal site blocks written")
PY

docker exec platform-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec platform-caddy caddy reload --config /etc/caddy/Caddyfile
sleep 2

echo ===VERIFY===
API=$(curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/api/health || true)
echo "api=$API"
echo "$API" | grep -q '"ok":true'
TITLE=$(curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/ | tr '\n' ' ' | grep -oE '<title>[^<]+' | head -1 || true)
echo "title=$TITLE"
echo "$TITLE" | grep -qiE 'Vua Proxy|Proxy|Vua MMO|vuaproxy'
curl -sS -m 5 -o /dev/null -w 'home %{http_code}\n' -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -o /dev/null -w 'admin %{http_code}\n' -H 'Host: admin.vuaproxy.cloud' http://127.0.0.1/admin.html
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' -X POST http://127.0.0.1/api/payos/webhook -H 'Content-Type: application/json' -d '{}'; echo
echo ===VERIFY_HTTPS===
curl -skS -m 8 -o /dev/null -w 'https-home %{http_code}\n' --resolve vuaproxy.cloud:443:127.0.0.1 https://vuaproxy.cloud/ || true
curl -skS -m 8 -w 'https-health %{http_code} ' --resolve vuaproxy.cloud:443:127.0.0.1 https://vuaproxy.cloud/api/health || true
echo
curl -skS -m 8 -o /dev/null -w 'https-admin %{http_code}\n' --resolve admin.vuaproxy.cloud:443:127.0.0.1 https://admin.vuaproxy.cloud/admin.html || true
echo CADDY_CLEAN_OK
