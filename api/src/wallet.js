const { PayOS } = require("@payos/node");
const config = require("./config");
const { query, withTransaction } = require("./db");

let payos = null;
if (config.payos.clientId && config.payos.apiKey && config.payos.checksumKey) {
  payos = new PayOS({
    clientId: config.payos.clientId,
    apiKey: config.payos.apiKey,
    checksumKey: config.payos.checksumKey
  });
}

function hasPayos() {
  return Boolean(payos) || config.payos.mock;
}

/**
 * Nội dung CK PayOS: "{Ho ten} chuyen tien"
 * PayOS / VietQR giới hạn ~25 byte UTF-8 — dấu tiếng Việt làm vượt limit
 * → dùng ASCII để luôn vừa.
 */
const PAYOS_DESC_MAX = 25;
const PAYOS_DESC_SUFFIX = " chuyen tien"; // 12 bytes ASCII
const RANDOM_HO = [
  "Nguyen", "Tran", "Le", "Pham", "Hoang", "Huynh", "Phan", "Vu", "Vo", "Dang",
  "Bui", "Do", "Ho", "Ngo", "Duong", "Ly", "Dao", "Dinh", "Truong", "Mai"
];
const RANDOM_DEM = [
  "Van", "Thi", "Minh", "Hoang", "Thu", "Quoc", "Anh", "Hong", "Thanh", "Duc",
  "Ngoc", "Bao", "Kim", "Xuan", "Quynh"
];
const RANDOM_TEN = [
  "An", "Binh", "Chi", "Dung", "Giang", "Ha", "Hung", "Khanh", "Lan", "Linh",
  "Long", "Mai", "Nam", "Ngoc", "Phong", "Quang", "Son", "Tuan", "Vy", "Yen",
  "Dat", "Hieu", "Khoa", "My", "Trang"
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function utf8Bytes(s) {
  return Buffer.byteLength(String(s || ""), "utf8");
}

function randomPayerName() {
  // 2 hoặc 3 từ cho đa dạng, rồi cắt vừa giới hạn
  const two = Math.random() < 0.35;
  return two ? pick(RANDOM_HO) + " " + pick(RANDOM_TEN) : pick(RANDOM_HO) + " " + pick(RANDOM_DEM) + " " + pick(RANDOM_TEN);
}

function transferDescription() {
  const maxName = Math.max(1, PAYOS_DESC_MAX - utf8Bytes(PAYOS_DESC_SUFFIX));
  let name = randomPayerName().replace(/\s+/g, " ").trim();
  while (name && utf8Bytes(name) > maxName) {
    const sp = name.lastIndexOf(" ");
    if (sp >= 3) name = name.slice(0, sp);
    else {
      // cắt theo byte, không cắt giữa UTF-8
      let cut = name;
      while (cut && utf8Bytes(cut) > maxName) cut = cut.slice(0, -1);
      name = cut.trim();
      break;
    }
  }
  const out = name + PAYOS_DESC_SUFFIX;
  if (utf8Bytes(out) <= PAYOS_DESC_MAX) return out;
  // fallback ngắn nhất vẫn hợp lệ
  return ("An" + PAYOS_DESC_SUFFIX).slice(0, PAYOS_DESC_MAX);
}

function genOrderCode() {
  // PayOS requires unique integer orderCode
  return Number(String(Date.now()).slice(-11) + String(Math.floor(Math.random() * 90 + 10)));
}

async function createPaymentLink({ amount, description, returnUrl, cancelUrl, itemName }) {
  if (!hasPayos()) {
    const err = new Error("Hệ thống thanh toán QR chưa sẵn sàng");
    err.status = 503;
    throw err;
  }
  const orderCode = genOrderCode();
  let checkoutUrl = "";
  let paymentLinkId = "";
  let qrCode = "";

  if (config.payos.mock || !payos) {
    checkoutUrl = returnUrl.includes("?")
      ? returnUrl + "&mock=1&code=" + orderCode
      : returnUrl + "?mock=1&code=" + orderCode;
    paymentLinkId = `mock_${orderCode}`;
    qrCode = `MOCK_PAYOS_${orderCode}_${amount}`;
  } else {
    let desc = String(description || transferDescription());
    if (utf8Bytes(desc) > PAYOS_DESC_MAX) {
      while (desc && utf8Bytes(desc) > PAYOS_DESC_MAX) desc = desc.slice(0, -1);
      if (!desc) desc = transferDescription();
    }
    let payment;
    try {
      payment = await payos.paymentRequests.create({
        orderCode,
        amount,
        description: desc,
        returnUrl,
        cancelUrl,
        items: [
          {
            name: String(itemName || "Don hang Vua Proxy").slice(0, 25),
            quantity: 1,
            price: amount
          }
        ]
      });
    } catch (payErr) {
      const msg =
        payErr?.message ||
        payErr?.error ||
        (typeof payErr === "string" ? payErr : "PayOS tạo QR thất bại");
      console.error("createPaymentLink PayOS", msg, { desc, bytes: utf8Bytes(desc) });
      const err = new Error(String(msg).slice(0, 200));
      err.status = 502;
      throw err;
    }
    checkoutUrl = payment.checkoutUrl || payment.checkout_url || "";
    paymentLinkId = payment.paymentLinkId || payment.payment_link_id || "";
    qrCode = payment.qrCode || payment.qr_code || "";
  }

  return { orderCode, checkoutUrl, paymentLinkId, qrCode, mock: config.payos.mock || !payos };
}

async function creditTopup(client, topup, meta = {}) {
  const upd = await client.query(
    `UPDATE topups SET status = 'paid', paid_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id`,
    [topup.id]
  );
  if (!upd.rowCount) return { already: true };
  await client.query(
    `UPDATE users SET balance_cents = balance_cents + $1 WHERE id = $2`,
    [topup.amount_cents, topup.user_id]
  );
  await client.query(
    `INSERT INTO wallet_ledger (user_id, type, amount_cents, ref_id, meta)
     VALUES ($1,'topup',$2,$3,$4)`,
    [
      topup.user_id,
      topup.amount_cents,
      String(topup.payos_order_code),
      JSON.stringify(meta)
    ]
  );
  return { already: false };
}

async function createTopup(req, res) {
  try {
    if (!hasPayos()) {
      return res.status(503).json({
        error: "Hệ thống nạp ví chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ hỗ trợ."
      });
    }
    const amount = Math.round(Number(req.body.amount || 0));
    if (!Number.isFinite(amount) || amount < 1000) {
      return res.status(400).json({ error: "Số tiền tối thiểu 1.000₫" });
    }
    if (amount > 50_000_000) {
      return res.status(400).json({ error: "Số tiền tối đa 50.000.000₫" });
    }

    const orderCode = genOrderCode();
    const origin = (
      config.webOriginPrimary ||
      String(config.webOrigin || "").split(",")[0] ||
      ""
    )
      .trim()
      .replace(/\/$/, "");
    const returnUrl = `${origin}/nap-tien.html?topup=ok&code=${orderCode}`;
    const cancelUrl = `${origin}/nap-tien.html?topup=cancel&code=${orderCode}`;

    let checkoutUrl = "";
    let paymentLinkId = "";
    let qrCode = "";

    const desc = transferDescription();

    if (config.payos.mock || !payos) {
      checkoutUrl = `${origin}/nap-tien.html?topup=mock&code=${orderCode}`;
      paymentLinkId = `mock_${orderCode}`;
    } else {
      const payment = await payos.paymentRequests.create({
        orderCode,
        amount,
        description: desc.slice(0, 25),
        returnUrl,
        cancelUrl,
        items: [{ name: "Nap so du Vua Proxy", quantity: 1, price: amount }]
      });
      checkoutUrl = payment.checkoutUrl || payment.checkout_url || "";
      paymentLinkId = payment.paymentLinkId || payment.payment_link_id || "";
      qrCode = payment.qrCode || payment.qr_code || "";
    }

    const ins = await query(
      `INSERT INTO topups (user_id, payos_order_code, amount_cents, checkout_url, payment_link_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, payos_order_code, amount_cents, status, checkout_url, created_at`,
      [req.user.id, orderCode, amount, checkoutUrl, paymentLinkId]
    );

    // Mock: credit immediately for demo
    if (config.payos.mock || !payos) {
      await withTransaction(async (client) => {
        const t = await client.query(`SELECT * FROM topups WHERE id = $1 FOR UPDATE`, [
          ins.rows[0].id
        ]);
        await creditTopup(client, t.rows[0], { mock: true });
      });
    }

    return res.json({
      topup: {
        orderCode,
        amount,
        status: config.payos.mock || !payos ? "paid" : "pending",
        checkoutUrl,
        qrCode,
        paymentLinkId
      }
    });
  } catch (err) {
    console.error("createTopup", err);
    return res.status(500).json({ error: err.message || "Không tạo được giao dịch nạp" });
  }
}

function isPayosPaidStatus(status) {
  const s = String(status || "").toUpperCase();
  return s === "PAID" || s === "PAYMENT_SUCCESS" || s === "SUCCESS";
}

function extractPayosPaymentInfo(info) {
  if (!info || typeof info !== "object") return {};
  // SDK may return flat object or { data: {...} }
  const data = info.data && typeof info.data === "object" ? info.data : info;
  return {
    status: data.status || info.status || "",
    orderCode: data.orderCode || data.order_code || info.orderCode,
    amountPaid: data.amountPaid ?? data.amount_paid,
    amountRemaining: data.amountRemaining ?? data.amount_remaining
  };
}

async function lookupPayosPaid(topup) {
  if (!payos || !topup) return false;
  const ids = [];
  if (topup.payment_link_id) ids.push(topup.payment_link_id);
  const code = Number(topup.payos_order_code);
  if (Number.isFinite(code) && code > 0) ids.push(code);
  for (const id of ids) {
    try {
      const info = await payos.paymentRequests.get(id);
      const parsed = extractPayosPaymentInfo(info);
      if (isPayosPaidStatus(parsed.status)) return true;
      if (
        Number(parsed.amountPaid) > 0 &&
        (parsed.amountRemaining === 0 || parsed.amountRemaining === "0")
      ) {
        return true;
      }
    } catch (e) {
      console.warn("lookupPayosPaid", id, e.message || e);
    }
  }
  return false;
}

async function payosWebhook(req, res) {
  try {
    const probeOc =
      req.body?.data?.orderCode ?? req.body?.orderCode ?? req.body?.data?.order_code;
    if (probeOc == null || String(probeOc).length === 0) {
      return res.json({ success: true, probe: true });
    }

    let data;
    if (config.payos.mock && !payos) {
      data = req.body?.data || req.body;
    } else if (!payos) {
      return res.status(503).send("PayOS not configured");
    } else {
      data = await payos.webhooks.verify(req.body);
    }

    // verify() returns webhook data payload (orderCode inside)
    const orderCode = Number(
      data?.orderCode ||
        data?.order_code ||
        data?.data?.orderCode ||
        req.body?.data?.orderCode ||
        req.body?.orderCode
    );
    if (!orderCode) {
      console.warn("webhook missing orderCode", JSON.stringify(req.body || {}).slice(0, 400));
      return res.status(400).send("missing orderCode");
    }

    const topLevelCode = String(req.body?.code || data?.code || "00");
    const successFlag = req.body?.success;
    const failed =
      (successFlag === false || successFlag === "false") ||
      (topLevelCode && topLevelCode !== "00" && String(data?.code || "00") !== "00");

    let fulfilledOrderId = null;
    let vpnStartIds = [];
    await withTransaction(async (client) => {
      const r = await client.query(
        `SELECT * FROM topups WHERE payos_order_code = $1 FOR UPDATE`,
        [orderCode]
      );
      const topup = r.rows[0];
      if (topup) {
        if (failed) {
          await client.query(
            `UPDATE topups SET status = 'failed' WHERE id = $1 AND status = 'pending'`,
            [topup.id]
          );
          return;
        }
        await creditTopup(client, topup, {
          webhook: true,
          reference: data?.reference || data?.data?.reference
        });
        return;
      }

      const o = await client.query(
        `SELECT * FROM orders WHERE payos_order_code = $1 FOR UPDATE`,
        [orderCode]
      );
      const order = o.rows[0];
      if (!order) {
        console.warn("webhook unknown order", orderCode);
        return;
      }
      if (failed) {
        await client.query(
          `UPDATE orders SET status = 'expired' WHERE id = $1 AND status = 'pending_payment'`,
          [order.id]
        );
        return;
      }
      const orders = require("./orders");
      const result = await orders.fulfillQrPaidOrder(client, order, {
        webhook: true,
        reference: data?.reference || data?.data?.reference
      });
      if (result && !result.already) {
        fulfilledOrderId = order.id;
        vpnStartIds = result.vpnStartIds || [];
      }
    });

    if (vpnStartIds.length) require("./vpn-pool").activate(vpnStartIds);

    if (fulfilledOrderId) {
      const { query } = require("./db");
      const fresh = await query(`SELECT * FROM orders WHERE id = $1`, [fulfilledOrderId]);
      if (fresh.rows[0]) {
        await require("./orders").notifyOrderDelivered(fresh.rows[0]);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("payosWebhook", err);
    return res.status(400).json({ error: "Invalid webhook" });
  }
}

async function syncTopup(req, res) {
  try {
    const orderCode = Number(req.params.code || req.query.code);
    if (!orderCode) return res.status(400).json({ error: "Thiếu mã" });
    const r = await query(
      `SELECT * FROM topups WHERE payos_order_code = $1 AND user_id = $2`,
      [orderCode, req.user.id]
    );
    const topup = r.rows[0];
    if (!topup) return res.status(404).json({ error: "Không tìm thấy giao dịch" });

    if (topup.status === "pending" && payos) {
      const paid = await lookupPayosPaid(topup);
      if (paid) {
        await withTransaction(async (client) => {
          const t = await client.query(`SELECT * FROM topups WHERE id = $1 FOR UPDATE`, [
            topup.id
          ]);
          await creditTopup(client, t.rows[0], { sync: true });
        });
      }
    }

    const u = await query(`SELECT balance_cents FROM users WHERE id = $1`, [req.user.id]);
    const fresh = await query(`SELECT status, amount_cents, paid_at FROM topups WHERE id = $1`, [
      topup.id
    ]);
    return res.json({
      topup: fresh.rows[0],
      balance: Number(u.rows[0].balance_cents)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không đồng bộ được" });
  }
}

async function ledger(req, res) {
  const r = await query(
    `SELECT id, type, amount_cents, ref_id, meta, created_at
     FROM wallet_ledger WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  return res.json({
    items: r.rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount_cents),
      refId: row.ref_id,
      meta: row.meta,
      createdAt: row.created_at
    }))
  });
}

module.exports = {
  createTopup,
  payosWebhook,
  syncTopup,
  ledger,
  hasPayos,
  createPaymentLink,
  transferDescription,
  getPayosClient: () => payos,
  genOrderCode
};
