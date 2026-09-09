/**
 * Inject static <a href> for crawlers (no JS) across the rest of the site:
 * - Chia sẻ (blog) posts on /chia-se
 * - HTML index /danh-sach-chia-se
 * - Shop URLs hub /danh-sach-shop
 * - Crawl hub links on homepage
 * - Regenerate sitemap.xml (products + blog + shops + static pages + categories)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "https://vuammovn.pro";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadProducts() {
  const js = fs.readFileSync(path.join(ROOT, "js/products-data.js"), "utf8");
  const m = js.match(/const RAW_PRODUCTS\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error("RAW_PRODUCTS not found");
  // eslint-disable-next-line no-eval
  return eval(m[1]).filter((p) => p && p.slug && p.id);
}

function loadSharePosts() {
  // Execute chia-se-data.js in a sandbox-ish way
  const js = fs.readFileSync(path.join(ROOT, "js/chia-se-data.js"), "utf8");
  const sandbox = { window: {}, console };
  const fn = new Function(
    "window",
    "console",
    js + "\n; return { SHARE_POSTS, SHARE_CATS };"
  );
  const { SHARE_POSTS, SHARE_CATS } = fn(sandbox.window, console);
  return {
    posts: (SHARE_POSTS || []).filter((p) => p && p.slug),
    cats: SHARE_CATS || [],
  };
}

function loadShops() {
  const js = fs.readFileSync(path.join(ROOT, "js/shops-data.js"), "utf8");
  const m = js.match(/const VUAMMO_SHOPS\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return [];
  // eslint-disable-next-line no-eval
  return eval(m[1]).filter((s) => s && (s.slug || s.token));
}

function shopHref(s) {
  if (s.slug) return "/" + s.slug;
  return "/shop?token=" + encodeURIComponent(s.token);
}

function ensureCss() {
  const cssPath = path.join(ROOT, "css/style.css");
  const marker = "/* seo-site-indexes */";
  let css = fs.readFileSync(cssPath, "utf8");
  if (css.includes(marker)) return;
  css +=
    "\n" +
    marker +
    "\n" +
    ".seo-share-index,.seo-shop-index,.seo-crawl-hub{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px 12px;padding:8px 0 24px}\n" +
    ".seo-s-link,.seo-shop-link,.seo-hub-link{display:block;font-size:13px;line-height:1.35;color:#0f172a;text-decoration:none;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}\n" +
    ".seo-s-link:hover,.seo-shop-link:hover,.seo-hub-link:hover{border-color:#fecaca;background:#fff1f2}\n" +
    "html.js-ready .seo-share-index,html.js-ready .seo-shop-index,html.js-ready .seo-crawl-hub{display:none!important}\n";
  fs.writeFileSync(cssPath, css);
  console.log("css ok");
}

function replaceOrInsert(html, start, end, block, insertAfterNeedle) {
  if (html.includes(start) && html.includes(end)) {
    return html.replace(new RegExp(start + "[\\s\\S]*?" + end, "m"), block);
  }
  if (insertAfterNeedle && html.includes(insertAfterNeedle)) {
    return html.replace(insertAfterNeedle, insertAfterNeedle + "\n" + block);
  }
  throw new Error("Cannot inject block (missing markers / needle)");
}

function injectChiaSe(posts, cats) {
  const START = "<!-- SEO_STATIC_SHARE_LINKS_START -->";
  const END = "<!-- SEO_STATIC_SHARE_LINKS_END -->";
  const catLinks = (cats || [])
    .filter((c) => c.slug && c.slug !== "all")
    .map(
      (c) =>
        '  <a class="seo-s-link" href="/chia-se?cat=' +
        encodeURIComponent(c.slug) +
        '">Chuyên mục: ' +
        esc(c.title) +
        "</a>"
    );
  const postLinks = posts.map((p) => {
    return (
      '  <a class="seo-s-link" href="/chia-se/' +
      p.slug +
      '">' +
      esc(p.title) +
      "</a>"
    );
  });
  const block =
    START +
    "\n" +
    '<nav class="seo-share-index" aria-label="Danh sách bài chia sẻ (cho trình thu thập)">' +
    "\n" +
    catLinks.concat(postLinks).join("\n") +
    "\n</nav>\n" +
    END;

  const file = path.join(ROOT, "chia-se.html");
  let html = fs.readFileSync(file, "utf8");
  html = replaceOrInsert(
    html,
    START,
    END,
    block,
    '<div class="blog-grid share-grid" id="shareGrid"></div>'
  );
  fs.writeFileSync(file, html);
  console.log("injected chia-se.html links", posts.length + catLinks.length);
}

function patchChiaSeJs() {
  const file = path.join(ROOT, "js/chia-se.js");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('document.documentElement.classList.add("js-ready")')) {
    console.log("chia-se.js already js-ready");
    return;
  }
  src = src.replace(
    "function boot(){\n  const params",
    'function boot(){\n  document.documentElement.classList.add("js-ready");\n  const params'
  );
  fs.writeFileSync(file, src);
  console.log("chia-se.js ok");
}

function writeHtmlList(dirRel, basePath, title, items, hrefOf, labelOf, perPage) {
  const outDir = path.join(ROOT, dirRel);
  fs.mkdirSync(outDir, { recursive: true });
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  if (!pages.length) pages.push([]);

  pages.forEach((chunk, i) => {
    const n = i + 1;
    const name = n === 1 ? "index.html" : "trang-" + n + ".html";
    const nav = pages
      .map((_, j) => {
        const pn = j + 1;
        const href = pn === 1 ? basePath + "/" : basePath + "/trang-" + pn;
        const cur = pn === n ? ' aria-current="page"' : "";
        return '<a href="' + href + '"' + cur + ">" + pn + "</a>";
      })
      .join(" ");
    const links = chunk
      .map((it) => {
        return (
          "<li><a href=\"" +
          hrefOf(it) +
          "\">" +
          esc(labelOf(it)) +
          "</a></li>"
        );
      })
      .join("\n");
    const canon =
      ORIGIN +
      basePath +
      (n === 1 ? "" : "/trang-" + n);
    const html =
      "<!DOCTYPE html>\n<html lang=\"vi\">\n<head>\n<meta charset=\"UTF-8\">\n" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
      "<title>" +
      esc(title) +
      " — trang " +
      n +
      " | Vua MMO</title>\n" +
      "<meta name=\"robots\" content=\"index,follow\">\n" +
      "<link rel=\"canonical\" href=\"" +
      canon +
      "\">\n" +
      "<link rel=\"stylesheet\" href=\"/css/style.css\">\n</head>\n<body>\n" +
      "<main class=\"container\" style=\"padding:24px 16px 48px\">\n" +
      "<p><a href=\"/\">Trang chủ</a> · <a href=\"/chia-se\">Chia sẻ</a> · <a href=\"/tat-ca-san-pham\">Sản phẩm</a> · <a href=\"/danh-sach-san-pham\">URL sản phẩm</a></p>\n" +
      "<h1>" +
      esc(title) +
      " (trang " +
      n +
      "/" +
      pages.length +
      ")</h1>\n" +
      "<p>Trang HTML tĩnh để Screaming Frog / bot lấy URL không cần JavaScript.</p>\n" +
      "<nav style=\"margin:12px 0;display:flex;flex-wrap:wrap;gap:8px\">" +
      nav +
      "</nav>\n<ol>\n" +
      links +
      "\n</ol>\n</main>\n</body>\n</html>\n";
    fs.writeFileSync(path.join(outDir, name), html);
  });
  console.log("wrote", dirRel, "pages", pages.length);
  return pages.length;
}

function injectHomeCrawlHub(posts, shops) {
  const START = "<!-- SEO_CRAWL_HUB_START -->";
  const END = "<!-- SEO_CRAWL_HUB_END -->";
  const links = [
    ["Tất cả sản phẩm", "/tat-ca-san-pham"],
    ["Danh sách URL sản phẩm", "/danh-sach-san-pham"],
    ["Chia sẻ (blog)", "/chia-se"],
    ["Danh sách URL bài viết", "/danh-sach-chia-se"],
    ["Danh sách gian hàng", "/danh-sach-shop"],
    ["Lấy toàn bộ URL (Screaming Frog)", "/lay-toan-bo-url"],
    ["sitemap.txt (toàn site)", "/sitemap.txt"],
    ["Giới thiệu", "/gioi-thieu"],
    ["FAQs", "/faqs"],
    ["Liên hệ", "/lien-he"],
    ["Hướng dẫn mua hàng", "/huong-dan-mua-hang"],
    ["Nạp tiền", "/nap-tien"],
    ["Đăng ký người bán", "/dang-ky-nguoi-ban"],
    ["Tài liệu API", "/tai-lieu-api"],
    ["Điều khoản dịch vụ", "/dieu-khoan-dich-vu"],
    ["Chính sách bảo mật", "/chinh-sach-bao-mat"],
    ["Bảo hành và hoàn tiền", "/bao-hanh-va-hoan-tien"],
  ];
  // Seed a handful of blog + shop URLs on homepage for discovery
  posts.slice(0, 12).forEach((p) => {
    links.push([p.title, "/chia-se/" + p.slug]);
  });
  shops.slice(0, 12).forEach((s) => {
    links.push(["Shop " + (s.name || s.slug), shopHref(s)]);
  });

  const block =
    START +
    "\n" +
    '<nav class="seo-crawl-hub" aria-label="Liên kết thu thập toàn site">' +
    "\n" +
    links
      .map(
        ([label, href]) =>
          '  <a class="seo-hub-link" href="' + href + '">' + esc(label) + "</a>"
      )
      .join("\n") +
    "\n</nav>\n" +
    END;

  const file = path.join(ROOT, "index.html");
  let html = fs.readFileSync(file, "utf8");
  if (html.includes(START) && html.includes(END)) {
    html = html.replace(new RegExp(START + "[\\s\\S]*?" + END, "m"), block);
  } else if (html.includes('<footer')) {
    html = html.replace(/<footer[\s\S]*?>/, (m) => block + "\n" + m);
  } else {
    html = html.replace("</body>", block + "\n</body>");
  }
  fs.writeFileSync(file, html);
  console.log("injected index crawl hub", links.length);
}

function patchAppJsReady() {
  const file = path.join(ROOT, "js/app.js");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('document.documentElement.classList.add("js-ready")')) {
    console.log("app.js already js-ready");
    return;
  }
  // Add near top of render section
  if (src.includes("/* ---------- Render ---------- */")) {
    src = src.replace(
      "/* ---------- Render ---------- */",
      '/* ---------- Render ---------- */\ndocument.documentElement.classList.add("js-ready");'
    );
  } else {
    src = 'document.documentElement.classList.add("js-ready");\n' + src;
  }
  fs.writeFileSync(file, src);
  console.log("app.js ok");
}

function loadCategoryChildren() {
  const taxPath = path.join(ROOT, "js/category-taxonomy.js");
  if (!fs.existsSync(taxPath)) return [];
  const js = fs.readFileSync(taxPath, "utf8");
  const fn = new Function(js + "\n; return CATEGORY_TAXONOMY;");
  const tax = fn();
  const out = [];
  (tax.parents || []).forEach((p) => {
    out.push({ loc: "/tat-ca-san-pham/" + p.slug, priority: "0.85" });
    (p.children || []).forEach((c) => {
      if (!c.slug) return;
      out.push({
        loc: "/tat-ca-san-pham/" + p.slug + "/" + c.slug,
        priority: "0.7",
      });
    });
  });
  return out;
}

function writeSitemap(products, posts, shops) {
  const urls = [];
  function add(loc, changefreq, priority) {
    urls.push({ loc, changefreq, priority });
  }

  add("/", "daily", "1.0");
  add("/tat-ca-san-pham", "daily", "0.9");
  add("/chia-se", "daily", "0.9");
  add("/danh-sach-san-pham", "weekly", "0.5");
  add("/danh-sach-chia-se", "weekly", "0.5");
  add("/danh-sach-shop", "weekly", "0.5");

  const staticPages = [
    "/gioi-thieu",
    "/faqs",
    "/lien-he",
    "/huong-dan-mua-hang",
    "/nap-tien",
    "/dang-ky-nguoi-ban",
    "/tai-lieu-api",
    "/dieu-khoan-dich-vu",
    "/dieu-khoan-su-dung",
    "/chinh-sach-bao-mat",
    "/chinh-sach-cookies",
    "/chinh-sach-mua-hang",
    "/bao-hanh-va-hoan-tien",
    "/hinh-thuc-thanh-toan",
    "/gdpr",
    "/dmca",
  ];
  staticPages.forEach((p) => add(p, "monthly", "0.5"));

  loadCategoryChildren().forEach((c) => add(c.loc, "daily", c.priority));

  products.forEach((p) =>
    add("/tat-ca-san-pham/" + p.slug + "-" + p.id, "weekly", "0.8")
  );
  posts.forEach((p) => add("/chia-se/" + p.slug, "weekly", "0.7"));
  shops.forEach((s) => {
    if (s.slug) add("/" + s.slug, "weekly", "0.6");
  });

  // dedupe
  const seen = new Set();
  const unique = [];
  for (const u of urls) {
    if (seen.has(u.loc)) continue;
    seen.add(u.loc);
    unique.push(u);
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    unique
      .map((u) => {
        return (
          "  <url>\n" +
          "    <loc>" +
          ORIGIN +
          u.loc +
          "</loc>\n" +
          "    <changefreq>" +
          u.changefreq +
          "</changefreq>\n" +
          "    <priority>" +
          u.priority +
          "</priority>\n" +
          "  </url>"
        );
      })
      .join("\n") +
    "\n</urlset>\n";

  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
  console.log("sitemap.xml urls", unique.length);

  try {
    require("child_process").execFileSync(
      process.execPath,
      [path.join(__dirname, "build-sf-url-exports.js")],
      { stdio: "inherit" }
    );
  } catch (e) {
    console.warn("build-sf-url-exports skipped:", e.message);
  }
}

function patchVercelRewrites() {
  const file = path.join(ROOT, "vercel.json");
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const need = [
    {
      source: "/vi/danh-sach-chia-se",
      destination: "/danh-sach-chia-se",
      permanent: true,
    },
    {
      source: "/vi/danh-sach-chia-se/:path*",
      destination: "/danh-sach-chia-se/:path*",
      permanent: true,
    },
    {
      source: "/vi/danh-sach-shop",
      destination: "/danh-sach-shop",
      permanent: true,
    },
    {
      source: "/vi/danh-sach-shop/:path*",
      destination: "/danh-sach-shop/:path*",
      permanent: true,
    },
  ];
  const rewriteNeed = [
    {
      source: "/danh-sach-chia-se",
      destination: "/vi/danh-sach-chia-se",
    },
    {
      source: "/danh-sach-chia-se/",
      destination: "/vi/danh-sach-chia-se",
    },
    {
      source: "/danh-sach-chia-se/trang-:n",
      destination: "/vi/danh-sach-chia-se/trang-:n",
    },
    {
      source: "/danh-sach-shop",
      destination: "/vi/danh-sach-shop",
    },
    {
      source: "/danh-sach-shop/",
      destination: "/vi/danh-sach-shop",
    },
    {
      source: "/danh-sach-shop/trang-:n",
      destination: "/vi/danh-sach-shop/trang-:n",
    },
  ];
  j.redirects = j.redirects || [];
  j.rewrites = j.rewrites || [];
  for (const r of need) {
    if (!j.redirects.some((x) => x.source === r.source)) j.redirects.push(r);
  }
  for (const r of rewriteNeed) {
    if (!j.rewrites.some((x) => x.source === r.source)) {
      // insert before catch-alls near end — push after danh-sach-san-pham block
      const idx = j.rewrites.findIndex((x) =>
        String(x.source || "").startsWith("/danh-sach-san-pham/trang")
      );
      if (idx >= 0) j.rewrites.splice(idx + 1, 0, r);
      else j.rewrites.push(r);
    }
  }
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
  console.log("vercel.json ok");
}

function patchRobots() {
  const file = path.join(ROOT, "robots.txt");
  const txt =
    "User-agent: *\nAllow: /\n\nSitemap: " +
    ORIGIN +
    "/sitemap.xml\nSitemap: " +
    ORIGIN +
    "/sitemap-index.xml\n";
  fs.writeFileSync(file, txt);
  console.log("robots.txt ok");
}

const products = loadProducts();
const { posts, cats } = loadSharePosts();
const shops = loadShops();

ensureCss();
patchChiaSeJs();
patchAppJsReady();
injectChiaSe(posts, cats);
writeHtmlList(
  "vi/danh-sach-chia-se",
  "/danh-sach-chia-se",
  "Danh sách bài chia sẻ",
  posts,
  (p) => "/chia-se/" + p.slug,
  (p) => p.title,
  100
);
writeHtmlList(
  "vi/danh-sach-shop",
  "/danh-sach-shop",
  "Danh sách gian hàng",
  shops,
  shopHref,
  (s) => s.name || s.slug,
  200
);
injectHomeCrawlHub(posts, shops);
writeSitemap(products, posts, shops);
patchVercelRewrites();
patchRobots();

console.log("done", {
  products: products.length,
  posts: posts.length,
  shops: shops.length,
});
