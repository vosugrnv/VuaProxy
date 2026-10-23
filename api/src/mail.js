const nodemailer = require("nodemailer");
const config = require("./config");

let transporter = null;

function isConfigured() {
  return Boolean(config.smtp.host && config.smtp.from);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isConfigured()) return null;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth:
      config.smtp.user && config.smtp.pass
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined
  });
  return transporter;
}

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN") + "₫";
}

function buildOrderText(order) {
  const lines = [];
  lines.push("Cảm ơn bạn đã mua hàng tại Vua Proxy!");
  lines.push("");
  lines.push("Mã đơn: " + (order.code || ""));
  lines.push("Tổng thanh toán: " + money(order.total));
  if (order.promoCode) {
    lines.push("Mã KM: " + order.promoCode + " (−" + money(order.discount) + ")");
  }
  lines.push("");
  if (Array.isArray(order.items) && order.items.length) {
    lines.push("Sản phẩm:");
    order.items.forEach((it) => {
      lines.push("  • " + (it.name || "Sản phẩm") + " ×" + (it.qty || 1));
    });
    lines.push("");
  }
  const note = order.deliveryNote || "";
  if (note) {
    lines.push("Thông tin giao hàng:");
    lines.push(note);
    lines.push("");
  }
  lines.push(
    "Xem đơn tại: " +
      (config.webOriginPrimary || String(config.webOrigin || "").split(",")[0] || "").replace(
        /\/$/,
        ""
      ) +
      "/tai-khoan#orders"
  );
  lines.push("");
  lines.push("Hỗ trợ: support@vuaproxy.cloud");
  return lines.join("\n");
}

function buildOrderHtml(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemRows = items
    .map(
      (it) =>
        "<tr><td style=\"padding:6px 0;color:#334155\">" +
        escapeHtml(it.name || "Sản phẩm") +
        " ×" +
        (it.qty || 1) +
        "</td><td style=\"padding:6px 0;text-align:right;font-weight:600\">" +
        money((it.price || 0) * (it.qty || 1)) +
        "</td></tr>"
    )
    .join("");
  const note = String(order.deliveryNote || "").trim();
  const noteHtml = note
    ? '<pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;font:13px/1.5 monospace;color:#0f172a">' +
      escapeHtml(note) +
      "</pre>"
    : "";
  return (
    '<div style="font-family:Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">' +
    '<div style="border-bottom:3px solid #dc2626;padding-bottom:12px;margin-bottom:20px">' +
    '<strong style="font-size:20px;color:#dc2626">Vua Proxy</strong>' +
    "</div>" +
    "<p>Xin chào,</p>" +
    "<p>Đơn hàng của bạn đã thanh toán thành công. Thông tin chi tiết bên dưới:</p>" +
    '<table style="width:100%;border-collapse:collapse;margin:12px 0 18px">' +
    '<tr><td style="padding:4px 0;color:#64748b">Mã đơn</td><td style="padding:4px 0;text-align:right;font-weight:700">' +
    escapeHtml(order.code || "") +
    "</td></tr>" +
    '<tr><td style="padding:4px 0;color:#64748b">Tổng thanh toán</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#dc2626">' +
    money(order.total) +
    "</td></tr></table>" +
    (itemRows
      ? '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' +
        itemRows +
        "</table>"
      : "") +
    noteHtml +
    '<p style="margin-top:20px"><a href="' +
    escapeHtml(
      (config.webOriginPrimary || String(config.webOrigin || "").split(",")[0] || "").replace(
        /\/$/,
        ""
      ) + "/tai-khoan#orders"
    ) +
    '" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Xem đơn hàng</a></p>' +
    '<p style="font-size:13px;color:#64748b;margin-top:24px">Hỗ trợ: <a href="mailto:support@vuaproxy.cloud">support@vuaproxy.cloud</a></p>' +
    "</div>"
  );
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendOrderConfirmation({ to, order }) {
  const email = String(to || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return { sent: false, reason: "invalid-email" };
  }
  const tx = getTransporter();
  if (!tx) {
    console.warn("[mail] SMTP chưa cấu hình — bỏ qua gửi đơn tới", email);
    return { sent: false, reason: "not-configured", to: email };
  }
  const code = order.code || "don-hang";
  try {
    await tx.sendMail({
      from: config.smtp.from,
      to: email,
      subject: "Vua Proxy — Đơn " + code + " đã thanh toán",
      text: buildOrderText(order),
      html: buildOrderHtml(order)
    });
    console.log("[mail] sent order", code, "to", email);
    return { sent: true, to: email };
  } catch (err) {
    console.error("[mail] send failed", email, err.message);
    return { sent: false, reason: err.message, to: email };
  }
}

module.exports = { sendOrderConfirmation, isConfigured };
