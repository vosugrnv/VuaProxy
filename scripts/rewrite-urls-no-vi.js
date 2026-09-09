/**
 * Rewrite site URLs:
 * - /vi/... → without /vi
 * - ?cat=slug → /tat-ca-san-pham/parent[/child]
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

function loadTaxonomy() {
  const js = fs.readFileSync(path.join(ROOT, "js/category-taxonomy.js"), "utf8");
  const m = js.match(/CATEGORY_TAXONOMY\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!m) throw new Error("taxonomy not found");
  return eval("(" + m[1] + ")");
}

const CHILD_SLUG_ALIASES = {
  "game::game": "tai-khoan-game",
  "khoa-hoc::khoa-hoc": "khoa-hoc-tong-hop"
};

function leafSlug(parentSlug, title, preferredSlug) {
  let slug =
    preferredSlug ||
    String(title || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const alias = CHILD_SLUG_ALIASES[parentSlug + "::" + slug];
  if (alias) return alias;
  if (slug === parentSlug) return slug + "-con";
  return slug;
}

function buildCatMap(tax) {
  const map = new Map();
  const parentSlugs = new Set((tax.parents || []).map((p) => p.slug));
  for (const parent of tax.parents || []) {
    map.set(parent.slug, "/tat-ca-san-pham/" + parent.slug);
    for (const child of parent.children || []) {
      const cs = leafSlug(parent.slug, child.title, child.slug);
      map.set(cs, "/tat-ca-san-pham/" + parent.slug + "/" + cs);
      if (child.slug && child.slug !== cs && !parentSlugs.has(child.slug)) {
        map.set(child.slug, "/tat-ca-san-pham/" + parent.slug + "/" + cs);
      }
    }
  }
  map.set("khac", "/tat-ca-san-pham/tai-khoan-cong-cu-ai/tai-khoan-khac");
  map.set("all", "/tat-ca-san-pham");
  return map;
}

const tax = loadTaxonomy();
const catMap = buildCatMap(tax);

function rewriteCatQuery(html) {
  return html.replace(
    /(?:\/)?tat-ca-san-pham(?:\.html)?\?cat=([a-z0-9-]+)/gi,
    (full, slug) => {
      const pretty = catMap.get(slug) || "/tat-ca-san-pham/" + slug;
      return pretty;
    }
  );
}

function stripVi(html) {
  return html
    .replace(/\/vi\/tat-ca-san-pham/g, "/tat-ca-san-pham")
    .replace(/\/vi\/chia-se/g, "/chia-se")
    .replace(/\/vi\/danh-sach-san-pham/g, "/danh-sach-san-pham")
    .replace(/https:\/\/vuammo\.com\/vi\//g, "https://vuammovn.pro/")
    .replace(/https:\/\/vuammovn\.pro\/vi\//g, "https://vuammovn.pro/");
}

function walk(dir, exts, fn) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "api") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, exts, fn);
    else if (exts.some((e) => name.endsWith(e))) fn(full);
  }
}

let files = 0;
let changed = 0;
walk(
  ROOT,
  [".html", ".js", ".xml", ".txt"],
  (file) => {
    // skip huge generated product bodies partially — still update canonicals
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    if (rel === "vercel.json") return;
    if (rel.startsWith("scripts/") && !rel.endsWith("rewrite-urls-no-vi.js")) {
      // still update generate scripts that emit /vi paths
    }
    if (rel.startsWith("scripts/") && rel.includes("inject-static")) return;
    let raw = fs.readFileSync(file, "utf8");
    if (!raw.includes("/vi/") && !/[?&]cat=/.test(raw) && !raw.includes("tat-ca-san-pham.html?cat")) {
      return;
    }
    files++;
    let next = stripVi(rewriteCatQuery(raw));
    // also rewrite relative tat-ca-san-pham.html?cat=
    next = next.replace(
      /tat-ca-san-pham\.html\?cat=([a-z0-9-]+)/gi,
      (_, slug) => (catMap.get(slug) || "/tat-ca-san-pham/" + slug).replace(/^\//, "")
    );
    if (next !== raw) {
      fs.writeFileSync(file, next);
      changed++;
    }
  }
);

console.log("scanned with matches", files, "written", changed);
console.log("sample", catMap.get("capcut"), catMap.get("tai-khoan-cong-cu-ai"), catMap.get("game"));
