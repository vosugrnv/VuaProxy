const config = require("./config");
const { query, withTransaction } = require("./db");
const stock = require("./stock");

function isAdmin(user) {
  if (!user?.email) return false;
  if (!config.adminEmails.length) return true; // MVP: mọi user đăng nhập vào được admin nếu chưa cấu hình
  return config.adminEmails.includes(String(user.email).toLowerCase());
}

function adminRequired(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: "Cần tài khoản admin" });
  }
  next();
}

async function dashboard(req, res) {
  try {
    const [orders, revenue, topups, users, stockAvail, openDisputes] = await Promise.all([
      query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total_cents),0)::bigint AS sum FROM orders`),
      query(
        `SELECT COALESCE(SUM(ABS(amount_cents)),0)::bigint AS sum
         FROM wallet_ledger WHERE type = 'purchase'`
      ),
      query(
        `SELECT COALESCE(SUM(amount_cents),0)::bigint AS sum
         FROM topups WHERE status = 'paid'`
      ),
      query(`SELECT COUNT(*)::int AS n FROM users`),
      query(`SELECT COUNT(*)::int AS n FROM stock_items WHERE status = 'available'`),
      query(`SELECT COUNT(*)::int AS n FROM order_disputes WHERE status = 'open'`)
    ]);
    const recent = await query(
      `SELECT id, public_code, total_cents, status, created_at, items_json
       FROM orders ORDER BY created_at DESC LIMIT 8`
    );
    return res.json({
      stats: {
        orders: orders.rows[0].n,
        orderRevenue: Number(orders.rows[0].sum),
        purchaseVolume: Number(revenue.rows[0].sum),
        topupVolume: Number(topups.rows[0].sum),
        users: users.rows[0].n,
        stockAvailable: stockAvail.rows[0].n,
        openDisputes: openDisputes.rows[0].n,
        payosMock: config.payos.mock
      },
      recentOrders: recent.rows.map((r) => ({
        id: r.id,
        code: r.public_code || String(r.id).replace(/-/g, "").slice(0, 10).toUpperCase(),
        total: Number(r.total_cents),
        status: r.status,
        createdAt: r.created_at,
        items: r.items_json
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải dashboard" });
  }
}

async function listOrders(req, res) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim().toLowerCase();
    const range = String(req.query.range || "").trim(); // today|7d|30d|all
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    const counts = await query(
      `SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status`
    );
    const countMap = { all: 0 };
    counts.rows.forEach((r) => {
      countMap[r.status] = r.n;
      countMap.all += r.n;
    });

    const params = [];
    const where = [];
    if (status && status !== "all") {
      params.push(status);
      where.push(`o.status = $${params.length}`);
    }
    if (q) {
      params.push("%" + q + "%");
      where.push(
        `(lower(u.email) LIKE $${params.length} OR lower(COALESCE(u.name,'')) LIKE $${params.length} OR CAST(o.id AS text) LIKE $${params.length} OR lower(COALESCE(o.public_code,'')) LIKE $${params.length})`
      );
    }
    if (from) {
      params.push(from);
      where.push(`o.created_at >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      where.push(`o.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (!from && !to && range === "today") {
      where.push(`o.created_at >= date_trunc('day', NOW())`);
    } else if (!from && !to && range === "7d") {
      where.push(`o.created_at >= NOW() - INTERVAL '7 days'`);
    } else if (!from && !to && range === "30d") {
      where.push(`o.created_at >= NOW() - INTERVAL '30 days'`);
    }
    params.push(limit);
    const sql =
      `SELECT o.id, o.public_code, o.buyer_id, u.email AS buyer_email, u.name AS buyer_name,
              o.items_json, o.total_cents, o.status, o.delivery_note, o.delivery_payload,
              o.hold_until, o.created_at, o.released_at,
              d.status AS dispute_status, d.reason AS dispute_reason
       FROM orders o
       JOIN users u ON u.id = o.buyer_id
       LEFT JOIN order_disputes d ON d.order_id = o.id` +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      ` ORDER BY o.created_at DESC LIMIT $${params.length}`;
    const r = await query(sql, params);
    return res.json({
      counts: countMap,
      orders: r.rows.map((row) => ({
        id: row.id,
        code: row.public_code || String(row.id).replace(/-/g, "").slice(0, 10).toUpperCase(),
        buyerId: row.buyer_id,
        buyerEmail: row.buyer_email,
        buyerName: row.buyer_name,
        items: row.items_json,
        total: Number(row.total_cents),
        status: row.status,
        deliveryNote: row.delivery_note,
        delivery: row.delivery_payload,
        holdUntil: row.hold_until,
        createdAt: row.created_at,
        releasedAt: row.released_at,
        dispute: row.dispute_status
          ? { status: row.dispute_status, reason: row.dispute_reason }
          : null
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải đơn" });
  }
}

async function refundOrderToBuyer(client, order, byEmail, note) {
  const amount = Math.round(Number(order.total_cents) || 0);
  if (amount <= 0) return { refunded: false, refundCents: 0 };

  const already = await client.query(
    `SELECT 1 FROM wallet_ledger
     WHERE user_id = $1 AND type = 'refund' AND ref_id = $2
     LIMIT 1`,
    [order.buyer_id, order.id]
  );
  if (already.rowCount) return { refunded: false, refundCents: 0, already: true };

  const u = await client.query(
    `SELECT balance_cents FROM users WHERE id = $1 FOR UPDATE`,
    [order.buyer_id]
  );
  if (!u.rows[0]) {
    const err = new Error("Không tìm thấy khách để hoàn tiền");
    err.status = 404;
    throw err;
  }
  const next = Number(u.rows[0].balance_cents) + amount;
  await client.query(`UPDATE users SET balance_cents = $1 WHERE id = $2`, [
    next,
    order.buyer_id
  ]);
  await client.query(
    `INSERT INTO wallet_ledger (user_id, type, amount_cents, ref_id, meta)
     VALUES ($1,'refund',$2,$3,$4)`,
    [
      order.buyer_id,
      amount,
      order.id,
      JSON.stringify({
        orderCode: order.public_code || "",
        by: byEmail || "",
        note: note || "Hoàn tiền"
      })
    ]
  );
  return { refunded: true, refundCents: amount, balance: next };
}

async function updateOrderStatus(req, res) {
  try {
    const status = String(req.body.status || "").trim();
    const allowed = ["paid", "delivered", "disputed", "released", "refunded"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }
    const result = await withTransaction(async (client) => {
      const cur = await client.query(
        `SELECT id, buyer_id, total_cents, status, public_code
         FROM orders WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      if (!cur.rows[0]) {
        const err = new Error("Không tìm thấy đơn");
        err.status = 404;
        throw err;
      }
      const order = cur.rows[0];
      if (order.status === "refunded" && status !== "refunded") {
        const err = new Error("Đơn đã hoàn tiền, không đổi trạng thái khác");
        err.status = 400;
        throw err;
      }
      if (order.status === "released" && status === "refunded") {
        const err = new Error("Đơn đã giải ngân, không hoàn được");
        err.status = 400;
        throw err;
      }

      await client.query(
        `UPDATE orders SET status = $1,
            released_at = CASE WHEN $1 = 'released' THEN COALESCE(released_at, NOW()) ELSE released_at END
         WHERE id = $2`,
        [status, order.id]
      );

      let refundInfo = { refunded: false, refundCents: 0 };
      if (status === "refunded" && order.status !== "refunded") {
        refundInfo = await refundOrderToBuyer(
          client,
          order,
          req.user.email,
          "Hoàn tiền đơn hàng (admin)"
        );
        await client.query(
          `UPDATE order_disputes SET status = 'resolved'
           WHERE order_id = $1 AND status = 'open'`,
          [order.id]
        );
      }
      return {
        order: { id: order.id, status },
        ...refundInfo
      };
    });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ error: err.message || "Không cập nhật đơn" });
  }
}

async function listUsers(req, res) {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const r = await query(
      `SELECT id, email, name, balance_cents, created_at
       FROM users
       WHERE ($1 = '' OR lower(email) LIKE '%'||$1||'%' OR lower(COALESCE(name,'')) LIKE '%'||$1||'%' OR CAST(id AS text) LIKE '%'||$1||'%')
       ORDER BY created_at DESC
       LIMIT 200`,
      [q]
    );
    const sum = await query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(balance_cents),0)::bigint AS bal FROM users`);
    return res.json({
      stats: {
        users: sum.rows[0].n,
        totalBalance: Number(sum.rows[0].bal)
      },
      users: r.rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        balance: Number(u.balance_cents),
        createdAt: u.created_at,
        updatedAt: u.created_at,
        isAdmin: isAdmin({ email: u.email })
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải users" });
  }
}

async function creditWallet(req, res) {
  try {
    const userId = req.params.id;
    const amount = Math.round(Number(req.body.amount || 0));
    const note = String(req.body.note || "Admin nạp ví").slice(0, 200);
    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ error: "Số tiền không hợp lệ" });
    }
    if (Math.abs(amount) > 50_000_000) {
      return res.status(400).json({ error: "Vượt hạn mức 50.000.000₫" });
    }
    const result = await withTransaction(async (client) => {
      const u = await client.query(
        `SELECT id, balance_cents, email FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (!u.rows[0]) {
        const err = new Error("Không tìm thấy user");
        err.status = 404;
        throw err;
      }
      const next = Number(u.rows[0].balance_cents) + amount;
      if (next < 0) {
        const err = new Error("Số dư không đủ để trừ");
        err.status = 400;
        throw err;
      }
      await client.query(`UPDATE users SET balance_cents = $1 WHERE id = $2`, [next, userId]);
      await client.query(
        `INSERT INTO wallet_ledger (user_id, type, amount_cents, ref_id, meta)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          userId,
          amount >= 0 ? "topup" : "refund",
          amount,
          "admin",
          JSON.stringify({ by: req.user.email, note })
        ]
      );
      return { email: u.rows[0].email, balance: next };
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ error: err.message || "Không cộng ví được" });
  }
}

async function listLedger(req, res) {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const type = String(req.query.type || "").trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const params = [];
    const where = [];
    if (q) {
      params.push("%" + q + "%");
      where.push(
        `(lower(u.email) LIKE $${params.length} OR lower(COALESCE(u.name,'')) LIKE $${params.length} OR CAST(l.id AS text) LIKE $${params.length} OR lower(COALESCE(l.ref_id,'')) LIKE $${params.length})`
      );
    }
    if (type && type !== "all") {
      params.push(type);
      where.push(`l.type = $${params.length}`);
    }
    params.push(limit);
    const r = await query(
      `SELECT l.id, l.type, l.amount_cents, l.ref_id, l.meta, l.created_at,
              u.email, u.name, u.balance_cents
       FROM wallet_ledger l
       JOIN users u ON u.id = l.user_id` +
        (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
        ` ORDER BY l.created_at DESC LIMIT $${params.length}`,
      params
    );
    const items = r.rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount_cents),
      refId: row.ref_id,
      meta: row.meta,
      createdAt: row.created_at,
      email: row.email,
      name: row.name,
      balanceAfter: Number(row.balance_cents)
    }));
    const pageIn = items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0);
    const pageOut = items.filter((i) => i.amount < 0).reduce((s, i) => s + Math.abs(i.amount), 0);
    return res.json({
      items,
      pageStats: {
        creditCount: items.filter((i) => i.amount > 0).length,
        creditSum: pageIn,
        debitSum: pageOut,
        total: items.length
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải giao dịch ví" });
  }
}

async function listDisputes(req, res) {
  try {
    const status = String(req.query.status || "all").trim();
    const q = String(req.query.q || "").trim().toLowerCase();
    const params = [];
    const where = [];
    if (status && status !== "all") {
      params.push(status);
      where.push(`d.status = $${params.length}`);
    }
    if (q) {
      params.push("%" + q + "%");
      where.push(
        `(lower(COALESCE(d.reason,'')) LIKE $${params.length} OR lower(u.email) LIKE $${params.length} OR CAST(o.id AS text) LIKE $${params.length})`
      );
    }
    const counts = await query(
      `SELECT status, COUNT(*)::int AS n FROM order_disputes GROUP BY status`
    );
    const countMap = { all: 0, open: 0, resolved: 0, rejected: 0 };
    counts.rows.forEach((r) => {
      countMap[r.status] = r.n;
      countMap.all += r.n;
    });
    const r = await query(
      `SELECT d.id, d.order_id, d.reason, d.status, d.created_at,
              o.total_cents, o.status AS order_status, o.public_code,
              u.email, u.name
       FROM order_disputes d
       JOIN orders o ON o.id = d.order_id
       JOIN users u ON u.id = o.buyer_id` +
        (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
        ` ORDER BY d.created_at DESC LIMIT 100`,
      params
    );
    return res.json({
      counts: countMap,
      disputes: r.rows.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        orderCode:
          row.public_code || String(row.order_id).replace(/-/g, "").slice(0, 10).toUpperCase(),
        reason: row.reason,
        status: row.status,
        createdAt: row.created_at,
        total: Number(row.total_cents),
        orderStatus: row.order_status,
        email: row.email,
        name: row.name
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải khiếu nại" });
  }
}

async function updateDispute(req, res) {
  try {
    const status = String(req.body.status || "").trim();
    if (!["open", "resolved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }
    const result = await withTransaction(async (client) => {
      const r = await client.query(
        `SELECT id, status, order_id FROM order_disputes WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      if (!r.rows[0]) {
        const err = new Error("Không tìm thấy khiếu nại");
        err.status = 404;
        throw err;
      }
      const dispute = r.rows[0];
      if (dispute.status !== "open" && status !== dispute.status) {
        const err = new Error("Khiếu nại đã được xử lý");
        err.status = 400;
        throw err;
      }

      await client.query(`UPDATE order_disputes SET status = $1 WHERE id = $2`, [
        status,
        dispute.id
      ]);

      let refunded = false;
      let refundCents = 0;

      const ord = await client.query(
        `SELECT id, buyer_id, total_cents, status, public_code
         FROM orders WHERE id = $1 FOR UPDATE`,
        [dispute.order_id]
      );
      const order = ord.rows[0];
      if (!order) {
        const err = new Error("Không tìm thấy đơn của khiếu nại");
        err.status = 404;
        throw err;
      }

      if (status === "resolved") {
        // Hoàn tiền: luôn set refunded + cộng ví (idempotent)
        if (order.status !== "refunded") {
          await client.query(`UPDATE orders SET status = 'refunded' WHERE id = $1`, [order.id]);
        }
        const info = await refundOrderToBuyer(
          client,
          order,
          req.user.email,
          "Hoàn tiền khiếu nại"
        );
        refunded = !!info.refunded || !!info.already;
        refundCents = info.refundCents || Math.round(Number(order.total_cents) || 0);
      } else if (status === "rejected") {
        // Từ chối KN: giữ hold — đơn về delivered, KN = rejected (UI hiện "Từ chối KN")
        if (order.status === "disputed") {
          await client.query(`UPDATE orders SET status = 'delivered' WHERE id = $1`, [
            order.id
          ]);
        }
      }

      return {
        dispute: { id: dispute.id, status, order_id: dispute.order_id },
        refunded,
        refundCents,
        orderStatus:
          status === "resolved"
            ? "refunded"
            : status === "rejected"
              ? "rejected"
              : order.status
      };
    });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ error: err.message || "Không cập nhật khiếu nại" });
  }
}

async function voidStock(req, res) {
  try {
    const productId = String(req.body.productId || "").trim();
    const limit = Math.min(5000, Math.max(1, Number(req.body.count || 0)));
    if (!productId || !limit) {
      return res.status(400).json({ error: "Thiếu productId / count" });
    }
    const r = await query(
      `WITH doomed AS (
         SELECT id FROM stock_items
         WHERE product_id = $1 AND status = 'available'
         ORDER BY id ASC LIMIT $2
       )
       UPDATE stock_items s SET status = 'void'
       FROM doomed d WHERE s.id = d.id
       RETURNING s.id`,
      [productId, limit]
    );
    const available = await stock.countAvailable(productId);
    return res.json({ voided: r.rowCount, available, productId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không xóa tồn được" });
  }
}

async function upsertShop(req, res) {
  try {
    const token = String(req.body.token || req.params.token || "").trim();
    if (!token) return res.status(400).json({ error: "Thiếu token shop" });
    const name = req.body.name != null ? String(req.body.name).trim() : null;
    const city = req.body.city != null ? String(req.body.city).trim() : null;
    const district = req.body.district != null ? String(req.body.district).trim() : null;
    const bio = req.body.bio != null ? String(req.body.bio).trim() : null;
    const rating = req.body.rating != null ? Number(req.body.rating) : null;
    const joinedYear = req.body.joinedYear != null ? Number(req.body.joinedYear) : null;
    const active = req.body.active != null ? Boolean(req.body.active) : true;
    await query(
      `INSERT INTO shop_overrides (token, name, city, district, bio, rating, joined_year, active, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (token) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, shop_overrides.name),
         city = COALESCE(EXCLUDED.city, shop_overrides.city),
         district = COALESCE(EXCLUDED.district, shop_overrides.district),
         bio = COALESCE(EXCLUDED.bio, shop_overrides.bio),
         rating = COALESCE(EXCLUDED.rating, shop_overrides.rating),
         joined_year = COALESCE(EXCLUDED.joined_year, shop_overrides.joined_year),
         active = EXCLUDED.active,
         updated_at = NOW()`,
      [token, name, city, district, bio, rating, joinedYear, active]
    );
    const r = await query(`SELECT * FROM shop_overrides WHERE token = $1`, [token]);
    return res.json({ shop: r.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không lưu shop" });
  }
}

async function listShopOverrides(req, res) {
  const r = await query(`SELECT * FROM shop_overrides ORDER BY updated_at DESC`);
  return res.json({ overrides: r.rows });
}

async function deleteShopOverride(req, res) {
  await query(`DELETE FROM shop_overrides WHERE token = $1`, [req.params.token]);
  return res.json({ ok: true });
}

async function upsertProduct(req, res) {
  try {
    const productId = String(req.body.productId || req.params.id || "").trim();
    if (!productId) return res.status(400).json({ error: "Thiếu product id" });
    const name = req.body.name != null ? String(req.body.name).trim() : null;
    const price = req.body.price != null ? Math.round(Number(req.body.price)) : null;
    const active = req.body.active != null ? Boolean(req.body.active) : true;
    const note = req.body.note != null ? String(req.body.note).slice(0, 500) : "";
    await query(
      `INSERT INTO product_overrides (product_id, name, price_cents, active, note, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (product_id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, product_overrides.name),
         price_cents = COALESCE(EXCLUDED.price_cents, product_overrides.price_cents),
         active = EXCLUDED.active,
         note = EXCLUDED.note,
         updated_at = NOW()`,
      [productId, name, price, active, note]
    );
    const r = await query(`SELECT * FROM product_overrides WHERE product_id = $1`, [productId]);
    return res.json({ product: r.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không lưu sản phẩm" });
  }
}

async function listProductOverrides(_req, res) {
  const r = await query(`SELECT * FROM product_overrides ORDER BY updated_at DESC`);
  return res.json({ overrides: r.rows });
}

async function deleteProductOverride(req, res) {
  await query(`DELETE FROM product_overrides WHERE product_id = $1`, [req.params.id]);
  return res.json({ ok: true });
}

/* ---- Chat ---- */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const CHAT_UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/vuammo/uploads";

function ensureChatUploadDir() {
  try {
    fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
  } catch (_) {}
}

async function uploadChatFile(req, res) {
  try {
    ensureChatUploadDir();
    const raw = String(req.body.data || "");
    const nameHint = String(req.body.filename || "file.bin").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const m = raw.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: "Thiếu data URL base64" });
    const mime = String(m[1] || "").toLowerCase();
    const allowed =
      /^image\/(jpeg|jpg|png|webp|gif)$/.test(mime) ||
      mime === "application/pdf" ||
      mime === "application/zip" ||
      mime === "application/x-zip-compressed" ||
      mime === "application/msword" ||
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "text/plain" ||
      mime === "application/vnd.rar" ||
      mime === "application/x-rar-compressed";
    if (!allowed) {
      return res.status(400).json({ error: "Chỉ nhận ảnh, PDF, ZIP, DOC, TXT (tối đa 6MB)" });
    }
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 6 * 1024 * 1024) {
      return res.status(400).json({ error: "File tối đa 6MB" });
    }
    const ext =
      mime.includes("png")
        ? ".png"
        : mime.includes("webp")
          ? ".webp"
          : mime.includes("gif")
            ? ".gif"
            : mime.includes("jpeg") || mime.includes("jpg")
              ? ".jpg"
              : mime.includes("pdf")
                ? ".pdf"
                : mime.includes("zip")
                  ? ".zip"
                  : mime.includes("wordprocessingml")
                    ? ".docx"
                    : mime.includes("msword")
                      ? ".doc"
                      : mime.includes("plain")
                        ? ".txt"
                        : mime.includes("rar")
                          ? ".rar"
                          : path.extname(nameHint) || ".bin";
    const file = "chat-" + Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex") + ext;
    fs.writeFileSync(path.join(CHAT_UPLOAD_DIR, file), buf);
    return res.json({
      ok: true,
      url: "/uploads/" + file,
      mime,
      name: nameHint,
      size: buf.length
    });
  } catch (err) {
    console.error("uploadChatFile", err);
    return res.status(500).json({ error: "Upload thất bại" });
  }
}

async function postChatMessage(req, res) {
  try {
    const roomId = String(req.body.roomId || "").trim();
    const channel = String(req.body.channel || "").trim();
    const visitorKey = String(req.body.visitorKey || "").trim().slice(0, 80);
    const body = String(req.body.body || "").trim().slice(0, 4000);
    const role = String(req.body.role || "user").trim();
    const shopToken = String(req.body.shopToken || "").trim();
    const shopName = String(req.body.shopName || "").trim().slice(0, 120);
    const attachmentUrl = String(req.body.attachmentUrl || req.body.attachment_url || "")
      .trim()
      .slice(0, 500);
    const attachmentName = String(req.body.attachmentName || req.body.attachment_name || "")
      .trim()
      .slice(0, 180);
    const attachmentMime = String(req.body.attachmentMime || req.body.attachment_mime || "")
      .trim()
      .slice(0, 120);
    if (!roomId || !visitorKey || (!body && !attachmentUrl)) {
      return res.status(400).json({ error: "Thiếu room/visitor/nội dung" });
    }
    if (attachmentUrl && !/^\/uploads\/[a-zA-Z0-9._-]+$/.test(attachmentUrl)) {
      return res.status(400).json({ error: "attachmentUrl không hợp lệ" });
    }
    if (!["support", "shop"].includes(channel)) {
      return res.status(400).json({ error: "channel phải là support|shop" });
    }
    if (!["user", "support", "shop", "admin"].includes(role)) {
      return res.status(400).json({ error: "role không hợp lệ" });
    }
    let userId = null;
    let finalRole = "user";
    if (req.user) {
      userId = req.user.id;
      if (["support", "shop", "admin"].includes(role) && isAdmin(req.user)) {
        finalRole = role === "shop" ? "shop" : role === "admin" ? "admin" : "support";
      } else {
        finalRole = "user";
      }
    }
    const textBody = body || (attachmentUrl ? "[Đã gửi tệp đính kèm]" : "");
    const r = await query(
      `INSERT INTO chat_messages
         (room_id, channel, shop_token, shop_name, visitor_key, user_id, role, body,
          attachment_url, attachment_name, attachment_mime)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, room_id, channel, shop_token, shop_name, visitor_key, role, body,
                 attachment_url, attachment_name, attachment_mime, created_at`,
      [
        roomId,
        channel,
        shopToken,
        shopName,
        visitorKey,
        userId,
        finalRole,
        textBody,
        attachmentUrl,
        attachmentName,
        attachmentMime
      ]
    );
    return res.json({ message: r.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không gửi chat" });
  }
}

async function listChatMessages(req, res) {
  try {
    const roomId = String(req.query.roomId || "").trim();
    const visitorKey = String(req.query.visitorKey || "").trim();
    if (!roomId || !visitorKey) {
      return res.status(400).json({ error: "Thiếu roomId/visitorKey" });
    }
    const cols =
      "id, room_id, channel, shop_token, shop_name, visitor_key, role, body, attachment_url, attachment_name, attachment_mime, created_at";
    let r;
    if (req.user && req.user.id) {
      r = await query(
        `SELECT ${cols}
         FROM chat_messages
         WHERE room_id = $1 AND (visitor_key = $2 OR user_id = $3)
         ORDER BY created_at ASC
         LIMIT 300`,
        [roomId, visitorKey, req.user.id]
      );
    } else {
      r = await query(
        `SELECT ${cols}
         FROM chat_messages
         WHERE room_id = $1 AND visitor_key = $2
         ORDER BY created_at ASC
         LIMIT 300`,
        [roomId, visitorKey]
      );
    }
    return res.json({ messages: r.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải chat" });
  }
}

async function listMyChatThreads(req, res) {
  try {
    const visitorKey = String(req.query.visitorKey || "").trim().slice(0, 80);
    const params = [req.user.id];
    let where = "user_id = $1";
    if (visitorKey) {
      params.push(visitorKey);
      where = "(user_id = $1 OR visitor_key = $2)";
    }
    const readerId = String(req.user.id);
    const r = await query(
      `SELECT room_id AS "roomId",
              MAX(channel) AS channel,
              MAX(shop_token) AS "shopToken",
              MAX(shop_name) AS "shopName",
              COUNT(*)::int AS "msgCount",
              MAX(created_at) AS "lastAt",
              (ARRAY_AGG(body ORDER BY created_at DESC))[1] AS "lastBody",
              (ARRAY_AGG(role ORDER BY created_at DESC))[1] AS "lastRole",
              MAX(visitor_key) AS "visitorKey"
       FROM chat_messages
       WHERE ${where}
       GROUP BY room_id
       ORDER BY "lastAt" DESC
       LIMIT 100`,
      params
    );
    const reads = await query(
      `SELECT room_id, visitor_key, last_read_at
       FROM chat_reads
       WHERE reader_role = 'user' AND reader_id = $1`,
      [readerId]
    );
    const readMap = {};
    reads.rows.forEach((row) => {
      readMap[row.room_id + "|" + row.visitor_key] = new Date(row.last_read_at).getTime();
    });
    const threads = r.rows.map((row) => {
      const vk = row.visitorKey || visitorKey || "";
      const lastAt = row.lastAt ? new Date(row.lastAt).getTime() : 0;
      const readAt = readMap[row.roomId + "|" + vk] || 0;
      const lastRole = row.lastRole || "";
      const unread = lastRole && lastRole !== "user" && lastAt > readAt ? 1 : 0;
      return {
        roomId: row.roomId,
        channel:
          row.channel ||
          (String(row.roomId || "").indexOf("shop_") === 0 ? "shop" : "support"),
        shopToken: row.shopToken || "",
        shopName: row.shopName || "",
        msgCount: row.msgCount || 0,
        lastAt: row.lastAt,
        lastBody: row.lastBody || "",
        lastRole,
        visitorKey: vk,
        unread
      };
    });
    threads.sort((a, b) => {
      if ((b.unread || 0) !== (a.unread || 0)) return (b.unread || 0) - (a.unread || 0);
      const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return tb - ta;
    });
    return res.json({ threads });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải danh sách chat" });
  }
}

async function markChatRead(req, res) {
  try {
    const roomId = String(req.body.roomId || "").trim();
    const visitorKey = String(req.body.visitorKey || "").trim().slice(0, 80);
    if (!roomId || !visitorKey) {
      return res.status(400).json({ error: "Thiếu roomId/visitorKey" });
    }
    let readerRole = "user";
    let readerId = visitorKey;
    if (req.user && isAdmin(req.user) && String(req.body.as || "") === "admin") {
      readerRole = "admin";
      readerId = "admin";
    } else if (req.user) {
      readerRole = "user";
      readerId = String(req.user.id);
    }
    await query(
      `INSERT INTO chat_reads (room_id, visitor_key, reader_role, reader_id, last_read_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (room_id, visitor_key, reader_role, reader_id)
       DO UPDATE SET last_read_at = NOW()`,
      [roomId, visitorKey, readerRole, readerId]
    );
    return res.json({ ok: true, roomId, visitorKey, readerRole });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không đánh dấu đã đọc" });
  }
}

async function adminChatThreads(req, res) {
  try {
    const channel = String(req.query.channel || "support").trim();
    const shopToken = String(req.query.shopToken || "").trim();
    let r;
    if (channel === "shop" && shopToken) {
      r = await query(
        `SELECT t.visitor_key,
                t.shop_name,
                t.shop_token,
                t.room_id,
                t.msg_count,
                t.last_at,
                t.last_body,
                t.last_role,
                t.user_id,
                COALESCE(NULLIF(TRIM(u.name), ''), '') AS user_name,
                COALESCE(NULLIF(TRIM(u.email), ''), '') AS user_email,
                CASE
                  WHEN t.last_role = 'user' AND (r.last_read_at IS NULL OR t.last_at > r.last_read_at)
                  THEN 1 ELSE 0
                END AS unread
         FROM (
           SELECT visitor_key,
                  MAX(shop_name) AS shop_name,
                  MAX(shop_token) AS shop_token,
                  MAX(room_id) AS room_id,
                  COUNT(*)::int AS msg_count,
                  MAX(created_at) AS last_at,
                  (ARRAY_AGG(body ORDER BY created_at DESC))[1] AS last_body,
                  (ARRAY_AGG(role ORDER BY created_at DESC))[1] AS last_role,
                  (ARRAY_AGG(user_id ORDER BY created_at DESC)
                    FILTER (WHERE user_id IS NOT NULL AND role = 'user'))[1] AS user_id
           FROM chat_messages
           WHERE channel = 'shop' AND shop_token = $1
           GROUP BY visitor_key
         ) t
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN chat_reads r
           ON r.room_id = t.room_id
          AND r.visitor_key = t.visitor_key
          AND r.reader_role = 'admin'
          AND r.reader_id = 'admin'
         ORDER BY unread DESC, t.last_at DESC
         LIMIT 100`,
        [shopToken]
      );
    } else if (channel === "shop") {
      r = await query(
        `SELECT t.shop_token,
                t.shop_name,
                t.threads,
                t.msg_count,
                t.last_at,
                COALESCE(p.pending, 0)::int AS pending
         FROM (
           SELECT shop_token,
                  MAX(shop_name) AS shop_name,
                  COUNT(DISTINCT visitor_key)::int AS threads,
                  COUNT(*)::int AS msg_count,
                  MAX(created_at) AS last_at
           FROM chat_messages
           WHERE channel = 'shop' AND shop_token <> ''
           GROUP BY shop_token
         ) t
         LEFT JOIN (
           SELECT x.shop_token, COUNT(*)::int AS pending
           FROM (
             SELECT c.shop_token, c.visitor_key, c.room_id,
                    MAX(c.created_at) AS last_at,
                    (ARRAY_AGG(c.role ORDER BY c.created_at DESC))[1] AS last_role
             FROM chat_messages c
             WHERE c.channel = 'shop' AND c.shop_token <> ''
             GROUP BY c.shop_token, c.visitor_key, c.room_id
           ) x
           LEFT JOIN chat_reads r
             ON r.room_id = x.room_id
            AND r.visitor_key = x.visitor_key
            AND r.reader_role = 'admin'
            AND r.reader_id = 'admin'
           WHERE x.last_role = 'user'
             AND (r.last_read_at IS NULL OR x.last_at > r.last_read_at)
           GROUP BY x.shop_token
         ) p ON p.shop_token = t.shop_token
         ORDER BY pending DESC, t.last_at DESC
         LIMIT 500`
      );
    } else {
      r = await query(
        `SELECT t.visitor_key,
                t.room_id,
                t.msg_count,
                t.last_at,
                t.last_body,
                t.last_role,
                t.user_id,
                COALESCE(NULLIF(TRIM(u.name), ''), '') AS user_name,
                COALESCE(NULLIF(TRIM(u.email), ''), '') AS user_email,
                CASE
                  WHEN t.last_role = 'user' AND (r.last_read_at IS NULL OR t.last_at > r.last_read_at)
                  THEN 1 ELSE 0
                END AS unread
         FROM (
           SELECT visitor_key,
                  MAX(room_id) AS room_id,
                  COUNT(*)::int AS msg_count,
                  MAX(created_at) AS last_at,
                  (ARRAY_AGG(body ORDER BY created_at DESC))[1] AS last_body,
                  (ARRAY_AGG(role ORDER BY created_at DESC))[1] AS last_role,
                  (ARRAY_AGG(user_id ORDER BY created_at DESC)
                    FILTER (WHERE user_id IS NOT NULL AND role = 'user'))[1] AS user_id
           FROM chat_messages
           WHERE channel = 'support'
           GROUP BY visitor_key
         ) t
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN chat_reads r
           ON r.room_id = t.room_id
          AND r.visitor_key = t.visitor_key
          AND r.reader_role = 'admin'
          AND r.reader_id = 'admin'
         ORDER BY unread DESC, t.last_at DESC
         LIMIT 100`
      );
    }
    return res.json({ threads: r.rows, channel });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải hội thoại" });
  }
}


async function ackAdminBadge(req, res) {
  try {
    const key = String(req.body.key || req.body.badge || "").trim();
    const allowed = new Set([
      "orders",
      "disputes",
      "blog",
      "stock",
      "chatSupport",
      "chatShop",
      "notifications"
    ]);
    if (!allowed.has(key)) {
      return res.status(400).json({ error: "Badge không hợp lệ" });
    }
    if (key === "chatSupport" || key === "chatShop") {
      await markAllChannelRead(key === "chatSupport" ? "support" : "shop");
    }
    await query(
      `INSERT INTO admin_badge_acks (badge_key, last_ack_at)
       VALUES ($1, NOW())
       ON CONFLICT (badge_key) DO UPDATE SET last_ack_at = NOW()`,
      [key]
    );
    return res.json({ ok: true, key });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không xác nhận badge" });
  }
}

async function markAllChannelRead(channel) {
  const rows = await query(
    `SELECT t.room_id, t.visitor_key
     FROM (
       SELECT MAX(room_id) AS room_id,
              visitor_key,
              MAX(created_at) AS last_at,
              (ARRAY_AGG(role ORDER BY created_at DESC))[1] AS last_role
       FROM chat_messages
       WHERE channel = $1
       GROUP BY visitor_key, COALESCE(shop_token, '')
     ) t
     LEFT JOIN chat_reads r
       ON r.room_id = t.room_id
      AND r.visitor_key = t.visitor_key
      AND r.reader_role = 'admin'
      AND r.reader_id = 'admin'
     WHERE t.last_role = 'user'
       AND (r.last_read_at IS NULL OR t.last_at > r.last_read_at)`,
    [channel]
  );
  for (const row of rows.rows) {
    await query(
      `INSERT INTO chat_reads (room_id, visitor_key, reader_role, reader_id, last_read_at)
       VALUES ($1,$2,'admin','admin',NOW())
       ON CONFLICT (room_id, visitor_key, reader_role, reader_id)
       DO UPDATE SET last_read_at = NOW()`,
      [row.room_id, row.visitor_key]
    );
  }
  return rows.rows.length;
}

async function adminBadges(_req, res) {
  try {
    const ackRows = await query(`SELECT badge_key, last_ack_at FROM admin_badge_acks`);
    const ack = {};
    ackRows.rows.forEach((r) => {
      ack[r.badge_key] = r.last_ack_at;
    });
    const ackOr = (key) => ack[key] || "1970-01-01";
    const [orders, disputes, support, shopPending, blogDrafts, stockLow] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS n FROM orders
         WHERE status IN ('paid','delivered')
           AND created_at > $1::timestamptz`,
        [ackOr("orders")]
      ),
      query(
        `SELECT COUNT(*)::int AS n FROM order_disputes
         WHERE status = 'open'
           AND created_at > $1::timestamptz`,
        [ackOr("disputes")]
      ),
      query(
        `SELECT COUNT(*)::int AS n FROM (
           SELECT t.visitor_key
           FROM (
             SELECT visitor_key, MAX(room_id) AS room_id, MAX(created_at) AS last_at,
                    (ARRAY_AGG(role ORDER BY created_at DESC))[1] AS last_role
             FROM chat_messages WHERE channel = 'support'
             GROUP BY visitor_key
           ) t
           LEFT JOIN chat_reads r
             ON r.room_id = t.room_id
            AND r.visitor_key = t.visitor_key
            AND r.reader_role = 'admin'
            AND r.reader_id = 'admin'
           WHERE t.last_role = 'user'
             AND (r.last_read_at IS NULL OR t.last_at > r.last_read_at)
         ) x`
      ),
      query(
        `SELECT shop_token, COUNT(*)::int AS pending
         FROM (
           SELECT c.shop_token, c.visitor_key, c.room_id,
                  MAX(c.created_at) AS last_at,
                  (ARRAY_AGG(c.role ORDER BY c.created_at DESC))[1] AS last_role
           FROM chat_messages c
           WHERE c.channel = 'shop' AND c.shop_token <> ''
           GROUP BY c.shop_token, c.visitor_key, c.room_id
         ) x
         LEFT JOIN chat_reads r
           ON r.room_id = x.room_id
          AND r.visitor_key = x.visitor_key
          AND r.reader_role = 'admin'
          AND r.reader_id = 'admin'
         WHERE x.last_role = 'user'
           AND (r.last_read_at IS NULL OR x.last_at > r.last_read_at)
         GROUP BY shop_token`
      ),
      query(
        `SELECT COUNT(*)::int AS n FROM blog_posts
         WHERE status = 'draft'
           AND COALESCE(updated_at, created_at) > $1::timestamptz`,
        [ackOr("blog")]
      ),
      query(
        `SELECT COUNT(*)::int AS n FROM (
           SELECT product_id FROM stock_items
           GROUP BY product_id
           HAVING COUNT(*) FILTER (WHERE status = 'available') = 0
         ) x`
      )
    ]);
    const shopPendingByToken = {};
    let chatShop = 0;
    shopPending.rows.forEach((row) => {
      shopPendingByToken[row.shop_token] = row.pending;
      chatShop += row.pending;
    });
    return res.json({
      orders: orders.rows[0].n,
      disputes: disputes.rows[0].n,
      chatSupport: support.rows[0].n,
      chatShop,
      blog: blogDrafts.rows[0].n,
      stock: ack.stock ? 0 : stockLow.rows[0].n,
      shopPendingByToken
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải badge" });
  }
}

module.exports = {
  isAdmin,
  adminRequired,
  dashboard,
  listOrders,
  updateOrderStatus,
  listUsers,
  creditWallet,
  listLedger,
  listDisputes,
  updateDispute,
  voidStock,
  upsertShop,
  listShopOverrides,
  deleteShopOverride,
  upsertProduct,
  listProductOverrides,
  deleteProductOverride,
  postChatMessage,
  listChatMessages,
  listMyChatThreads,
  markChatRead,
  adminChatThreads,
  uploadChatFile,
  adminBadges,
  ackAdminBadge
};

