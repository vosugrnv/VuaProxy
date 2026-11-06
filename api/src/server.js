const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const auth = require("./auth");
const wallet = require("./wallet");
const orders = require("./orders");
const stock = require("./stock");
const admin = require("./admin");
const cms = require("./cms");
const catalogCms = require("./catalog-cms");
const vpnPool = require("./vpn-pool");
const { rateLimit } = require("./rate-limit");

if (!config.jwtSecret || config.jwtSecret === "dev-secret-change-me") {
  console.error("Refusing to start: set a unique JWT_SECRET");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = new Set(
  [
    ...config.webOriginList,
    "https://www.vuaproxy.cloud",
    "https://vuaproxy.cloud",
    "https://admin.vuaproxy.cloud",
    "http://127.0.0.1:3100",
    "http://localhost:3100",
    "http://127.0.0.1:3101",
    "http://localhost:3101"
  ].filter(Boolean)
);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, origin);
      return cb(null, false);
    },
    credentials: true
  })
);
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

const uploadDir = process.env.UPLOAD_DIR || "/var/www/vuaproxy/uploads";
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (_) {}
app.use(
  "/uploads",
  express.static(uploadDir, {
    fallthrough: true,
    maxAge: "1d",
    index: false
  })
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    payos: wallet.hasPayos(),
    mock: config.payos.mock,
    adminConfigured: config.adminEmails.length > 0,
    octoprox: require("./octoprox").isConfigured()
  });
});

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  key: (req) =>
    "login:" +
    (req.ip || "") +
    ":" +
    String(req.body?.email || req.body?.username || "")
      .toLowerCase()
      .slice(0, 80)
});
const registerLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  key: (req) => "register:" + (req.ip || "")
});
const uploadLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  key: (req) => "upload:" + (req.ip || "")
});
app.post("/auth/register", registerLimit, auth.register);
app.post("/auth/login", loginLimit, auth.login);
app.post("/auth/logout", auth.logout);
app.get("/auth/me", auth.authRequired, auth.me);
app.patch("/auth/profile", auth.authRequired, auth.updateProfile);
app.post("/auth/avatar", auth.authRequired, auth.uploadAvatar);
app.post("/auth/password", auth.authRequired, loginLimit, auth.changePassword);

app.get("/notifications", auth.authRequired, async (req, res) => {
  try {
    const { query } = require("./db");
    const r = await query(
      `SELECT id, audience, title, body, kind, created_at
       FROM notifications
       WHERE audience IN ('all','customers')
       ORDER BY created_at DESC LIMIT 50`
    );
    return res.json({ items: r.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải thông báo" });
  }
});
app.get("/promos/active", auth.optionalAuth, cms.listActivePromos);
app.post("/promos/validate", auth.optionalAuth, cms.validatePromo);
app.get("/blog", cms.listPublicBlog);
app.get("/blog/:slug", cms.getPublicBlog);
app.get("/catalog/extra", catalogCms.listPublicCatalog);

app.post("/wallet/topup", auth.authRequired, wallet.createTopup);
app.get("/wallet/ledger", auth.authRequired, wallet.ledger);
app.get("/wallet/topup/:code/sync", auth.authRequired, wallet.syncTopup);
app.post("/payos/webhook", wallet.payosWebhook);

app.post("/orders", auth.authRequired, orders.createOrder);
app.post("/orders/checkout-qr", auth.optionalAuth, orders.createCheckoutQr);
app.get("/orders/pay/:code", orders.getPayStatus);
app.get("/orders", auth.authRequired, orders.listOrders);
app.get("/orders/reviews/mine", auth.authRequired, orders.listMyReviews);
app.get("/orders/:id", auth.authRequired, orders.getOrder);
app.post("/orders/:id/dispute", auth.authRequired, orders.disputeOrder);
app.post("/orders/:id/dispute/withdraw", auth.authRequired, orders.withdrawDispute);
app.post("/orders/:id/review", auth.authRequired, orders.reviewOrder);
app.get("/products/:productId/reviews", orders.listProductReviews);

app.get("/stock/counts", stock.getCounts);
app.get("/stock", auth.authRequired, stock.listStock);
app.post("/stock/import", auth.authRequired, stock.importStock);
app.patch("/stock/item/:id", auth.authRequired, stock.updateItem);
app.delete("/stock/item/:id", auth.authRequired, stock.deleteItem);
app.get("/stock/:productId/items", auth.authRequired, stock.listItems);
app.get("/stock/:productId/preview", auth.authRequired, stock.previewStock);

app.post("/chat/messages", auth.optionalAuth, admin.postChatMessage);
app.get("/chat/messages", auth.optionalAuth, admin.listChatMessages);
app.post("/chat/upload", uploadLimit, auth.optionalAuth, admin.uploadChatFile);
app.get("/chat/files/:name", auth.optionalAuth, admin.getChatFile);
app.get("/chat/threads/mine", auth.authRequired, admin.listMyChatThreads);
app.post("/chat/read", auth.optionalAuth, admin.markChatRead);

const adm = [auth.authRequired, admin.adminRequired];
app.get("/admin/dashboard", ...adm, admin.dashboard);
app.get("/admin/orders", ...adm, admin.listOrders);
app.patch("/admin/orders/:id", ...adm, admin.updateOrderStatus);
app.post("/admin/orders/:id/warranty", ...adm, admin.warrantyOrder);
app.get("/admin/users", ...adm, admin.listUsers);
app.post("/admin/users/:id/credit", ...adm, admin.creditWallet);
app.get("/admin/ledger", ...adm, admin.listLedger);
app.get("/admin/disputes", ...adm, admin.listDisputes);
app.patch("/admin/disputes/:id", ...adm, admin.updateDispute);
app.post("/admin/stock/void", ...adm, admin.voidStock);
app.get("/admin/shops", ...adm, admin.listShopOverrides);
app.put("/admin/shops/:token", ...adm, admin.upsertShop);
app.delete("/admin/shops/:token", ...adm, admin.deleteShopOverride);
app.get("/admin/products", ...adm, admin.listProductOverrides);
app.put("/admin/products/:id", ...adm, admin.upsertProduct);
app.delete("/admin/products/:id", ...adm, admin.deleteProductOverride);
app.get("/admin/chat/threads", ...adm, admin.adminChatThreads);
app.get("/admin/badges", ...adm, admin.adminBadges);
app.post("/admin/badges/ack", ...adm, admin.ackAdminBadge);

app.get("/admin/vpn-pool", ...adm, async (req, res) => {
  try {
    return res.json(await vpnPool.snapshot());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Không tải kho proxy" });
  }
});
app.post("/admin/vpn-pool/sources", ...adm, async (req, res) => {
  try {
    return res.json(await vpnPool.addSource(req.body || {}));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Không thêm key" });
  }
});
app.delete("/admin/vpn-pool/sources/:id", ...adm, async (req, res) => {
  try {
    await vpnPool.removeSource(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Không xóa key" });
  }
});
app.put("/admin/vpn-pool/settings", ...adm, async (req, res) => {
  try {
    await vpnPool.saveSettings(req.body || {});
    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Không lưu cấu hình" });
  }
});
app.post("/admin/vpn-pool/build", ...adm, async (req, res) => {
  try {
    return res.json(await vpnPool.buildPool());
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Không dựng được" });
  }
});
app.post("/admin/vpn-pool/probe", ...adm, async (req, res) => {
  try {
    const up = await vpnPool.probePending();
    return res.json({ up });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Không dò được IP" });
  }
});

app.get("/admin/blacklist", ...adm, cms.listBlacklist);
app.post("/admin/blacklist", ...adm, cms.addBlacklist);
app.delete("/admin/blacklist/:id", ...adm, cms.removeBlacklist);
app.get("/admin/promos", ...adm, cms.listPromos);
app.post("/admin/promos", ...adm, cms.createPromo);
app.patch("/admin/promos/:id", ...adm, cms.updatePromo);
app.delete("/admin/promos/:id", ...adm, cms.deletePromo);
app.get("/admin/notifications", ...adm, cms.listNotifications);
app.post("/admin/notifications", ...adm, cms.createNotification);
app.delete("/admin/notifications/:id", ...adm, cms.deleteNotification);
app.get("/admin/blog", ...adm, cms.listBlog);
app.get("/admin/blog/:id", ...adm, cms.getBlog);
app.post("/admin/blog", ...adm, cms.upsertBlog);
app.put("/admin/blog/:id", ...adm, cms.upsertBlog);
app.delete("/admin/blog/:id", ...adm, cms.deleteBlog);
app.post("/admin/blog/sync", ...adm, cms.syncBlogFromSite);
app.get("/admin/virtual-shops", ...adm, cms.listVirtualShops);
app.post("/admin/virtual-shops", ...adm, cms.upsertVirtualShop);
app.put("/admin/virtual-shops/:id", ...adm, cms.upsertVirtualShop);
app.delete("/admin/virtual-shops/:id", ...adm, cms.deleteVirtualShop);

app.post("/admin/upload", ...adm, catalogCms.uploadFile);
app.get("/admin/cms-products", ...adm, catalogCms.listCmsProducts);
app.post("/admin/cms-products", ...adm, catalogCms.upsertCmsProduct);
app.put("/admin/cms-products/:id", ...adm, catalogCms.upsertCmsProduct);
app.delete("/admin/cms-products/:id", ...adm, catalogCms.deleteCmsProduct);
app.get("/admin/cms-shops", ...adm, catalogCms.listCmsShops);
app.post("/admin/cms-shops", ...adm, catalogCms.upsertCmsShop);
app.put("/admin/cms-shops/:token", ...adm, catalogCms.upsertCmsShop);
app.delete("/admin/cms-shops/:token", ...adm, catalogCms.deleteCmsShop);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

setInterval(() => {
  orders.releaseExpiredOrders().catch((e) => console.error("release job", e));
}, 60 * 60 * 1000);
orders.releaseExpiredOrders().catch(() => {});

app.listen(config.port, config.host, () => {
  console.log(`vuammo-api on http://${config.host}:${config.port}`);
});
