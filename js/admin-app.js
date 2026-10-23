/* Vua Proxy Admin SPA — đơn proxy, ví, kho & chat hỗ trợ */
(function () {
  const money = (n) =>
    window.VuammoApi && VuammoApi.money
      ? VuammoApi.money(n)
      : Number(n || 0).toLocaleString("vi-VN") + "₫";
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  /** Main storefront URL when admin runs on subdomain */
  function siteBase() {
    if (window.VUAMMO_SITE_ORIGIN) return String(window.VUAMMO_SITE_ORIGIN).replace(/\/$/, "");
    const h = location.hostname || "";
    if (/vuaproxy\.cloud$/i.test(h) || h.startsWith("admin.")) {
      return "https://www.vuaproxy.cloud";
    }
    return "https://www.vuaproxy.cloud";
  }
  function siteUrl(path) {
    const p = path.startsWith("/") ? path : "/" + path;
    const base = siteBase();
    return base ? base + p : p.replace(/^\//, "");
  }

  function setAdminChatLayout(on) {
    const body = document.querySelector(".adm-body");
    if (body) body.classList.toggle("adm-body--chat", !!on);
  }

  function renderAdminBubble(m) {
    const staff = m.role !== "user";
    const html =
      window.VuammoChatMedia && typeof VuammoChatMedia.messageBodyHtml === "function"
        ? VuammoChatMedia.messageBodyHtml(m)
        : esc(m.body || "");
    const who = staff ? (m.role === "shop" ? "Shop" : "Bạn") : "Khách";
    return (
      '<div class="adm-msg adm-msg--' +
      (staff ? "staff" : "user") +
      '">' +
      '<div class="adm-bubble ' +
      (staff ? "staff" : "user") +
      '">' +
      html +
      "</div>" +
      '<div class="adm-msg-meta">' +
      esc(who) +
      " · " +
      esc(fmt(m.created_at)) +
      "</div></div>"
    );
  }

  function guestChatLabel(t) {
    const name = String((t && (t.user_name || t.userName)) || "").trim();
    const email = String((t && (t.user_email || t.userEmail)) || "").trim();
    return { name: name || "Khách", email };
  }

  function renderGuestChatHead(el, tOrName, emailMaybe) {
    if (!el) return;
    let name = "Khách";
    let email = "";
    if (tOrName && typeof tOrName === "object") {
      const g = guestChatLabel(tOrName);
      name = g.name;
      email = g.email;
    } else {
      name = String(tOrName || "").trim() || "Khách";
      email = String(emailMaybe || "").trim();
    }
    el.innerHTML =
      '<div class="adm-chat-guest-name">' +
      esc(name) +
      "</div>" +
      (email
        ? '<div class="adm-chat-guest-email">' + esc(email) + "</div>"
        : '<div class="adm-chat-guest-email adm-muted">Chưa có email (khách chưa đăng nhập)</div>');
  }

  const ORDER_LABELS = {
    all: "Tất cả",
    waiting: "Chờ hoàn thành",
    done: "Hoàn thành",
    disputed: "Khiếu nại",
    // legacy (ẩn pill, vẫn map nếu API cũ)
    paid: "Chờ hoàn thành",
    delivered: "Chờ hoàn thành",
    released: "Hoàn thành",
    refunded: "Hoàn thành"
  };
  const DISPUTE_LABELS = {
    all: "Tất cả",
    open: "Chờ xử lý",
    resolved: "Đã hoàn",
    rejected: "Từ chối KN"
  };
  const TYPE_LABELS = {
    topup: "Nạp tiền",
    purchase: "Mua hàng",
    refund: "Hoàn tiền",
    release: "Giải ngân"
  };

  function isHoldActive(o) {
    return Boolean(o && o.holdUntil && new Date(o.holdUntil) > new Date());
  }
  function orderUiKey(o) {
    if (!o) return "done";
    if (o.status === "disputed" || (o.dispute && o.dispute.status === "open")) return "disputed";
    if (["released", "refunded"].includes(o.status)) return "done";
    if (["paid", "delivered"].includes(o.status)) {
      if (o.holdUntil && new Date(o.holdUntil) <= new Date()) return "done";
      return "waiting";
    }
    return "done";
  }
  function orderUiLabel(o) {
    const key = orderUiKey(o);
    return ORDER_LABELS[key] || key;
  }

  const state = {
    view: "dashboard",
    user: null,
    supportVisitor: null,
    supportGuestMeta: null,
    pendingSupportChat: null,
    shopToken: null,
    shopName: null,
    shopVisitor: null,
    orders: { status: "all", range: "all", q: "", from: "", to: "" },
    dashboard: { range: "all", from: "", to: "" },
    disputes: { status: "all", q: "" },
    ledger: { type: "all", q: "" },
    blog: { q: "", status: "all", locale: "all", category: "all" },
    badges: {},
    badgeTimer: null,
    vpnTab: "proxies"
  };

  function buyerSupportVisitorKey(buyerId) {
    return buyerId ? "u_" + String(buyerId) : "";
  }

  function openSupportChatForOrder(o) {
    if (!o) return;
    const email = String(o.buyerEmail || "").trim();
    const name = String(o.buyerName || "").trim() || "Khách";
    const buyerId = o.buyerId || "";
    state.pendingSupportChat = {
      buyerId: buyerId,
      visitorKey: buyerSupportVisitorKey(buyerId),
      email: email,
      name: name,
      orderCode: o.code || String(o.id || "").slice(0, 8),
      orderHint:
        "Đơn #" +
        (o.code || String(o.id || "").slice(0, 8)) +
        (o.items && o.items[0] ? " · " + String(o.items[0].name || "") : "")
    };
    setView("chatSupport");
  }

  function getCatalogProducts() {
    try {
      if (typeof RAW_PRODUCTS !== "undefined" && Array.isArray(RAW_PRODUCTS)) return RAW_PRODUCTS;
    } catch (_) {}
    return Array.isArray(window.RAW_PRODUCTS) ? window.RAW_PRODUCTS : [];
  }
  function getCatalogShops() {
    try {
      if (typeof VUAMMO_SHOPS !== "undefined" && Array.isArray(VUAMMO_SHOPS)) return VUAMMO_SHOPS;
    } catch (_) {}
    return Array.isArray(window.VUAMMO_SHOPS) ? window.VUAMMO_SHOPS : [];
  }

  /** Map mã SP/biến thể → { title, subtitle, countryCode, countryName } */
  let _stockNameMap = null;
  function getStockNameMap() {
    if (_stockNameMap) return _stockNameMap;
    const map = Object.create(null);
    getCatalogProducts().forEach((p) => {
      const name = p.name || ("SP #" + p.id);
      const countryCode = String(p.countryCode || "").toLowerCase();
      const countryName = String(p.countryName || "").trim();
      const meta = {
        title: name,
        subtitle: "",
        countryCode,
        countryName
      };
      if (Array.isArray(p.variants) && p.variants.length) {
        p.variants.forEach((v) => {
          map[String(v.id)] = {
            title: name,
            subtitle: v.label || ("Biến thể #" + v.id),
            countryCode,
            countryName
          };
        });
      }
      map[String(p.id)] = meta;
    });
    _stockNameMap = map;
    return map;
  }
  function stockProductLabel(productId) {
    const m = getStockNameMap()[String(productId)];
    if (!m) return { title: "Không tìm thấy tên", subtitle: "", countryCode: "", countryName: "" };
    return m;
  }
  function stockCountryOptions(products) {
    const map = Object.create(null);
    (products || []).forEach((p) => {
      const label = stockProductLabel(p.product_id);
      const code = label.countryCode || "";
      if (!code) return;
      if (!map[code]) {
        map[code] = {
          v: code,
          t: (label.countryName || code.toUpperCase()) + " (" + code.toUpperCase() + ")"
        };
      }
    });
    return Object.values(map).sort((a, b) => a.t.localeCompare(b.t, "vi"));
  }

  function getSharePosts() {
    try {
      if (typeof SHARE_POSTS !== "undefined" && Array.isArray(SHARE_POSTS)) return SHARE_POSTS;
    } catch (_) {}
    return Array.isArray(window.SHARE_POSTS) ? window.SHARE_POSTS : [];
  }

  function slugifyText(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  function wrapTextarea(el, before, after) {
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const val = el.value || "";
    const sel = val.slice(start, end) || "…";
    el.value = val.slice(0, start) + before + sel + after + val.slice(end);
    el.focus();
    const pos = start + before.length + sel.length + after.length;
    el.setSelectionRange(pos, pos);
  }

  async function uploadAdminFile(file) {
    if (!file) throw new Error("Chưa chọn file");
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error("Không đọc được file"));
      fr.readAsDataURL(file);
    });
    const data = await api("/admin/upload", {
      method: "POST",
      body: JSON.stringify({ data: dataUrl, filename: file.name })
    });
    return data.url;
  }

  function wireSeoCounter(inputId, labelCntId, max) {
    const input = document.getElementById(inputId);
    const cnt = document.getElementById(labelCntId);
    if (!input || !cnt) return;
    const tick = () => {
      const n = String(input.value || "").length;
      cnt.textContent = n + "/" + max;
      cnt.style.color = n > max ? "#dc2626" : "#94a3b8";
    };
    input.addEventListener("input", tick);
    tick();
  }

  function filterSelect(id, label, options, cur) {
    return (
      '<div class="adm-field"><label>' +
      esc(label) +
      '</label><select id="' +
      id +
      '">' +
      options
        .map(
          (o) =>
            '<option value="' +
            esc(o.v) +
            '"' +
            (String(cur) === String(o.v) ? " selected" : "") +
            ">" +
            esc(o.t) +
            "</option>"
        )
        .join("") +
      "</select></div>"
    );
  }

  function api(path, opts) {
    return VuammoApi.api(path, opts);
  }

  function fmt(d) {
    try {
      return new Date(d).toLocaleString("vi-VN");
    } catch {
      return String(d || "");
    }
  }
  function fmtTime(d) {
    try {
      const x = new Date(d);
      return (
        x.toLocaleTimeString("vi-VN", { hour12: false }) +
        "<br><span class=\"adm-cell-sub\">" +
        x.toLocaleDateString("vi-VN") +
        "</span>"
      );
    } catch {
      return esc(d);
    }
  }
  function statusTag(st) {
    const map = {
      paid: "info",
      delivered: "info",
      waiting: "info",
      disputed: "bad",
      released: "ok",
      done: "ok",
      refunded: "pink",
      open: "warn",
      resolved: "pink",
      rejected: "bad"
    };
    const label = DISPUTE_LABELS[st] || ORDER_LABELS[st] || st;
    return (
      '<span class="adm-tag ' +
      (map[st] || "") +
      '">' +
      esc(label) +
      "</span>"
    );
  }
  function orderStatusTag(o) {
    const key = orderUiKey(o);
    return statusTag(key);
  }
  function moneyCls(n) {
    if (n > 0) return '<span class="adm-money-pos">+' + money(n) + "</span>";
    if (n < 0) return '<span class="adm-money-neg">' + money(n) + "</span>";
    return '<span class="adm-money-zero">' + money(0) + "</span>";
  }
  function shopOfItem(item) {
    return item.seller || item.shopName || item.shop || "—";
  }
  function countryCodeOfItem(item) {
    if (!item) return "";
    if (item.countryCode) return String(item.countryCode).toLowerCase();
    if (item.country) return String(item.country).toLowerCase();
    const img = String(item.image || "");
    const mImg = img.match(/\/flags\/([a-z]{2})\./i);
    if (mImg) return mImg[1].toLowerCase();
    const id = String(item.id || "");
    const mId = id.match(/^lcp-([a-z]{2})-/i);
    if (mId) return mId[1].toLowerCase();
    return "";
  }
  function countryLabelOfItem(item) {
    const code = countryCodeOfItem(item);
    if (!code) {
      const parts = String((item && item.name) || "").split(" · ");
      if (parts.length >= 2) return parts[1];
      return "—";
    }
    const locs = window.VUAPROXY_LOCATIONS || [];
    const hit = locs.find((x) => x.code === code);
    if (hit) return (hit.nameVi || hit.name) + " (" + code.toUpperCase() + ")";
    return code.toUpperCase();
  }
  function countriesOfOrder(o) {
    return (
      [
        ...new Set(
          (o.items || [])
            .map((i) => countryLabelOfItem(i))
            .filter((x) => x && x !== "—")
        )
      ].join(", ") || "—"
    );
  }
  function toast(msg) {
    if (window.VuammoApi && VuammoApi.showToast) VuammoApi.showToast(msg);
    else alert(msg);
  }
  /** Popup xác nhận cho thao tác nguy hiểm (xóa / ẩn / hoàn tiền) */
  function confirmAction(opts) {
    const o = opts || {};
    const title = o.title || "Xác nhận";
    const message = o.message || "Bạn có chắc muốn thực hiện thao tác này?";
    const okText = o.okText || "Xác nhận";
    const cancelText = o.cancelText || "Huỷ";
    const danger = o.danger !== false;
    return new Promise((resolve) => {
      const prev = document.getElementById("admConfirmModal");
      if (prev) prev.remove();
      const wrap = document.createElement("div");
      wrap.id = "admConfirmModal";
      wrap.className = "adm-modal-bg";
      wrap.innerHTML =
        '<div class="adm-modal" role="dialog" aria-modal="true">' +
        "<h3>" +
        esc(title) +
        "</h3><p>" +
        esc(message) +
        '</p><div class="adm-compose-actions">' +
        '<button type="button" class="btn btn-outline" data-c="0">' +
        esc(cancelText) +
        '</button><button type="button" class="btn ' +
        (danger ? "btn-danger" : "btn-primary") +
        '" data-c="1" autofocus>' +
        esc(okText) +
        "</button></div></div>";
      document.body.appendChild(wrap);
      const finish = (ok) => {
        wrap.remove();
        resolve(!!ok);
      };
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) finish(false);
      });
      wrap.querySelector('[data-c="0"]').addEventListener("click", () => finish(false));
      wrap.querySelector('[data-c="1"]').addEventListener("click", () => finish(true));
      document.addEventListener(
        "keydown",
        function onKey(e) {
          if (e.key === "Escape") {
            document.removeEventListener("keydown", onKey);
            finish(false);
          }
        },
        { once: true }
      );
    });
  }


  const BADGE_ACK_VIEWS = {
    orders: "orders",
    disputes: "disputes",
    blog: "blog",
    stock: "stock",
    // chatSupport / chatShop: không ack khi vào menu — chỉ đọc khi mở hội thoại
    notifications: "notifications"
  };

  function hideNavBadge(key) {
    document.querySelectorAll('[data-badge="' + key + '"]').forEach((el) => {
      el.textContent = "";
      el.classList.add("hidden");
    });
    if (state.badges) state.badges[key] = 0;
  }

  async function ackBadge(key) {
    if (!key) return;
    hideNavBadge(key);
    try {
      await api("/admin/badges/ack", {
        method: "POST",
        body: JSON.stringify({ key })
      });
    } catch (_) {}
    refreshBadges();
  }

  async function setView(view) {
    if (view === "shops" || view === "virtualShops" || view === "chatShop") {
      view = "dashboard";
    }
    if (view !== "chatSupport") setAdminChatLayout(false);
    state.view = view;
    document.querySelectorAll(".adm-nav button").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === view);
    });
    if (BADGE_ACK_VIEWS[view]) {
      await ackBadge(BADGE_ACK_VIEWS[view]);
    }
    const title = document.getElementById("admTitle");
    const sub = document.getElementById("admSub");
    const map = {
      dashboard: ["Dashboard", "Theo dõi doanh thu, đơn proxy, ví và hoạt động Vua Proxy"],
      orders: [
        "Đơn hàng",
        "Lọc theo trạng thái · tìm khách · giao / huỷ / hoàn tất đơn proxy"
      ],
      disputes: [
        "Khiếu nại",
        "Admin cập nhật trạng thái xử lý khiếu nại đơn hàng tại đây"
      ],
      products: ["Sản phẩm / Gói proxy", "Ẩn/hiện catalog · ghi chú · gắn nhập kho nhanh"],
      stock: ["Tồn kho proxy", "Thêm / xoá dòng IP giao tự động (1 dòng = 1 đơn vị)"],
      vpnPool: [
        "Kho proxy",
        "Chỉ thêm key. Khi khách mua, proxy tự mở đúng quốc gia và đúng số ngày trên đơn, rồi tự tắt khi hết hạn."
      ],
      promos: [
        "Khuyến mãi",
        "Chọn hiện công khai hoặc chỉ nhập mã; giới hạn số lần mỗi user (0 = không giới hạn)."
      ],
      notifications: [
        "Thông báo",
        "Gửi thông báo hệ thống tới tất cả khách / nhóm audience"
      ],
      blog: ["Blog / Viết bài", "Đồng bộ từ website · form SEO đầy đủ · publish lên Chia sẻ"],
      users: ["Quản lý Users", "Danh sách tài khoản khách trên Vua Proxy"],
      blacklist: [
        "Blacklist",
        "User trong list bị chặn mua hàng. Gỡ blacklist để mở lại."
      ],
      wallet: [
        "Ví người dùng",
        "Tất cả user và số dư (mặc định 0₫ nếu chưa có giao dịch). Nạp / trừ thủ công."
      ],
      ledger: [
        "Giao dịch ví",
        "Lịch sử nạp PayOS · mua hàng · hoàn / điều chỉnh admin"
      ],
      chatSupport: [
        "Chat hỗ trợ ↔ Khách",
        "Kênh hỗ trợ khách hàng Vua Proxy (đơn, nạp tiền, bảo hành proxy)"
      ]
    };
    const t = map[view] || ["Admin", ""];
    if (title) title.textContent = t[0];
    if (sub) sub.textContent = t[1];
    const actions = document.getElementById("admTopActions");
    if (actions) {
      actions.innerHTML =
        '<button type="button" class="btn btn-outline" id="admRefresh">Làm mới</button>';
      document.getElementById("admRefresh")?.addEventListener("click", () => render());
    }
    render();
  }

  async function boot() {
    const mount = document.getElementById("admRoot");
    if (!mount) return;
    await VuammoAuth.refreshMe();
    const user = VuammoAuth.getUser();
    if (!user) {
      mount.innerHTML = loginHtml();
      wireLogin();
      return;
    }
    if (user.isAdmin === false) {
      mount.innerHTML =
        '<div class="adm-login"><h1>Không có quyền admin</h1><p>Tài khoản ' +
        esc(user.email) +
        " chưa nằm trong ADMIN_EMAILS.</p>" +
        '<a class="btn btn-outline" href="' +
        siteUrl("index.html") +
        '">Về trang chủ</a></div>';
      return;
    }
    state.user = user;
    mount.innerHTML = shellHtml(user);
    document.querySelectorAll(".adm-nav button").forEach((b) => {
      b.addEventListener("click", () => setView(b.dataset.view));
    });
    document.getElementById("admLogout")?.addEventListener("click", async () => {
      await VuammoAuth.logout();
      location.reload();
    });
    setView("dashboard");
    refreshBadges();
    if (state.badgeTimer) clearInterval(state.badgeTimer);
    state.badgeTimer = setInterval(refreshBadges, 20000);
  }

  async function refreshBadges() {
    try {
      const b = await api("/admin/badges");
      state.badges = b || {};
      document.querySelectorAll("[data-badge]").forEach((el) => {
        const key = el.getAttribute("data-badge");
        const n = Number(b[key] || 0);
        if (n > 0) {
          el.textContent = n > 99 ? "99+" : String(n);
          el.classList.remove("hidden");
        } else {
          el.textContent = "";
          el.classList.add("hidden");
        }
      });
    } catch (_) {}
  }

  function loginHtml() {
    return (
      '<div class="adm-login"><h1>Vua Proxy Admin</h1>' +
      "<p>Đăng nhập tài khoản quản trị để theo dõi đơn proxy, ví, kho IP và chat hỗ trợ.</p>" +
      '<form id="admLoginForm">' +
      "<label>Email</label><input name=\"email\" type=\"email\" required>" +
      "<label>Mật khẩu</label><input name=\"password\" type=\"password\" required>" +
      '<div class="adm-actions"><button class="btn btn-primary" type="submit">Đăng nhập</button>' +
      '<a class="btn btn-outline" href="' +
      siteUrl("/tai-khoan") +
      '">Tạo tài khoản</a></div>' +
      '<p class="adm-muted" id="admLoginErr"></p></form></div>'
    );
  }

  function wireLogin() {
    document.getElementById("admLoginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await VuammoAuth.login(String(fd.get("email")), String(fd.get("password")));
        location.reload();
      } catch (err) {
        const el = document.getElementById("admLoginErr");
        if (el) el.textContent = err.message || "Đăng nhập thất bại";
      }
    });
  }

  function ico(path) {
    return (
      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      path +
      "</svg>"
    );
  }

  function shellHtml(user) {
    return (
      '<div class="adm-shell">' +
      '<aside class="adm-side">' +
      '<div class="adm-brand"><img src="/images/logo-vuaproxy.png?v=20260915logo1" alt="Vua Proxy">' +
      "<div><strong>Vua Proxy Admin</strong><span>Đơn proxy, ví, kho IP &amp; chat hỗ trợ</span></div></div>" +
      '<nav class="adm-nav">' +
      '<div class="adm-nav-label">Tổng quan</div>' +
      btn("dashboard", "Dashboard", "M3 12h18M3 6h18M3 18h18") +
      '<div class="adm-nav-label">Vận hành</div>' +
      btn("orders", "Đơn hàng", "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2") +
      btn("disputes", "Khiếu nại", "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z") +
      btn("products", "Sản phẩm / Gói proxy", "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4") +
      btn("stock", "Tồn kho proxy", "M4 7h16M4 12h16M4 17h10") +
      btn("vpnPool", "Kho proxy VPN", "M12 2a10 10 0 100 20 10 10 0 000-20zm0 6v4l3 2") +
      btn("promos", "Khuyến mãi", "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z") +
      btn("notifications", "Thông báo", "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9") +
      btn("blog", "Blog / Viết bài", "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z") +
      btn("blacklist", "Blacklist", "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636") +
      '<div class="adm-nav-label">Chat</div>' +
      btn("chatSupport", "Chat hỗ trợ ↔ Khách", "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z") +
      '<div class="adm-nav-label">Tài chính &amp; Users</div>' +
      btn("users", "Quản lý Users", "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z") +
      btn("wallet", "Ví người dùng", "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z") +
      btn("ledger", "Giao dịch ví", "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2") +
      "</nav>" +
      '<div class="adm-side-foot">' +
      esc(user.email) +
      '<br><button type="button" class="btn btn-ghost" id="admLogout" style="margin-top:8px">Đăng xuất</button>' +
      '<br><a href="' +
      siteUrl("index.html") +
      '">← Về website</a></div></aside>' +
      '<div class="adm-main"><header class="adm-top"><div><h1 id="admTitle">Dashboard</h1>' +
      '<p id="admSub"></p></div><div class="adm-top-actions" id="admTopActions"></div></header>' +
      '<div class="adm-body" id="admBody"></div></div></div>'
    );
  }

  function btn(view, label, path) {
    return (
      '<button type="button" data-view="' +
      view +
      '">' +
      ico('<path stroke-linecap="round" stroke-linejoin="round" d="' + path + '"/>') +
      '<span class="adm-nav-label-text">' +
      label +
      "</span>" +
      '<span class="badge hidden" data-badge="' +
      view +
      '"></span></button>'
    );
  }

  async function render() {
    const body = document.getElementById("admBody");
    if (!body) return;
    body.innerHTML = '<p class="adm-muted">Đang tải…</p>';
    try {
      if (state.view === "dashboard") await renderDashboard(body);
      else if (state.view === "orders") await renderOrders(body);
      else if (state.view === "disputes") await renderDisputes(body);
      else if (state.view === "products") await renderProducts(body);
      else if (state.view === "stock") await renderStock(body);
      else if (state.view === "vpnPool") await renderVpnPool(body);
      else if (state.view === "promos") await renderPromos(body);
      else if (state.view === "notifications") await renderNotifications(body);
      else if (state.view === "blog") await renderBlog(body);
      else if (state.view === "users") await renderUsers(body);
      else if (state.view === "blacklist") await renderBlacklist(body);
      else if (state.view === "wallet") await renderWallet(body);
      else if (state.view === "ledger") await renderLedger(body);
      else if (state.view === "chatSupport") await renderChatSupport(body);
    } catch (err) {
      body.innerHTML = '<p class="adm-muted">' + esc(err.message) + "</p>";
    }
    refreshBadges();
  }

  function stat(label, value, cls) {
    return (
      '<div class="adm-stat"><span>' +
      esc(label) +
      "</span><b" +
      (cls ? ' class="' + cls + '"' : "") +
      ">" +
      value +
      "</b></div>"
    );
  }

  async function renderVpnPool(body) {
    const data = await api("/admin/vpn-pool");
    const tab = state.vpnTab || "proxies";
    const host = data.settings?.advertiseHost || "";
    body.innerHTML =
      '<div class="vpn-board">' +
      '<div class="vpn-head"><div><strong>Kho proxy</strong>' +
      "<span>Không dựng trước. Proxy mở lúc khách thanh toán, theo quốc gia và thời hạn của đơn.</span></div>" +
      '<div class="vpn-host">IP máy <b>' +
      esc(host || "chưa đặt") +
      "</b></div>" +
      '<button type="button" class="btn btn-primary" id="vpnAdd">Thêm cấu hình</button></div>' +
      '<div class="vpn-tabs">' +
      vpnTabBtn("proxies", "Proxy (" + (data.proxies || []).length + ")", tab) +
      vpnTabBtn("logs", "Nhật ký", tab) +
      vpnTabBtn("settings", "Cài đặt", tab) +
      "</div>" +
      (data.building ? '<p class="vpn-note">Đang dựng proxy… trang sẽ tự cập nhật.</p>' : "") +
      (tab === "proxies" ? vpnProxyGrid(data) : "") +
      (tab === "logs" ? vpnLogs(data) : "") +
      (tab === "settings" ? vpnSettings(data) : "") +
      "</div>";
    body.querySelectorAll("[data-vpn-tab]").forEach((b) => {
      b.addEventListener("click", () => {
        state.vpnTab = b.getAttribute("data-vpn-tab");
        render();
      });
    });
    document.getElementById("vpnAdd")?.addEventListener("click", () => {
      state.vpnTab = "settings";
      render();
    });
    document.getElementById("vpnProbe")?.addEventListener("click", () => vpnAct("/admin/vpn-pool/probe", "POST"));
    document.getElementById("vpnSaveHost")?.addEventListener("click", async () => {
      try {
        await api("/admin/vpn-pool/settings", {
          method: "PUT",
          body: JSON.stringify({
            advertiseHost: document.getElementById("vpnHost").value,
            portStart: document.getElementById("vpnPort").value
          })
        });
        VuammoApi.showToast("Đã lưu IP máy");
        render();
      } catch (err) {
        VuammoApi.showToast(err.message);
      }
    });
    document.getElementById("vpnSourceForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api("/admin/vpn-pool/sources", {
          method: "POST",
          body: JSON.stringify({
            provider: fd.get("provider"),
            secret: fd.get("secret"),
            slots: fd.get("slots")
          })
        });
        e.target.reset();
        VuammoApi.showToast("Đã thêm key");
        render();
      } catch (err) {
        VuammoApi.showToast(err.message);
      }
    });
    body.querySelectorAll("[data-del-source]").forEach((b) => {
      b.addEventListener("click", async () => {
        if (!confirm("Xóa key này và các proxy chưa giữ?")) return;
        try {
          await api("/admin/vpn-pool/sources/" + b.getAttribute("data-del-source"), { method: "DELETE" });
          render();
        } catch (err) {
          VuammoApi.showToast(err.message);
        }
      });
    });
    body.querySelectorAll("[data-copy]").forEach((b) => {
      b.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(b.getAttribute("data-copy"));
          VuammoApi.showToast("Đã chép");
        } catch (_) {
          VuammoApi.showToast(b.getAttribute("data-copy"));
        }
      });
    });
    if (data.building && state.view === "vpnPool") {
      clearTimeout(state.vpnTimer);
      state.vpnTimer = setTimeout(() => {
        if (state.view === "vpnPool") render();
      }, 4000);
    }
  }

  function vpnTabBtn(id, label, current) {
    return (
      '<button type="button" data-vpn-tab="' +
      id +
      '" class="' +
      (id === current ? "on" : "") +
      '">' +
      esc(label) +
      "</button>"
    );
  }

  function vpnProxyGrid(data) {
    const rows = data.proxies || [];
    if (!rows.length) {
      return '<p class="vpn-empty">Chưa có proxy đang chạy. Thêm key ở Cài đặt. Cổng chỉ mở khi khách mua, đúng quốc gia và số ngày trên đơn.</p>';
    }
    return (
      '<div class="vpn-grid">' +
      rows
        .map((p) => {
          const place = [p.exitIp, p.location].filter(Boolean).join(" · ");
          return (
            '<article class="vpn-card">' +
            "<header><b>" +
            esc(p.endpoint) +
            '</b><button type="button" data-copy="' +
            esc(p.endpoint + ":" + p.user + ":" + p.pass) +
            '" title="Chép">⎘</button></header>' +
            "<p>" +
            esc(place || "Đang dò IP") +
            "</p>" +
            '<span class="vpn-tag">' +
            esc(p.label) +
            "</span> " +
            '<span class="vpn-tag ' +
            esc(p.status) +
            '">' +
            esc(p.status === "assigned" ? "đã giao" : p.status === "up" ? "sống" : p.status) +
            "</span></article>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function vpnLogs(data) {
    const rows = data.logs || [];
    if (!rows.length) return '<p class="vpn-empty">Chưa có nhật ký.</p>';
    return (
      '<div class="vpn-logs">' +
      rows
        .map((row) => "<p class=\"" + esc(row.level) + '">' + esc(row.message) + "</p>")
        .join("") +
      "</div>"
    );
  }

  function vpnSettings(data) {
    const s = data.settings || {};
    const options = (data.providers || [])
      .map((p) => '<option value="' + esc(p.id) + '">' + esc(p.label) + "</option>")
      .join("");
    const sources = (data.sources || [])
      .map(
        (src) =>
          "<li><b>" +
          esc(src.label) +
          "</b> · " +
          esc(src.username || "key") +
          " · " +
          esc(String(src.slots)) +
          " cổng cùng lúc · " +
          esc(src.countries ? src.countries : "mọi quốc gia khách mua") +
          ' <button type="button" data-del-source="' +
          src.id +
          '">Xóa</button></li>'
      )
      .join("");
    return (
      '<div class="vpn-settings">' +
      "<p>Chỉ dán key, không dựng proxy trước. Khách mua nước nào, bao nhiêu ngày, hệ thống mở đúng cổng đó rồi tự tắt khi hết hạn. Mỗi key chịu tối đa 10 cổng đang chạy; khoảng 1000 cổng cùng lúc thì cần khoảng 100 key.</p>" +
      '<div class="adm-filters">' +
      '<div class="adm-field"><label>IP máy phát cho khách</label><input id="vpnHost" value="' +
      esc(s.advertiseHost || "") +
      '" placeholder="10.10.2.213"></div>' +
      '<div class="adm-field"><label>Cổng bắt đầu</label><input id="vpnPort" type="number" value="' +
      esc(String(s.portStart || 8284)) +
      '"></div>' +
      '<button type="button" class="btn btn-outline" id="vpnSaveHost">Lưu</button>' +
      '<button type="button" class="btn btn-outline" id="vpnProbe">Dò lại IP</button></div>' +
      '<form id="vpnSourceForm" class="adm-filters">' +
      '<div class="adm-field"><label>VPN</label><select name="provider">' +
      options +
      "</select></div>" +
      '<div class="adm-field"><label>Key</label><input name="secret" autocomplete="off" required placeholder="Dán key VPN"></div>' +
      '<div class="adm-field"><label>Slot tối đa</label><input name="slots" type="number" min="1" max="10" value="10" title="Số cổng đang chạy cùng lúc trên key này, không phải số proxy tạo sẵn"></div>' +
      '<button class="btn btn-primary" type="submit">Thêm key</button></form>' +
      "<ul class=\"vpn-sources\">" +
      (sources || "<li>Chưa có key.</li>") +
      "</ul></div>"
    );
  }

  async function vpnAct(path, method) {
    try {
      await api(path, { method });
      VuammoApi.showToast("Đã gửi lệnh");
      render();
    } catch (err) {
      VuammoApi.showToast(err.message);
    }
  }

  async function renderDashboard(body) {
    const f = state.dashboard || { range: "all", from: "", to: "" };
    const qs = new URLSearchParams({
      range: f.range || "all",
      from: f.from || "",
      to: f.to || ""
    });
    const data = await api("/admin/dashboard?" + qs.toString());
    const s = data.stats;
    const recent = (data.recentOrders || []).filter(
      (o) => o && !["pending_payment", "expired"].includes(String(o.status || ""))
    );
    const usersLabel = s.usersIsNewInRange ? "Users mới" : "Users";
    body.innerHTML =
      (s.payosMock
        ? '<div class="adm-card"><span class="adm-tag warn">PayOS đang MOCK</span> — nạp tiền chưa thu thật. Cần gắn key PayOS live.</div>'
        : "") +
      '<div class="adm-card"><div class="adm-filters">' +
      '<div class="adm-range-btns" id="dashRange">' +
      rangeBtn("all", "Mọi ngày", f.range) +
      rangeBtn("today", "Hôm nay", f.range) +
      rangeBtn("7d", "7 ngày", f.range) +
      rangeBtn("30d", "30 ngày", f.range) +
      "</div>" +
      '<div class="adm-field"><label>Từ ngày</label><input type="date" id="dashFrom" value="' +
      esc(f.from || "") +
      '"></div>' +
      '<div class="adm-field"><label>Đến ngày</label><input type="date" id="dashTo" value="' +
      esc(f.to || "") +
      '"></div>' +
      '<button type="button" class="btn btn-primary" id="dashApply">Lọc</button>' +
      "</div></div>" +
      '<div class="adm-grid">' +
      stat("Doanh thu đơn", money(s.orderRevenue)) +
      stat("Đã trừ ví (mua)", money(s.purchaseVolume), "neg") +
      stat("Đã nạp ví", money(s.topupVolume), "pos") +
      stat("Đơn hàng", s.orders) +
      stat(usersLabel, s.users) +
      stat("Tồn kho còn", s.stockAvailable) +
      stat("Khiếu nại mở", s.openDisputes, s.openDisputes ? "warn" : "") +
      "</div>" +
      '<div class="adm-card"><div class="adm-card-head"><h2>Đơn gần đây</h2>' +
      '<button type="button" class="btn btn-outline btn-sm" id="goOrders">Xem tất cả</button></div>' +
      '<div class="adm-table-wrap"><table class="adm-table"><thead><tr>' +
      "<th>Khách</th><th>Quốc gia</th><th>Sản phẩm</th><th>Giá</th><th>Trạng thái</th>" +
      "</tr></thead><tbody>" +
      (recent.length
        ? recent
            .map((o) => {
              const items = (o.items || []).map((i) => i.name).join(", ");
              return (
                '<tr><td><span class="adm-cell-main">' +
                esc(o.buyerName || o.buyerEmail || "—") +
                '</span><span class="adm-cell-sub">' +
                esc(o.buyerEmail || "") +
                "</span></td><td>" +
                esc(countriesOfOrder(o)) +
                "</td><td>" +
                esc(items) +
                "</td><td>" +
                money(o.total) +
                "</td><td>" +
                orderStatusTag(o) +
                "</td></tr>"
              );
            })
            .join("")
        : '<tr><td colspan="5" class="adm-empty">Không có đơn trong khoảng đã chọn</td></tr>') +
      "</tbody></table></div></div>";
    document.getElementById("goOrders")?.addEventListener("click", () => setView("orders"));
    document.getElementById("dashRange")?.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        state.dashboard.range = b.getAttribute("data-r");
        state.dashboard.from = "";
        state.dashboard.to = "";
        renderDashboard(body);
      });
    });
    document.getElementById("dashApply")?.addEventListener("click", () => {
      state.dashboard.from = document.getElementById("dashFrom").value;
      state.dashboard.to = document.getElementById("dashTo").value;
      if (state.dashboard.from || state.dashboard.to) state.dashboard.range = "all";
      renderDashboard(body);
    });
  }

  async function renderOrders(body) {
    const f = state.orders;
    const qs = new URLSearchParams({
      limit: "100",
      status: f.status,
      range: f.range,
      q: f.q,
      from: f.from,
      to: f.to
    });
    const data = await api("/admin/orders?" + qs.toString());
    const c = data.counts || {};
    const pills = ["all", "waiting", "done", "disputed"]
      .map((st) => {
        const n = c[st] != null ? c[st] : st === "all" ? c.all || 0 : 0;
        return (
          '<button type="button" class="adm-pill' +
          (f.status === st ? " active" : "") +
          '" data-st="' +
          st +
          '">' +
          esc(ORDER_LABELS[st]) +
          " (" +
          n +
          ")</button>"
        );
      })
      .join("");

    body.innerHTML =
      '<div class="adm-hint">Ẩn đơn chưa thanh toán. <b>Chờ hoàn thành</b> = còn hiệu lực gói (có thể khiếu nại) · <b>Hoàn thành</b> = hết hạn · <b>Hoàn tất</b> (nút) kết thúc sớm · <b>Hoàn tiền</b> trả ví khách.</div>' +
      '<div class="adm-pills" id="ordPills">' +
      pills +
      "</div>" +
      '<div class="adm-card"><div class="adm-filters">' +
      '<div class="adm-range-btns" id="ordRange">' +
      rangeBtn("all", "Mọi ngày", f.range) +
      rangeBtn("today", "Hôm nay", f.range) +
      rangeBtn("7d", "7 ngày", f.range) +
      rangeBtn("30d", "30 ngày", f.range) +
      "</div>" +
      '<div class="adm-field"><label>Từ ngày</label><input type="date" id="ordFrom" value="' +
      esc(f.from) +
      '"></div>' +
      '<div class="adm-field"><label>Đến ngày</label><input type="date" id="ordTo" value="' +
      esc(f.to) +
      '"></div>' +
      '<input class="adm-search" id="ordQ" placeholder="Tìm email / tên / mã đơn…" value="' +
      esc(f.q) +
      '">' +
      '<button type="button" class="btn btn-primary" id="ordApply">Lọc</button>' +
      "</div></div>" +
      '<div class="adm-card"><div class="adm-table-wrap"><table class="adm-table"><thead><tr>' +
      "<th>ID</th><th>Khách</th><th>Quốc gia</th><th>Sản phẩm / Gói</th><th>Giá</th><th>Trạng thái</th><th>Ngày</th><th></th>" +
      "</tr></thead><tbody>" +
      (data.orders || [])
        .map((o) => {
          const countries = countriesOfOrder(o);
          const items = (o.items || []).map((i) => esc(i.name) + " ×" + i.qty).join("<br>");
          const canDone = orderUiKey(o) === "waiting";
          const canCancel = o.status !== "refunded" && o.status !== "released";
          const canWarranty =
            o.status !== "pending_payment" &&
            o.status !== "expired" &&
            o.status !== "refunded";
          const whCount = Math.max(0, Number(o.warrantyCount) || 0);
          return (
            '<tr data-id="' +
            o.id +
            '"><td>#' +
            esc(o.code || String(o.id).slice(0, 8)) +
            '</td><td><span class="adm-cell-main">' +
            esc(o.buyerName || "—") +
            '</span><span class="adm-cell-sub">' +
            esc(o.buyerEmail) +
            "</span></td><td>" +
            esc(countries) +
            "</td><td>" +
            items +
            "</td><td><b>" +
            money(o.total) +
            "</b></td><td>" +
            orderStatusTag(o) +
            (o.dispute && o.dispute.status === "open"
              ? '<div class="adm-tag bad" style="margin-top:4px">KN: ' +
                esc(o.dispute.reason || "") +
                "</div>"
              : o.dispute && o.dispute.status === "rejected" && o.status !== "refunded"
                ? '<div class="adm-tag bad" style="margin-top:4px">Từ chối KN</div>'
                : "") +
            (whCount
              ? '<div class="adm-tag info" style="margin-top:4px">BH ×' + whCount + "</div>"
              : "") +
            "</td><td>" +
            fmtTime(o.createdAt) +
            '</td><td><div class="adm-row-actions adm-row-actions--orders">' +
            '<button type="button" class="btn btn-outline btn-sm js-detail">Chi tiết</button>' +
            '<button type="button" class="btn btn-primary btn-sm js-chat">Chat</button>' +
            (canWarranty
              ? '<button type="button" class="btn btn-outline btn-sm js-warranty adm-btn-warranty">Bảo hành</button>'
              : '<span class="adm-row-slot" aria-hidden="true"></span>') +
            (canCancel
              ? '<button type="button" class="btn btn-danger btn-sm js-cancel">Hoàn tiền</button>'
              : '<span class="adm-row-slot" aria-hidden="true"></span>') +
            (canDone
              ? '<button type="button" class="btn btn-ok btn-sm js-done">Hoàn tất</button>'
              : '<span class="adm-row-slot" aria-hidden="true"></span>') +
            "</div></td></tr>"
          );
        })
        .join("") ||
      '<tr><td colspan="8" class="adm-empty">Chưa có đơn phù hợp bộ lọc</td></tr>' +
      "</tbody></table></div></div>";

    document.getElementById("ordPills")?.querySelectorAll(".adm-pill").forEach((b) => {
      b.addEventListener("click", () => {
        state.orders.status = b.getAttribute("data-st");
        renderOrders(body);
      });
    });
    document.getElementById("ordRange")?.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        state.orders.range = b.getAttribute("data-r");
        state.orders.from = "";
        state.orders.to = "";
        renderOrders(body);
      });
    });
    document.getElementById("ordApply")?.addEventListener("click", () => {
      state.orders.q = document.getElementById("ordQ").value.trim();
      state.orders.from = document.getElementById("ordFrom").value;
      state.orders.to = document.getElementById("ordTo").value;
      if (state.orders.from || state.orders.to) state.orders.range = "all";
      renderOrders(body);
    });
    body.querySelectorAll(".js-detail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest("tr").getAttribute("data-id");
        const o = (data.orders || []).find((x) => x.id === id);
        if (!o) return;
        const delivery = Array.isArray(o.delivery)
          ? o.delivery
              .map((d) => (d.lines || []).join("\n"))
              .filter(Boolean)
              .join("\n---\n")
          : o.deliveryNote || "(chưa có payload)";
        alert(
          "Đơn #" +
            (o.code || id) +
            "\nKhách: " +
            o.buyerEmail +
            "\nTT: " +
            orderUiLabel(o) +
            (o.holdUntil ? "\nHiệu lực đến: " + new Date(o.holdUntil).toLocaleString("vi-VN") : "") +
            "\nTổng: " +
            money(o.total) +
            "\n\nGiao hàng:\n" +
            delivery
        );
      });
    });
    body.querySelectorAll(".js-chat").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest("tr").getAttribute("data-id");
        const o = (data.orders || []).find((x) => String(x.id) === String(id));
        if (!o) return toast("Không tìm thấy đơn");
        openSupportChatForOrder(o);
      });
    });
    body.querySelectorAll(".js-warranty").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest("tr").getAttribute("data-id");
        const o = (data.orders || []).find((x) => String(x.id) === String(id));
        if (!o) return toast("Không tìm thấy đơn");
        const ok = await openWarrantyModal(o);
        if (ok) renderOrders(body);
      });
    });
    body.querySelectorAll(".js-cancel").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await confirmAction({ title: "Hoàn tiền đơn hàng", message: "Số tiền đơn sẽ được cộng lại vào ví khách. Thao tác không hoàn tác được.", okText: "Hoàn tiền" }))) return;
        const id = btn.closest("tr").getAttribute("data-id");
        const res = await api("/admin/orders/" + id, {
          method: "PATCH",
          body: JSON.stringify({ status: "refunded" })
        });
        const amt = res && res.refundCents ? money(res.refundCents) : "";
        toast(amt ? "Đã hoàn " + amt + " về ví khách" : "Đã hoàn tiền đơn");
        renderOrders(body);
      });
    });
    body.querySelectorAll(".js-done").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest("tr").getAttribute("data-id");
        await api("/admin/orders/" + id, {
          method: "PATCH",
          body: JSON.stringify({ status: "released" })
        });
        toast("Đã hoàn tất đơn");
        renderOrders(body);
      });
    });
  }

  function openWarrantyModal(order) {
    return new Promise((resolve) => {
      const prev = document.getElementById("admWarrantyModal");
      if (prev) prev.remove();
      const items = Array.isArray(order.items) ? order.items : [];
      const delivery = Array.isArray(order.delivery) ? order.delivery : [];
      const nextSeq = Math.max(0, Number(order.warrantyCount) || 0) + 1;
      const previewCode = (order.code || "ORDER") + "-BH" + nextSeq;
      const deliveryPreview = delivery.length
        ? delivery
            .map((d) => {
              const lines = (d.lines || []).filter(Boolean);
              return (
                "<div class=\"adm-field\" style=\"margin:0 0 10px\">" +
                "<label style=\"margin:0 0 4px\">" +
                esc(d.name || d.productId || "Sản phẩm") +
                " ×" +
                esc(d.qty || 1) +
                "</label>" +
                '<pre style="margin:0;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;white-space:pre-wrap;max-height:140px;overflow:auto">' +
                esc(lines.join("\n") || "(không có payload)") +
                "</pre></div>"
              );
            })
            .join("")
        : '<p class="adm-muted">Chưa có payload giao hàng gốc — vẫn có thể bảo hành từ tồn kho theo sản phẩm đơn.</p>';

      const qtyRows = items.length
        ? items
            .map((it, idx) => {
              const rawPid = String(it.productId || it.product_id || "").trim();
              const rawId = String(it.id || "").trim();
              const pid =
                rawPid && !/^(lcp-|manual-|proxy-loc-)/i.test(rawPid)
                  ? rawPid
                  : rawPid || rawId;
              const maxQ = Math.max(1, Math.round(Number(it.qty) || 1));
              return (
                '<div class="adm-field" style="margin:0 0 10px">' +
                "<label>" +
                esc(it.name || pid) +
                " <span class=\"cnt\">tối đa " +
                maxQ +
                "</span></label>" +
                '<input type="number" min="0" max="' +
                maxQ +
                '" value="' +
                maxQ +
                '" data-wh-idx="' +
                idx +
                '" data-product-id="' +
                esc(pid) +
                '" data-line-id="' +
                esc(rawId) +
                '" data-name="' +
                esc(it.name || pid) +
                '" data-country="' +
                esc(it.countryCode || it.country_code || "") +
                '" data-package="' +
                esc(it.packageKey || it.package_key || "") +
                '" data-max="' +
                maxQ +
                '"></div>'
              );
            })
            .join("")
        : '<p class="adm-muted">Đơn không có dòng sản phẩm.</p>';

      const wrap = document.createElement("div");
      wrap.id = "admWarrantyModal";
      wrap.className = "adm-modal-bg";
      wrap.innerHTML =
        '<div class="adm-modal adm-modal--wide" role="dialog" aria-modal="true">' +
        "<h3>Bảo hành đơn #" +
        esc(order.code || "") +
        "</h3>" +
        '<p style="margin:0 0 12px">Mã bảo hành lần này: <b>' +
        esc(previewCode) +
        "</b>. Hệ thống lấy hàng còn trong tồn kho và gửi vào chat khách.</p>" +
        '<div style="margin-bottom:14px"><div style="font-size:12.5px;font-weight:700;color:#334155;margin-bottom:6px">Sản phẩm đã gửi trước đó</div>' +
        deliveryPreview +
        "</div>" +
        '<div style="margin-bottom:8px"><div style="font-size:12.5px;font-weight:700;color:#334155;margin-bottom:6px">Số lượng bảo hành</div>' +
        qtyRows +
        "</div>" +
        '<div class="adm-compose-actions">' +
        '<button type="button" class="btn btn-outline" data-c="0">Huỷ</button>' +
        '<button type="button" class="btn btn-primary" data-c="1">Bảo hành &amp; gửi hàng</button>' +
        "</div></div>";
      document.body.appendChild(wrap);

      const finish = (ok) => {
        wrap.remove();
        resolve(!!ok);
      };
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) finish(false);
      });
      wrap.querySelector('[data-c="0"]').addEventListener("click", () => finish(false));
      wrap.querySelector('[data-c="1"]').addEventListener("click", async () => {
        const payloadItems = [];
        let qtyError = "";
        wrap.querySelectorAll("input[data-wh-idx]").forEach((inp) => {
          const qty = Math.max(0, Math.round(Number(inp.value) || 0));
          const maxQ = Math.max(1, Number(inp.getAttribute("data-max") || 1));
          if (qty < 1) return;
          if (qty > maxQ) {
            qtyError = "Số lượng không được vượt " + maxQ;
            return;
          }
          payloadItems.push({
            productId: inp.getAttribute("data-product-id") || "",
            id: inp.getAttribute("data-line-id") || "",
            name: inp.getAttribute("data-name") || "",
            countryCode: inp.getAttribute("data-country") || "",
            packageKey: inp.getAttribute("data-package") || "",
            qty
          });
        });
        if (qtyError) return toast(qtyError);
        if (!payloadItems.length) return toast("Chọn ít nhất 1 sản phẩm / số lượng > 0");
        const btnOk = wrap.querySelector('[data-c="1"]');
        if (btnOk) {
          btnOk.disabled = true;
          btnOk.textContent = "Đang gửi…";
        }
        try {
          const res = await api("/admin/orders/" + order.id + "/warranty", {
            method: "POST",
            body: JSON.stringify({ items: payloadItems })
          });
          toast("Đã bảo hành #" + (res.warrantyCode || previewCode) + " — đã gửi chat khách");
          finish(true);
        } catch (e) {
          toast(e.message || "Bảo hành lỗi");
          if (btnOk) {
            btnOk.disabled = false;
            btnOk.textContent = "Bảo hành & gửi hàng";
          }
        }
      });
      document.addEventListener(
        "keydown",
        function onKey(e) {
          if (e.key === "Escape") {
            document.removeEventListener("keydown", onKey);
            finish(false);
          }
        },
        { once: true }
      );
    });
  }

  function rangeBtn(id, label, cur) {
    return (
      '<button type="button" data-r="' +
      id +
      '" class="' +
      (cur === id ? "active" : "") +
      '">' +
      label +
      "</button>"
    );
  }

  async function renderDisputes(body) {
    const f = state.disputes;
    const qs = new URLSearchParams({ status: f.status, q: f.q });
    const data = await api("/admin/disputes?" + qs.toString());
    const c = data.counts || {};
    const pills = ["all", "open", "resolved", "rejected"]
      .map((st) => {
        return (
          '<button type="button" class="adm-pill' +
          (f.status === st ? " active" : "") +
          '" data-st="' +
          st +
          '">' +
          DISPUTE_LABELS[st] +
          " (" +
          (c[st] || 0) +
          ")</button>"
        );
      })
      .join("");
    body.innerHTML =
      '<div class="adm-hint"><b>Hoàn tiền</b> → cộng ví khách + Đã hoàn. <b>Từ chối</b> → trạng thái Từ chối KN (không hoàn tiền).</div>' +
      '<div class="adm-pills" id="dpPills">' +
      pills +
      "</div>" +
      '<div class="adm-card"><div class="adm-filters">' +
      '<input class="adm-search" id="dpQ" placeholder="Tìm lý do, mã đơn, email…" value="' +
      esc(f.q) +
      '">' +
      '<button type="button" class="btn btn-outline" id="dpRefresh">Làm mới</button></div></div>' +
      '<div class="adm-card"><div class="adm-table-wrap"><table class="adm-table"><thead><tr>' +
      "<th>Đơn</th><th>Khách</th><th>Lý do</th><th>Tổng</th><th>Trạng thái</th><th>Ngày</th><th></th>" +
      "</tr></thead><tbody>" +
      ((data.disputes || []).length
        ? data.disputes
            .map(
              (d) =>
                '<tr data-id="' +
                d.id +
                '"><td>#' +
                esc(d.orderCode || String(d.orderId).slice(0, 8)) +
                '</td><td><span class="adm-cell-main">' +
                esc(d.name || "—") +
                '</span><span class="adm-cell-sub">' +
                esc(d.email) +
                "</span></td><td>" +
                esc(d.reason) +
                "</td><td>" +
                money(d.total) +
                "</td><td>" +
                statusTag(d.status) +
                "</td><td>" +
                fmtTime(d.createdAt) +
                '</td><td><div class="adm-row-actions">' +
                (d.status === "open"
                  ? '<button type="button" class="btn btn-ok btn-sm js-res">Hoàn tiền</button>' +
                    '<button type="button" class="btn btn-danger btn-sm js-rej">Từ chối</button>'
                  : "—") +
                "</div></td></tr>"
            )
            .join("")
        : '<tr><td colspan="7" class="adm-empty">Chưa có khiếu nại nào</td></tr>') +
      "</tbody></table></div></div>";

    document.getElementById("dpPills")?.querySelectorAll(".adm-pill").forEach((b) => {
      b.addEventListener("click", () => {
        state.disputes.status = b.getAttribute("data-st");
        renderDisputes(body);
      });
    });
    document.getElementById("dpRefresh")?.addEventListener("click", () => {
      state.disputes.q = document.getElementById("dpQ").value.trim();
      renderDisputes(body);
    });
    body.querySelectorAll(".js-res").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await confirmAction({ title: "Hoàn tiền khiếu nại", message: "Sẽ hoàn tiền về ví khách và đánh dấu khiếu nại đã xử lý.", okText: "Hoàn tiền" }))) return;
        const res = await api("/admin/disputes/" + btn.closest("tr").getAttribute("data-id"), {
          method: "PATCH",
          body: JSON.stringify({ status: "resolved" })
        });
        const amt = res && res.refundCents ? money(res.refundCents) : "";
        toast(amt ? "Đã hoàn " + amt + " · trạng thái Đã hoàn" : "Đã hoàn tiền khiếu nại");
        renderDisputes(body);
      });
    });
    body.querySelectorAll(".js-rej").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await confirmAction({ title: "Từ chối khiếu nại", message: "Khiếu nại sẽ chuyển sang Từ chối KN. Không hoàn tiền cho khách.", okText: "Từ chối" }))) return;
        await api("/admin/disputes/" + btn.closest("tr").getAttribute("data-id"), {
          method: "PATCH",
          body: JSON.stringify({ status: "rejected" })
        });
        toast("Đã từ chối KN");
        renderDisputes(body);
      });
    });
  }

  async function renderProducts(body) {
    const locations = window.VUAPROXY_LOCATIONS || [];
    const packFn =
      typeof window.VUAPROXY_allCountryPackages === "function"
        ? window.VUAPROXY_allCountryPackages
        : null;
    let catalog = packFn
      ? packFn(locations)
      : getCatalogProducts().filter((p) => p && p.countryCode);

    const overrides = await api("/admin/products").catch(() => ({ overrides: [] }));
    const map = {};
    (overrides.overrides || []).forEach((o) => {
      map[String(o.product_id)] = o;
    });

    let cmsProducts = [];
    try {
      const cmsData = await api("/admin/cms-products");
      cmsProducts = (cmsData.products || []).map((p) =>
        Object.assign({}, p, { source: "cms" })
      );
    } catch (_) {
      cmsProducts = [];
    }

    const cmsIds = new Set(cmsProducts.map((p) => String(p.id)));
    const products = cmsProducts.concat(
      catalog.filter((p) => !cmsIds.has(String(p.id)))
    );

    if (!products.length) {
      body.innerHTML =
        '<div class="adm-card"><span class="adm-tag bad">Chưa có gói</span> Thiếu locations/proxy-packages.</div>';
      return;
    }

    const countries = locations
      .slice()
      .sort((a, b) =>
        String(a.nameVi || a.name).localeCompare(String(b.nameVi || b.name), "vi")
      );

    body.innerHTML =
      '<div class="adm-hint">Mỗi dòng là <b>sản phẩm đặt hàng được</b>. Tên gói luôn có <b>quốc gia</b>. Dùng <b>Mua</b> để mở trang sản phẩm / tạo đơn như khách.</div>' +
      '<div class="adm-grid">' +
      stat("Quốc gia", countries.length) +
      stat("Gói hiển thị", products.filter((p) => {
        const ov = map[String(p.id)] || {};
        return ov.active !== false && p.active !== false;
      }).length) +
      stat("Tổng gói", products.length) +
      "</div>" +
      '<div class="adm-card"><div class="adm-card-head"><h2>Gói proxy theo quốc gia</h2>' +
      '<button type="button" class="btn btn-primary" id="prodNew">Thêm gói mới</button></div>' +
      '<div id="prodCompose" class="hidden adm-compose">' +
      "<h3 id=\"prodComposeTitle\">Thêm gói mới</h3>" +
      '<input type="hidden" id="npEditId" value="">' +
      '<div class="adm-field"><label>Quốc gia *</label><select id="npCountry">' +
      countries
        .map(
          (c) =>
            '<option value="' +
            esc(c.code) +
            '">' +
            esc((c.nameVi || c.name) + " (" + c.code.toUpperCase() + ")") +
            "</option>"
        )
        .join("") +
      "</select></div>" +
      '<div class="adm-field"><label>Tên gói (có quốc gia) *</label><input id="npName" placeholder="VD: Proxy dân cư tĩnh Private · Mỹ"></div>' +
      '<div class="adm-field"><label>Giá / 30 ngày ₫ *</label><input id="npPrice" type="number" min="0" step="1000" value="10000"></div>' +
      '<div class="adm-field"><label>Ghi chú</label><input id="npNote" placeholder="Share3/Share5, pack…"></div>' +
      '<div class="adm-field"><label>Ảnh (mặc định = cờ quốc gia)</label><input id="npImage" placeholder="/images/flags/us.png"></div>' +
      '<div class="adm-compose-actions">' +
      '<button type="button" class="btn btn-primary" id="npSave">Lưu</button>' +
      '<button type="button" class="btn btn-outline" id="npCancel">Huỷ</button></div></div>' +
      '<div class="adm-filters">' +
      '<input class="adm-search" id="prodFilter" placeholder="Lọc tên gói / quốc gia / id…">' +
      filterSelect(
        "prodCountry",
        "Quốc gia",
        [{ v: "all", t: "Mọi quốc gia" }].concat(
          countries.map((c) => ({
            v: c.code,
            t: (c.nameVi || c.name) + " (" + c.code.toUpperCase() + ")"
          }))
        ),
        "all"
      ) +
      filterSelect(
        "prodActive",
        "Hiển thị",
        [
          { v: "all", t: "Tất cả" },
          { v: "on", t: "Đang hiện" },
          { v: "off", t: "Đã ẩn" }
        ],
        "all"
      ) +
      '<button type="button" class="btn btn-outline" id="prodApply">Lọc</button></div>' +
      '<p class="adm-muted" id="prodCount" style="margin:10px 0"></p>' +
      '<div class="adm-table-wrap"><table class="adm-table" id="prodTable"><thead><tr>' +
      "<th>ID</th><th>Quốc gia</th><th>Tên gói (có quốc gia)</th><th>Giá / 30 ngày</th><th>TT</th><th></th>" +
      "</tr></thead><tbody></tbody></table></div></div>";

    const compose = document.getElementById("prodCompose");
    const openCompose = (row) => {
      compose.classList.remove("hidden");
      document.getElementById("prodComposeTitle").textContent = row
        ? "Sửa gói"
        : "Thêm gói mới";
      document.getElementById("npEditId").value = row ? String(row.id) : "";
      if (row) {
        if (row.countryCode) document.getElementById("npCountry").value = row.countryCode;
        document.getElementById("npName").value = row.name || "";
        document.getElementById("npPrice").value = String(
          (map[String(row.id)] && map[String(row.id)].price_cents != null
            ? map[String(row.id)].price_cents
            : row.price) || 0
        );
        document.getElementById("npNote").value = row.note || "";
        document.getElementById("npImage").value = row.image || "";
      } else {
        document.getElementById("npName").value = "";
        document.getElementById("npPrice").value = "10000";
        document.getElementById("npNote").value = "";
        document.getElementById("npImage").value = "";
        syncNameFromCountry();
      }
      compose.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    function syncNameFromCountry() {
      const code = document.getElementById("npCountry").value;
      const c = countries.find((x) => x.code === code);
      const label = c ? c.nameVi || c.name : code;
      const cur = document.getElementById("npName").value.trim();
      if (!cur || /·/.test(cur) === false) {
        document.getElementById("npName").value = "Proxy dân cư tĩnh Private · " + label;
      } else {
        document.getElementById("npName").value = cur.replace(/\s·\s.*$/, " · " + label);
      }
      document.getElementById("npImage").value = "/images/flags/" + code + ".png";
    }

    document.getElementById("prodNew")?.addEventListener("click", () => openCompose(null));
    document.getElementById("npCancel")?.addEventListener("click", () =>
      compose.classList.add("hidden")
    );
    document.getElementById("npCountry")?.addEventListener("change", syncNameFromCountry);

    document.getElementById("npSave")?.addEventListener("click", async () => {
      const code = document.getElementById("npCountry").value;
      const c = countries.find((x) => x.code === code);
      const label = c ? c.nameVi || c.name : code;
      let name = document.getElementById("npName").value.trim();
      if (!name) return toast("Nhập tên gói");
      if (!name.includes(label) && !name.includes(code.toUpperCase())) {
        name = name.replace(/\s·\s.*$/, "") + " · " + label;
      }
      const price = Number(document.getElementById("npPrice").value || 0);
      if (price <= 0) return toast("Giá phải > 0");
      const editId = document.getElementById("npEditId").value.trim();
      const image =
        document.getElementById("npImage").value.trim() ||
        "/images/flags/" + code + ".png";
      const note = document.getElementById("npNote").value.trim();

      if (editId && !cmsIds.has(editId) && catalog.some((p) => String(p.id) === editId)) {
        await api("/admin/products/" + encodeURIComponent(editId), {
          method: "PUT",
          body: JSON.stringify({
            productId: editId,
            name: name,
            price: price,
            note: note,
            active: true
          })
        });
        toast("Đã cập nhật gói catalog");
      } else {
        await api("/admin/cms-products", {
          method: "POST",
          body: JSON.stringify({
            id: editId || undefined,
            name,
            price,
            image,
            seller: "Vua Proxy",
            sellerSlug: "vuaproxy",
            sellerToken: "vuaproxy",
            catsText: "proxy," + code + ",custom",
            description: note || name,
            stock: 999
          })
        });
        toast(editId ? "Đã lưu gói CMS" : "Đã thêm gói mới");
      }
      renderProducts(body);
    });

    const tbody = body.querySelector("#prodTable tbody");
    function paint() {
      const needle = String(document.getElementById("prodFilter")?.value || "").toLowerCase();
      const cF = document.getElementById("prodCountry")?.value || "all";
      const actF = document.getElementById("prodActive")?.value || "all";
      const filtered = products.filter((p) => {
        const ov = map[String(p.id)] || {};
        const active = ov.active !== false && p.active !== false;
        const code = p.countryCode || (Array.isArray(p.cats) ? p.cats.find((x) => /^[a-z]{2}$/.test(x)) : "");
        if (cF !== "all" && code !== cF) return false;
        if (actF === "on" && !active) return false;
        if (actF === "off" && active) return false;
        if (!needle) return true;
        const name = ov.name || p.name || "";
        return (
          String(p.id).includes(needle) ||
          String(code).includes(needle) ||
          String(name).toLowerCase().includes(needle) ||
          String(p.countryName || "").toLowerCase().includes(needle)
        );
      });
      const countEl = document.getElementById("prodCount");
      if (countEl) {
        countEl.textContent =
          "Hiển thị " + filtered.length + " / " + products.length + " gói";
      }
      tbody.innerHTML = filtered.length
        ? filtered
            .map((p) => {
              const ov = map[String(p.id)] || {};
              const active = ov.active !== false && p.active !== false;
              const price = ov.price_cents != null ? Number(ov.price_cents) : p.price;
              const name = ov.name || p.name;
              const code =
                p.countryCode ||
                (Array.isArray(p.cats) ? p.cats.find((x) => /^[a-z]{2}$/.test(x)) : "") ||
                "";
              const cName =
                p.countryName ||
                (countries.find((x) => x.code === code) || {}).nameVi ||
                code.toUpperCase();
              const buyHref = p.href
                ? siteUrl(p.href)
                : siteUrl("/tat-ca-san-pham/" + (p.slug || "goi") + "-" + p.id);
              const prodHref = siteUrl(
                typeof productSeoPath === "function"
                  ? productSeoPath(Object.assign({}, p, { name: name, slug: p.slug || ("goi-" + p.id) }))
                  : "/tat-ca-san-pham/" + (p.slug || "goi") + "-" + p.id
              );
              const isCms = p.source === "cms";
              return (
                '<tr data-id="' +
                esc(String(p.id)) +
                '" data-cms="' +
                (isCms ? "1" : "0") +
                '"><td>#' +
                esc(String(p.id)) +
                '</td><td><span class="adm-cell-main">' +
                esc(cName) +
                '</span><span class="adm-cell-sub">' +
                esc(String(code).toUpperCase()) +
                '</span></td><td><span class="adm-cell-main">' +
                esc(name) +
                "</span>" +
                (ov.note || p.note
                  ? '<span class="adm-cell-sub">' + esc(ov.note || p.note) + "</span>"
                  : "") +
                "</td><td><b>" +
                money(price) +
                "</b></td><td>" +
                (active
                  ? '<span class="adm-tag ok">Hiện</span>'
                  : '<span class="adm-tag bad">Ẩn</span>') +
                '</td><td><div class="adm-row-actions">' +
                '<a class="btn btn-primary btn-sm" href="' +
                esc(prodHref) +
                '" target="_blank" rel="noopener">Mua</a>' +
                '<a class="btn btn-outline btn-sm" href="' +
                esc(buyHref) +
                '" target="_blank" rel="noopener">Trang QG</a>' +
                '<button type="button" class="btn btn-ghost btn-sm js-edit">Sửa</button>' +
                '<button type="button" class="btn btn-ghost btn-sm js-toggle">' +
                (active ? "Ẩn" : "Hiện") +
                "</button>" +
                '<button type="button" class="btn btn-danger btn-sm js-del">Xóa</button>' +
                "</div></td></tr>"
              );
            })
            .join("")
        : '<tr><td colspan="6" class="adm-empty">Không khớp bộ lọc</td></tr>';

      tbody.querySelectorAll(".js-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.closest("tr").getAttribute("data-id");
          const row = products.find((x) => String(x.id) === id);
          if (row) openCompose(Object.assign({}, row, map[id] || {}));
        });
      });
      tbody.querySelectorAll(".js-toggle").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.closest("tr").getAttribute("data-id");
          const ov = map[id] || {};
          const cur = products.find((x) => String(x.id) === id);
          const currentlyOn = ov.active !== false && (!cur || cur.active !== false);
          const next = !currentlyOn;
          if (!next) {
            const ok = await confirmAction({
              title: "Ẩn gói proxy",
              message: "Gói #" + id + " sẽ bị ẩn khỏi bán. Bạn có chắc?",
              okText: "Ẩn gói"
            });
            if (!ok) return;
          }
          if (btn.closest("tr").getAttribute("data-cms") === "1") {
            await api("/admin/cms-products/" + encodeURIComponent(id), {
              method: "PUT",
              body: JSON.stringify(Object.assign({}, cur, { active: next, id }))
            });
          } else {
            await api("/admin/products/" + encodeURIComponent(id), {
              method: "PUT",
              body: JSON.stringify({ productId: id, active: next })
            });
          }
          toast(next ? "Đã hiện" : "Đã ẩn");
          renderProducts(body);
        });
      });
      tbody.querySelectorAll(".js-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const tr = btn.closest("tr");
          const id = tr.getAttribute("data-id");
          const isCms = tr.getAttribute("data-cms") === "1";
          if (isCms) {
            if (!(await confirmAction({ title: "Xóa gói proxy", message: "Xóa vĩnh viễn gói CMS #" + id + "?", okText: "Xóa gói" }))) return;
            await api("/admin/cms-products/" + encodeURIComponent(id), { method: "DELETE" });
            toast("Đã xóa");
          } else {
            if (!(await confirmAction({ title: "Ẩn gói proxy", message: "Gói mặc định không xóa cứng — sẽ ẩn khỏi bán. Tiếp tục?", okText: "Ẩn gói" }))) return;
            await api("/admin/products/" + encodeURIComponent(id), {
              method: "PUT",
              body: JSON.stringify({ productId: id, active: false })
            });
            toast("Đã ẩn gói mặc định");
          }
          renderProducts(body);
        });
      });
    }
    paint();
    document.getElementById("prodApply")?.addEventListener("click", paint);
    document.getElementById("prodFilter")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") paint();
    });
  }

  async function renderStock(body) {
    const data = await api("/stock");
    const countryOpts = [{ v: "", t: "Tất cả quốc gia" }].concat(
      stockCountryOptions(data.products || [])
    );
    body.innerHTML =
      '<div class="adm-card"><h2>Nhập tồn kho</h2>' +
      '<div class="adm-form-grid">' +
      '<div class="adm-field"><label>Mã sản phẩm / biến thể</label><input id="stkId" placeholder="VD 1189"></div>' +
      '<div class="adm-field span2"><label>Dòng hàng (1 dòng = 1 đơn vị giao)</label><textarea id="stkText" rows="5" placeholder="user:pass&#10;key-xxxx"></textarea></div>' +
      '<div class="adm-field span3"><button type="button" class="btn btn-primary" id="stkImport">Lưu vào kho</button></div>' +
      "</div></div>" +
      '<div class="adm-card"><h2>Tồn hiện tại</h2>' +
      '<div class="adm-filters"><input class="adm-search" id="stkFilter" placeholder="Lọc mã hoặc tên sản phẩm…">' +
      filterSelect("stkCountry", "Quốc gia", countryOpts, "") +
      filterSelect(
        "stkSort",
        "Sắp xếp",
        [
          { v: "avail", t: "Còn nhiều → ít" },
          { v: "id", t: "Theo mã" },
          { v: "name", t: "Theo tên" },
          { v: "country", t: "Theo quốc gia" },
          { v: "empty", t: "Hết hàng trước" }
        ],
        "avail"
      ) +
      '<button type="button" class="btn btn-outline" id="stkFilterBtn">Lọc</button></div>' +
      '<div class="adm-table-wrap" style="margin-top:10px"><table class="adm-table"><thead><tr>' +
      "<th>Mã</th><th>Quốc gia</th><th>Sản phẩm</th><th>Còn</th><th>Đã bán</th><th>Tổng</th><th></th></tr></thead><tbody id=\"stkRows\">" +
      "</tbody></table></div></div>";

    async function openStockDetail(productId) {
      const label = stockProductLabel(productId);
      const countryText = label.countryCode
        ? (label.countryName || label.countryCode.toUpperCase()) +
          " (" +
          String(label.countryCode).toUpperCase() +
          ")"
        : "—";
      const prev = document.getElementById("stkDetailModal");
      if (prev) prev.remove();
      const wrap = document.createElement("div");
      wrap.id = "stkDetailModal";
      wrap.className = "adm-modal-bg";
      wrap.innerHTML =
        '<div class="adm-modal adm-modal--wide" role="dialog" aria-modal="true">' +
        "<h3>Tồn kho · #" +
        esc(productId) +
        "</h3>" +
        '<p><b>' +
        esc(label.title) +
        "</b>" +
        (label.subtitle ? " · " + esc(label.subtitle) : "") +
        " · Quốc gia: " +
        esc(countryText) +
        "</p>" +
        '<div class="adm-filters" style="margin:0 0 10px">' +
        '<button type="button" class="btn btn-outline btn-sm" id="stkDetRefresh">Làm mới</button>' +
        '<button type="button" class="btn btn-danger btn-sm" id="stkDetVoidMany">Xóa nhiều dòng còn</button>' +
        "</div>" +
        '<div class="adm-table-wrap" style="max-height:340px;overflow:auto"><table class="adm-table"><thead><tr>' +
        "<th style=\"width:70px\">ID</th><th>Dòng hàng</th><th style=\"width:160px\"></th></tr></thead>" +
        '<tbody id="stkDetRows"><tr><td colspan="3" class="adm-empty">Đang tải…</td></tr></tbody></table></div>' +
        '<div class="adm-form-grid" style="margin-top:14px">' +
        '<div class="adm-field span3"><label>Thêm dòng mới (1 dòng = 1 đơn vị)</label>' +
        '<textarea id="stkDetAdd" rows="4" placeholder="ip:port:user:pass"></textarea></div>' +
        '<div class="adm-field span3 adm-compose-actions" style="justify-content:flex-end">' +
        '<button type="button" class="btn btn-outline" data-close="1">Đóng</button>' +
        '<button type="button" class="btn btn-primary" id="stkDetAddBtn">Thêm vào kho</button>' +
        "</div></div></div>";
      document.body.appendChild(wrap);

      const close = () => wrap.remove();
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap || e.target.getAttribute("data-close") === "1") close();
      });

      async function loadRows() {
        const box = document.getElementById("stkDetRows");
        if (!box) return;
        box.innerHTML = '<tr><td colspan="3" class="adm-empty">Đang tải…</td></tr>';
        try {
          const data = await api(
            "/stock/" + encodeURIComponent(productId) + "/items?status=available&limit=1000"
          );
          const items = data.items || [];
          box.innerHTML = items.length
            ? items
                .map(
                  (it) =>
                    '<tr data-item-id="' +
                    esc(it.id) +
                    '"><td>#' +
                    esc(it.id) +
                    '</td><td><input class="adm-stk-line" value="' +
                    esc(it.payload || "") +
                    '"></td><td style="white-space:nowrap">' +
                    '<button type="button" class="btn btn-outline btn-sm js-stk-save">Lưu</button> ' +
                    '<button type="button" class="btn btn-danger btn-sm js-stk-del">Xóa</button>' +
                    "</td></tr>"
                )
                .join("")
            : '<tr><td colspan="3" class="adm-empty">Chưa có dòng tồn còn lại</td></tr>';
          box.querySelectorAll(".js-stk-save").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const tr = btn.closest("tr");
              const id = tr.getAttribute("data-item-id");
              const payload = tr.querySelector(".adm-stk-line")?.value || "";
              await api("/stock/item/" + encodeURIComponent(id), {
                method: "PATCH",
                body: JSON.stringify({ payload })
              });
              toast("Đã lưu dòng #" + id);
            });
          });
          box.querySelectorAll(".js-stk-del").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const tr = btn.closest("tr");
              const id = tr.getAttribute("data-item-id");
              const ok = await confirmAction({
                title: "Xóa dòng tồn",
                message: "Xóa dòng #" + id + " khỏi kho còn lại?",
                okText: "Xóa dòng"
              });
              if (!ok) return;
              await api("/stock/item/" + encodeURIComponent(id), { method: "DELETE" });
              toast("Đã xóa dòng #" + id);
              await loadRows();
              renderStock(body);
            });
          });
        } catch (err) {
          box.innerHTML =
            '<tr><td colspan="3" class="adm-empty">' +
            esc(err.message || "Không tải được") +
            "</td></tr>";
        }
      }

      document.getElementById("stkDetRefresh")?.addEventListener("click", () => loadRows());
      document.getElementById("stkDetVoidMany")?.addEventListener("click", async () => {
        const count = Number(prompt("Xóa bao nhiêu dòng còn lại (theo thứ tự cũ → mới)?", "10") || 0);
        if (!count) return;
        const ok = await confirmAction({
          title: "Xóa nhiều dòng tồn",
          message: "Xóa " + count + " dòng tồn còn lại của sản phẩm #" + productId + "?",
          okText: "Xóa tồn"
        });
        if (!ok) return;
        await api("/admin/stock/void", {
          method: "POST",
          body: JSON.stringify({ productId, count })
        });
        toast("Đã xóa " + count + " dòng");
        await loadRows();
        renderStock(body);
      });
      document.getElementById("stkDetAddBtn")?.addEventListener("click", async () => {
        const text = document.getElementById("stkDetAdd")?.value || "";
        if (!String(text).trim()) {
          toast("Chưa nhập dòng hàng");
          return;
        }
        await api("/stock/import", {
          method: "POST",
          body: JSON.stringify({ productId, text })
        });
        document.getElementById("stkDetAdd").value = "";
        toast("Đã thêm vào kho");
        await loadRows();
        renderStock(body);
      });
      await loadRows();
    }

    function paintStock() {
      const needle = String(document.getElementById("stkFilter")?.value || "").toLowerCase();
      const country = String(document.getElementById("stkCountry")?.value || "").toLowerCase();
      const sort = document.getElementById("stkSort")?.value || "avail";
      let list = (data.products || []).slice();
      if (needle) {
        list = list.filter((p) => {
          const label = stockProductLabel(p.product_id);
          const hay =
            String(p.product_id).toLowerCase() +
            " " +
            String(label.title || "").toLowerCase() +
            " " +
            String(label.subtitle || "").toLowerCase() +
            " " +
            String(label.countryName || "").toLowerCase() +
            " " +
            String(label.countryCode || "").toLowerCase();
          return hay.includes(needle);
        });
      }
      if (country) {
        list = list.filter((p) => {
          const label = stockProductLabel(p.product_id);
          return String(label.countryCode || "").toLowerCase() === country;
        });
      }
      if (sort === "empty") list.sort((a, b) => a.available - b.available);
      else if (sort === "id")
        list.sort((a, b) => String(a.product_id).localeCompare(String(b.product_id)));
      else if (sort === "name")
        list.sort((a, b) =>
          stockProductLabel(a.product_id).title.localeCompare(
            stockProductLabel(b.product_id).title,
            "vi"
          )
        );
      else if (sort === "country")
        list.sort((a, b) => {
          const ca = stockProductLabel(a.product_id);
          const cb = stockProductLabel(b.product_id);
          const byName = String(ca.countryName || ca.countryCode || "").localeCompare(
            String(cb.countryName || cb.countryCode || ""),
            "vi"
          );
          if (byName) return byName;
          return String(a.product_id).localeCompare(String(b.product_id));
        });
      else list.sort((a, b) => b.available - a.available);
      const box = document.getElementById("stkRows");
      box.innerHTML = list.length
        ? list
            .map((p) => {
              const label = stockProductLabel(p.product_id);
              const countryCell = label.countryCode
                ? '<span class="adm-cell-main">' +
                  esc(label.countryName || label.countryCode.toUpperCase()) +
                  '</span><span class="adm-cell-sub">' +
                  esc(String(label.countryCode).toUpperCase()) +
                  "</span>"
                : '<span class="adm-cell-sub">—</span>';
              return (
                '<tr data-id="' +
                esc(p.product_id) +
                '"><td>#' +
                esc(p.product_id) +
                "</td><td>" +
                countryCell +
                '</td><td><span class="adm-cell-main">' +
                esc(label.title) +
                "</span>" +
                (label.subtitle
                  ? '<span class="adm-cell-sub">' + esc(label.subtitle) + "</span>"
                  : "") +
                "</td><td><b>" +
                p.available +
                "</b></td><td>" +
                p.sold +
                "</td><td>" +
                p.total +
                '</td><td><button type="button" class="btn btn-outline btn-sm js-view">Xem tồn kho</button></td></tr>'
              );
            })
            .join("")
        : '<tr><td colspan="7" class="adm-empty">Chưa có tồn kho / không khớp lọc</td></tr>';
      box.querySelectorAll(".js-view").forEach((btn) => {
        btn.addEventListener("click", () => {
          const productId = btn.closest("tr").getAttribute("data-id");
          openStockDetail(productId);
        });
      });
    }
    document.getElementById("stkImport")?.addEventListener("click", async () => {
      const productId = document.getElementById("stkId").value.trim();
      const text = document.getElementById("stkText").value;
      await api("/stock/import", { method: "POST", body: JSON.stringify({ productId, text }) });
      toast("Đã nhập kho");
      renderStock(body);
    });
    paintStock();
    document.getElementById("stkFilterBtn")?.addEventListener("click", paintStock);
    document.getElementById("stkCountry")?.addEventListener("change", paintStock);
    document.getElementById("stkSort")?.addEventListener("change", paintStock);
    document.getElementById("stkFilter")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") paintStock();
    });
  }

  async function renderShops(body) {
    const ovData = await api("/admin/shops");
    const ov = {};
    (ovData.overrides || []).forEach((s) => {
      ov[s.token] = s;
    });
    let cmsShops = [];
    try {
      const cmsData = await api("/admin/cms-shops");
      cmsShops = (cmsData.shops || []).map((s) =>
        Object.assign({}, s, { source: "cms" })
      );
    } catch (_) {
      cmsShops = [];
    }
    const catalog = getCatalogShops();
    const cmsTokens = new Set(cmsShops.map((s) => String(s.token)));
    const shops = cmsShops.concat(
      catalog
        .filter((s) => !cmsTokens.has(String(s.token)))
        .map((s) => Object.assign({}, s, { source: s.source || "catalog" }))
    );
    const hidden = shops.filter((s) => {
      const o = ov[s.token] || {};
      return o.active === false || s.active === false;
    }).length;
    body.innerHTML =
      '<div class="adm-hint"><b>Cách hoạt động</b><ul>' +
      "<li>CMS shops + catalog tĩnh, merge theo token (CMS ưu tiên).</li>" +
      "<li>Tắt shop = ẩn trên site (override active=false).</li>" +
      "<li>Mỗi shop có phòng chat riêng tại mục Chat Shop ↔ Khách.</li></ul></div>" +
      '<div class="adm-grid adm-grid-3">' +
      stat("Tổng gian hàng", shops.length) +
      stat("Đang hiện", shops.length - hidden, "pos") +
      stat("Đã tắt", hidden, hidden ? "warn" : "") +
      "</div>" +
      '<div class="adm-card"><div class="adm-card-head"><h2>Gian hàng</h2>' +
      '<button type="button" class="btn btn-primary" id="shopNew">Gian hàng mới</button></div>' +
      '<div id="shopCompose" class="hidden adm-compose">' +
      "<h3>Gian hàng mới</h3>" +
      '<div class="adm-field"><label>Tên *</label><input id="nsName" placeholder="Tên gian hàng"></div>' +
      '<div class="adm-field"><label>Slug</label><input id="nsSlug" placeholder="tu-dong-tu-ten"></div>' +
      '<div class="adm-field"><label>Token (tuỳ chọn / auto)</label><input id="nsToken" placeholder="Để trống = tự sinh"></div>' +
      '<div class="adm-field"><label>Avatar URL</label><input id="nsAvatar" placeholder="https://… hoặc /uploads/…"></div>' +
      '<div class="adm-field"><label>Upload avatar</label><div class="adm-file-row">' +
      '<input type="file" id="nsAvatarFile" accept="image/*">' +
      '<button type="button" class="btn btn-outline btn-sm" id="nsAvatarUp">Upload</button></div>' +
      '<img id="nsAvatarPreview" class="adm-preview-img hidden" alt=""></div>' +
      '<div class="adm-field"><label>Rating</label><input id="nsRating" type="number" min="0" max="5" step="0.1" value="5"></div>' +
      '<div class="adm-field"><label>Bio</label><textarea id="nsBio" rows="3"></textarea></div>' +
      '<div class="adm-field"><label>SEO title <span class="cnt" id="nsMetaTitleCnt">0/60</span></label>' +
      '<input id="nsMetaTitle"></div>' +
      '<div class="adm-field"><label>Meta description <span class="cnt" id="nsMetaDescCnt">0/155</span></label>' +
      '<textarea id="nsMetaDesc" rows="2"></textarea></div>' +
      '<div class="adm-compose-actions">' +
      '<button type="button" class="btn btn-primary" id="nsSave">Lưu gian hàng</button>' +
      '<button type="button" class="btn btn-outline" id="nsCancel">Huỷ</button></div></div></div>' +
      '<div class="adm-card"><div class="adm-filters">' +
      '<input class="adm-search" id="shopFilter" placeholder="Lọc theo tên shop, token…">' +
      filterSelect(
        "shopActive",
        "Hiển thị",
        [
          { v: "all", t: "Tất cả" },
          { v: "on", t: "Đang hiện" },
          { v: "off", t: "Đã tắt" }
        ],
        "all"
      ) +
      '<button type="button" class="btn btn-outline" id="shopRefresh">Làm mới</button></div>' +
      '<p class="adm-muted" id="shopCount" style="margin:8px 0 10px"></p>' +
      '<div class="adm-table-wrap"><table class="adm-table"><thead><tr>' +
      "<th>Shop</th><th>Đánh giá</th><th>Nguồn</th><th>Hiển thị</th><th></th>" +
      '</tr></thead><tbody id="shopRows"></tbody></table></div></div>' +
      '<div id="shopEditor" class="hidden"></div>';

    const compose = document.getElementById("shopCompose");
    let slugManual = false;
    document.getElementById("shopNew")?.addEventListener("click", () => {
      compose.classList.remove("hidden");
      slugManual = false;
      compose.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("nsCancel")?.addEventListener("click", () => {
      compose.classList.add("hidden");
    });
    document.getElementById("nsName")?.addEventListener("input", () => {
      if (slugManual) return;
      document.getElementById("nsSlug").value = slugifyText(
        document.getElementById("nsName").value
      );
    });
    document.getElementById("nsSlug")?.addEventListener("input", () => {
      slugManual = true;
    });
    wireSeoCounter("nsMetaTitle", "nsMetaTitleCnt", 60);
    wireSeoCounter("nsMetaDesc", "nsMetaDescCnt", 155);
    const syncNsPreview = () => {
      const url = document.getElementById("nsAvatar")?.value.trim();
      const img = document.getElementById("nsAvatarPreview");
      if (!img) return;
      if (url) {
        img.src = url;
        img.classList.remove("hidden");
      } else img.classList.add("hidden");
    };
    document.getElementById("nsAvatar")?.addEventListener("input", syncNsPreview);
    document.getElementById("nsAvatarUp")?.addEventListener("click", async () => {
      const file = document.getElementById("nsAvatarFile")?.files?.[0];
      if (!file) return toast("Chọn file ảnh");
      try {
        const url = await uploadAdminFile(file);
        document.getElementById("nsAvatar").value = url;
        syncNsPreview();
        toast("Đã upload avatar");
      } catch (e) {
        toast(e.message || "Upload lỗi");
      }
    });
    document.getElementById("nsSave")?.addEventListener("click", async () => {
      const name = document.getElementById("nsName").value.trim();
      if (!name) return toast("Nhập tên gian hàng");
      await api("/admin/cms-shops", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug: document.getElementById("nsSlug").value.trim() || slugifyText(name),
          token: document.getElementById("nsToken").value.trim() || undefined,
          avatar: document.getElementById("nsAvatar").value.trim(),
          rating: Number(document.getElementById("nsRating").value || 5),
          bio: document.getElementById("nsBio").value.trim(),
          metaTitle: document.getElementById("nsMetaTitle").value.trim(),
          metaDescription: document.getElementById("nsMetaDesc").value.trim()
        })
      });
      toast("Đã tạo gian hàng CMS");
      renderShops(body);
    });

    const rows = document.getElementById("shopRows");
    function paint() {
      const needle = String(document.getElementById("shopFilter")?.value || "").toLowerCase();
      const actF = document.getElementById("shopActive")?.value || "all";
      const filtered = shops.filter((s) => {
        const o = ov[s.token] || {};
        const active = o.active !== false && s.active !== false;
        if (actF === "on" && !active) return false;
        if (actF === "off" && active) return false;
        if (!needle) return true;
        return (
          String(s.name || "").toLowerCase().includes(needle) ||
          String(s.token || "").includes(needle)
        );
      });
      const countEl = document.getElementById("shopCount");
      if (countEl) {
        countEl.textContent =
          "Hiển thị " + filtered.length + " / " + shops.length + " gian hàng";
      }
      rows.innerHTML =
        (filtered.length
          ? filtered
              .map((s) => {
                const o = ov[s.token] || {};
                const active = o.active !== false && s.active !== false;
                const name = o.name || s.name;
                const isCms = s.source === "cms";
                return (
                  '<tr data-token="' +
                  esc(s.token) +
                  '"><td><span class="adm-cell-main">' +
                  esc(name) +
                  '</span><span class="adm-cell-sub">' +
                  esc(String(s.token || "").slice(0, 12)) +
                  "…</span></td><td>★ " +
                  esc(String(o.rating != null ? o.rating : s.rating || "—")) +
                  "</td><td>" +
                  (isCms
                    ? '<span class="adm-tag pink">cms</span>'
                    : '<span class="adm-tag">catalog</span>') +
                  "</td><td>" +
                  (active
                    ? '<span class="adm-tag ok">Hiện</span>'
                    : '<span class="adm-tag bad">Ẩn</span>') +
                  '</td><td><div class="adm-row-actions">' +
                  '<button type="button" class="btn btn-primary btn-sm js-edit">Chỉnh hồ sơ</button>' +
                  '<a class="btn btn-outline btn-sm" target="_blank" href="' +
                  siteUrl((s.slug ? "/" + s.slug : "/shop?token=" + encodeURIComponent(s.token))) +
                  '">Xem</a></div></td></tr>'
                );
              })
              .join("")
          : '<tr><td colspan="5" class="adm-empty">Không khớp bộ lọc</td></tr>');
      rows.querySelectorAll(".js-edit").forEach((btn) => {
        btn.addEventListener("click", () => openEditor(btn.closest("tr").getAttribute("data-token")));
      });
    }

    function openEditor(token) {
      const s = shops.find((x) => x.token === token);
      if (!s) return;
      const o = ov[token] || {};
      const active = o.active !== false && s.active !== false;
      const box = document.getElementById("shopEditor");
      box.classList.remove("hidden");
      box.innerHTML =
        '<div class="adm-card"><h2>Chỉnh hồ sơ — ' +
        esc(o.name || s.name) +
        "</h2>" +
        '<div class="adm-form-grid">' +
        '<div class="adm-field span2"><label>Tên</label><input class="f-name" value="' +
        esc(o.name || s.name) +
        '"></div>' +
        '<div class="adm-field span3"><label>Bio</label><textarea class="f-bio" rows="3">' +
        esc(o.bio || s.bio || "") +
        "</textarea></div></div>" +
        '<div class="adm-actions"><button type="button" class="btn btn-primary" id="shopSave">Lưu</button>' +
        '<button type="button" class="btn btn-ghost" id="shopToggle">' +
        (active ? "Tắt shop" : "Bật shop") +
        '</button><button type="button" class="btn btn-outline" id="shopClose">Đóng</button></div></div>';
      box.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("shopClose")?.addEventListener("click", () => box.classList.add("hidden"));
      document.getElementById("shopSave")?.addEventListener("click", async () => {
        await api("/admin/shops/" + encodeURIComponent(token), {
          method: "PUT",
          body: JSON.stringify({
            token,
            name: box.querySelector(".f-name").value,
            bio: box.querySelector(".f-bio").value,
            active: true
          })
        });
        toast("Đã lưu shop");
        renderShops(body);
      });
      document.getElementById("shopToggle")?.addEventListener("click", async () => {
        if (active) {
          const ok = await confirmAction({
            title: "Ẩn / tắt shop",
            message: "Shop sẽ bị tắt và ẩn khỏi bán. Tiếp tục?",
            okText: "Tắt shop"
          });
          if (!ok) return;
        }
        await api("/admin/shops/" + encodeURIComponent(token), {
          method: "PUT",
          body: JSON.stringify({ token, active: !active })
        });
        toast(active ? "Đã tắt shop" : "Đã bật shop");
        renderShops(body);
      });
    }

    paint();
    document.getElementById("shopFilter")?.addEventListener("input", paint);
    document.getElementById("shopActive")?.addEventListener("change", paint);
    document.getElementById("shopRefresh")?.addEventListener("click", () => renderShops(body));
  }

  async function renderWallet(body) {
    const data = await api("/admin/users");
    const st = data.stats || { users: data.users.length, totalBalance: 0 };
    body.innerHTML =
      '<div class="adm-grid adm-grid-3">' +
      stat("Tổng người dùng", st.users) +
      stat("Tổng số dư", money(st.totalBalance), "pos") +
      stat("Trang này", data.users.length) +
      "</div>" +
      '<div class="adm-card"><input class="adm-search" id="userFilter" placeholder="Tìm theo tên, email, user id…">' +
      '<div class="adm-table-wrap" style="margin-top:14px"><table class="adm-table"><thead><tr>' +
      "<th>User</th><th>Vai trò</th><th>Số dư</th><th>Cập nhật</th><th></th>" +
      '</tr></thead><tbody id="userRows"></tbody></table></div></div>' +
      '<div id="walletModal" class="hidden"></div>';

    const rows = document.getElementById("userRows");
    function paint(q) {
      const needle = String(q || "").toLowerCase();
      rows.innerHTML = data.users
        .filter(
          (u) =>
            !needle ||
            u.email.toLowerCase().includes(needle) ||
            String(u.name || "").toLowerCase().includes(needle) ||
            String(u.id).includes(needle)
        )
        .map((u) => {
          const balCls =
            u.balance > 0 ? "adm-money-pos" : u.balance < 0 ? "adm-money-neg" : "adm-money-zero";
          return (
            '<tr data-id="' +
            u.id +
            '"><td><span class="adm-cell-main">' +
            esc(u.name || u.email.split("@")[0]) +
            '</span><span class="adm-cell-sub">' +
            esc(u.email) +
            "<br>" +
            esc(String(u.id).slice(0, 13)) +
            "…</span></td><td>" +
            (u.isAdmin
              ? '<span class="adm-tag pink">admin</span>'
              : '<span class="adm-tag">customer</span>') +
            '</td><td class="' +
            balCls +
            '">' +
            money(u.balance) +
            "</td><td>" +
            fmtTime(u.updatedAt || u.createdAt) +
            '</td><td><button type="button" class="btn btn-outline btn-sm js-edit-bal">Sửa số dư</button></td></tr>'
          );
        })
        .join("");
      rows.querySelectorAll(".js-edit-bal").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.closest("tr").getAttribute("data-id");
          const u = data.users.find((x) => x.id === id);
          openCreditModal(u);
        });
      });
    }

    function openCreditModal(u) {
      const box = document.getElementById("walletModal");
      box.classList.remove("hidden");
      box.innerHTML =
        '<div class="adm-modal-bg"><div class="adm-modal"><h3>Sửa số dư</h3>' +
        "<p>" +
        esc(u.email) +
        " · hiện tại <b>" +
        money(u.balance) +
        "</b></p>" +
        '<div class="adm-field"><label>Số tiền (+ nạp / − trừ)</label>' +
        '<input type="number" id="mAmt" placeholder="VD 100000 hoặc -50000"></div>' +
        '<div class="adm-field"><label>Ghi chú</label><input id="mNote" value="Admin điều chỉnh"></div>' +
        '<div class="adm-actions"><button type="button" class="btn btn-primary" id="mOk">Cập nhật</button>' +
        '<button type="button" class="btn btn-outline" id="mClose">Huỷ</button></div></div></div>';
      document.getElementById("mClose")?.addEventListener("click", () => box.classList.add("hidden"));
      box.querySelector(".adm-modal-bg")?.addEventListener("click", (e) => {
        if (e.target.classList.contains("adm-modal-bg")) box.classList.add("hidden");
      });
      document.getElementById("mOk")?.addEventListener("click", async () => {
        const amount = Number(document.getElementById("mAmt").value);
        const note = document.getElementById("mNote").value.trim();
        await api("/admin/users/" + u.id + "/credit", {
          method: "POST",
          body: JSON.stringify({ amount, note })
        });
        toast("Đã cập nhật ví");
        renderWallet(body);
      });
    }

    paint("");
    document.getElementById("userFilter")?.addEventListener("input", (e) => paint(e.target.value));
  }

  async function renderLedger(body) {
    const f = state.ledger;
    const qs = new URLSearchParams({ type: f.type, q: f.q, limit: "100" });
    const data = await api("/admin/ledger?" + qs.toString());
    const ps = data.pageStats || {};
    body.innerHTML =
      '<div class="adm-card"><div class="adm-filters">' +
      '<input class="adm-search" id="ledQ" placeholder="Tìm tên, email, user id, mô tả, ref…" value="' +
      esc(f.q) +
      '">' +
      '<div class="adm-field"><label>Loại</label><select id="ledType">' +
      ["all", "topup", "purchase", "refund", "release"]
        .map(
          (t) =>
            '<option value="' +
            t +
            '"' +
            (f.type === t ? " selected" : "") +
            ">" +
            (t === "all" ? "Tất cả loại" : TYPE_LABELS[t] || t) +
            "</option>"
        )
        .join("") +
      '</select></div><button type="button" class="btn btn-primary" id="ledApply">Lọc</button>' +
      '<button type="button" class="btn btn-outline" id="goWallet">Số dư ví</button></div></div>' +
      '<div class="adm-grid">' +
      stat("Giao dịch (+) trang này", ps.creditCount || 0) +
      stat("Tổng nạp (+) trang này", money(ps.creditSum || 0), "pos") +
      stat("Tổng trừ (−) trang này", money(ps.debitSum || 0), "neg") +
      stat("Số dòng", ps.total || 0) +
      "</div>" +
      '<div class="adm-card"><div class="adm-muted" style="margin-bottom:10px">Hiển thị ' +
      (data.items || []).length +
      " · sắp xếp mới → cũ</div>" +
      '<div class="adm-table-wrap"><table class="adm-table"><thead><tr>' +
      "<th>#</th><th>Giao dịch</th><th>Người dùng</th><th>Loại</th><th>Số tiền</th><th>Mô tả</th><th>Ref</th><th>Thời gian</th>" +
      "</tr></thead><tbody>" +
      (data.items || [])
        .map((i, idx) => {
          const note = (i.meta && (i.meta.note || i.meta.by)) || "";
          return (
            "<tr><td>" +
            (idx + 1) +
            "</td><td>#" +
            i.id +
            '</td><td><span class="adm-cell-main">' +
            esc(i.name || "—") +
            '</span><span class="adm-cell-sub">' +
            esc(i.email) +
            "</span></td><td>" +
            (i.amount >= 0
              ? '<span class="adm-tag ok">'
              : '<span class="adm-tag bad">') +
            esc(TYPE_LABELS[i.type] || i.type) +
            "</span></td><td>" +
            moneyCls(i.amount) +
            "</td><td>" +
            esc(note || "—") +
            "</td><td>" +
            esc(i.refId || "—") +
            "</td><td>" +
            fmtTime(i.createdAt) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div></div>";

    document.getElementById("ledApply")?.addEventListener("click", () => {
      state.ledger.q = document.getElementById("ledQ").value.trim();
      state.ledger.type = document.getElementById("ledType").value;
      renderLedger(body);
    });
    document.getElementById("goWallet")?.addEventListener("click", () => setView("wallet"));
  }


  function chatUnreadBadgeHtml(n) {
    const pending = Math.max(0, Number(n) || 0);
    if (!pending) return "";
    return (
      ' <span class="badge" style="position:static;margin-left:6px">' +
      (pending > 99 ? "99+" : pending) +
      "</span>"
    );
  }

  function resortAdminChatList(listEl) {
    if (!listEl) return;
    const header = listEl.querySelector(":scope > .adm-muted, :scope > div.adm-muted");
    const items = Array.from(listEl.querySelectorAll(":scope > .adm-list-item"));
    items.sort((a, b) => {
      const ua = Math.max(0, Number(a.getAttribute("data-unread") || 0));
      const ub = Math.max(0, Number(b.getAttribute("data-unread") || 0));
      if (ub !== ua) return ub - ua;
      const ta = Number(a.getAttribute("data-last") || 0);
      const tb = Number(b.getAttribute("data-last") || 0);
      return tb - ta;
    });
    items.forEach((el) => listEl.appendChild(el));
    if (header && header.parentNode === listEl) listEl.insertBefore(header, listEl.firstChild);
  }

  function clearThreadUnreadBadge(btn, listEl) {
    if (!btn) return 0;
    const prev = Math.max(0, Number(btn.getAttribute("data-unread") || 0));
    btn.setAttribute("data-unread", "0");
    btn.querySelectorAll(".adm-tag.warn, .badge").forEach((el) => el.remove());
    if (listEl) resortAdminChatList(listEl);
    return prev;
  }

  async function renderChatSupport(body) {
    setAdminChatLayout(true);
    if (!document.getElementById("adm-chat-guest-css")) {
      const st = document.createElement("style");
      st.id = "adm-chat-guest-css";
      st.textContent =
        ".adm-chat-guest-name{font-weight:700;line-height:1.25}" +
        ".adm-chat-guest-email{font-size:12px;font-weight:500;color:#64748b;margin-top:2px;word-break:break-all}" +
        ".adm-chat-head{display:flex;flex-direction:column;align-items:flex-start;gap:0;line-height:1.3}";
      document.head.appendChild(st);
    }
    body.innerHTML =
      '<div class="adm-hint">Kênh <b>Chat hỗ trợ Vua Proxy ↔ Khách</b>. Danh sách hội thoại luôn hiện — trống cũng check được.</div>' +
      '<div class="adm-split"><div class="adm-list" id="supList"></div>' +
      '<div class="adm-chat-pane"><div class="adm-chat-head" id="supHead">Chọn khách bên trái</div>' +
      '<div class="adm-chat-msgs" id="supMsgs"><div class="adm-empty">Chưa chọn hội thoại</div></div>' +
      '<form class="adm-chat-form" id="supForm"><input id="supInput" placeholder="Trả lời khách…" autocomplete="off">' +
      '<button class="btn btn-primary" type="submit">Gửi</button></form></div></div>';
    const threads = await api("/admin/chat/threads?channel=support");
    const list = document.getElementById("supList");
    const pending = state.pendingSupportChat;
    state.pendingSupportChat = null;
    const rows = (threads.threads || []).slice().sort((a, b) => {
      const ua = Math.max(0, Number(a.unread) || (a.last_role === "user" ? 1 : 0));
      const ub = Math.max(0, Number(b.unread) || (b.last_role === "user" ? 1 : 0));
      if (ub !== ua) return ub - ua;
      const ta = a.last_at ? new Date(a.last_at).getTime() : 0;
      const tb = b.last_at ? new Date(b.last_at).getTime() : 0;
      return tb - ta;
    });

    let openKey = "";
    let openMeta = null;
    if (pending) {
      const emailLc = String(pending.email || "").toLowerCase();
      const match = rows.find((t) => {
        if (pending.visitorKey && t.visitor_key === pending.visitorKey) return true;
        if (pending.buyerId && String(t.user_id || "") === String(pending.buyerId)) return true;
        const te = String(t.user_email || "").toLowerCase();
        return emailLc && te && te === emailLc;
      });
      openKey = (match && match.visitor_key) || pending.visitorKey || "";
      openMeta = {
        user_name: pending.name || (match && match.user_name) || "Khách",
        user_email: pending.email || (match && match.user_email) || ""
      };
      if (openKey && !rows.some((t) => t.visitor_key === openKey)) {
        rows.unshift({
          visitor_key: openKey,
          user_name: openMeta.user_name,
          user_email: openMeta.user_email,
          last_body: "",
          last_at: null,
          last_role: "support",
          unread: 0
        });
      }
    }

    list.innerHTML =
      '<div style="padding:10px;border-bottom:1px solid #f1f5f9" class="adm-muted">Hội thoại: <b>' +
      rows.length +
      "</b> · tin mới lên đầu</div>" +
      (rows.length
        ? rows
            .map((t) => {
              const pending = Math.max(
                0,
                Number(t.unread) || (t.last_role === "user" ? 1 : 0)
              );
              return (
                (() => {
                  const g = guestChatLabel(t);
                  const preview = String(t.last_body || "")
                    .replace(/^Đơn\s+#?[A-Z0-9_-]+\s*[·•\-]?\s*/i, "")
                    .replace(/^Về\s+Đơn\s+#?[A-Z0-9_-]+[^\n]*/i, "")
                    .trim();
                  const sub = g.email
                    ? esc(g.email) + (preview ? " · " + esc(preview) : "")
                    : preview
                      ? esc(preview)
                      : "";
                  const lastTs = t.last_at ? new Date(t.last_at).getTime() : 0;
                  return (
                '<button type="button" class="adm-list-item" data-v="' +
                esc(t.visitor_key) +
                '" data-name="' +
                esc(g.name) +
                '" data-email="' +
                esc(g.email) +
                '" data-unread="' +
                pending +
                '" data-last="' +
                lastTs +
                '"><strong>' +
                esc(g.name) +
                chatUnreadBadgeHtml(pending) +
                "</strong>" +
                (sub ? "<small>" + sub + "</small>" : "") +
                "</button>"
                  );
                })()
              );
            })
            .join("")
        : '<div class="adm-empty">Chưa có hội thoại support — phòng vẫn sẵn sàng khi khách nhắn.</div>');

    async function openThread(visitorKey, meta) {
      state.supportVisitor = visitorKey;
      state.supportGuestMeta = meta || guestChatLabel({});
      renderGuestChatHead(document.getElementById("supHead"), state.supportGuestMeta);
      try {
        await api("/chat/read", {
          method: "POST",
          body: JSON.stringify({
            roomId: "vuammo_support",
            visitorKey,
            as: "admin"
          })
        });
      } catch (_) {}
      const activeBtn = document.querySelector("#supList .adm-list-item.active");
      clearThreadUnreadBadge(activeBtn, document.getElementById("supList"));
      const data = await api(
        "/chat/messages?roomId=" +
          encodeURIComponent("vuammo_support") +
          "&visitorKey=" +
          encodeURIComponent(visitorKey)
      );
      const box = document.getElementById("supMsgs");
      const msgs = data.messages || [];
      box.innerHTML = msgs.length
        ? msgs.map((m) => renderAdminBubble(m)).join("")
        : '<div class="adm-empty">Hội thoại trống — gửi tin để bắt đầu chat với khách.</div>';
      box.scrollTop = box.scrollHeight;
      refreshBadges();
    }

    list.querySelectorAll(".adm-list-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        list.querySelectorAll(".adm-list-item").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
        openThread(btn.getAttribute("data-v"), {
          user_name: btn.getAttribute("data-name") || "Khách",
          user_email: btn.getAttribute("data-email") || ""
        });
      });
    });

    const supForm = document.getElementById("supForm");
    const supInput = document.getElementById("supInput");
    if (pending && pending.orderHint && supInput && !supInput.value) {
      supInput.value = "Về " + pending.orderHint + ": ";
      supInput.focus();
    }
    async function sendSupport({ text, attachment }) {
      if (!state.supportVisitor) return;
      const hasAttach = !!(attachment && attachment.url);
      if (!text && !hasAttach) return;
      await api("/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          roomId: "vuammo_support",
          channel: "support",
          visitorKey: state.supportVisitor,
          role: "support",
          body: text || "",
          attachmentUrl: hasAttach ? attachment.url : "",
          attachmentName: hasAttach ? attachment.name || "" : "",
          attachmentMime: hasAttach ? attachment.mime || "" : ""
        })
      });
      openThread(state.supportVisitor, state.supportGuestMeta);
    }
    if (window.VuammoChatMedia && supForm && supInput) {
      VuammoChatMedia.wireComposer({ form: supForm, input: supInput, onSend: sendSupport });
    } else {
      supForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = (supInput?.value || "").trim();
        if (!text) return;
        if (supInput) supInput.value = "";
        await sendSupport({ text });
      });
    }

    if (openKey) {
      const btn = Array.from(list.querySelectorAll(".adm-list-item")).find(
        (el) => el.getAttribute("data-v") === openKey
      );
      if (btn) {
        list.querySelectorAll(".adm-list-item").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
      }
      openThread(openKey, openMeta);
    }
  }

  async function renderChatShop(body) {
    setAdminChatLayout(true);
    const shops = getCatalogShops();
    const [act, badges] = await Promise.all([
      api("/admin/chat/threads?channel=shop"),
      api("/admin/badges").catch(() => ({}))
    ]);
    state.badges = badges || state.badges;
    const byToken = {};
    (act.threads || []).forEach((t) => {
      byToken[t.shop_token] = t;
    });
    const pendingMap = badges.shopPendingByToken || {};

    body.innerHTML =
      '<div class="adm-hint"><b>' +
      shops.length +
      " phòng chat shop</b> luôn hiện đủ (kể cả trống). Badge đỏ = khách đang chờ trả lời.</div>" +
      '<div class="adm-split adm-split-3">' +
      '<div class="adm-list" id="shopRooms"></div>' +
      '<div class="adm-list" id="shopThreads"></div>' +
      '<div class="adm-chat-pane"><div class="adm-chat-head" id="shopHead">Chọn shop bên trái để mở phòng</div>' +
      '<div class="adm-chat-msgs" id="shopMsgs"><div class="adm-empty">Chọn shop để kiểm tra phòng chat</div></div>' +
      '<form class="adm-chat-form" id="shopForm"><input id="shopInput" placeholder="Trả lời với tư cách shop…" autocomplete="off">' +
      '<button class="btn btn-primary" type="submit">Gửi</button></form></div></div>';

    const roomList = document.getElementById("shopRooms");
    function roomHtml(s) {
      const a = byToken[s.token];
      const pending = Number(pendingMap[s.token] || (a && a.pending) || 0);
      const threads = a ? a.threads : 0;
      const msgs = a ? a.msg_count : 0;
      const empty = !threads;
      return (
        '<button type="button" class="adm-list-item" data-token="' +
        esc(s.token) +
        '" data-name="' +
        esc(s.name) +
        '" data-unread="' +
        pending +
        '" data-last="' +
        (a && a.last_at ? new Date(a.last_at).getTime() : 0) +
        '"><strong>' +
        esc(s.name) +
        (pending
          ? ' <span class="badge" style="position:static;margin-left:6px">' +
            (pending > 99 ? "99+" : pending) +
            "</span>"
          : "") +
        "</strong><small>" +
        esc(s.city || "") +
        " · " +
        (empty
          ? '<span class="adm-tag">Trống</span>'
          : threads + " khách · " + msgs + " tin") +
        "</small></button>"
      );
    }

    const sortedShops = shops.slice().sort((a, b) => {
      const pa = Number(pendingMap[a.token] || (byToken[a.token] && byToken[a.token].pending) || 0);
      const pb = Number(pendingMap[b.token] || (byToken[b.token] && byToken[b.token].pending) || 0);
      if (pb !== pa) return pb - pa;
      const ta = byToken[a.token] && byToken[a.token].last_at
        ? new Date(byToken[a.token].last_at).getTime()
        : 0;
      const tb = byToken[b.token] && byToken[b.token].last_at
        ? new Date(byToken[b.token].last_at).getTime()
        : 0;
      return tb - ta;
    });

    roomList.innerHTML =
      '<div style="padding:10px"><input class="adm-search" id="roomQ" placeholder="Tìm trong ' +
      shops.length +
      ' phòng shop…">' +
      '<div class="adm-muted" style="margin-top:8px">Hiển thị đủ ' +
      shops.length +
      " phòng · tin mới lên đầu</div></div>" +
      '<div id="roomItems">' +
      sortedShops.map(roomHtml).join("") +
      "</div>";

    document.getElementById("roomQ")?.addEventListener("input", (e) => {
      const needle = e.target.value.toLowerCase();
      roomList.querySelectorAll(".adm-list-item").forEach((btn) => {
        const hit =
          !needle ||
          btn.getAttribute("data-name").toLowerCase().includes(needle) ||
          btn.getAttribute("data-token").includes(needle);
        btn.style.display = hit ? "" : "none";
      });
    });

    async function loadThreads(token, name) {
      state.shopToken = token;
      state.shopName = name;
      state.shopVisitor = null;
      const a = byToken[token];
      document.getElementById("shopHead").textContent =
        "Phòng shop: " + name + (a ? "" : " (trống)");
      document.getElementById("shopMsgs").innerHTML =
        '<div class="adm-empty">Phòng <b>' +
        esc(name) +
        "</b> sẵn sàng.<br>Chưa chọn khách — hoặc chưa có ai nhắn.</div>";
      const data = await api(
        "/admin/chat/threads?channel=shop&shopToken=" + encodeURIComponent(token)
      );
      const box = document.getElementById("shopThreads");
      const rows = (data.threads || []).slice().sort((a, b) => {
        const ua = Math.max(0, Number(a.unread) || (a.last_role === "user" ? 1 : 0));
        const ub = Math.max(0, Number(b.unread) || (b.last_role === "user" ? 1 : 0));
        if (ub !== ua) return ub - ua;
        const ta = a.last_at ? new Date(a.last_at).getTime() : 0;
        const tb = b.last_at ? new Date(b.last_at).getTime() : 0;
        return tb - ta;
      });
      box.innerHTML =
        '<div style="padding:10px;border-bottom:1px solid #f1f5f9" class="adm-muted">Khách trong phòng: <b>' +
        rows.length +
        "</b></div>" +
        (rows.length
          ? rows
              .map((t) => {
                const pending = Math.max(
                  0,
                  Number(t.unread) || (t.last_role === "user" ? 1 : 0)
                );
                const lastTs = t.last_at ? new Date(t.last_at).getTime() : 0;
                return (
                  (() => {
                    const g = guestChatLabel(t);
                    return (
                  '<button type="button" class="adm-list-item" data-v="' +
                  esc(t.visitor_key) +
                  '" data-name="' +
                  esc(g.name) +
                  '" data-email="' +
                  esc(g.email) +
                  '" data-unread="' +
                  pending +
                  '" data-last="' +
                  lastTs +
                  '"><strong>' +
                  esc(g.name) +
                  chatUnreadBadgeHtml(pending) +
                  "</strong><small>" +
                  (g.email ? esc(g.email) + " · " : "") +
                  esc(t.last_body || "(trống)") +
                  "</small></button>"
                    );
                  })()
                );
              })
              .join("")
          : '<div class="adm-empty">Phòng trống — chưa có khách chat với shop này.<br>Vẫn kiểm tra / sẵn sàng nhận tin.</div>');
      box.querySelectorAll(".adm-list-item").forEach((btn) => {
        btn.addEventListener("click", () => {
          box.querySelectorAll(".adm-list-item").forEach((x) => x.classList.remove("active"));
          btn.classList.add("active");
          openShopThread(btn.getAttribute("data-v"), {
            user_name: btn.getAttribute("data-name") || "Khách",
            user_email: btn.getAttribute("data-email") || ""
          });
        });
      });
    }

    async function openShopThread(visitorKey, meta) {
      state.shopVisitor = visitorKey;
      state.shopGuestMeta = meta || guestChatLabel({});
      const roomId = "shop_" + state.shopToken;
      const g = guestChatLabel(state.shopGuestMeta);
      const head = document.getElementById("shopHead");
      if (head) {
        head.innerHTML =
          '<div class="adm-chat-guest-name">Shop ' +
          esc(state.shopName) +
          " ↔ " +
          esc(g.name) +
          "</div>" +
          (g.email
            ? '<div class="adm-chat-guest-email">' + esc(g.email) + "</div>"
            : '<div class="adm-chat-guest-email adm-muted">Chưa có email (khách chưa đăng nhập)</div>');
      }
      try {
        await api("/chat/read", {
          method: "POST",
          body: JSON.stringify({ roomId, visitorKey, as: "admin" })
        });
      } catch (_) {}
      const activeBtn = document.querySelector("#shopThreads .adm-list-item.active");
      const cleared = clearThreadUnreadBadge(
        activeBtn,
        document.getElementById("shopThreads")
      );
      if (cleared > 0 && pendingMap[state.shopToken] != null) {
        pendingMap[state.shopToken] = Math.max(
          0,
          Number(pendingMap[state.shopToken] || 0) - cleared
        );
      }
      const shopBtn = document.querySelector(
        '#shopRooms .adm-list-item[data-token="' + state.shopToken + '"]'
      );
      if (shopBtn) {
        const left = Number(pendingMap[state.shopToken] || 0);
        let badge = shopBtn.querySelector(".badge");
        if (left <= 0) {
          if (badge) badge.remove();
        } else if (badge) {
          badge.textContent = left > 99 ? "99+" : String(left);
        } else {
          const strong = shopBtn.querySelector("strong");
          if (strong) {
            badge = document.createElement("span");
            badge.className = "badge";
            badge.style.cssText = "position:static;margin-left:6px";
            badge.textContent = left > 99 ? "99+" : String(left);
            strong.appendChild(badge);
          }
        }
        shopBtn.setAttribute("data-unread", String(left));
        resortAdminChatList(document.getElementById("roomItems") || document.getElementById("shopRooms"));
      }
      const data = await api(
        "/chat/messages?roomId=" +
          encodeURIComponent(roomId) +
          "&visitorKey=" +
          encodeURIComponent(visitorKey)
      );
      const box = document.getElementById("shopMsgs");
      const msgs = data.messages || [];
      box.innerHTML = msgs.length
        ? msgs
            .map((m) => {
              return renderAdminBubble(m);
            })
            .join("")
        : '<div class="adm-empty">Chưa có tin nhắn trong hội thoại này</div>';
      box.scrollTop = box.scrollHeight;
      refreshBadges();
    }

    roomList.querySelectorAll(".adm-list-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        roomList.querySelectorAll(".adm-list-item").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
        loadThreads(btn.getAttribute("data-token"), btn.getAttribute("data-name"));
      });
    });

    const shopForm = document.getElementById("shopForm");
    const shopInput = document.getElementById("shopInput");
    async function sendShop({ text, attachment }) {
      if (!state.shopVisitor || !state.shopToken) return;
      const hasAttach = !!(attachment && attachment.url);
      if (!text && !hasAttach) return;
      await api("/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          roomId: "shop_" + state.shopToken,
          channel: "shop",
          visitorKey: state.shopVisitor,
          role: "shop",
          body: text || "",
          shopToken: state.shopToken,
          shopName: state.shopName || "",
          attachmentUrl: hasAttach ? attachment.url : "",
          attachmentName: hasAttach ? attachment.name || "" : "",
          attachmentMime: hasAttach ? attachment.mime || "" : ""
        })
      });
      openShopThread(state.shopVisitor, state.shopGuestMeta);
    }
    if (window.VuammoChatMedia && shopForm && shopInput) {
      VuammoChatMedia.wireComposer({ form: shopForm, input: shopInput, onSend: sendShop });
    } else {
      shopForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = (shopInput?.value || "").trim();
        if (!text) return;
        if (shopInput) shopInput.value = "";
        await sendShop({ text });
      });
    }

    refreshBadges();
  }

  async function renderVirtualShops(body) {
    const data = await api("/admin/virtual-shops");
    const st = data.stats || { total: 0, visible: 0, on_shift: 0 };
    body.innerHTML =
      '<div class="adm-hint"><b>Shop ảo</b> dùng để filler / demo trên khám phá. Không lẫn với 80 gian hàng thật (mục Gian hàng) và không có phòng chat shop thật.</div>' +
      '<div class="adm-grid adm-grid-3">' +
      stat("Tổng shop ảo", st.total) +
      stat("Hiện trên khám phá", st.visible, "pos") +
      stat("Đang trong ca", st.on_shift) +
      "</div>" +
      '<div class="adm-card"><h2>Thêm / sửa shop ảo</h2><div class="adm-form-grid">' +
      '<input type="hidden" id="vsId">' +
      '<div class="adm-field"><label>Tên shop</label><input id="vsName"></div>' +
      '<div class="adm-field"><label>Thành phố</label><input id="vsCity"></div>' +
      '<div class="adm-field"><label>SĐT</label><input id="vsPhone"></div>' +
      '<div class="adm-field"><label>Đánh giá</label><input id="vsRating" type="number" step="0.1" value="4.9"></div>' +
      '<div class="adm-field span2"><label>Bio</label><input id="vsBio"></div>' +
      '<div class="adm-field span3"><button type="button" class="btn btn-primary" id="vsSave">Lưu shop ảo</button></div>' +
      "</div></div>" +
      '<div class="adm-card"><div class="adm-filters">' +
      '<input class="adm-search" id="vsFilter" placeholder="Lọc theo tên, SĐT, khu vực…">' +
      filterSelect(
        "vsVis",
        "Hiển thị",
        [
          { v: "all", t: "Tất cả" },
          { v: "on", t: "Đang hiện" },
          { v: "off", t: "Đã ẩn" }
        ],
        "all"
      ) +
      '<button type="button" class="btn btn-outline" id="vsRefresh">Làm mới &amp; đồng bộ</button></div>' +
      '<div class="adm-table-wrap" style="margin-top:12px"><table class="adm-table"><thead><tr>' +
      "<th>Shop ảo</th><th>SĐT</th><th>Khu vực</th><th>Đánh giá</th><th>Hiển thị</th><th></th>" +
      '</tr></thead><tbody id="vsRows"></tbody></table></div></div>';

    function fillForm(item) {
      document.getElementById("vsId").value = item ? item.id : "";
      document.getElementById("vsName").value = item ? item.name : "";
      document.getElementById("vsCity").value = item ? item.city : "";
      document.getElementById("vsPhone").value = item ? item.phone : "";
      document.getElementById("vsRating").value = item ? item.rating : "4.9";
      document.getElementById("vsBio").value = item ? item.bio : "";
    }

    function paint() {
      const needle = String(document.getElementById("vsFilter")?.value || "").toLowerCase();
      const vis = document.getElementById("vsVis")?.value || "all";
      const rows = document.getElementById("vsRows");
      const list = (data.items || []).filter((s) => {
        if (vis === "on" && !s.visible) return false;
        if (vis === "off" && s.visible) return false;
        if (!needle) return true;
        return (
          s.name.toLowerCase().includes(needle) ||
          String(s.phone).includes(needle) ||
          String(s.city).toLowerCase().includes(needle)
        );
      });
      rows.innerHTML = list.length
        ? list
            .map(
              (s) =>
                '<tr data-id="' +
                s.id +
                '"><td><span class="adm-cell-main">' +
                esc(s.name) +
                "</span></td><td>" +
                esc(s.phone || "—") +
                "</td><td>" +
                esc(s.city || "—") +
                "</td><td>★ " +
                esc(s.rating) +
                "</td><td>" +
                (s.visible
                  ? '<span class="adm-tag ok">Hiện</span>'
                  : '<span class="adm-tag bad">Ẩn</span>') +
                '</td><td><div class="adm-row-actions">' +
                '<button type="button" class="btn btn-primary btn-sm js-edit">Chỉnh hồ sơ</button>' +
                '<button type="button" class="btn btn-ghost btn-sm js-vis">' +
                (s.visible ? "Ẩn" : "Hiện") +
                '</button><button type="button" class="btn btn-danger btn-sm js-del">Xóa</button></div></td></tr>'
            )
            .join("")
        : '<tr><td colspan="6" class="adm-empty">Chưa có shop ảo / không khớp lọc</td></tr>';
      rows.querySelectorAll(".js-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = Number(btn.closest("tr").getAttribute("data-id"));
          fillForm(data.items.find((x) => x.id === id));
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });
      rows.querySelectorAll(".js-vis").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.closest("tr").getAttribute("data-id");
          const s = data.items.find((x) => String(x.id) === id);
          if (s && s.visible) {
            const ok = await confirmAction({
              title: "Ẩn shop ảo",
              message: "Ẩn shop \"" + (s.name || id) + "\" khỏi danh sách hiển thị?",
              okText: "Ẩn"
            });
            if (!ok) return;
          }
          await api("/admin/virtual-shops/" + id, {
            method: "PUT",
            body: JSON.stringify({
              name: s.name,
              city: s.city,
              phone: s.phone,
              rating: s.rating,
              bio: s.bio,
              visible: !s.visible,
              onShift: s.onShift
            })
          });
          toast("Đã cập nhật");
          renderVirtualShops(body);
        });
      });
      rows.querySelectorAll(".js-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!(await confirmAction({ title: "Xóa shop ảo", message: "Shop ảo sẽ bị xóa khỏi danh sách. Không hoàn tác được.", okText: "Xóa" }))) return;
          await api("/admin/virtual-shops/" + btn.closest("tr").getAttribute("data-id"), {
            method: "DELETE"
          });
          toast("Đã xóa");
          renderVirtualShops(body);
        });
      });
    }

    document.getElementById("vsSave")?.addEventListener("click", async () => {
      const id = document.getElementById("vsId").value;
      const payload = {
        name: document.getElementById("vsName").value.trim(),
        city: document.getElementById("vsCity").value.trim(),
        phone: document.getElementById("vsPhone").value.trim(),
        rating: Number(document.getElementById("vsRating").value || 4.9),
        bio: document.getElementById("vsBio").value.trim(),
        visible: true,
        onShift: true
      };
      if (!payload.name) return toast("Nhập tên shop");
      if (id) {
        await api("/admin/virtual-shops/" + id, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await api("/admin/virtual-shops", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      toast("Đã lưu shop ảo");
      renderVirtualShops(body);
    });
    paint();
    document.getElementById("vsFilter")?.addEventListener("input", paint);
    document.getElementById("vsVis")?.addEventListener("change", paint);
    document.getElementById("vsRefresh")?.addEventListener("click", () => renderVirtualShops(body));
  }

  async function renderPromos(body) {
    const data = await api("/admin/promos");
    body.innerHTML =
      '<div class="adm-card"><div class="adm-card-head"><h2>Tạo mã mới</h2>' +
      "<span class=\"adm-muted\">Tổng: " +
      (data.total || 0) +
      " mã · Đang bật: " +
      (data.active || 0) +
      "</span></div>" +
      '<div class="adm-form-grid">' +
      '<div class="adm-field"><label>Mã</label><input id="prCode" placeholder="VD VUAMMO10"></div>' +
      '<div class="adm-field"><label>% giảm</label><input id="prPct" type="number" value="10"></div>' +
      '<div class="adm-field"><label>Giảm tối đa (₫)</label><input id="prMax" type="number" value="100000"></div>' +
      '<div class="adm-field"><label>Đơn tối thiểu (₫)</label><input id="prMin" type="number" value="0"></div>' +
      '<div class="adm-field"><label>Hết hạn</label><input id="prExp" type="date"></div>' +
      '<div class="adm-field"><label>Số lượt dùng (toàn sàn)</label><input id="prUses" type="number" min="1" value="100"></div>' +
      '<div class="adm-field"><label>Hiển thị</label><select id="prVis">' +
      '<option value="public">Công khai — hiện khi thanh toán, bấm áp dụng</option>' +
      '<option value="hidden">Nhập mã — không hiện list, chỉ khi gõ đúng</option>' +
      "</select></div>" +
      '<div class="adm-field"><label>Mỗi user dùng tối đa</label><input id="prPerUser" type="number" min="0" value="0" title="0 = không giới hạn mỗi tài khoản">' +
      '<span class="adm-muted" style="display:block;margin-top:4px;font-size:12px">0 = không giới hạn · 1 = mỗi TK 1 lần · 2+ = giới hạn tương ứng</span></div>' +
      '<div class="adm-field span3"><label>Mô tả khuyến mãi…</label><textarea id="prDesc" rows="2"></textarea></div>' +
      '<div class="adm-field span3"><button type="button" class="btn btn-primary" id="prCreate">Tạo mã mới</button></div>' +
      "</div></div>" +
      '<div class="adm-card"><div class="adm-filters">' +
      '<input class="adm-search" id="prFilter" placeholder="Lọc mã / mô tả…">' +
      filterSelect(
        "prActive",
        "Trạng thái",
        [
          { v: "all", t: "Tất cả" },
          { v: "on", t: "Đang bật" },
          { v: "off", t: "Đã tắt" }
        ],
        "all"
      ) +
      '<button type="button" class="btn btn-outline" id="prFilterBtn">Lọc</button></div>' +
      '<div class="adm-table-wrap" style="margin-top:12px"><table class="adm-table"><thead><tr>' +
      "<th>Mã</th><th>Hiển thị</th><th>/user</th><th>Mô tả</th><th>Giảm</th><th>Tối đa</th><th>Đơn tối thiểu</th><th>Lượt sàn</th><th>Hết hạn</th><th>Trạng thái</th><th></th>" +
      '</tr></thead><tbody id="prRows"></tbody></table></div></div>';

    function promoVisLabel(p) {
      return p.visibility === "hidden" ? "Nhập mã" : "Công khai";
    }

    function promoPerUserLabel(p) {
      const n = Number(p.perUserLimit || 0);
      if (!n) return "Không giới hạn";
      return n + " lần";
    }

    function paintPromos() {
      const needle = String(document.getElementById("prFilter")?.value || "").toLowerCase();
      const act = document.getElementById("prActive")?.value || "all";
      const list = (data.items || []).filter((p) => {
        if (act === "on" && !p.active) return false;
        if (act === "off" && p.active) return false;
        if (!needle) return true;
        return (
          p.code.toLowerCase().includes(needle) ||
          String(p.description || "")
            .toLowerCase()
            .includes(needle) ||
          promoVisLabel(p).toLowerCase().includes(needle)
        );
      });
      document.getElementById("prRows").innerHTML = list.length
        ? list
            .map(
              (p) =>
                '<tr data-id="' +
                p.id +
                '"><td><b>' +
                esc(p.code) +
                "</b></td><td>" +
                esc(promoVisLabel(p)) +
                "</td><td>" +
                esc(promoPerUserLabel(p)) +
                "</td><td>" +
                esc(p.description || "—") +
                "</td><td>" +
                p.percent +
                "%</td><td>" +
                money(p.maxCents) +
                "</td><td>" +
                money(p.minOrderCents) +
                "</td><td>" +
                p.usedCount +
                "/" +
                p.maxUses +
                "</td><td>" +
                esc(p.expiresAt ? String(p.expiresAt).slice(0, 10) : "—") +
                "</td><td>" +
                (p.active
                  ? '<span class="adm-tag ok">Đang bật</span>'
                  : '<span class="adm-tag bad">Tắt</span>') +
                '</td><td><div class="adm-row-actions">' +
                '<button type="button" class="btn btn-ghost btn-sm js-tog">' +
                (p.active ? "Tắt" : "Bật") +
                '</button><button type="button" class="btn btn-danger btn-sm js-del">Xóa</button></div></td></tr>'
            )
            .join("")
        : '<tr><td colspan="11" class="adm-empty">Không khớp bộ lọc</td></tr>';
      document.querySelectorAll("#prRows .js-tog").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.closest("tr").getAttribute("data-id");
          const p = data.items.find((x) => String(x.id) === id);
          if (p && p.active) {
            const ok = await confirmAction({
              title: "Tắt mã khuyến mãi",
              message: "Ẩn / tắt mã \"" + (p.code || id) + "\". Tiếp tục?",
              okText: "Tắt mã"
            });
            if (!ok) return;
          }
          await api("/admin/promos/" + id, {
            method: "PATCH",
            body: JSON.stringify({ active: !p.active })
          });
          renderPromos(body);
        });
      });
      document.querySelectorAll("#prRows .js-del").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!(await confirmAction({ title: "Xóa mã khuyến mãi", message: "Mã khuyến mãi sẽ bị xóa vĩnh viễn.", okText: "Xóa" }))) return;
          await api("/admin/promos/" + btn.closest("tr").getAttribute("data-id"), {
            method: "DELETE"
          });
          renderPromos(body);
        });
      });
    }

    document.getElementById("prCreate")?.addEventListener("click", async () => {
      await api("/admin/promos", {
        method: "POST",
        body: JSON.stringify({
          code: document.getElementById("prCode").value,
          percent: Number(document.getElementById("prPct").value),
          maxCents: Number(document.getElementById("prMax").value),
          minOrderCents: Number(document.getElementById("prMin").value),
          expiresAt: document.getElementById("prExp").value || null,
          maxUses: Number(document.getElementById("prUses").value || 1),
          visibility: document.getElementById("prVis").value,
          perUserLimit: Number(document.getElementById("prPerUser").value || 0),
          description: document.getElementById("prDesc").value
        })
      });
      toast("Đã tạo mã");
      renderPromos(body);
    });
    paintPromos();
    document.getElementById("prFilterBtn")?.addEventListener("click", paintPromos);
  }

  async function renderNotifications(body) {
    const data = await api("/admin/notifications");
    const st = data.stats || {};
    body.innerHTML =
      '<div class="adm-grid">' +
      stat("Tổng thông báo", st.total || 0) +
      stat("Users nhận được", st.users || 0) +
      stat("Khách hàng", st.users || 0) +
      stat("Shop", getCatalogShops().length) +
      "</div>" +
      '<div class="adm-card"><h2>Gửi thông báo mới</h2>' +
      '<div class="adm-pills" id="ntAud">' +
      '<button type="button" class="adm-pill active" data-a="all">Tất cả users</button>' +
      '<button type="button" class="adm-pill" data-a="customers">Chỉ khách</button>' +
      '<button type="button" class="adm-pill" data-a="shops">Chỉ shop</button></div>' +
      '<div class="adm-form-grid">' +
      '<div class="adm-field span2"><label>Tiêu đề</label><input id="ntTitle"></div>' +
      '<div class="adm-field"><label>Loại</label><select id="ntKind"><option value="system">Hệ thống</option><option value="promo">Khuyến mãi</option><option value="order">Đơn hàng</option></select></div>' +
      '<div class="adm-field span3"><label>Nội dung thông báo…</label><textarea id="ntBody" rows="3"></textarea></div>' +
      '<div class="adm-field span3"><button type="button" class="btn btn-primary" id="ntSend">Gửi thông báo</button></div>' +
      "</div></div>" +
      '<div class="adm-card"><div class="adm-table-wrap"><table class="adm-table"><thead><tr>' +
      "<th>Loại</th><th>Tiêu đề</th><th>Nội dung</th><th>Audience</th><th>Thời gian</th><th></th>" +
      "</tr></thead><tbody>" +
      ((data.items || []).length
        ? data.items
            .map(
              (n) =>
                '<tr data-id="' +
                n.id +
                '"><td>' +
                esc(n.kind) +
                "</td><td><b>" +
                esc(n.title) +
                "</b></td><td>" +
                esc(n.body).slice(0, 120) +
                "</td><td>" +
                esc(n.audience) +
                "</td><td>" +
                fmtTime(n.createdAt) +
                '</td><td><button type="button" class="btn btn-danger btn-sm js-del">Xóa</button></td></tr>'
            )
            .join("")
        : '<tr><td colspan="6" class="adm-empty">Chưa có thông báo</td></tr>') +
      "</tbody></table></div></div>";

    let audience = "all";
    document.getElementById("ntAud")?.querySelectorAll(".adm-pill").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll("#ntAud .adm-pill").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        audience = b.getAttribute("data-a");
      });
    });
    document.getElementById("ntSend")?.addEventListener("click", async () => {
      await api("/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          audience,
          title: document.getElementById("ntTitle").value.trim(),
          body: document.getElementById("ntBody").value.trim(),
          kind: document.getElementById("ntKind").value
        })
      });
      toast("Đã gửi thông báo");
      renderNotifications(body);
    });
    body.querySelectorAll(".js-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await confirmAction({
          title: "Xóa thông báo",
          message: "Thông báo này sẽ bị xóa. Tiếp tục?",
          okText: "Xóa"
        });
        if (!ok) return;
        await api("/admin/notifications/" + btn.closest("tr").getAttribute("data-id"), {
          method: "DELETE"
        });
        renderNotifications(body);
      });
    });
  }

  
  let blogQuill = null;

  function destroyBlogEditor() {
    blogQuill = null;
  }

  function getBlogHtml() {
    if (blogQuill) {
      const html = String(blogQuill.root.innerHTML || "").trim();
      return html === "<p><br></p>" ? "" : html;
    }
    return document.getElementById("bContent")?.value || "";
  }

  function setBlogHtml(html) {
    const safe = html && String(html).trim() ? String(html) : "<p><br></p>";
    const ta = document.getElementById("bContent");
    if (ta) ta.value = html || "";
    if (!blogQuill) return;
    blogQuill.setContents([]);
    blogQuill.clipboard.dangerouslyPasteHTML(0, safe);
  }

  function mountBlogEditor(initialHtml) {
    destroyBlogEditor();
    const host = document.getElementById("bEditor");
    if (!host) return null;
    // Reset host so remount không bị toolbar trùng
    const wrap = host.closest(".adm-rte");
    if (wrap) {
      wrap.innerHTML = '<div id="bEditor"></div>';
    } else {
      host.innerHTML = "";
    }
    const fresh = document.getElementById("bEditor");
    if (!fresh) return null;
    if (!window.Quill) {
      console.warn("Quill chưa tải");
      const ta = document.getElementById("bContent");
      if (ta) {
        ta.classList.remove("hidden");
        ta.rows = 14;
        ta.value = initialHtml || "";
      }
      return null;
    }
    blogQuill = new Quill(fresh, {
      theme: "snow",
      placeholder: "Nhập nội dung bài viết…",
      modules: {
        toolbar: {
          container: [
            [{ font: [] }, { size: ["small", false, "large", "huge"] }],
            [{ header: [1, 2, 3, 4, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ color: [] }, { background: [] }],
            [{ script: "sub" }, { script: "super" }],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ indent: "-1" }, { indent: "+1" }],
            [{ align: [] }],
            ["blockquote", "code-block"],
            ["link", "image"],
            ["clean"]
          ],
          handlers: {
            image: function () {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = async () => {
                const file = input.files && input.files[0];
                if (!file) return;
                try {
                  const url = await uploadAdminFile(file);
                  const range = blogQuill.getSelection(true) || { index: blogQuill.getLength() };
                  blogQuill.insertEmbed(range.index, "image", url, "user");
                  blogQuill.setSelection(range.index + 1, 0);
                  const imgField = document.getElementById("bImage");
                  if (imgField && !imgField.value.trim()) {
                    imgField.value = url;
                    imgField.dispatchEvent(new Event("input"));
                  }
                  toast("Đã chèn ảnh");
                } catch (e) {
                  toast(e.message || "Upload ảnh lỗi");
                }
              };
              input.click();
            }
          }
        }
      }
    });
    setBlogHtml(initialHtml || "");
    blogQuill.on("text-change", () => {
      const ta = document.getElementById("bContent");
      if (ta) ta.value = getBlogHtml();
    });
    return blogQuill;
  }

async function renderBlog(body) {
    const sitePosts = getSharePosts();
    const f = state.blog || { q: "", status: "all", locale: "all", category: "all" };
    state.blog = f;
    const qs = new URLSearchParams({
      q: f.q,
      status: f.status,
      locale: f.locale,
      category: f.category
    });
    const data = await api("/admin/blog?" + qs.toString());
    const c = data.counts || { total: 0, published: 0, draft: 0 };
    const catOpts = [{ v: "all", t: "Mọi chuyên mục" }].concat(
      (data.categories || []).map((x) => ({
        v: x.category,
        t: x.category + " (" + x.n + ")"
      }))
    );

    body.innerHTML =
      '<div class="adm-hint">Đồng bộ <b>' +
      sitePosts.length +
      " bài</b> từ mục Chia sẻ trên website vào admin. Có thể sửa / ẩn (draft) sau khi sync.</div>" +
      '<div class="adm-grid adm-grid-3">' +
      stat("Tổng bài (DB)", c.total) +
      stat("Published", c.published, "pos") +
      stat("Draft", c.draft, c.draft ? "warn" : "") +
      "</div>" +
      '<div class="adm-card"><div class="adm-card-head"><h2>Blog / Viết bài</h2><div class="adm-actions" style="margin:0">' +
      '<button type="button" class="btn btn-primary" id="blogSync">Đồng bộ từ website (' +
      sitePosts.length +
      ")</button>" +
      '<button type="button" class="btn btn-outline" id="blogNew">Bài mới</button></div></div>' +
      '<div class="adm-filters">' +
      '<input class="adm-search" id="blogQ" placeholder="Tìm tiêu đề, slug, chuyên mục…" value="' +
      esc(f.q) +
      '">' +
      filterSelect(
        "blogStatus",
        "Status",
        [
          { v: "all", t: "Tất cả" },
          { v: "published", t: "published" },
          { v: "draft", t: "draft" }
        ],
        f.status
      ) +
      filterSelect(
        "blogLoc",
        "Locale",
        [
          { v: "all", t: "Tất cả" },
          { v: "vi", t: "vi" },
          { v: "en", t: "en" }
        ],
        f.locale
      ) +
      filterSelect("blogCat", "Chuyên mục", catOpts, f.category) +
      '<button type="button" class="btn btn-outline" id="blogApply">Lọc</button></div>' +
      '<div id="blogForm" class="hidden adm-compose" style="margin-top:14px">' +
      "<h3 id=\"bFormTitle\">Bài mới</h3>" +
      '<input type="hidden" id="bId">' +
      '<div class="adm-field"><label>Ngôn ngữ</label>' +
      '<select id="bLoc"><option value="vi">vi</option><option value="en">en</option></select></div>' +
      '<div class="adm-field"><label>Tiêu đề</label><input id="bTitle" placeholder="Tiêu đề bài viết"></div>' +
      '<div class="adm-field"><label>Slug</label><input id="bSlug" placeholder="tu-dong-tu-tieu-de"></div>' +
      '<div class="adm-field"><label>Excerpt</label><input id="bExcerpt" placeholder="Tóm tắt ngắn"></div>' +
      '<div class="adm-field span3"><label>Nội dung</label>' +
      '<div class="adm-rte"><div id="bEditor"></div></div>' +
      '<textarea id="bContent" class="hidden" aria-hidden="true"></textarea>' +
      '<p class="adm-rte-hint">Soạn thảo như Word — in đậm, tiêu đề, danh sách, màu chữ, căn lề, chèn ảnh/link. HTML được lưu tự động phía sau.</p></div>' +
      '<div class="adm-field"><label>Chèn ảnh + alt</label>' +
      '<div class="adm-file-row">' +
      '<input type="file" id="bImgFile" accept="image/*">' +
      '<input id="bImgAlt" placeholder="alt text" style="max-width:180px">' +
      '<button type="button" class="btn btn-outline btn-sm" id="bImgInsert">Chèn</button></div>' +
      '<input id="bImage" placeholder="URL ảnh đại diện / chèn vào bài" style="margin-top:8px">' +
      '<img id="bImgPreview" class="adm-preview-img hidden" alt="" style="margin-top:8px"></div>' +
      '<div class="adm-field"><label>SEO title <span class="cnt" id="bMetaTitleCnt">0/60</span></label>' +
      '<input id="bMetaTitle" placeholder="Để trống = dùng tiêu đề"></div>' +
      '<div class="adm-field"><label>Meta description <span class="cnt" id="bMetaDescCnt">0/155</span></label>' +
      '<textarea id="bMetaDesc" rows="2" placeholder="Mô tả SERP / Open Graph"></textarea></div>' +
      '<div class="adm-field"><label>Canonical URL</label>' +
      '<input id="bCanon" placeholder="/chia-se/slug-bai"></div>' +
      '<div class="adm-field"><label>OG image URL</label><input id="bOg" placeholder="Để trống = dùng ảnh đại diện"></div>' +
      '<div class="adm-field"><label>Upload OG file</label><div class="adm-file-row">' +
      '<input type="file" id="bOgFile" accept="image/*">' +
      '<button type="button" class="btn btn-outline btn-sm" id="bOgUp">Upload</button></div></div>' +
      '<div class="adm-field"><label>Category slug</label><input id="bCat" placeholder="tin-tuc-ai"></div>' +
      '<div class="adm-field"><label>Category label</label><input id="bCatLabel" placeholder="Tin tức AI"></div>' +
      '<div class="adm-field"><label>Keywords</label><input id="bKeywords" placeholder="từ khóa, cách nhau bởi dấu phẩy"></div>' +
      '<div class="adm-compose-actions">' +
      '<button type="button" class="btn btn-outline" id="bDraft">Lưu nháp</button>' +
      '<button type="button" class="btn btn-primary" id="bPublish">Publish</button>' +
      '<button type="button" class="btn btn-ghost" id="bCancel">Huỷ</button></div></div>' +
      '<div class="adm-table-wrap" style="margin-top:14px"><table class="adm-table"><thead><tr>' +
      "<th>Tiêu đề</th><th>Chuyên mục</th><th>Locale</th><th>Slug</th><th>Status</th><th></th>" +
      "</tr></thead><tbody>" +
      ((data.items || []).length
        ? data.items
            .map(
              (p) =>
                '<tr data-id="' +
                p.id +
                '"><td><span class="adm-cell-main">' +
                esc(p.title) +
                '</span><span class="adm-cell-sub">' +
                esc((p.excerpt || "").slice(0, 80)) +
                "</span></td><td>" +
                esc(p.category || "—") +
                "</td><td>" +
                esc(p.locale) +
                "</td><td>" +
                esc(p.slug) +
                "</td><td>" +
                (p.status === "published"
                  ? '<span class="adm-tag ok">published</span>'
                  : '<span class="adm-tag warn">draft</span>') +
                '</td><td><div class="adm-row-actions">' +
                '<button type="button" class="btn btn-outline btn-sm js-edit">Sửa</button>' +
                '<button type="button" class="btn btn-danger btn-sm js-del">Xóa</button></div></td></tr>'
            )
            .join("")
        : '<tr><td colspan="6" class="adm-empty">Chưa có bài trong DB — bấm <b>Đồng bộ từ website</b></td></tr>') +
      "</tbody></table></div></div>";

    const form = document.getElementById("blogForm");
    let slugManual = false;
    let editExtras = { readTime: "", publishedDate: null };

    function syncImgPreview() {
      const url = document.getElementById("bImage")?.value.trim();
      const img = document.getElementById("bImgPreview");
      if (!img) return;
      if (url) {
        img.src = url;
        img.classList.remove("hidden");
      } else img.classList.add("hidden");
    }

    function showForm(post) {
      form.classList.remove("hidden");
      slugManual = Boolean(post && post.slug);
      document.getElementById("bFormTitle").textContent = post ? "Sửa bài" : "Bài mới";
      document.getElementById("bId").value = post ? post.id : "";
      document.getElementById("bTitle").value = post ? post.title : "";
      document.getElementById("bMetaTitle").value = post ? post.metaTitle || "" : "";
      document.getElementById("bSlug").value = post ? post.slug : "";
      document.getElementById("bLoc").value = post ? post.locale : "vi";
      document.getElementById("bCat").value = post ? post.category || "" : "";
      document.getElementById("bCatLabel").value = post ? post.categoryLabel || "" : "";
      document.getElementById("bExcerpt").value = post ? post.excerpt || "" : "";
      document.getElementById("bMetaDesc").value = post
        ? post.metaDescription || post.excerpt || ""
        : "";
      document.getElementById("bKeywords").value = post ? post.keywords || "" : "";
      document.getElementById("bImage").value = post ? post.image || "" : "";
      document.getElementById("bOg").value = post ? post.ogImage || "" : "";
      document.getElementById("bCanon").value = post ? post.canonicalPath || "" : "";
      mountBlogEditor(post ? post.content || "" : "");
      editExtras = {
        readTime: post ? post.readTime || "" : "",
        publishedDate: post && post.publishedDate ? post.publishedDate : null
      };
      syncImgPreview();
      document.getElementById("bMetaTitle")?.dispatchEvent(new Event("input"));
      document.getElementById("bMetaDesc")?.dispatchEvent(new Event("input"));
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    wireSeoCounter("bMetaTitle", "bMetaTitleCnt", 60);
    wireSeoCounter("bMetaDesc", "bMetaDescCnt", 155);

    async function savePost(status) {
      const id = document.getElementById("bId").value;
      const title = document.getElementById("bTitle").value.trim();
      let slug = document.getElementById("bSlug").value.trim();
      if (!slug && title) slug = slugifyText(title);
      if (!title || !slug) return toast("Cần tiêu đề và slug");
      const payload = {
        title,
        slug,
        locale: document.getElementById("bLoc").value,
        status,
        category: document.getElementById("bCat").value.trim(),
        categoryLabel: document.getElementById("bCatLabel").value.trim(),
        excerpt: document.getElementById("bExcerpt").value.trim(),
        metaTitle: document.getElementById("bMetaTitle").value.trim(),
        metaDescription: document.getElementById("bMetaDesc").value.trim(),
        keywords: document.getElementById("bKeywords").value.trim(),
        image: document.getElementById("bImage").value.trim(),
        ogImage: document.getElementById("bOg").value.trim(),
        canonicalPath: document.getElementById("bCanon").value.trim(),
        readTime: editExtras.readTime || "",
        publishedDate:
          status === "published"
            ? editExtras.publishedDate || new Date().toISOString().slice(0, 10)
            : editExtras.publishedDate,
        content: getBlogHtml()
      };
      if (id) {
        await api("/admin/blog/" + id, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/admin/blog", { method: "POST", body: JSON.stringify(payload) });
      }
      toast(status === "published" ? "Đã publish lên website" : "Đã lưu nháp");
      renderBlog(body);
    }

    async function doSync() {
      if (!sitePosts.length) return toast("Không tải được SHARE_POSTS từ website");
      const payload = sitePosts.map((p) => ({
        title: p.title,
        slug: p.slug,
        content: p.body || "",
        excerpt: p.excerpt || "",
        metaTitle: p.title,
        metaDescription: p.excerpt || "",
        keywords: p.keywords || "",
        category: p.cat || "",
        categoryLabel: p.catLabel || "",
        image: p.image || "",
        ogImage: p.image || "",
        canonicalPath: "/chia-se/" + p.slug,
        readTime: p.readTime || "",
        publishedDate: p.date || null,
        locale: "vi",
        status: "published"
      }));
      const r = await api("/admin/blog/sync", {
        method: "POST",
        body: JSON.stringify({ posts: payload })
      });
      toast("Đã đồng bộ " + (r.upserted || 0) + " bài lên DB / website");
      renderBlog(body);
    }

    if (!c.total && sitePosts.length) {
      doSync().catch(() => {});
    }

    document.getElementById("blogApply")?.addEventListener("click", () => {
      state.blog = {
        q: document.getElementById("blogQ").value.trim(),
        status: document.getElementById("blogStatus").value,
        locale: document.getElementById("blogLoc").value,
        category: document.getElementById("blogCat").value
      };
      renderBlog(body);
    });
    document.getElementById("blogSync")?.addEventListener("click", async () => {
      if (!(await confirmAction({ title: "Đồng bộ blog", message: "Đồng bộ " + sitePosts.length + " bài từ Chia sẻ vào admin/DB?", okText: "Đồng bộ", danger: false }))) return;
      await doSync();
    });
    document.getElementById("blogNew")?.addEventListener("click", () => showForm(null));
    document.getElementById("bCancel")?.addEventListener("click", () => form.classList.add("hidden"));
    document.getElementById("bDraft")?.addEventListener("click", () => savePost("draft"));
    document.getElementById("bPublish")?.addEventListener("click", () => savePost("published"));

    document.getElementById("bTitle")?.addEventListener("input", () => {
      if (slugManual) return;
      document.getElementById("bSlug").value = slugifyText(
        document.getElementById("bTitle").value
      );
    });
    document.getElementById("bSlug")?.addEventListener("input", () => {
      slugManual = true;
    });
    document.getElementById("bImage")?.addEventListener("input", syncImgPreview);


    document.getElementById("bImgInsert")?.addEventListener("click", async () => {
      const alt = document.getElementById("bImgAlt")?.value.trim() || "";
      let url = document.getElementById("bImage").value.trim();
      const file = document.getElementById("bImgFile")?.files?.[0];
      try {
        if (file) {
          url = await uploadAdminFile(file);
          document.getElementById("bImage").value = url;
          syncImgPreview();
        }
        if (!url) return toast("Chọn file hoặc nhập URL ảnh");
        if (blogQuill) {
          const range = blogQuill.getSelection(true) || { index: blogQuill.getLength() };
          blogQuill.insertEmbed(range.index, "image", url, "user");
          if (alt) {
            const imgs = blogQuill.root.querySelectorAll('img[src="' + url.replace(/"/g, '\\"') + '"]');
            const last = imgs[imgs.length - 1];
            if (last) last.setAttribute("alt", alt);
          }
          blogQuill.setSelection(range.index + 1, 0);
        } else {
          const ta = document.getElementById("bContent");
          if (ta) {
            ta.value +=
              '<p><img src="' +
              url.replace(/"/g, "") +
              '" alt="' +
              alt.replace(/"/g, "") +
              '"></p>\n';
          }
        }
        toast("Đã chèn ảnh vào nội dung");
      } catch (e) {
        toast(e.message || "Upload lỗi");
      }
    });

    document.getElementById("bOgUp")?.addEventListener("click", async () => {
      const file = document.getElementById("bOgFile")?.files?.[0];
      if (!file) return toast("Chọn file OG");
      try {
        const url = await uploadAdminFile(file);
        document.getElementById("bOg").value = url;
        toast("Đã upload OG");
      } catch (e) {
        toast(e.message || "Upload lỗi");
      }
    });

    body.querySelectorAll(".js-edit").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.closest("tr").getAttribute("data-id");
        const full = await api("/admin/blog/" + id);
        showForm(full.post);
      });
    });
    body.querySelectorAll(".js-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await confirmAction({ title: "Xóa bài viết", message: "Bài blog sẽ bị xóa khỏi admin/DB.", okText: "Xóa" }))) return;
        await api("/admin/blog/" + btn.closest("tr").getAttribute("data-id"), {
          method: "DELETE"
        });
        renderBlog(body);
      });
    });
  }

  async function renderUsers(body) {
    const data = await api("/admin/users");
    const st = data.stats || { users: data.users.length, totalBalance: 0 };
    body.innerHTML =
      '<div class="adm-grid adm-grid-3">' +
      stat("Tổng users", st.users) +
      stat("Tổng số dư ví", money(st.totalBalance), "pos") +
      stat("Trang này", data.users.length) +
      "</div>" +
      '<div class="adm-card"><div class="adm-filters">' +
      '<input class="adm-search" id="usrFilter" placeholder="Tìm tên, email, user id…">' +
      filterSelect(
        "usrRole",
        "Vai trò",
        [
          { v: "all", t: "Tất cả" },
          { v: "customer", t: "Customer" },
          { v: "admin", t: "Admin" }
        ],
        "all"
      ) +
      '<button type="button" class="btn btn-outline" id="usrApply">Lọc</button>' +
      '<button type="button" class="btn btn-ghost" id="goWalletFromUsers">Sang ví</button></div>' +
      '<div class="adm-table-wrap" style="margin-top:12px"><table class="adm-table"><thead><tr>' +
      "<th>User</th><th>Email</th><th>Vai trò</th><th>Số dư</th><th>Ngày tạo</th><th></th>" +
      '</tr></thead><tbody id="usrRows"></tbody></table></div></div>';

    function paint() {
      const needle = String(document.getElementById("usrFilter")?.value || "").toLowerCase();
      const role = document.getElementById("usrRole")?.value || "all";
      const list = (data.users || []).filter((u) => {
        if (role === "admin" && !u.isAdmin) return false;
        if (role === "customer" && u.isAdmin) return false;
        if (!needle) return true;
        return (
          u.email.toLowerCase().includes(needle) ||
          String(u.name || "").toLowerCase().includes(needle) ||
          String(u.id).includes(needle)
        );
      });
      document.getElementById("usrRows").innerHTML = list.length
        ? list
            .map(
              (u) =>
                '<tr><td><span class="adm-cell-main">' +
                esc(u.name || u.email.split("@")[0]) +
                '</span><span class="adm-cell-sub">' +
                esc(String(u.id).slice(0, 13)) +
                "…</span></td><td>" +
                esc(u.email) +
                "</td><td>" +
                (u.isAdmin
                  ? '<span class="adm-tag pink">admin</span>'
                  : '<span class="adm-tag">customer</span>') +
                '</td><td class="' +
                (u.balance > 0 ? "adm-money-pos" : "adm-money-zero") +
                '">' +
                money(u.balance) +
                "</td><td>" +
                fmtTime(u.createdAt) +
                '</td><td><button type="button" class="btn btn-outline btn-sm js-wal" data-id="' +
                u.id +
                '">Xem ví</button></td></tr>'
            )
            .join("")
        : '<tr><td colspan="6" class="adm-empty">Không có user / không khớp lọc</td></tr>';
      document.querySelectorAll(".js-wal").forEach((btn) => {
        btn.addEventListener("click", () => setView("wallet"));
      });
    }
    paint();
    document.getElementById("usrApply")?.addEventListener("click", paint);
    document.getElementById("usrFilter")?.addEventListener("input", paint);
    document.getElementById("usrRole")?.addEventListener("change", paint);
    document.getElementById("goWalletFromUsers")?.addEventListener("click", () => setView("wallet"));
  }

  async function renderBlacklist(body) {
    const data = await api("/admin/blacklist");
    body.innerHTML =
      '<div class="adm-hint">User trong blacklist <b>không mua được hàng</b> (chặn tạo đơn). Thường dùng với tài khoản spam / lừa đảo.</div>' +
      '<div class="adm-card"><h2>Thêm user vào blacklist</h2><div class="adm-form-grid">' +
      '<div class="adm-field span2"><label>Thêm user vào blacklist</label>' +
      '<input id="blQ" placeholder="Tìm theo tên, email, user id…"></div>' +
      '<div class="adm-field span3"><label>Lý do (bắt buộc)</label>' +
      '<textarea id="blReason" rows="2" placeholder="VD: spam chat, lừa đảo hoàn tiền…"></textarea></div>' +
      '<div class="adm-field"><button type="button" class="btn btn-primary" id="blAdd">Thêm blacklist</button></div>' +
      "</div></div>" +
      '<div class="adm-card"><div class="adm-card-head"><input class="adm-search" id="blFilter" placeholder="Lọc blacklist theo tên / email…" style="max-width:320px">' +
      "<span class=\"adm-muted\">Đang blacklist: <b>" +
      (data.total || 0) +
      "</b></span></div>" +
      '<div class="adm-table-wrap"><table class="adm-table"><thead><tr>' +
      "<th>User</th><th>Vai trò</th><th>Lý do</th><th>Thời điểm</th><th>Admin</th><th></th>" +
      '</tr></thead><tbody id="blRows"></tbody></table></div></div>';

    function paint(q) {
      const needle = String(q || "").toLowerCase();
      document.getElementById("blRows").innerHTML = (data.items || [])
        .filter(
          (i) =>
            !needle ||
            i.email.toLowerCase().includes(needle) ||
            String(i.name || "").toLowerCase().includes(needle)
        )
        .map(
          (i) =>
            '<tr data-id="' +
            i.id +
            '"><td><span class="adm-cell-main">' +
            esc(i.name || i.email.split("@")[0]) +
            '</span><span class="adm-cell-sub">' +
            esc(i.email) +
            "</span></td><td><span class=\"adm-tag\">Khách</span></td><td>" +
            esc(i.reason) +
            "</td><td>" +
            fmtTime(i.createdAt) +
            "</td><td>" +
            esc(i.adminEmail || "—") +
            '</td><td><button type="button" class="btn btn-danger btn-sm js-rm">Gỡ blacklist</button></td></tr>'
        )
        .join("") ||
        '<tr><td colspan="6" class="adm-empty">Chưa có ai trong blacklist</td></tr>';
      document.querySelectorAll("#blRows .js-rm").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const ok = await confirmAction({
            title: "Gỡ blacklist",
            message: "User sẽ được mua hàng lại. Xác nhận gỡ?",
            okText: "Gỡ blacklist",
            danger: false
          });
          if (!ok) return;
          await api("/admin/blacklist/" + btn.closest("tr").getAttribute("data-id"), {
            method: "DELETE"
          });
          toast("Đã gỡ blacklist");
          renderBlacklist(body);
        });
      });
    }

    document.getElementById("blAdd")?.addEventListener("click", async () => {
      await api("/admin/blacklist", {
        method: "POST",
        body: JSON.stringify({
          query: document.getElementById("blQ").value.trim(),
          reason: document.getElementById("blReason").value.trim()
        })
      });
      toast("Đã thêm blacklist");
      renderBlacklist(body);
    });
    paint("");
    document.getElementById("blFilter")?.addEventListener("input", (e) => paint(e.target.value));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 50));
  } else {
    setTimeout(boot, 50);
  }
})();
