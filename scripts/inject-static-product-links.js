/**
 * Inject static product <a href> into listing HTML so crawlers
 * (Screaming Frog without JS) discover product URLs.
 * Markers: SEO_STATIC_PRODUCT_LINKS_START / END
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const START = "<!-- SEO_STATIC_PRODUCT_LINKS_START -->";
const END = "<!-- SEO_STATIC_PRODUCT_LINKS_END -->";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadProducts() {
  const js = fs.readFileSync(path.join(ROOT, "js/products-data.js"), "utf8");
  const m = js.match(/const RAW_PRODUCTS\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error("RAW_PRODUCTS not found");
  return eval(m[1]);
}

function buildLinkBlock(products) {
  const links = products
    .filter((p) => p && p.slug && p.id)
    .map((p) => {
      const href = "/tat-ca-san-pham/" + p.slug + "-" + p.id;
      return '  <a class="seo-p-link" href="' + href + '">' + esc(p.name) + "</a>";
    });
  return (
    START +
    "\n" +
    '<nav class="seo-product-index" aria-label="Danh sách sản phẩm (cho trình thu thập)">' +
    "\n" +
    links.join("\n") +
    "\n</nav>\n" +
    END
  );
}

function injectInto(fileRel, products) {
  const file = path.join(ROOT, fileRel);
  let html = fs.readFileSync(file, "utf8");
  const block = buildLinkBlock(products);

  if (html.includes(START) && html.includes(END)) {
    html = html.replace(new RegExp(START + "[\\s\\S]*?" + END, "m"), block);
  } else if (html.includes('id="productGrid"')) {
    html = html.replace(
      /(<div class="listing-grid" id="productGrid">)(\s*)(<\/div>)/,
      "$1\n" + block + "\n$3"
    );
  } else {
    throw new Error("No productGrid or markers in " + fileRel);
  }

  fs.writeFileSync(file, html);
  console.log("injected", fileRel, "links", products.length);
}

function ensureCss() {
  const cssPath = path.join(ROOT, "css/style.css");
  const marker = "/* seo-product-index */";
  let css = fs.readFileSync(cssPath, "utf8");
  if (css.includes(marker)) return;
  css +=
    "\n" +
    marker +
    "\n" +
    ".seo-product-index{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px 12px;padding:8px 0 24px}\n" +
    ".seo-p-link{display:block;font-size:13px;line-height:1.35;color:#0f172a;text-decoration:none;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}\n" +
    ".seo-p-link:hover{border-color:#fecaca;background:#fff1f2}\n" +
    "html.js-ready .seo-product-index{display:none!important}\n";
  fs.writeFileSync(cssPath, css);
  console.log("css ok");
}

function patchListingJs() {
  const file = path.join(ROOT, "js/tat-ca-san-pham.js");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("document.documentElement.classList.add(\"js-ready\")")) return;
  src = src.replace(
    "function init(){\n  renderFilters();",
    'function init(){\n  document.documentElement.classList.add("js-ready");\n  renderFilters();'
  );
  fs.writeFileSync(file, src);
  console.log("tat-ca-san-pham.js ok");
}

function writeHtmlSitemap(products) {
  const perPage = 500;
  const pages = [];
  for (let i = 0; i < products.length; i += perPage) {
    pages.push(products.slice(i, i + perPage));
  }
  const outDir = path.join(ROOT, "vi/danh-sach-san-pham");
  fs.mkdirSync(outDir, { recursive: true });

  const indexLinks = pages
    .map((_, i) => {
      const n = i + 1;
      const href = n === 1 ? "/danh-sach-san-pham/" : "/danh-sach-san-pham/trang-" + n;
      return '<li><a href="' + href + '">Trang ' + n + " (" + pages[i].length + " sản phẩm)</a></li>";
    })
    .join("\n");

  pages.forEach((chunk, i) => {
    const n = i + 1;
    const name = n === 1 ? "index.html" : "trang-" + n + ".html";
    const nav = pages
      .map((_, j) => {
        const pn = j + 1;
        const href = pn === 1 ? "/danh-sach-san-pham/" : "/danh-sach-san-pham/trang-" + pn;
        const cur = pn === n ? ' aria-current="page"' : "";
        return "<a href=\"" + href + "\"" + cur + ">" + pn + "</a>";
      })
      .join(" ");

    const links = chunk
      .filter((p) => p && p.slug && p.id)
      .map((p) => {
        const href = "/tat-ca-san-pham/" + p.slug + "-" + p.id;
        return "<li><a href=\"" + href + "\">" + esc(p.name) + "</a></li>";
      })
      .join("\n");

    const html =
      "<!DOCTYPE html>\n<html lang=\"vi\">\n<head>\n<meta charset=\"UTF-8\">\n" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
      "<title>Danh sách sản phẩm — trang " +
      n +
      " | Vua MMO</title>\n" +
      "<meta name=\"robots\" content=\"index,follow\">\n" +
      "<link rel=\"canonical\" href=\"https://vuammovn.pro/danh-sach-san-pham/" +
      (n === 1 ? "" : "trang-" + n) +
      "\">\n" +
      "<link rel=\"stylesheet\" href=\"/css/style.css\">\n</head>\n<body>\n" +
      "<main class=\"container\" style=\"padding:24px 16px 48px\">\n" +
      "<p><a href=\"/\">Trang chủ</a> · <a href=\"/tat-ca-san-pham\">Tất cả sản phẩm</a></p>\n" +
      "<h1>Danh sách sản phẩm (trang " +
      n +
      "/" +
      pages.length +
      ")</h1>\n" +
      "<p>Trang HTML tĩnh để công cụ SEO / Screaming Frog lấy URL sản phẩm không cần JavaScript.</p>\n" +
      "<nav style=\"margin:12px 0;display:flex;flex-wrap:wrap;gap:8px\">" +
      nav +
      "</nav>\n" +
      "<ol>\n" +
      links +
      "\n</ol>\n</main>\n</body>\n</html>\n";

    fs.writeFileSync(path.join(outDir, name), html);
  });

  // hub already is index.html page 1; also ensure root pointer
  console.log("html sitemap pages", pages.length);
}

const products = loadProducts();
ensureCss();
patchListingJs();
injectInto("tat-ca-san-pham.html", products);
writeHtmlSitemap(products);

// Link from listing footer area if missing
const listing = path.join(ROOT, "tat-ca-san-pham.html");
let listingHtml = fs.readFileSync(listing, "utf8");
if (!listingHtml.includes("/danh-sach-san-pham")) {
  listingHtml = listingHtml.replace(
    '<a href="/tat-ca-san-pham">Tất cả sản phẩm</a>',
    '<a href="/tat-ca-san-pham">Tất cả sản phẩm</a>\n      <a href="/danh-sach-san-pham/">Danh sách URL sản phẩm</a>'
  );
  // only first footer occurrence is enough — replace once in footer-col products
  fs.writeFileSync(listing, listingHtml);
}

console.log("done");
