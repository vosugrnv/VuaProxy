/**
 * Export URL lists for Screaming Frog / SEO tools.
 * Free SF only crawls 500 URLs/session — split sitemaps into chunks ≤400.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "https://vuammovn.pro";
const CHUNK = 400;

function loadLocsFromSitemap() {
  const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  const locs = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) locs.push(m[1].trim());
  return [...new Set(locs)];
}

function urlEntry(loc) {
  return (
    "  <url>\n" +
    "    <loc>" +
    loc +
    "</loc>\n" +
    "    <changefreq>weekly</changefreq>\n" +
    "    <priority>0.7</priority>\n" +
    "  </url>"
  );
}

function main() {
  const locs = loadLocsFromSitemap();
  if (!locs.length) throw new Error("No URLs in sitemap.xml");

  fs.writeFileSync(path.join(ROOT, "sitemap.txt"), locs.join("\n") + "\n");

  const partsDir = path.join(ROOT, "sitemaps");
  fs.mkdirSync(partsDir, { recursive: true });
  for (const f of fs.readdirSync(partsDir)) {
    if (/^part-\d+\.xml$/.test(f)) fs.unlinkSync(path.join(partsDir, f));
  }

  const parts = [];
  for (let i = 0; i < locs.length; i += CHUNK) {
    const slice = locs.slice(i, i + CHUNK);
    const n = String(parts.length + 1).padStart(2, "0");
    const file = "part-" + n + ".xml";
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      slice.map(urlEntry).join("\n") +
      "\n</urlset>\n";
    fs.writeFileSync(path.join(partsDir, file), xml);
    parts.push({ file, count: slice.length, href: ORIGIN + "/sitemaps/" + file });
  }

  const indexXml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    parts
      .map(
        (p) =>
          "  <sitemap>\n    <loc>" +
          p.href +
          "</loc>\n  </sitemap>"
      )
      .join("\n") +
    "\n</sitemapindex>\n";
  fs.writeFileSync(path.join(ROOT, "sitemap-index.xml"), indexXml);

  const partLinks = parts
    .map(
      (p, i) =>
        `<li><a href="/sitemaps/${p.file}">Phần ${i + 1}</a> — ${p.count} URL (crawl List Mode trong Screaming Frog)</li>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lấy toàn bộ URL site — Screaming Frog | Vua MMO</title>
<meta name="robots" content="index,follow">
<link rel="canonical" href="${ORIGIN}/lay-toan-bo-url">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<main class="container" style="padding:28px 16px 64px;max-width:820px">
  <p><a href="/">Trang chủ</a> · <a href="/tat-ca-san-pham">Sản phẩm</a> · <a href="/danh-sach-san-pham">Danh sách sản phẩm</a></p>
  <h1>Lấy toàn bộ URL toàn site</h1>
  <p>Site hiện có <strong>${locs.length}</strong> URL trong sitemap. Screaming Frog bản miễn phí chỉ crawl tối đa <strong>500 URL / lần</strong>, nên không thể spider hết site trong một lần.</p>

  <h2>Cách 1 — Chỉ cần danh sách URL (nhanh nhất)</h2>
  <ol>
    <li>Mở <a href="/sitemap.txt"><strong>sitemap.txt</strong></a> (một URL mỗi dòng).</li>
    <li>Hoặc tải <a href="/sitemap.xml"><strong>sitemap.xml</strong></a> đầy đủ (${locs.length} URL).</li>
  </ol>

  <h2>Cách 2 — Screaming Frog List Mode (khuyến nghị)</h2>
  <ol>
    <li>Mode → <strong>List</strong></li>
    <li>Upload → Download → dán <code>${ORIGIN}/sitemap.txt</code> hoặc từng file phần bên dưới</li>
    <li>Crawl từng phần (mỗi phần ≤ ${CHUNK} URL, dưới hạn mức 500 của bản free)</li>
  </ol>
  <p>Sitemap index: <a href="/sitemap-index.xml">/sitemap-index.xml</a></p>
  <ul>
${partLinks}
  </ul>

  <h2>Cách 3 — Spider theo hub HTML (không cần JS)</h2>
  <ul>
    <li><a href="/danh-sach-san-pham">/danh-sach-san-pham</a> — sản phẩm (chia trang)</li>
    <li><a href="/danh-sach-chia-se">/danh-sach-chia-se</a> — bài viết</li>
    <li><a href="/danh-sach-shop">/danh-sach-shop</a> — gian hàng</li>
    <li><a href="/tat-ca-san-pham">/tat-ca-san-pham</a> — toàn bộ link sản phẩm tĩnh</li>
  </ul>

  <p style="margin-top:28px;color:#64748b;font-size:14px">Nếu dùng Spider từ trang chủ với bản free, tool sẽ dừng ở ~500 URL — đó là giới hạn phần mềm, không phải lỗi site.</p>
</main>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, "lay-toan-bo-url.html"), html);

  console.log("URLs:", locs.length);
  console.log("parts:", parts.length, "chunk:", CHUNK);
  console.log("wrote sitemap.txt, sitemap-index.xml, sitemaps/part-*.xml, lay-toan-bo-url.html");
}

main();
