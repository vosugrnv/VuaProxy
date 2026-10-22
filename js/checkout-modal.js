/* Checkout modal — Mua ngay → popup thanh toán / QR / đơn thành công */
(function () {
  const GUEST_PAY_KEY = "vuammo_guest_pay";
  const PAID_FLASH_KEY = "vuaproxy_paid_flash";
  const CSS_ID = "vuammo-checkout-modal-css";
  let pollTimer = null;
  let state = null;

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    if (window.VuammoApi && VuammoApi.money) return VuammoApi.money(n);
    return Number(n || 0).toLocaleString("vi-VN") + "₫";
  }

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent =
      ".co-pay-modal{position:fixed;inset:0;z-index:1300;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}" +
      ".co-pay-modal[hidden]{display:none!important}" +
      ".co-pay-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.48);backdrop-filter:blur(3px)}" +
      ".co-pay-sheet{position:relative;z-index:1;width:100%;max-width:440px;margin:auto;background:#fff;border-radius:16px;" +
      "box-shadow:0 24px 60px rgba(15,23,42,.28);padding:18px 18px 16px;max-height:min(92vh,720px);overflow:auto}" +
      ".co-pay-x{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:22px;line-height:1;" +
      "color:#94a3b8;cursor:pointer;padding:4px;z-index:2}" +
      ".co-pay-x:hover{color:#0f172a}" +
      ".co-pay-sheet h2{margin:0 28px 12px 0;font-size:17px;font-weight:800;color:#0f172a;letter-spacing:-.02em}" +
      ".co-pay-lines{list-style:none;margin:0 0 12px;padding:0}" +
      ".co-pay-lines li{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13.5px}" +
      ".co-pay-lines li:last-child{border-bottom:0}" +
      ".co-pay-lines .nm{font-weight:600;color:#0f172a;line-height:1.35}" +
      ".co-pay-lines .qt{color:#64748b;font-weight:600;margin-left:6px;white-space:nowrap}" +
      ".co-pay-field{margin:0 0 12px}" +
      ".co-pay-field label{display:block;font-size:12.5px;font-weight:700;color:#334155;margin:0 0 5px}" +
      ".co-pay-field .req{color:#dc2626}" +
      ".co-pay-input{width:100%;box-sizing:border-box;height:38px;border:1px solid #e2e8f0;border-radius:9px;" +
      "padding:0 11px;font:inherit;font-size:13.5px;color:#0f172a}" +
      ".co-pay-input:focus{outline:0;border-color:#f87171;box-shadow:0 0 0 3px rgba(220,38,38,.12)}" +
      ".co-pay-hint{margin:5px 0 0;font-size:11.5px;color:#94a3b8;line-height:1.4}" +
      ".co-pay-promo{display:flex;gap:8px;align-items:center}" +
      ".co-pay-promo .co-pay-input{flex:1;min-width:0;text-transform:uppercase}" +
      ".co-pay-bal{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 10px;margin:0 0 12px;" +
      "padding:9px 11px;border-radius:10px;background:#fff7f7;border:1px solid #fee2e2}" +
      ".co-pay-bal .lb{font-size:12px;color:#64748b;font-weight:600}" +
      ".co-pay-bal .vl{font-size:15px;font-weight:800;color:#0f172a}" +
      ".co-pay-bal a{margin-left:auto;font-size:12.5px;font-weight:700;color:#dc2626;text-decoration:none}" +
      ".co-pay-bal a:hover{text-decoration:underline}" +
      ".co-pay-confirm{margin:0 0 14px;border:1px solid #fecaca;border-radius:12px;background:#fff7f7;overflow:hidden}" +
      ".co-pay-confirm div{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;font-size:13.5px;border-top:1px solid #fee2e2}" +
      ".co-pay-confirm div:first-child{border-top:0}" +
      ".co-pay-confirm span{color:#64748b;font-weight:600;flex:0 0 auto}" +
      ".co-pay-confirm strong{color:#0f172a;font-weight:700;text-align:right;line-height:1.35}" +
      ".co-pay-confirm .tot strong{color:#dc2626;font-size:16px;font-weight:800}" +
      ".co-pay-sum{margin:0 0 12px;display:flex;flex-direction:column;gap:6px}" +
      ".co-pay-sum-row{display:flex;justify-content:space-between;font-size:13.5px;color:#475569}" +
      ".co-pay-sum-pay{padding-top:7px;border-top:1px dashed #e2e8f0;font-weight:600;color:#0f172a}" +
      ".co-pay-sum-pay strong{font-size:16px;font-weight:800;color:#dc2626}" +
      ".co-pay-btn{appearance:none;display:flex;align-items:center;justify-content:center;width:100%;height:40px;" +
      "margin:0 0 8px;border-radius:9px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;" +
      "border:1px solid transparent;box-sizing:border-box;text-decoration:none}" +
      ".co-pay-btn:disabled{opacity:.55;cursor:not-allowed}" +
      ".co-pay-btn--primary{background:#dc2626;color:#fff;border-color:#dc2626}" +
      ".co-pay-btn--primary:hover{background:#b91c1c;color:#fff}" +
      ".co-pay-btn--outline{background:#fff;color:#dc2626;border-color:#fecaca}" +
      ".co-pay-btn--outline:hover{background:#fff1f2}" +
      ".co-pay-btn--soft{background:#fff1f2;color:#b91c1c;border-color:#fecaca;width:auto;padding:0 12px;flex:0 0 auto}" +
      ".co-pay-btn--ghost{background:transparent;color:#64748b;border:0;height:34px;margin:0}" +
      ".co-pay-foot{margin:4px 0 0;font-size:11.5px;color:#94a3b8;line-height:1.4;text-align:center}" +
      ".co-pay-back{display:inline-flex;align-items:center;gap:4px;margin:0 0 12px;padding:0;border:0;" +
      "background:transparent;color:#64748b;font:inherit;font-size:13px;font-weight:600;cursor:pointer}" +
      ".co-pay-back:hover{color:#dc2626}" +
      ".co-pay-qr{text-align:center}" +
      ".co-pay-qr h2{margin:0 0 8px}" +
      ".co-pay-qr-frame{display:inline-flex;padding:10px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;margin:6px 0 12px}" +
      ".co-pay-qr-frame img{display:block;width:200px;height:200px;object-fit:contain}" +
      ".co-pay-ok .ok-title{color:#166534;font-size:16px;font-weight:800;margin:0 0 8px}" +
      ".co-pay-ok .ok-code{margin:0 0 10px;font-size:13.5px;color:#475569}" +
      ".co-pay-delivery{margin:10px 0;padding:11px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;" +
      "font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;text-align:left}" +
      ".co-pay-email-note{margin:8px 0 0;font-size:12.5px;color:#64748b;text-align:left}" +
      ".co-pay-email-note.ok{color:#166534}" +
      ".co-pay-actions{display:flex;flex-direction:column;gap:8px;margin-top:14px}" +
      ".co-pay-sub{position:fixed;inset:0;z-index:1310;display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".co-pay-sub-bg{position:absolute;inset:0;background:rgba(15,23,42,.35)}" +
      ".co-pay-sub-card{position:relative;z-index:1;width:100%;max-width:340px;background:#fff;border-radius:14px;" +
      "padding:20px 18px 16px;text-align:center;box-shadow:0 16px 40px rgba(15,23,42,.25)}" +
      ".co-pay-sub-card h3{margin:0 0 8px;font-size:16px;font-weight:800}" +
      ".co-pay-sub-card p{margin:0 0 14px;font-size:13px;color:#64748b;line-height:1.5}" +
      ".co-pay-sub-card p b{color:#0f172a}" +
      "body.co-pay-open{overflow:hidden}";
    document.head.appendChild(s);
  }

  function qrImgUrl(qrCode, checkoutUrl) {
    const raw = String(qrCode || "").trim();
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:image")) return raw;
    const payload = raw || String(checkoutUrl || "").trim();
    if (!payload) return "";
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
      encodeURIComponent(payload)
    );
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function saveGuestPay(payload) {
    try {
      localStorage.setItem(GUEST_PAY_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function goPaidPage(order, opts) {
    opts = opts || {};
    try {
      sessionStorage.setItem(
        PAID_FLASH_KEY,
        JSON.stringify({
          order: order || {},
          emailSent: opts.emailSent,
          deliveryEmail: opts.deliveryEmail || ""
        })
      );
    } catch (_) {}
    location.href = "/thanh-toan?paid=1";
  }

  function clearGuestPay() {
    try {
      localStorage.removeItem(GUEST_PAY_KEY);
    } catch (_) {}
  }

  function close() {
    stopPoll();
    document.getElementById("coPayModal")?.remove();
    document.getElementById("coPaySub")?.remove();
    document.body.classList.remove("co-pay-open");
    state = null;
  }

  function sheet() {
    return document.querySelector("#coPayModal .co-pay-sheet");
  }

  function napHref() {
    const next = location.pathname + location.search;
    return "/nap-tien?next=" + encodeURIComponent(next + (next.includes("?") ? "&" : "?") + "topup=1");
  }

  function showSubModal(opts) {
    document.getElementById("coPaySub")?.remove();
    const wrap = document.createElement("div");
    wrap.id = "coPaySub";
    wrap.className = "co-pay-sub";
    wrap.innerHTML =
      '<div class="co-pay-sub-bg" data-close></div>' +
      '<div class="co-pay-sub-card">' +
      "<h3>" +
      escapeHtml(opts.title || "") +
      "</h3><p>" +
      (opts.bodyHtml || escapeHtml(opts.body || "")) +
      "</p>" +
      (opts.primaryHref
        ? '<a class="co-pay-btn co-pay-btn--primary" href="' +
          escapeHtml(opts.primaryHref) +
          '">' +
          escapeHtml(opts.primaryText || "Tiếp tục") +
          "</a>"
        : "") +
      '<button type="button" class="co-pay-btn co-pay-btn--ghost" data-close>' +
      escapeHtml(opts.secondaryText || "Đóng") +
      "</button></div>";
    document.body.appendChild(wrap);
    wrap.querySelectorAll("[data-close]").forEach((el) =>
      el.addEventListener("click", () => wrap.remove())
    );
  }

  function showInsufficient() {
    const total = state.payTotal();
    const bal = Number(state.user?.balance || 0);
    const need = Math.max(0, total - bal);
    showSubModal({
      title: "Số dư ví không đủ",
      bodyHtml:
        "Cần thanh toán <b>" +
        escapeHtml(money(total)) +
        "</b>, số dư hiện tại <b>" +
        escapeHtml(money(bal)) +
        "</b>" +
        (need > 0 ? " — còn thiếu <b>" + escapeHtml(money(need)) + "</b>" : "") +
        ".<br>Nạp ví xong sẽ quay lại để thanh toán.",
      primaryHref: napHref(),
      primaryText: "Nạp ví",
      secondaryText: "Để sau"
    });
  }

  function validateEmail() {
    const el = document.getElementById("coPayEmail");
    const email = String(el?.value || state.email || "")
      .trim()
      .toLowerCase();
    state.email = email;
    if (!email || !email.includes("@") || email.length < 5) {
      VuammoApi.showToast("Vui lòng nhập email nhận hàng hợp lệ");
      el?.focus();
      return "";
    }
    return email;
  }

  function clearOrderedFromCart() {
    try {
      if (!window.CartStore) return;
      const orderedIds = new Set(state.items.map((i) => String(i.id)));
      const remain = CartStore.read().filter((i) => !orderedIds.has(String(i.id)));
      CartStore.write(remain);
      if (CartStore.setSelectedIds) CartStore.setSelectedIds(remain.map((i) => String(i.id)));
    } catch (_) {}
  }

  function apiItems() {
    return state.items.map((it) => ({
      id: String(it.id || it.productId || ""),
      productId: it.productId ? String(it.productId) : undefined,
      name: it.name,
      price: it.price,
      qty: it.qty || 1,
      image: it.image || "",
      seller: it.seller || "",
      sellerToken: it.sellerToken || "",
      sellerSlug: it.sellerSlug || "",
      parentId: it.parentId || "",
      meta: it.meta || "",
      countryCode: it.countryCode || "",
      packageKey: it.packageKey || "",
      days: Number(it.days) > 0 ? Math.round(Number(it.days)) : undefined
    }));
  }

  function renderForm() {
    const el = sheet();
    if (!el) return;
    const total = state.payTotal();
    const loggedIn = !!(state.user && state.user.id);
    const bal = loggedIn ? Number(state.user.balance || 0) : 0;
    const promo = state.promo;
    const qtySum = state.items.reduce((s, it) => s + (Number(it.qty) || 1), 0);
    const productName = state.items.map((it) => it.name).filter(Boolean).join(", ");

    el.innerHTML =
      '<button type="button" class="co-pay-x" id="coPayClose" aria-label="Đóng">&times;</button>' +
      "<h2>Xác nhận thanh toán</h2>" +
      '<div class="co-pay-confirm">' +
      "<div><span>Sản phẩm</span><strong>" +
      escapeHtml(productName) +
      "</strong></div>" +
      "<div><span>Số lượng</span><strong>" +
      qtySum +
      "</strong></div>" +
      '<div class="tot"><span>Tổng thanh toán</span><strong>' +
      money(total) +
      "</strong></div></div>" +
      '<div class="co-pay-field"><label for="coPayEmail">Email nhận hàng <span class="req">*</span></label>' +
      '<input type="email" id="coPayEmail" class="co-pay-input" placeholder="you@email.com" autocomplete="email" value="' +
      escapeHtml(state.email) +
      '">' +
      '<p class="co-pay-hint">Proxy và mã đơn sẽ gửi về email này.</p></div>' +
      '<div class="co-pay-field"><label for="coPayPromo">Mã khuyến mãi</label>' +
      '<div class="co-pay-promo"><input type="text" id="coPayPromo" class="co-pay-input" placeholder="Nhập mã" value="' +
      escapeHtml(promo ? promo.code : "") +
      '">' +
      '<button type="button" class="co-pay-btn co-pay-btn--soft" id="coPayPromoBtn">Áp dụng</button></div>' +
      (promo
        ? '<p class="co-pay-hint" style="color:#166534">Đã áp dụng <b>' +
          escapeHtml(promo.code) +
          "</b>" +
          (promo.percent ? " (−" + promo.percent + "%)" : "") +
          ' · <button type="button" class="co-pay-btn co-pay-btn--ghost" id="coPayPromoClear" style="display:inline;width:auto;height:auto;padding:0;margin:0;color:#dc2626">Gỡ</button></p>'
        : "") +
      "</div>" +
      (loggedIn
        ? '<div class="co-pay-bal"><span class="lb">Số dư ví</span><span class="vl">' +
          money(bal) +
          '</span><a href="' +
          napHref() +
          '">Nạp ví</a></div>'
        : '<p class="co-pay-hint" style="margin-bottom:10px">Khách có thể thanh toán QR không cần đăng nhập. <a href="/tai-khoan?next=' +
          encodeURIComponent(location.pathname) +
          '">Đăng nhập</a></p>') +
      '<div class="co-pay-sum">' +
      '<div class="co-pay-sum-row"><span>Tạm tính</span><strong>' +
      money(state.subtotal) +
      "</strong></div>" +
      (promo && promo.discount
        ? '<div class="co-pay-sum-row" style="color:#16a34a"><span>Giảm giá</span><strong>−' +
          money(promo.discount) +
          "</strong></div>"
        : "") +
      '<div class="co-pay-sum-row co-pay-sum-pay"><span>Cần thanh toán</span><strong>' +
      money(total) +
      "</strong></div></div>" +
      (loggedIn
        ? '<button type="button" class="co-pay-btn co-pay-btn--primary" id="coPayWallet">Xác nhận thanh toán</button>' +
          '<button type="button" class="co-pay-btn co-pay-btn--outline" id="coPayQr">Thanh toán QR</button>'
        : '<button type="button" class="co-pay-btn co-pay-btn--primary" id="coPayQr">Xác nhận thanh toán</button>') +
      '<p class="co-pay-foot">Bấm xác nhận để thanh toán và nhận proxy ngay.</p>';

    document.getElementById("coPayClose")?.addEventListener("click", close);
    document.getElementById("coPayEmail")?.addEventListener("input", (e) => {
      state.email = String(e.target.value || "").trim();
    });
    document.getElementById("coPayPromoBtn")?.addEventListener("click", applyPromo);
    document.getElementById("coPayPromoClear")?.addEventListener("click", () => {
      state.promo = null;
      renderForm();
    });
    document.getElementById("coPayWallet")?.addEventListener("click", payWallet);
    document.getElementById("coPayQr")?.addEventListener("click", payQr);
  }

  async function applyPromo() {
    const code = String(document.getElementById("coPayPromo")?.value || "").trim();
    if (!code) {
      VuammoApi.showToast("Nhập mã khuyến mãi");
      return;
    }
    try {
      const data = await VuammoApi.api("/promos/validate", {
        method: "POST",
        body: JSON.stringify({ code, amount: state.subtotal })
      });
      state.promo = {
        code: data.code,
        discount: data.discount,
        pay: data.pay,
        percent: data.percent
      };
      renderForm();
      VuammoApi.showToast("Đã áp dụng mã " + data.code);
    } catch (err) {
      VuammoApi.showToast(err.message || "Mã không hợp lệ");
    }
  }

  async function payWallet() {
    if (!state.user?.id) return;
    const total = state.payTotal();
    if (Number(state.user.balance || 0) < total) {
      showInsufficient();
      return;
    }
    const email = validateEmail();
    if (!email) return;
    const btn = document.getElementById("coPayWallet");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Đang xử lý…";
    }
    try {
      const body = { items: apiItems(), email };
      if (state.promo?.code) body.promoCode = state.promo.code;
      const data = await VuammoApi.api("/orders", {
        method: "POST",
        body: JSON.stringify(body)
      });
      clearOrderedFromCart();
      try {
        await VuammoAuth.refreshMe();
        state.user = VuammoAuth.getUser ? VuammoAuth.getUser() : state.user;
      } catch (_) {}
      goPaidPage(data.order, {
        emailSent: data.emailSent,
        deliveryEmail: data.deliveryEmail || email
      });
    } catch (err) {
      if (err.status === 402) {
        try {
          await VuammoAuth.refreshMe();
          state.user = VuammoAuth.getUser ? VuammoAuth.getUser() : state.user;
        } catch (_) {}
        showInsufficient();
      } else {
        VuammoApi.showToast(err.message || "Không tạo đơn được");
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Xác nhận thanh toán";
      }
    }
  }

  async function payQr() {
    const email = validateEmail();
    if (!email) return;
    const btn = document.getElementById("coPayQr");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Đang tạo QR…";
    }
    try {
      const body = { items: apiItems(), email };
      if (state.promo?.code) body.promoCode = state.promo.code;
      const data = await VuammoApi.api("/orders/checkout-qr", {
        method: "POST",
        body: JSON.stringify(body)
      });
      const token = data.payment?.guestToken || "";
      const code = data.order?.code || "";
      if (code && token) saveGuestPay({ code, token });
      if (data.payment?.status === "paid" || data.order?.status === "delivered") {
        clearOrderedFromCart();
        clearGuestPay();
        goPaidPage(data.order, {
          emailSent: data.emailSent,
          deliveryEmail: data.deliveryEmail || email
        });
        return;
      }
      renderQr(data, { code, token });
      VuammoApi.showToast("Quét QR để thanh toán");
    } catch (err) {
      VuammoApi.showToast(err.message || "Không tạo QR được");
      if (btn) {
        btn.disabled = false;
        btn.textContent = state.user?.id ? "Thanh toán QR" : "Xác nhận thanh toán";
      }
    }
  }

  function renderQr(data, pay) {
    const el = sheet();
    if (!el) return;
    const order = data.order || {};
    const payment = data.payment || {};
    const img = qrImgUrl(payment.qrCode, payment.checkoutUrl);
    el.innerHTML =
      '<button type="button" class="co-pay-x" id="coPayClose" aria-label="Đóng">&times;</button>' +
      '<button type="button" class="co-pay-back" id="coPayBack">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' +
      "Quay lại chỉnh đơn</button>" +
      '<div class="co-pay-qr">' +
      "<h2>Quét QR thanh toán</h2>" +
      "<p style=\"margin:0 0 10px;font-size:13.5px;color:#475569\">Mã đơn <strong>" +
      escapeHtml(order.code || "") +
      "</strong> · <strong>" +
      money(order.total) +
      "</strong></p>" +
      (img
        ? '<div class="co-pay-qr-frame"><img src="' +
          escapeHtml(img) +
          '" alt="QR" width="200" height="200"></div>'
        : "") +
      (payment.checkoutUrl
        ? '<a class="co-pay-btn co-pay-btn--primary" href="' +
          escapeHtml(payment.checkoutUrl) +
          '" target="_blank" rel="noopener">Mở trang thanh toán</a>'
        : "") +
      '<p class="co-pay-hint" id="coPayPoll" style="margin:10px 0">Đang chờ thanh toán…</p>' +
      '<button type="button" class="co-pay-btn co-pay-btn--outline" id="coPayRefresh">Tôi đã thanh toán</button>' +
      "</div>";

    document.getElementById("coPayClose")?.addEventListener("click", close);
    document.getElementById("coPayBack")?.addEventListener("click", () => {
      stopPoll();
      renderForm();
    });
    startPoll(pay.code, pay.token);
    document.getElementById("coPayRefresh")?.addEventListener("click", () => tickPay(pay.code, pay.token));
  }

  async function tickPay(code, token) {
    if (!code || !token) return;
    try {
      const data = await VuammoApi.api(
        "/orders/pay/" + encodeURIComponent(code) + "?token=" + encodeURIComponent(token)
      );
      if (data.order && data.order.status && data.order.status !== "pending_payment") {
        stopPoll();
        clearGuestPay();
        clearOrderedFromCart();
        goPaidPage(data.order, {
          emailSent: data.emailSent,
          deliveryEmail: data.deliveryEmail || data.order.deliveryEmail || state.email
        });
      } else {
        const st = document.getElementById("coPayPoll");
        if (st) st.textContent = "Đang chờ thanh toán…";
      }
    } catch (_) {}
  }

  function startPoll(code, token) {
    stopPoll();
    if (!code || !token) return;
    pollTimer = setInterval(() => tickPay(code, token), 4000);
  }

  function renderSuccess(order, opts) {
    opts = opts || {};
    const el = sheet();
    if (!el) return;
    stopPoll();
    const note = order?.deliveryNote || order?.delivery_note || "Đơn đã thanh toán.";
    const code = order?.code || "";
    const email = opts.deliveryEmail || order?.deliveryEmail || state.email || "";
    const items = Array.isArray(order?.items) ? order.items : state.items;
    el.innerHTML =
      '<button type="button" class="co-pay-x" id="coPayClose" aria-label="Đóng">&times;</button>' +
      '<div class="co-pay-ok">' +
      '<p class="ok-title">Thanh toán thành công!</p>' +
      (code ? '<p class="ok-code">Mã đơn: <b>' + escapeHtml(code) + "</b></p>" : "") +
      '<ul class="co-pay-lines">' +
      items
        .map(
          (it) =>
            "<li><span><span class=\"nm\">" +
            escapeHtml(it.name) +
            '</span><span class="qt">×' +
            (it.qty || 1) +
            "</span></span><strong>" +
            money((it.price || 0) * (it.qty || 1)) +
            "</strong></li>"
        )
        .join("") +
      "</ul>" +
      '<div class="co-pay-delivery">' +
      escapeHtml(note).replace(/\n/g, "<br>") +
      "</div>" +
      (email
        ? opts.emailSent === true
          ? '<p class="co-pay-email-note ok">Đã gửi xác nhận đơn tới <b>' +
            escapeHtml(email) +
            "</b>.</p>"
          : '<p class="co-pay-email-note">Xác nhận đơn sẽ gửi tới <b>' +
            escapeHtml(email) +
            "</b>.</p>"
        : "") +
      '<div class="co-pay-actions">' +
      '<a class="co-pay-btn co-pay-btn--primary" href="/tai-khoan#orders">Xem đơn hàng</a>' +
      '<button type="button" class="co-pay-btn co-pay-btn--outline" id="coPayDone">Đóng</button>' +
      "</div></div>";
    document.getElementById("coPayClose")?.addEventListener("click", close);
    document.getElementById("coPayDone")?.addEventListener("click", close);
  }

  async function open(opts) {
    opts = opts || {};
    injectCss();
    const items = Array.isArray(opts.items) ? opts.items.filter(Boolean) : [];
    if (!items.length) {
      VuammoApi?.showToast?.("Chưa có sản phẩm để thanh toán");
      return;
    }

    try {
      if (window.VuammoAuth?.refreshMe) await VuammoAuth.refreshMe();
    } catch (_) {}

    const user = window.VuammoAuth?.getUser ? VuammoAuth.getUser() : null;
    const subtotal = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);

    state = {
      items,
      user,
      email: String(user?.email || opts.email || "").trim(),
      promo: null,
      subtotal,
      payTotal() {
        return state.promo ? state.promo.pay : state.subtotal;
      }
    };

    stopPoll();
    document.getElementById("coPayModal")?.remove();
    document.getElementById("coPaySub")?.remove();

    const wrap = document.createElement("div");
    wrap.id = "coPayModal";
    wrap.className = "co-pay-modal";
    wrap.innerHTML =
      '<div class="co-pay-backdrop" data-close-bg></div><div class="co-pay-sheet" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(wrap);
    document.body.classList.add("co-pay-open");
    wrap.querySelector("[data-close-bg]")?.addEventListener("click", close);
    document.addEventListener(
      "keydown",
      function onEsc(e) {
        if (e.key === "Escape") {
          close();
          document.removeEventListener("keydown", onEsc);
        }
      },
      { once: true }
    );

    renderForm();
  }

  window.VuammoCheckoutModal = { open, close };
})();
