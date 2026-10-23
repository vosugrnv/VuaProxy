#!/bin/bash
# Serve vuaproxy static + API on 187.52.116.85 for Cloudflare (same model as vuammo).
set -euo pipefail
WEB=/var/www/vuaproxy-web
mkdir -p "$WEB"
if [ ! -f "$WEB/index.html" ]; then
  echo "missing $WEB/index.html" >&2
  exit 1
fi
rm -f "$WEB/.env.local"

# WEB_ORIGIN for PayOS return + CORS-friendly list
ENVF=/var/www/vuaproxy-api/.env
if [ -f "$ENVF" ]; then
  python3 - <<'PY'
from pathlib import Path
p = Path("/var/www/vuaproxy-api/.env")
text = p.read_text()
desired = "WEB_ORIGIN=https://www.vuaproxy.cloud,https://vuaproxy.cloud,https://admin.vuaproxy.cloud,http://187.52.116.85"
import re
if re.search(r"^WEB_ORIGIN=", text, re.M):
    text = re.sub(r"^WEB_ORIGIN=.*$", desired, text, count=1, flags=re.M)
else:
    text = text.rstrip() + "\n" + desired + "\n"
p.write_text(text)
print("WEB_ORIGIN set")
PY
fi

cat > /etc/nginx/sites-available/vuaproxy-web <<'NGX'
server {
    listen 80;
    listen [::]:80;
    server_name vuaproxy.cloud www.vuaproxy.cloud;
    root /var/www/vuaproxy-web;
    index index.html;
    client_max_body_size 50m;

    location /api/ {
        proxy_pass http://127.0.0.1:3101/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        proxy_read_timeout 120s;
    }

    location /uploads/ {
        alias /var/www/vuaproxy/uploads/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        access_log off;
    }

    location / {
        try_files $uri $uri/ $uri.html @vuaproxy;
    }

    location @vuaproxy {
        rewrite ^/tat-ca-khu-vuc/([^/]+)/?$ /khu-vuc-quoc-gia.html last;
        rewrite ^/tat-ca-san-pham/[^/]+/[^/]+/?$ /tat-ca-san-pham.html last;
        rewrite ^/tat-ca-san-pham/.+-[0-9]+/?$ /product.html last;
        rewrite ^/tat-ca-san-pham/[^/]+/?$ /tat-ca-san-pham.html last;
        rewrite ^/chia-se/([^/]+)/?$ /chia-se-bai.html?slug=$1 last;
        rewrite ^/danh-sach-san-pham/?$ /vi/danh-sach-san-pham/index.html last;
        rewrite ^/danh-sach-san-pham/trang-([0-9]+)/?$ /vi/danh-sach-san-pham/trang-$1.html last;
        rewrite ^/danh-sach-shop/?$ /vi/danh-sach-shop/index.html last;
        rewrite ^/danh-sach-shop/trang-([0-9]+)/?$ /vi/danh-sach-shop/trang-$1.html last;
        rewrite ^/danh-sach-chia-se/?$ /vi/danh-sach-chia-se/index.html last;
        rewrite ^/danh-sach-chia-se/trang-([0-9]+)/?$ /vi/danh-sach-chia-se/trang-$1.html last;
        rewrite ^/tin-nhan/[^/]+/?$ /tin-nhan.html last;
        rewrite ^/admin/?$ /admin.html last;
        rewrite ^/([a-z0-9][a-z0-9-]{0,62})/?$ /shop.html?slug=$1 last;
        return 404;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name admin.vuaproxy.cloud;
    root /var/www/vuaproxy-web;
    index admin.html;
    client_max_body_size 50m;
    add_header X-Robots-Tag "noindex, nofollow" always;

    location = / {
        rewrite ^ /admin.html last;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3101/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding "";
        proxy_read_timeout 120s;
    }

    location /uploads/ {
        alias /var/www/vuaproxy/uploads/;
        expires 7d;
        access_log off;
    }

    location / {
        try_files $uri $uri/ $uri.html =404;
    }
}
NGX

ln -sfn /etc/nginx/sites-available/vuaproxy-web /etc/nginx/sites-enabled/vuaproxy-web
# Avoid conflicting server_name on :80 from earlier path-only config
rm -f /etc/nginx/conf.d/vuaproxy-path.conf

# Keep IP path locations for direct http://IP/vuaproxy-api health checks
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

echo "=== vuaproxy-web head ==="
sed -n '45,70p' /etc/nginx/sites-available/vuaproxy-web | cat -A
nginx -t
systemctl reload nginx

# Deploy latest API patches if present in /tmp
if [ -d /tmp/vuaproxy-api-patch/src ]; then
  cp -a /tmp/vuaproxy-api-patch/src/. /var/www/vuaproxy-api/src/
fi

pm2 restart vuaproxy-api --update-env || pm2 start /var/www/vuaproxy-api/src/server.js --name vuaproxy-api --cwd /var/www/vuaproxy-api
pm2 save || true
sleep 1

echo ===LOCAL===
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/api/health; echo
curl -sS -m 5 -o /dev/null -w 'home %{http_code}\n' -H 'Host: www.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -o /dev/null -w 'admin %{http_code}\n' -H 'Host: admin.vuaproxy.cloud' http://127.0.0.1/
curl -sS -m 5 -H 'Host: www.vuaproxy.cloud' -X POST http://127.0.0.1/api/payos/webhook -H 'Content-Type: application/json' -d '{}' ; echo
echo VUAPROXY_WEB_READY
