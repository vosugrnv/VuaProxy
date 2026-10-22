const config = require("./config");
const { query, withTransaction } = require("./db");

function parseLines(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function canManageStock(user) {
  const admins = String(process.env.STOCK_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.length) return true; // MVP: mọi user đăng nhập được nhập kho
  return admins.includes(String(user.email || "").toLowerCase());
}

async function countAvailable(productId) {
  const r = await query(
    `SELECT COUNT(*)::int AS n FROM stock_items
     WHERE product_id = $1 AND status = 'available'`,
    [String(productId)]
  );
  return r.rows[0]?.n || 0;
}

/** Public: tồn kho theo product / variant id */
async function getCounts(req, res) {
  try {
    const ids = String(req.query.ids || req.query.productId || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (!ids.length) return res.status(400).json({ error: "Thiếu product id" });
    const r = await query(
      `SELECT product_id, COUNT(*)::int AS available
       FROM stock_items
       WHERE product_id = ANY($1::text[]) AND status = 'available'
       GROUP BY product_id`,
      [ids]
    );
    const map = {};
    ids.forEach((id) => {
      map[id] = 0;
    });
    r.rows.forEach((row) => {
      map[row.product_id] = row.available;
    });
    return res.json({ counts: map });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không lấy tồn kho được" });
  }
}

/** Seller/admin: danh sách nhóm tồn kho */
async function listStock(req, res) {
  try {
    if (!canManageStock(req.user)) {
      return res.status(403).json({ error: "Không có quyền quản lý kho" });
    }
    const r = await query(
      `SELECT product_id,
              COUNT(*) FILTER (WHERE status = 'available')::int AS available,
              COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
              COUNT(*)::int AS total,
              MAX(created_at) AS last_added
       FROM stock_items
       GROUP BY product_id
       ORDER BY available DESC, product_id
       LIMIT 500`
    );
    return res.json({ products: r.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải kho được" });
  }
}

/** Seller/admin: nhập nhiều dòng hàng (mỗi dòng 1 đơn vị giao) */
async function importStock(req, res) {
  try {
    if (!canManageStock(req.user)) {
      return res.status(403).json({ error: "Không có quyền quản lý kho" });
    }
    const productId = String(req.body.productId || req.body.product_id || "").trim();
    const shopToken = String(req.body.shopToken || req.body.shop_token || "").trim();
    const lines = Array.isArray(req.body.lines)
      ? req.body.lines.map((l) => String(l).trim()).filter(Boolean)
      : parseLines(req.body.text || req.body.payload || "");
    if (!productId) return res.status(400).json({ error: "Thiếu mã sản phẩm / biến thể" });
    if (!lines.length) return res.status(400).json({ error: "Chưa có dòng hàng để nhập" });
    if (lines.length > 5000) {
      return res.status(400).json({ error: "Tối đa 5000 dòng mỗi lần nhập" });
    }

    const values = [];
    const params = [];
    let i = 1;
    for (const line of lines) {
      values.push(`($${i++},$${i++},$${i++},'available',$${i++})`);
      params.push(productId, shopToken, line, req.user.id);
    }
    await query(
      `INSERT INTO stock_items (product_id, shop_token, payload, status, created_by)
       VALUES ${values.join(",")}`,
      params
    );
    const available = await countAvailable(productId);
    return res.json({
      ok: true,
      added: lines.length,
      productId,
      available
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không nhập kho được" });
  }
}

/** Preview vài dòng còn (che bớt) — chỉ quản lý kho */
async function previewStock(req, res) {
  try {
    if (!canManageStock(req.user)) {
      return res.status(403).json({ error: "Không có quyền" });
    }
    const productId = String(req.params.productId || "").trim();
    const r = await query(
      `SELECT id, LEFT(payload, 24) AS preview, length(payload) AS len, created_at
       FROM stock_items
       WHERE product_id = $1 AND status = 'available'
       ORDER BY id ASC LIMIT 20`,
      [productId]
    );
    const available = await countAvailable(productId);
    return res.json({ productId, available, items: r.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không xem được" });
  }
}

/** Danh sách đầy đủ dòng tồn (để xem / sửa / xóa) */
async function listItems(req, res) {
  try {
    if (!canManageStock(req.user)) {
      return res.status(403).json({ error: "Không có quyền" });
    }
    const productId = String(req.params.productId || "").trim();
    if (!productId) return res.status(400).json({ error: "Thiếu mã sản phẩm" });
    const status = String(req.query.status || "available").trim() || "available";
    const limit = Math.min(2000, Math.max(1, Number(req.query.limit || 500)));
    const r = await query(
      `SELECT id, payload, status, created_at, sold_at, order_id
       FROM stock_items
       WHERE product_id = $1 AND status = $2
       ORDER BY id ASC
       LIMIT $3`,
      [productId, status, limit]
    );
    const available = await countAvailable(productId);
    return res.json({ productId, status, available, items: r.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải dòng tồn được" });
  }
}

/** Sửa 1 dòng tồn còn lại */
async function updateItem(req, res) {
  try {
    if (!canManageStock(req.user)) {
      return res.status(403).json({ error: "Không có quyền" });
    }
    const id = Number(req.params.id || 0);
    const payload = String(req.body.payload || req.body.text || "").trim();
    if (!id) return res.status(400).json({ error: "Thiếu id dòng tồn" });
    if (!payload) return res.status(400).json({ error: "Nội dung dòng trống" });
    const r = await query(
      `UPDATE stock_items
       SET payload = $1
       WHERE id = $2 AND status = 'available'
       RETURNING id, product_id, payload, status, created_at`,
      [payload, id]
    );
    if (!r.rowCount) {
      return res.status(404).json({ error: "Không tìm thấy dòng tồn còn lại" });
    }
    return res.json({ ok: true, item: r.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không sửa dòng tồn được" });
  }
}

/** Xóa (void) 1 dòng tồn còn lại */
async function deleteItem(req, res) {
  try {
    if (!canManageStock(req.user)) {
      return res.status(403).json({ error: "Không có quyền" });
    }
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ error: "Thiếu id dòng tồn" });
    const r = await query(
      `UPDATE stock_items
       SET status = 'void'
       WHERE id = $1 AND status = 'available'
       RETURNING id, product_id`,
      [id]
    );
    if (!r.rowCount) {
      return res.status(404).json({ error: "Không tìm thấy dòng tồn còn lại" });
    }
    const productId = r.rows[0].product_id;
    const available = await countAvailable(productId);
    return res.json({ ok: true, id, productId, available });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không xóa dòng tồn được" });
  }
}

const PKG_ORDER = ["share", "dc-single", "pack100", "pack100-dc"];
let _locationCodesCache = null;

function loadLocationCodes() {
  if (_locationCodesCache) return _locationCodesCache;
  const fs = require("fs");
  const path = require("path");
  const candidates = [
    path.join(__dirname, "..", "..", "js", "locations-data.js"),
    "/var/www/vuaproxy/js/locations-data.js",
    "/var/www/vuammo/js/locations-data.js"
  ];
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const codes = [...raw.matchAll(/code:\s*"([a-z]{2})"/gi)].map((m) =>
        String(m[1]).toLowerCase()
      );
      if (codes.length) {
        _locationCodesCache = codes;
        return _locationCodesCache;
      }
    } catch (_) {
      /* try next */
    }
  }
  _locationCodesCache = [];
  return _locationCodesCache;
}

function derivePackageProductId(countryCode, packageKey) {
  const cc = String(countryCode || "")
    .trim()
    .toLowerCase();
  const pk = String(packageKey || "").trim();
  if (!cc || !pk) return null;
  const codes = loadLocationCodes();
  let ci = codes.indexOf(cc);
  if (ci < 0) ci = 0;
  let pi = PKG_ORDER.indexOf(pk);
  if (pi < 0) pi = 0;
  return String(820000 + ci * 10 + pi);
}

function parseLcpMeta(id) {
  const s = String(id || "")
    .trim()
    .toLowerCase();
  if (!s.startsWith("lcp-")) return null;
  const rest = s.slice(4);
  for (const pk of ["pack100-dc", "dc-single", "pack100", "share"]) {
    const re = new RegExp("^([a-z]{2})-" + pk.replace(/-/g, "\\-") + "(?:-|$)");
    const m = rest.match(re);
    if (m) return { countryCode: m[1], packageKey: pk };
  }
  return null;
}

function isManualFulfillment(productId) {
  const id = String(productId || "")
    .trim()
    .toLowerCase();
  return id.startsWith("lcp-") || id.startsWith("manual-") || id.startsWith("proxy-loc-");
}

/** Country-package / LCP lines — may fulfill from VPN, stock, or manual note. */
function isLocationProxyItem(it) {
  const id = String(it?.id || "")
    .trim()
    .toLowerCase();
  if (id.startsWith("lcp-") || id.startsWith("proxy-loc-") || id.startsWith("manual-")) return true;
  const pid = String(it?.productId || it?.product_id || "")
    .trim()
    .toLowerCase();
  if (pid.startsWith("lcp-") || pid.startsWith("proxy-loc-")) return true;
  const cc = String(it?.countryCode || it?.country_code || "")
    .trim()
    .toLowerCase();
  const pk = String(it?.packageKey || it?.package_key || "").trim();
  return Boolean(cc && pk);
}

/**
 * Cart lines for location proxies use id like "lcp-vn-..." but stock is keyed by
 * stable numeric productId (820000+). Prefer productId when present.
 * Does NOT derive from country/package (that would force stock on all LCP checkouts).
 */
function resolveStockProductId(it) {
  const pid = String(it?.productId || it?.product_id || "").trim();
  if (pid) return pid;
  return String(it?.id || "").trim();
}

/**
 * Stronger resolver for warranty: prefer numeric productId, else derive from
 * countryCode + packageKey / lcp- id so we can pull real stock credentials.
 */
function resolveWarrantyStockProductId(it) {
  const pid = String(it?.productId || it?.product_id || "").trim();
  if (pid && !isManualFulfillment(pid)) return pid;

  const cc = String(it?.countryCode || it?.country_code || "").trim();
  const pk = String(it?.packageKey || it?.package_key || "").trim();
  if (cc && pk) {
    const derived = derivePackageProductId(cc, pk);
    if (derived) return derived;
  }

  const lineId = String(it?.id || pid || "").trim();
  const parsed = parseLcpMeta(lineId);
  if (parsed) {
    const derived = derivePackageProductId(parsed.countryCode, parsed.packageKey);
    if (derived) return derived;
  }

  if (pid && !isManualFulfillment(pid)) return pid;
  return pid || lineId;
}

/** Strip internal notes from lines shown to customers. */
function sanitizeCustomerLines(lines) {
  return (lines || [])
    .map((l) => String(l || "").trim())
    .filter(Boolean)
    .filter((l) => {
      const low = l.toLowerCase();
      if (/^mã\s*đơn\s*nội\s*bộ/i.test(l)) return false;
      if (/^ma\s*don\s*noi\s*bo/i.test(low)) return false;
      if (/internal\s*(order|id|note)/i.test(low)) return false;
      if (/^note\s*nội\s*bộ/i.test(l)) return false;
      if (/order_id\s*[:=]/i.test(low)) return false;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(l)) {
        return false;
      }
      return true;
    });
}

/**
 * Customer-facing warranty / delivery text — no internal IDs, clear line breaks,
 * quantity as words, no duplicated product title.
 */
function formatCustomerDeliveryNote(opts) {
  const warrantyCode = String(opts.warrantyCode || "").trim();
  const baseCode = String(opts.baseCode || "").trim();
  const delivered = Array.isArray(opts.delivered) ? opts.delivered : [];
  const when =
    opts.when || new Date().toLocaleString("vi-VN", { hour12: false });

  const blocks = delivered.map((b) => {
    const name = String(b.name || b.productId || "Sản phẩm").trim();
    const qty = Math.max(1, Math.round(Number(b.qty || 1)));
    const rawLines = sanitizeCustomerLines(b.lines || []);
    const uniq = [];
    const seen = new Set();
    for (const line of rawLines) {
      const norm = line.replace(/\s+/g, " ").trim();
      const low = norm.toLowerCase();
      if (low === name.toLowerCase()) continue;
      if (/^(số\s*lượng|so\s*luong)\s*[:=]?\s*\d+$/i.test(norm)) continue;
      if (/^[×x]\s*\d+$/i.test(norm)) continue;
      if (/đơn proxy khu vực/i.test(norm)) continue;
      if (/giao thủ công/i.test(norm)) continue;
      const withoutX = norm.replace(/\s*[·•]\s*[×x]\d+\b/gi, "").trim();
      const key = withoutX.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(withoutX || norm);
    }

    let block = "Sản phẩm: " + name + "\n" + "Số lượng: " + qty;
    if (uniq.length) {
      block += "\n\nThông tin proxy:\n" + uniq.join("\n");
    } else {
      block += "\n\n(Đang chuẩn bị thông tin proxy — hỗ trợ sẽ gửi sớm.)";
    }
    return block;
  });

  const head = warrantyCode
    ? "BẢO HÀNH #" +
      warrantyCode +
      (baseCode ? "\nĐơn gốc: #" + baseCode : "") +
      "\nThời gian: " +
      when
    : "Giao hàng Vua Proxy\nThời gian: " + when;

  return head + (blocks.length ? "\n\n" + blocks.join("\n\n") : "");
}

/**
 * Allocate stock inside an open transaction client.
 * Returns delivery blocks [{ productId, name, qty, lines }]
 * options.requireRealStock — warranty path: never send manual placeholders
 */
async function allocateForItems(client, orderId, items, options) {
  const requireRealStock = !!(options && options.requireRealStock);
  const delivered = [];
  for (const it of items) {
    const lineId = String(it.id || "").trim();
    const productId = requireRealStock
      ? resolveWarrantyStockProductId(it)
      : resolveStockProductId(it);
    const qty = Math.max(1, Math.round(Number(it.qty || 1)));
    if (!productId) {
      const err = new Error("Thiếu mã sản phẩm trong giỏ");
      err.status = 400;
      throw err;
    }

    if (isManualFulfillment(productId)) {
      if (requireRealStock) {
        const err = new Error(
          "Sản phẩm chưa gắn mã kho (giao tay). Nhập tồn kho theo mã sản phẩm số trước khi bảo hành."
        );
        err.status = 409;
        throw err;
      }
      delivered.push({
        productId,
        lineId: lineId || productId,
        name: it.name || productId,
        qty,
        lines: ["Đơn proxy khu vực — giao thủ công / qua hệ thống proxy.", "Số lượng: " + qty]
      });
      continue;
    }

    const pick = await client.query(
      `SELECT id, payload FROM stock_items
       WHERE product_id = $1 AND status = 'available'
       ORDER BY id ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [productId, qty]
    );
    if (pick.rows.length < qty) {
      if (!requireRealStock && isLocationProxyItem(it)) {
        delivered.push({
          productId,
          lineId: lineId || productId,
          name: it.name || productId,
          qty,
          lines: [
            "Đơn proxy khu vực — giao thủ công / qua hệ thống proxy.",
            "Số lượng: " + qty
          ]
        });
        continue;
      }
      const err = new Error(
        `Hết hàng hoặc thiếu tồn kho cho mã #${productId} (cần ${qty}, còn ${pick.rows.length}). Vui lòng nhập kho trước.`
      );
      err.status = 409;
      throw err;
    }
    const ids = pick.rows.map((r) => r.id);
    await client.query(
      `UPDATE stock_items
       SET status = 'sold', order_id = $1, sold_at = NOW()
       WHERE id = ANY($2::bigint[])`,
      [orderId, ids]
    );
    delivered.push({
      productId,
      lineId: lineId || productId,
      name: it.name || productId,
      qty,
      lines: pick.rows.map((r) => r.payload)
    });
  }
  return delivered;
}

module.exports = {
  getCounts,
  listStock,
  importStock,
  previewStock,
  listItems,
  updateItem,
  deleteItem,
  allocateForItems,
  isManualFulfillment,
  isLocationProxyItem,
  resolveStockProductId,
  resolveWarrantyStockProductId,
  parseLcpMeta,
  formatCustomerDeliveryNote,
  sanitizeCustomerLines,
  canManageStock,
  countAvailable
};
