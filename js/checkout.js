/* Checkout — ví (đăng nhập) + QR (không bắt buộc đăng nhập) */
(function () {
  const GUEST_PAY_KEY = "vuammo_guest_pay";
  const PAID_FLASH_KEY = "vuaproxy_paid_flash";

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

  function qrImgUrl(qrCode, checkoutUrl) {
    const raw = String(qrCode || "").trim();
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:image")) return raw;
    const payload = raw || String(checkoutUrl || "").trim();
    if (!payload) return "";
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" +
      encodeURIComponent(payload)
    );
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

  function openPaidPopup(order, opts) {
    opts = opts || {};
    document.getElementById("coPaidPopup")?.remove();
    const note = order?.deliveryNote || order?.delivery_note || "";
    const code = order?.code || "";
    const items = Array.isArray(order?.items) ? order.items : [];
    const body = window.VuaproxyResult
      ? window.VuaproxyResult.html(order)
      : '<div class="checkout-success-delivery">' + escapeHtml(note).replace(/\n/g, "<br>") + "</div>";
    const wrap = document.createElement("div");
    wrap.id = "coPaidPopup";
    wrap.className = "co-pay-modal";
    wrap.innerHTML =
      '<div class="co-pay-backdrop" data-close></div>' +
      '<div class="co-pay-sheet" role="dialog" aria-modal="true">' +
      '<button type="button" class="co-pay-x" data-close aria-label="Đóng">&times;</button>' +
      '<div class="co-pay-ok">' +
      '<p class="ok-title">Đơn hàng đã gửi</p>' +
      (code ? '<p class="ok-code">Mã đơn: <b>' + escapeHtml(code) + "</b></p>" : "") +
      (items.length
        ? '<ul class="co-pay-lines">' +
          items
            .map(
              (it) =>
                "<li><span class=\"nm\">" +
                escapeHtml(it.name) +
                "</span><strong>" +
                (it.qty || 1) +
                "</strong></li>"
            )
            .join("") +
          "</ul>"
        : "") +
      body +
      '<button type="button" class="co-pay-btn co-pay-btn--primary" data-close>Đóng</button>' +
      "</div></div>";
    if (!document.getElementById("vuammo-checkout-modal-css")) {
      const s = document.createElement("style");
      s.id = "vuammo-checkout-modal-css";
      s.textContent =
        ".co-pay-modal{position:fixed;inset:0;z-index:1300;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}" +
        ".co-pay-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.48)}" +
        ".co-pay-sheet{position:relative;z-index:1;width:100%;max-width:440px;margin:auto;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(15,23,42,.28);padding:18px;max-height:min(92vh,720px);overflow:auto}" +
        ".co-pay-x{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:22px;cursor:pointer;color:#94a3b8}" +
        ".co-pay-ok .ok-title{color:#166534;font-size:16px;font-weight:800;margin:0 0 8px}" +
        ".co-pay-lines{list-style:none;margin:0 0 12px;padding:0}" +
        ".co-pay-lines li{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13.5px}" +
        ".co-pay-btn{display:flex;align-items:center;justify-content:center;width:100%;height:40px;margin-top:12px;border-radius:9px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;border:0;background:#dc2626;color:#fff}";
      document.head.appendChild(s);
    }
    document.body.appendChild(wrap);
    wrap.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", () => wrap.remove());
    });
    window.VuaproxyResult?.bind(wrap);
  }

  function saveGuestPay(payload) {
    try {
      localStorage.setItem(GUEST_PAY_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function readGuestPay() {
    try {
      return JSON.parse(localStorage.getItem(GUEST_PAY_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function clearGuestPay() {
    try {
      localStorage.removeItem(GUEST_PAY_KEY);
    } catch (_) {}
  }

  function closeCheckoutModal() {
    document.getElementById("checkoutModal")?.remove();
  }

  function openCheckoutModal(opts) {
    closeCheckoutModal();
    const wrap = document.createElement("div");
    wrap.id = "checkoutModal";
    wrap.className = "co-modal";
    wrap.innerHTML =
      '<div class="co-modal-backdrop" data-close></div>' +
      '<div class="co-modal-card" role="dialog" aria-modal="true" aria-labelledby="coModalTitle">' +
      '<button type="button" class="co-modal-x" data-close aria-label="Đóng">&times;</button>' +
      '<div class="co-modal-icon" aria-hidden="true">' +
      (opts.icon || "!") +
      "</div>" +
      '<h3 id="coModalTitle">' +
      escapeHtml(opts.title || "") +
      "</h3>" +
      '<p class="co-modal-body">' +
      (opts.bodyHtml || escapeHtml(opts.body || "")) +
      "</p>" +
      '<div class="co-modal-actions">' +
      (opts.primaryHref
        ? '<a class="co-btn co-btn--primary" href="' +
          escapeHtml(opts.primaryHref) +
          '">' +
          escapeHtml(opts.primaryText || "Tiếp tục") +
          "</a>"
        : "") +
      (opts.primaryAction
        ? '<button type="button" class="co-btn co-btn--primary" id="coModalPrimary">' +
          escapeHtml(opts.primaryText || "Tiếp tục") +
          "</button>"
        : "") +
      '<button type="button" class="co-btn co-btn--ghost" data-close>' +
      escapeHtml(opts.secondaryText || "Đóng") +
      "</button>" +
      "</div></div>";
    document.body.appendChild(wrap);
    wrap.querySelectorAll("[data-close]").forEach((el) => {
      el.addEventListener("click", closeCheckoutModal);
    });
    if (opts.primaryAction) {
      document.getElementById("coModalPrimary")?.addEventListener("click", () => {
        closeCheckoutModal();
        opts.primaryAction();
      });
    }
    document.addEventListener(
      "keydown",
      function onEsc(e) {
        if (e.key === "Escape") {
          closeCheckoutModal();
          document.removeEventListener("keydown", onEsc);
        }
      },
      { once: true }
    );
  }

  async function init() {
    const mount = document.getElementById("checkoutApp");
    if (!mount) return;

    try {
      await VuammoAuth.refreshMe();
    } catch (_) {}

    let user = VuammoAuth.getUser ? VuammoAuth.getUser() : null;
    let loggedIn = !!(user && user.id);

    const params = new URLSearchParams(location.search || "");
    if (params.get("paid") === "1") {
      let flash = null;
      try {
        flash = JSON.parse(sessionStorage.getItem(PAID_FLASH_KEY) || "null");
      } catch (_) {}
      try {
        sessionStorage.removeItem(PAID_FLASH_KEY);
      } catch (_) {}
      if (flash && flash.order) {
        renderPaid(mount, flash.order, flash);
        openPaidPopup(flash.order, flash);
      } else {
        mount.innerHTML =
          '<div class="co-empty"><p>Không tìm thấy đơn vừa thanh toán.</p><a class="co-btn co-btn--primary" href="/tai-khoan#orders">Xem đơn hàng</a></div>';
      }
      return;
    }
    const payCode = String(params.get("code") || "").trim();
    const payToken = String(params.get("token") || "").trim();
    if (payCode && payToken) {
      saveGuestPay({ code: payCode, token: payToken });
      await showPayResult(mount, payCode, payToken);
      return;
    }

    if (params.get("topup") === "1" || params.get("topup") === "ok") {
      try {
        await VuammoAuth.refreshMe();
        user = VuammoAuth.getUser ? VuammoAuth.getUser() : null;
        loggedIn = !!(user && user.id);
      } catch (_) {}
      VuammoApi.showToast("Nạp ví thành công — bạn có thể thanh toán đơn hàng");
      try {
        const clean = new URL(location.href);
        clean.searchParams.delete("topup");
        history.replaceState({}, "", clean.pathname + (clean.search || "") + clean.hash);
      } catch (_) {}
    }

    const allItems = CartStore.read();
    const selected = CartStore.selectedItems ? CartStore.selectedItems() : allItems;
    const items = selected.length ? selected : allItems;
    if (!items.length) {
      const pending = readGuestPay();
      if (pending && pending.code && pending.token) {
        await showPayResult(mount, pending.code, pending.token);
        return;
      }
      mount.innerHTML =
        '<div class="co-empty"><p>Chưa có sản phẩm để thanh toán.</p><a class="co-btn co-btn--primary" href="/tat-ca-khu-vuc">Chọn proxy</a></div>';
      return;
    }

    const subtotal = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
    let deliveryEmail = String(user?.email || "").trim();
    let promo = null;
    let activePromos = [];
    try {
      const data = await VuammoApi.api("/promos/active");
      activePromos = data.items || [];
    } catch (_) {
      activePromos = [];
    }

    function payTotal() {
      return promo ? promo.pay : subtotal;
    }

    function clearCartOrdered() {
      const orderedIds = new Set(items.map((i) => String(i.id)));
      const remain = CartStore.read().filter((i) => !orderedIds.has(String(i.id)));
      CartStore.write(remain);
      if (CartStore.setSelectedIds) CartStore.setSelectedIds(remain.map((i) => String(i.id)));
    }

    const napHref =
      "/nap-tien?next=" + encodeURIComponent("/thanh-toan");

    function readDeliveryEmailInput() {
      const el = document.getElementById("guestEmail");
      if (el) deliveryEmail = String(el.value || "").trim();
      return deliveryEmail;
    }

    function validateDeliveryEmail() {
      const email = readDeliveryEmailInput().toLowerCase();
      if (!email || !email.includes("@") || email.length < 5) {
        VuammoApi.showToast("Vui lòng nhập email nhận hàng hợp lệ");
        const el = document.getElementById("guestEmail");
        if (el) el.focus();
        return "";
      }
      return email;
    }

    function showInsufficientModal() {
      const total = payTotal();
      const bal = Number(user?.balance || 0);
      const need = Math.max(0, total - bal);
      openCheckoutModal({
        icon: "₫",
        title: "Số dư ví không đủ",
        bodyHtml:
          "Cần thanh toán <b>" +
          escapeHtml(money(total)) +
          "</b>, số dư hiện tại <b>" +
          escapeHtml(money(bal)) +
          "</b>" +
          (need > 0 ? " — còn thiếu <b>" + escapeHtml(money(need)) + "</b>" : "") +
          ".<br>Nạp ví xong sẽ quay lại trang này để thanh toán.",
        primaryHref: napHref,
        primaryText: "Nạp ví",
        secondaryText: "Để sau"
      });
    }

    async function payByQr() {
      const btn = document.getElementById("qrPayBtn");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Đang tạo QR…";
      }
      try {
        const email = validateDeliveryEmail();
        if (!email) {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Thanh toán QR";
          }
          return;
        }
        const body = { items, email };
        if (promo && promo.code) body.promoCode = promo.code;
        const data = await VuammoApi.api("/orders/checkout-qr", {
          method: "POST",
          body: JSON.stringify(body)
        });
        const token = data.payment?.guestToken || "";
        const code = data.order?.code || "";
        if (code && token) saveGuestPay({ code, token });
        if (data.payment?.status === "paid" || data.order?.status === "delivered") {
          clearCartOrdered();
          goPaidPage(data.order, {
            emailSent: data.emailSent,
            deliveryEmail: data.deliveryEmail || email
          });
          return;
        }
        renderQrPanel(mount, data, {
          onBack: () => {
            stopPoll();
            paint();
          }
        });
        startPoll(mount, code, token);
        VuammoApi.showToast("Quét QR để thanh toán");
      } catch (err) {
        VuammoApi.showToast(err.message || "Không tạo QR được");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Thanh toán QR";
        }
      }
    }

    async function payByWallet() {
      const btn = document.getElementById("payBtn");
      const total = payTotal();
      const bal = Number(user?.balance || 0);
      if (!loggedIn) {
        openCheckoutModal({
          icon: "→",
          title: "Cần đăng nhập",
          bodyHtml: "Đăng nhập để thanh toán bằng số dư ví, hoặc dùng <b>Thanh toán QR</b>.",
          primaryHref: "/tai-khoan?next=" + encodeURIComponent("/thanh-toan"),
          primaryText: "Đăng nhập",
          secondaryText: "Đóng"
        });
        return;
      }
      if (bal < total) {
        showInsufficientModal();
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Đang xử lý…";
      }
      try {
        const email = validateDeliveryEmail();
        if (!email) {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Xác nhận thanh toán";
          }
          return;
        }
        const body = { items, email };
        if (promo && promo.code) body.promoCode = promo.code;
        const data = await VuammoApi.api("/orders", {
          method: "POST",
          body: JSON.stringify(body)
        });
        clearCartOrdered();
        await VuammoAuth.refreshMe();
        goPaidPage(data.order, {
          emailSent: data.emailSent,
          deliveryEmail: data.deliveryEmail || email
        });
      } catch (err) {
        if (err.status === 402) {
          try {
            await VuammoAuth.refreshMe();
            user = VuammoAuth.getUser ? VuammoAuth.getUser() : user;
          } catch (_) {}
          showInsufficientModal();
        } else {
          VuammoApi.showToast(err.message || "Không tạo đơn được");
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Xác nhận thanh toán";
        }
      }
    }

    function paint() {
      const total = payTotal();
      const bal = loggedIn ? Number(user.balance || 0) : 0;

      mount.innerHTML =
        '<div class="co-layout">' +
        '<section class="co-card co-card--main">' +
        '<header class="co-card-head"><h2>Đơn hàng</h2>' +
        '<span class="co-badge">' +
        items.length +
        " sản phẩm</span></header>" +
        '<ul class="co-lines" id="checkoutLines"></ul>' +
        '<div class="co-field">' +
        '<label for="guestEmail">Email nhận hàng <span class="co-req">*</span></label>' +
        '<input type="email" id="guestEmail" class="co-input" placeholder="you@email.com" autocomplete="email" value="' +
        escapeHtml(deliveryEmail) +
        '">' +
        '<p class="co-hint">Proxy và mã đơn sẽ gửi về email này sau khi thanh toán.</p>' +
        "</div>" +
        '<div class="co-field co-field--promo">' +
        '<label for="promoInput">Mã khuyến mãi</label>' +
        '<div class="co-promo-row">' +
        '<input type="text" id="promoInput" class="co-input" placeholder="Nhập mã" autocomplete="off" value="' +
        escapeHtml(promo ? promo.code : "") +
        '">' +
        '<button type="button" class="co-btn co-btn--soft" id="promoApply">Áp dụng</button>' +
        (promo
          ? '<button type="button" class="co-btn co-btn--ghost" id="promoClear">Gỡ</button>'
          : "") +
        "</div>" +
        (activePromos.length
          ? '<div class="co-promo-chips" id="promoList"></div>'
          : '<p class="co-hint">Chưa có mã công khai — nhập mã nếu được cấp.</p>') +
        '<p id="promoMsg" class="co-promo-msg' +
        (promo ? " ok" : "") +
        '">' +
        (promo
          ? "Đã áp dụng <b>" +
            escapeHtml(promo.code) +
            "</b>" +
            (promo.percent ? " (−" + promo.percent + "%)" : "")
          : "") +
        "</p></div></section>" +
        '<aside class="co-card co-card--side">' +
        '<header class="co-card-head"><h2>Thanh toán</h2></header>' +
        (loggedIn
          ? '<div class="co-balance">' +
            '<span class="co-balance-label">Số dư ví</span>' +
            '<span class="co-balance-val">' +
            money(bal) +
            '</span><a class="co-balance-topup" href="' +
            napHref +
            '">Nạp ví</a></div>'
          : '<p class="co-hint co-hint--side">Khách có thể thanh toán QR không cần đăng nhập.</p>') +
        '<div class="co-sum">' +
        '<div class="co-sum-row"><span>Tạm tính</span><strong>' +
        money(subtotal) +
        "</strong></div>" +
        (promo && promo.discount
          ? '<div class="co-sum-row co-sum-disc"><span>Giảm giá</span><strong>−' +
            money(promo.discount) +
            "</strong></div>"
          : "") +
        '<div class="co-sum-row co-sum-pay"><span>Cần thanh toán</span><strong>' +
        money(total) +
        "</strong></div></div>" +
        (loggedIn
          ? '<button type="button" class="co-btn co-btn--primary co-btn--block" id="payBtn">Xác nhận thanh toán</button>' +
            '<button type="button" class="co-btn co-btn--outline co-btn--block" id="qrPayBtn">Thanh toán QR</button>'
          : '<button type="button" class="co-btn co-btn--primary co-btn--block" id="qrPayBtn">Thanh toán QR</button>' +
            '<p class="co-hint co-hint--side">Đã có tài khoản? <a href="/tai-khoan?next=/thanh-toan">Đăng nhập</a> để trả bằng ví.</p>') +
        '<p class="co-foot-note">Thanh toán xong hệ thống giao proxy tự động.</p>' +
        "</aside></div>";

      document.getElementById("checkoutLines").innerHTML = items
        .map(
          (it) =>
            "<li><div class=\"co-line-main\"><span class=\"co-line-name\">" +
            escapeHtml(it.name) +
            '</span><span class="co-line-qty">×' +
            it.qty +
            "</span></div><strong>" +
            money(it.price * it.qty) +
            "</strong></li>"
        )
        .join("");

      const list = document.getElementById("promoList");
      if (list) {
        list.innerHTML = activePromos
          .map((p) => {
            const label =
              escapeHtml(p.code) +
              " · −" +
              p.percent +
              "%" +
              (p.perUserLimit > 0 ? " · " + p.perUserLimit + " lần/TK" : "");
            return (
              '<button type="button" class="co-chip" data-code="' +
              escapeHtml(p.code) +
              '">' +
              label +
              "</button>"
            );
          })
          .join("");
        list.querySelectorAll(".co-chip").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById("promoInput").value = btn.getAttribute("data-code");
            applyPromo();
          });
        });
      }

      document.getElementById("promoApply")?.addEventListener("click", applyPromo);
      document.getElementById("promoClear")?.addEventListener("click", () => {
        promo = null;
        paint();
      });
      document.getElementById("promoInput")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          applyPromo();
        }
      });
      document.getElementById("guestEmail")?.addEventListener("input", (e) => {
        deliveryEmail = String(e.target.value || "").trim();
      });
      document.getElementById("payBtn")?.addEventListener("click", () => payByWallet());
      document.getElementById("qrPayBtn")?.addEventListener("click", () => payByQr());
    }

    async function applyPromo() {
      const code = String(document.getElementById("promoInput")?.value || "").trim();
      const msg = document.getElementById("promoMsg");
      if (!code) {
        if (msg) {
          msg.className = "co-promo-msg err";
          msg.textContent = "Nhập mã khuyến mãi";
        }
        return;
      }
      try {
        const data = await VuammoApi.api("/promos/validate", {
          method: "POST",
          body: JSON.stringify({ code, amount: subtotal })
        });
        promo = {
          code: data.code,
          discount: data.discount,
          pay: data.pay,
          description: data.description || "",
          percent: data.percent
        };
        paint();
        VuammoApi.showToast("Đã áp dụng mã " + data.code);
      } catch (err) {
        promo = null;
        if (msg) {
          msg.className = "co-promo-msg err";
          msg.textContent = err.message || "Mã không hợp lệ";
        } else {
          VuammoApi.showToast(err.message || "Mã không hợp lệ");
        }
      }
    }

    paint();
  }

  function renderPaid(mount, order, opts) {
    opts = opts || {};
    const note = order?.deliveryNote || order?.delivery_note || "Đơn đã thanh toán.";
    const code = order?.code || "";
    const email = opts.deliveryEmail || order?.deliveryEmail || order?.guestEmail || "";
    const items = Array.isArray(order?.items) ? order.items : [];
    const itemHtml = items.length
      ? '<ul class="checkout-success-items">' +
        items
          .map(
            (it) =>
              "<li><span>" +
              escapeHtml(it.name) +
              " × " +
              (it.qty || 1) +
              "</span><strong>" +
              money((it.price || 0) * (it.qty || 1)) +
              "</strong></li>"
          )
          .join("") +
        "</ul>"
      : "";
    const emailNote = email
      ? opts.emailSent === true
        ? '<p class="checkout-email-note ok">Đã gửi xác nhận đơn hàng tới <b>' +
          escapeHtml(email) +
          "</b>.</p>"
        : '<p class="checkout-email-note">Xác nhận đơn sẽ gửi tới <b>' +
          escapeHtml(email) +
          "</b>.</p>"
      : "";
    mount.innerHTML =
      '<div class="info-note checkout-success co-success">' +
      "<strong>Thanh toán thành công!</strong>" +
      (code ? "<p>Mã đơn: <b>" + escapeHtml(code) + "</b></p>" : "") +
      itemHtml +
      (window.VuaproxyResult
        ? window.VuaproxyResult.html(order)
        : '<div class="checkout-success-delivery">' + escapeHtml(note).replace(/\n/g, "<br>") + "</div>") +
      emailNote +
      '<p class="checkout-success-actions"><a class="co-btn co-btn--primary" href="/tai-khoan#orders">Xem đơn hàng</a> ' +
      '<a class="co-btn co-btn--outline" href="/">Về trang chủ</a></p></div>';
    window.VuaproxyResult?.bind(mount);
  }

  function renderQrPanel(mount, data, opts) {
    opts = opts || {};
    const order = data.order || {};
    const payment = data.payment || {};
    const img = qrImgUrl(payment.qrCode, payment.checkoutUrl);
    const canBack = typeof opts.onBack === "function";
    mount.innerHTML =
      '<div class="co-qr-wrap">' +
      (canBack
        ? '<button type="button" class="co-page-back" id="qrBackBtn">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>' +
          "Quay lại chỉnh đơn</button>"
        : "") +
      '<div class="checkout-qr-panel">' +
      "<h2>Quét QR thanh toán</h2>" +
      "<p>Mã đơn <strong>" +
      escapeHtml(order.code || "") +
      "</strong> · Số tiền <strong>" +
      money(order.total) +
      "</strong></p>" +
      (img
        ? '<div class="checkout-qr-frame"><img src="' +
          escapeHtml(img) +
          '" alt="QR thanh toán" width="240" height="240"></div>'
        : "") +
      (payment.checkoutUrl
        ? '<p><a class="co-btn co-btn--primary" href="' +
          escapeHtml(payment.checkoutUrl) +
          '" target="_blank" rel="noopener">Mở trang thanh toán</a></p>'
        : "") +
      '<p class="checkout-note" id="qrPollStatus">Đang chờ thanh toán… giữ trang này mở.</p>' +
      '<p><button type="button" class="co-btn co-btn--outline" id="qrRefreshBtn">Tôi đã thanh toán</button></p>' +
      "</div></div>";
    if (canBack) {
      document.getElementById("qrBackBtn")?.addEventListener("click", opts.onBack);
    }
  }

  let pollTimer = null;
  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPoll(mount, code, token) {
    stopPoll();
    if (!code || !token) return;
    const tick = async () => {
      try {
        const data = await VuammoApi.api(
          "/orders/pay/" + encodeURIComponent(code) + "?token=" + encodeURIComponent(token)
        );
        if (data.order && data.order.status && data.order.status !== "pending_payment") {
          stopPoll();
          clearGuestPay();
          try {
            const orderedIds = new Set(
              (data.order.items || []).map((i) => String(i.id)).filter(Boolean)
            );
            if (orderedIds.size && window.CartStore) {
              const remain = CartStore.read().filter((i) => !orderedIds.has(String(i.id)));
              CartStore.write(remain);
              if (CartStore.setSelectedIds) {
                CartStore.setSelectedIds(remain.map((i) => String(i.id)));
              }
            }
          } catch (_) {}
          goPaidPage(data.order, {
            emailSent: data.emailSent,
            deliveryEmail: data.deliveryEmail || data.order.deliveryEmail
          });
        } else {
          const el = document.getElementById("qrPollStatus");
          if (el) el.textContent = "Đang chờ thanh toán… giữ trang này mở.";
        }
      } catch (_) {}
    };
    pollTimer = setInterval(tick, 4000);
    document.getElementById("qrRefreshBtn")?.addEventListener("click", tick);
  }

  async function showPayResult(mount, code, token) {
    mount.innerHTML = '<div class="co-empty"><p>Đang kiểm tra thanh toán…</p></div>';
    try {
      const data = await VuammoApi.api(
        "/orders/pay/" + encodeURIComponent(code) + "?token=" + encodeURIComponent(token)
      );
      if (data.order?.status === "pending_payment") {
        renderQrPanel(mount, data, {
          onBack: () => {
            stopPoll();
            location.href = "/thanh-toan";
          }
        });
        startPoll(mount, code, token);
      } else {
        clearGuestPay();
        renderPaid(mount, data.order, {
          emailSent: data.emailSent,
          deliveryEmail: data.deliveryEmail || data.order?.deliveryEmail
        });
        openPaidPopup(data.order, {
          emailSent: data.emailSent,
          deliveryEmail: data.deliveryEmail || data.order?.deliveryEmail
        });
      }
    } catch (err) {
      mount.innerHTML =
        '<div class="co-empty"><p>' +
        escapeHtml(err.message || "Không tải được đơn") +
        '</p><a class="co-btn co-btn--primary" href="/tat-ca-khu-vuc">Chọn proxy</a></div>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 60));
  } else {
    setTimeout(init, 60);
  }
})();
