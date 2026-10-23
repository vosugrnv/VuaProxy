#!/bin/bash
# Inject vuaproxy host handlers into the existing :80 site (most reliable on this VPS).
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
cp -a "$CADDY" "$CADDY.bak.vuaproxy.host.$(date +%s)"

# Restore oldest bak if current file is a mess of our prior patches
if grep -q 'vuaproxy cloudflare origin' "$CADDY" || grep -c 'vuaproxy_api' "$CADDY" | grep -vq '^0$'; then
  BAK=$(ls -1 /srv/platform/infra/caddy/Caddyfile.bak.* 2>/dev/null | head -1 || true)
  if [ -n "$BAK" ]; then
    echo "restore $BAK"
    cp -a "$BAK" "$CADDY"
  fi
fi

python3 - "$HOSTIP" <<'PY'
from pathlib import Path
import re, sys
hostip = sys.argv[1]
p = Path("/srv/platform/infra/caddy/Caddyfile")
text = p.read_text()

# Strip prior vuaproxy domain server blocks / snippets / imports
text = re.sub(r"\n?\(vuaproxy_api\) \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(r"\n\timport vuaproxy_api", "", text)
text = re.sub(r"\nwww\.vuaproxy\.cloud,\s*vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
text = re.sub(r"\nadmin\.vuaproxy\.cloud \{[\s\S]*?\n\}\n*", "\n", text)
# Strip prior injected host handlers
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
		root * /var/www/vuaproxy/uploads
		file_server
	}}
}}
"""

# Insert snippet after global options
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
		handle {{
			root * /var/www/vuaproxy-web
			try_files {{path}} {{path}}.html {{path}}/index.html /index.html
			file_server
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
			root * /var/www/vuaproxy-web
			rewrite / /admin.html
			try_files {{path}} {{path}}.html /admin.html
			file_server
		}}
	}}
	# --- end vuaproxy host handlers ---
"""

# Inject handlers at start of :80 block (right after opening brace / imports area)
i = text.find(":80 {")
if i < 0:
    raise SystemExit("no :80 block")
j = text.find("{", i)
# Prefer after import lines near the top of the block
window_end = min(len(text), j + 1200)
insert_at = j + 1
# If imports exist, insert after the first few lines of the block
nl = text.find("\n", j)
if nl > 0:
    insert_at = nl + 1
text = text[:insert_at] + handlers + text[insert_at:]
p.write_text(text)
print("injected host handlers into :80")
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
echo "$TITLE" | grep -qi 'Vua Proxy\|Proxy'
curl -sS -m 5 -o /dev/null -w 'home %{http_code}\n' -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -o /dev/null -w 'admin %{http_code}\n' -H 'Host: admin.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' -X POST http://127.0.0.1/api/payos/webhook -H 'Content-Type: application/json' -d '{}'; echo
echo CADDY_CLEAN_OK
