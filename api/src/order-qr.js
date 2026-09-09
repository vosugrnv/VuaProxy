const crypto = require("crypto");
const config = require("./config");
const { query, withTransaction } = require("./db");
const stock = require("./stock");

function attach(ordersCore) {
  const {
    normalizeItems,
    enrichItemsSeller,
    allocPublicCode,
    formatOrder
  } = ordersCore;

  async function fulfillQrPaidOrder(client, orderRow, meta = {}) {
    if (!orderRow || orderRow.status !== "pending_payment") return { already: true };
    const cms = require("./cms");
    let items = orderRow.items_json || [];
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch (_) {
        items = [];
      }
    }
    items = await enrichItemsSeller(client, items);

    for (const it of items) {
      const c = await client.query(
        `SELECT COUNT(*)::int AS n FROM stock_items
         WHERE product_id = $1 AND status = 'available'`,
        [String(it.id)]
      );
      if ((c.rows[0]?.n || 0) < it.qty) {
        const err = new Error(
          `Tạm hết hàng khi thanh toán: ${it.name} (mã #${it.id}).`
        );
        err.status = 409;
        throw err;
      }
    }

    const holdUntil = new Date(Date.now() + config.holdDays * 24 * 60 * 60 * 1000);
    const delivered = await stock.allocateForItems(client, orderRow.id, items);
    const discount = Number(orderRow.discount_cents || 0);
    const promoCode = orderRow.promo_code || "";
    const noteLines = delivered
      .map((d) => d.name + " ×" + d.qty + ":\n" + d.lines.join("\n"))
      .join("\n\n");
    const fullNote =
      "Giao tự động từ kho Vua MMO (thanh toán QR).\n\n" +
      noteLines +
      (promoCode
        ? "\n\nĐã áp dụng mã " + promoCode + " (−" + discount.toLocaleString("vi-VN") + "₫)."
        : "") +
      "\n\nTiền được giữ bảo vệ đến " +
      holdUntil.toISOString().slice(0, 10) +
      ".";

    await client.query(
      `UPDATE orders
       SET status = 'delivered',
           delivery_payload = $1::jsonb,
           delivery_note = $2,
           hold_until = $3
       WHERE id = $4 AND status = 'pending_payment'`,
      [JSON.stringify(delivered), fullNote, holdUntil.toISOString(), orderRow.id]
    );

    if (orderRow.promo_code && orderRow.buyer_id) {
      try {
        const pr = await client.query(
          `SELECT id FROM promo_codes WHERE upper(code) = upper($1) LIMIT 1`,
          [orderRow.promo_code]
        );
        if (pr.rows[0]) {
          await cms.consumePromo(client, pr.rows[0].id, orderRow.buyer_id, orderRow.id);
        }
      } catch (e) {
        console.warn("promo consume after QR", e.message);
      }
    }

    return { already: false, delivered, fullNote, holdUntil, meta };
  }

  async function createCheckoutQr(req, res) {
    try {
      const wallet = require("./wallet");
      const cms = require("./cms");
      if (!wallet.hasPayos()) {
        return res.status(503).json({
          error:
            "Thanh toán QR chưa sẵn sàng. Vui lòng đăng nhập và thanh toán bằng ví, hoặc thử lại sau."
        });
      }
      if (req.user?.id && (await cms.isUserBlacklisted(req.user.id))) {
        return res.status(403).json({
          error: "Tài khoản nằm trong blacklist. Liên hệ hỗ trợ Vua MMO để được mở lại."
        });
      }
      const parsed = normalizeItems(req.body.items);
      if (!parsed) {
        return res.status(400).json({ error: "Giỏ hàng không hợp lệ (thiếu id/tên/giá)" });
      }
      let { items } = parsed;
      let subtotal = parsed.total;
      let discount = 0;
      let promoCode = "";
      const codeRaw = String(req.body.promoCode || req.body.promo || "").trim();
      if (codeRaw) {
        const applied = await cms.resolvePromo(codeRaw, subtotal, req.user?.id || null);
        discount = applied.discountCents;
        promoCode = applied.promo.code;
      }
      const total = Math.max(0, subtotal - discount);
      if (total < 1000) {
        return res.status(400).json({ error: "Đơn tối thiểu 1.000₫ để thanh toán QR" });
      }
      const guestEmail = String(req.body.email || req.body.guestEmail || "")
        .trim()
        .slice(0, 120);
      const guestToken = crypto.randomBytes(24).toString("hex");
      const payExpire = new Date(Date.now() + 60 * 60 * 1000);

      for (const it of items) {
        const c = await query(
          `SELECT COUNT(*)::int AS n FROM stock_items
           WHERE product_id = $1 AND status = 'available'`,
          [String(it.id)]
        );
        if ((c.rows[0]?.n || 0) < it.qty) {
          return res.status(409).json({
            error: `Tạm hết hàng: ${it.name} (mã #${it.id}). Còn ${c.rows[0]?.n || 0}/${it.qty}.`
          });
        }
      }

      items = await withTransaction(async (client) => enrichItemsSeller(client, items));
      const publicCode = await withTransaction(async (client) => allocPublicCode(client));
      const origin = String(config.webOrigin || "").replace(/\/$/, "");
      const returnUrl =
        origin +
        "/thanh-toan?pay=ok&code=" +
        encodeURIComponent(publicCode) +
        "&token=" +
        encodeURIComponent(guestToken);
      const cancelUrl =
        origin +
        "/thanh-toan?pay=cancel&code=" +
        encodeURIComponent(publicCode) +
        "&token=" +
        encodeURIComponent(guestToken);

      const payment = await wallet.createPaymentLink({
        amount: total,
        description: "DH " + publicCode,
        returnUrl,
        cancelUrl,
        itemName:
          (items[0]?.name || "Don hang") +
          (items.length > 1 ? " +" + (items.length - 1) : "")
      });

      const order = await withTransaction(async (client) => {
        const o = await client.query(
          `INSERT INTO orders (
             buyer_id, items_json, total_cents, status, delivery_note, delivery_payload, hold_until,
             promo_code, discount_cents, subtotal_cents, public_code,
             guest_token, guest_email, payos_order_code, payment_link_id, checkout_url, qr_code
           ) VALUES (
             $1,$2,$3,'pending_payment',$4,'[]'::jsonb,$5,$6,$7,$8,$9,
             $10,$11,$12,$13,$14,$15
           )
           RETURNING id, public_code, total_cents, status, delivery_note, delivery_payload, hold_until,
                     created_at, items_json, promo_code, discount_cents, subtotal_cents,
                     guest_token, checkout_url, qr_code, payos_order_code`,
          [
            req.user?.id || null,
            JSON.stringify(items),
            total,
            "Chờ thanh toán QR. Mã đơn " + publicCode + ".",
            payExpire.toISOString(),
            promoCode || null,
            discount,
            subtotal,
            publicCode,
            guestToken,
            guestEmail || null,
            payment.orderCode,
            payment.paymentLinkId || null,
            payment.checkoutUrl || null,
            payment.qrCode || null
          ]
        );
        return o.rows[0];
      });

      if (payment.mock) {
        await withTransaction(async (client) => {
          const locked = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [
            order.id
          ]);
          await fulfillQrPaidOrder(client, locked.rows[0], { mock: true });
        });
        const fresh = await query(
          `SELECT id, public_code, total_cents, status, delivery_note, delivery_payload, hold_until,
                  created_at, items_json, promo_code, discount_cents, subtotal_cents,
                  guest_token, checkout_url, qr_code, payos_order_code
           FROM orders WHERE id = $1`,
          [order.id]
        );
        return res.json({
          order: formatOrder(fresh.rows[0]),
          payment: {
            status: "paid",
            checkoutUrl: payment.checkoutUrl,
            qrCode: payment.qrCode,
            orderCode: payment.orderCode,
            guestToken
          }
        });
      }

      return res.json({
        order: formatOrder(order),
        payment: {
          status: "pending",
          checkoutUrl: payment.checkoutUrl,
          qrCode: payment.qrCode,
          orderCode: payment.orderCode,
          guestToken
        }
      });
    } catch (err) {
      console.error("createCheckoutQr", err);
      return res
        .status(err.status || 500)
        .json({ error: err.message || "Không tạo thanh toán QR được" });
    }
  }

  async function getPayStatus(req, res) {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const token = String(req.query.token || req.body?.token || "").trim();
      if (!code || !token) {
        return res.status(400).json({ error: "Thiếu mã đơn hoặc token" });
      }
      const r = await query(
        `SELECT * FROM orders WHERE public_code = $1 AND guest_token = $2 LIMIT 1`,
        [code, token]
      );
      const order = r.rows[0];
      if (!order) return res.status(404).json({ error: "Không tìm thấy đơn" });

      if (order.status === "pending_payment") {
        const wallet = require("./wallet");
        const payos = wallet.getPayosClient();
        if (payos && (order.payment_link_id || order.payos_order_code)) {
          try {
            const info = await payos.paymentRequests.get(
              order.payment_link_id || order.payos_order_code
            );
            const status = String(info.status || info.data?.status || "").toUpperCase();
            if (status === "PAID") {
              await withTransaction(async (client) => {
                const locked = await client.query(
                  `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
                  [order.id]
                );
                await fulfillQrPaidOrder(client, locked.rows[0], { sync: true });
              });
            }
          } catch (e) {
            console.warn("sync order pay", e.message);
          }
        }
      }

      const fresh = await query(`SELECT * FROM orders WHERE id = $1`, [order.id]);
      const row = fresh.rows[0];
      return res.json({
        order: formatOrder(row),
        payment: {
          status: row.status === "pending_payment" ? "pending" : row.status,
          checkoutUrl: row.checkout_url || "",
          qrCode: row.qr_code || "",
          orderCode: row.payos_order_code || null,
          guestToken: row.guest_token || ""
        }
      });
    } catch (err) {
      console.error("getPayStatus", err);
      return res.status(500).json({ error: "Không kiểm tra được thanh toán" });
    }
  }

  return { fulfillQrPaidOrder, createCheckoutQr, getPayStatus };
}

module.exports = { attach };
