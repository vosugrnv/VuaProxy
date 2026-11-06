const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PKG_MONTH = {
  share: [10000],
  "dc-single": [8000, 40000],
  pack100: [650000],
  "pack100-dc": [400000]
};

function monthPrices(countryCode, packageKey) {
  const bases = PKG_MONTH[String(packageKey || "")];
  if (!bases) return [];
  const mul = String(countryCode || "").toLowerCase() === "vn" ? 1 : 2;
  return bases.map((n) => n * mul);
}

function prorate(monthPrice, days) {
  const d = Math.max(1, Math.min(3660, Math.round(Number(days) || 30)));
  return Math.round((Number(monthPrice) / 30) * d);
}

let catalogCache = null;
let catalogMtime = 0;

function catalogFile() {
  const candidates = [
    process.env.CATALOG_PATH,
    "/var/www/vuaproxy-web/js/products-data.js",
    path.join(__dirname, "..", "..", "js", "products-data.js")
  ].filter(Boolean);
  return candidates.find((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch (_) {
      return false;
    }
  }) || "";
}

function loadCatalog() {
  const file = catalogFile();
  if (!file) return new Map();
  const st = fs.statSync(file);
  if (catalogCache && catalogMtime === st.mtimeMs) return catalogCache;
  const sandbox = { window: {}, console };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { timeout: 20000, filename: file });
  const list = (sandbox.window && sandbox.window.RAW_PRODUCTS) || [];
  const map = new Map();
  for (const product of list) {
    if (product && product.id != null) map.set(String(product.id), product);
  }
  catalogCache = map;
  catalogMtime = st.mtimeMs;
  return map;
}

function basesFromProduct(product) {
  if (!product) return [];
  const nums = [product.price, product.pricePrivate, product.regular];
  if (Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      if (variant) nums.push(variant.price, variant.regular);
    }
  }
  return nums.map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n > 0);
}

async function lookupDbPrices(queryFn, ids) {
  const clean = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  const out = new Map();
  if (!clean.length || typeof queryFn !== "function") return out;
  try {
    const overrides = await queryFn(
      `SELECT product_id, price_cents FROM product_overrides
       WHERE product_id = ANY($1::text[]) AND price_cents > 0`,
      [clean]
    );
    for (const row of overrides.rows || []) {
      out.set(String(row.product_id), [Number(row.price_cents)]);
    }
  } catch (_) {}
  try {
    const cms = await queryFn(
      `SELECT id, price_cents, regular_cents FROM cms_products WHERE id = ANY($1::text[])`,
      [clean]
    );
    for (const row of cms.rows || []) {
      const id = String(row.id);
      const prices = [Number(row.price_cents), Number(row.regular_cents)].filter((n) => n > 0);
      if (!prices.length) continue;
      out.set(id, (out.get(id) || []).concat(prices));
    }
  } catch (_) {}
  return out;
}

/**
 * Replace client-supplied unit prices with the official 30-day or prorated price.
 * Location lines (country + package) may be prorated by days. Other lines must
 * match the catalog price exactly, so a forged days field cannot cut the price.
 */
async function enforcePrices(queryFn, items) {
  const ids = [];
  for (const item of items) ids.push(item.productId, item.parentId, item.id);
  const dbPrices = await lookupDbPrices(queryFn, ids);
  let catalog = new Map();
  try {
    catalog = loadCatalog();
  } catch (err) {
    console.warn("catalog load", err.message);
  }

  for (const item of items) {
    const keys = [item.productId, item.parentId, item.id]
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    let bases = [];
    for (const key of keys) {
      if (dbPrices.has(key)) bases = bases.concat(dbPrices.get(key));
      bases = bases.concat(basesFromProduct(catalog.get(key)));
    }
    const locationMonths = monthPrices(item.countryCode, item.packageKey);
    const location = locationMonths.length > 0;
    if (location) bases = bases.concat(locationMonths);
    bases = [...new Set(bases.filter((n) => n > 0))];
    if (!bases.length) {
      throw Object.assign(new Error("Không xác định được giá sản phẩm. Tải lại trang rồi đặt lại."), {
        status: 400
      });
    }
    const allowed = location ? bases.map((base) => prorate(base, item.days || 30)) : bases;
    const sent = Math.round(Number(item.price));
    const match = allowed.find((price) => Math.abs(price - sent) <= 1);
    if (!match) {
      throw Object.assign(new Error("Giá đơn không khớp bảng giá. Tải lại trang rồi đặt lại."), {
        status: 400
      });
    }
    item.price = match;
  }
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return { items, total };
}

module.exports = { enforcePrices, monthPrices, prorate, loadCatalog };
