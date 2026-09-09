/* Checkout — ví (đăng nhập) + QR (không bắt buộc đăng nhập) */
(function () {
  const GUEST_PAY_KEY = "vuammo_guest_pay";

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

  async function init() {
    const mount = document.getElementById("checkoutApp");
    if (!mount) return;

    try {
      await VuammoAuth.refreshMe();
    } catch (_) {}

    const user = VuammoAuth.getUser ? VuammoAuth.getUser() : null;
    const loggedIn = !!(user && user.id);

    const params = new URLSearchParams(location.search || "");
    const payCode = String(params.get("code") || "").trim();
    const payToken = String(params.get("token") || "").trim();
    if (payCode && payToken) {
      saveGuestPay({ code: payCode, token: payToken });
      await showPayResult(mount, payCode, payToken);
      return;
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
        '<div class="info-note"><p>Giỏ hàng trống hoặc chưa chọn sản phẩm.</p><p><a href="/cart">Quay lại giỏ hàng</a></p></div>';
      return;
    }

    const subtotal = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
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

    function paint() {
      const total = payTotal();
      const enough = loggedIn && Number(user.balance || 0) >= total;
      mount.innerHTML =
        '<div class="checkout-layout">' +
        '<div class="checkout-items"><h2>Đơn hàng</h2><ul id="checkoutLines"></ul>' +
        '<div class="checkout-promo-box">' +
        "<h3>Mã khuyến mãi</h3>" +
        (activePromos.length
          ? '<p class="checkout-promo-hint">Mã đang mở — bấm để điền nhanh:</p><div class="checkout-promo-list" id="promoList"></div>'
          : '<p class="checkout-promo-hint">Hiện chưa có mã công khai. Bạn vẫn có thể nhập mã nếu được cấp.</p>') +
        '<div class="checkout-promo-form">' +
        '<input type="text" id="promoInput" placeholder="Nhập mã khuyến mãi" autocomplete="off" value="' +
        escapeHtml(promo ? promo.code : "") +
        '">' +
        '<button type="button" class="btn btn-outline" id="promoApply">Áp dụng</button>' +
        (promo
          ? '<button type="button" class="btn btn-ghost" id="promoClear">Gỡ mã</button>'
          : "") +
        "</div>" +
        '<p id="promoMsg" class="checkout-promo-msg' +
        (promo ? " ok" : "") +
        '">' +
        (promo
          ? "Đã áp dụng <b>" +
            escapeHtml(promo.code) +
            "</b>" +
            (promo.percent ? " (−" + promo.percent + "%)" : "") +
            (promo.description ? " — " + escapeHtml(promo.description) : "")
          : "") +
        "</p></div>" +
        (!loggedIn
          ? '<div class="checkout-guest-box"><label for="guestEmail">Email nhận thông tin đơn (tuỳ chọn)</label>' +
            '<input type="email" id="guestEmail" placeholder="you@email.com" autocomplete="email"></div>'
          : "") +
        "</div>" +
        '<aside class="checkout-side">' +
        "<h2>Thanh toán</h2>" +
        (loggedIn
          ? "<p>Số dư ví: <strong>" + money(user.balance) + "</strong></p>"
          : '<p class="checkout-guest-hint">Không cần đăng nhập — quét QR để thanh toán đơn.</p>') +
        '<div class="checkout-sum">' +
        "<div><span>Tạm tính</span><strong>" +
        money(subtotal) +
        "</strong></div>" +
        (promo && promo.discount
          ? '<div class="checkout-sum-disc"><span>Giảm giá</span><strong>−' +
            money(promo.discount) +
            "</strong></div>"
          : "") +
        '<div class="checkout-sum-pay"><span>Cần thanh toán</span><strong>' +
        money(total) +
        "</strong></div></div>" +
        '<button type="button" class="btn btn-primary" id="qrPayBtn">Thanh toán QR</button>' +
        (loggedIn
          ? enough
            ? '<button type="button" class="btn btn-outline checkout-wallet-btn" id="payBtn">Xác nhận trừ ví</button>'
            : '<div class="info-note" style="margin-top:12px"><p>Số dư ví không đủ' +
              (promo ? " (sau giảm giá)" : "") +
              '.</p><a class="btn btn-outline" href="/nap-tien">Nạp ví</a></div>'
          : '<p class="checkout-note">Đã có tài khoản? <a href="/tai-khoan?next=/thanh-toan">Đăng nhập</a> để trả bằng ví.</p>') +
        '<p class="checkout-note">Sau khi thanh toán QR thành công, hệ thống giao tài khoản tự động. Chat hỗ trợ vẫn cần đăng nhập.</p>' +
        "</aside></div>" +
        '<div id="checkoutMsg"></div>';

      document.getElementById("checkoutLines").innerHTML = items
        .map(
          (it) =>
            "<li><span>" +
            escapeHtml(it.name) +
            " × " +
            it.qty +
            "</span><strong>" +
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
              (p.perUserLimit > 0 ? " · " + p.perUserLimit + " lần/TK" : "") +
              (p.description ? " — " + escapeHtml(p.description) : "");
            return (
              '<button type="button" class="checkout-promo-chip" data-code="' +
              escapeHtml(p.code) +
              '">' +
              label +
              "</button>"
            );
          })
          .join("");
        list.querySelectorAll(".checkout-promo-chip").forEach((btn) => {
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

      document.getElementById("qrPayBtn")?.addEventListener("click", async () => {
        const btn = document.getElementById("qrPayBtn");
        btn.disabled = true;
        btn.textContent = "Đang tạo QR...";
        try {
          const body = { items };
          if (promo && promo.code) body.promoCode = promo.code;
          const email = document.getElementById("guestEmail")?.value;
          if (email) body.email = email;
          const data = await VuammoApi.api("/orders/checkout-qr", {
            method: "POST",
            body: JSON.stringify(body)
          });
          clearCartOrdered();
          const token = data.payment?.guestToken || "";
          const code = data.order?.code || "";
          if (code && token) saveGuestPay({ code, token });
          if (data.payment?.status === "paid" || data.order?.status === "delivered") {
            renderPaid(mount, data.order);
            clearGuestPay();
            VuammoApi.showToast("Thanh toán thành công");
            return;
          }
          renderQrPanel(mount, data);
          startPoll(mount, code, token);
          VuammoApi.showToast("Quét QR để thanh toán");
        } catch (err) {
          VuammoApi.showToast(err.message || "Không tạo QR được");
          btn.disabled = false;
          btn.textContent = "Thanh toán QR";
        }
      });

      document.getElementById("payBtn")?.addEventListener("click", async () => {
        const btn = document.getElementById("payBtn");
        btn.disabled = true;
        btn.textContent = "Đang xử lý...";
        try {
          const body = { items };
          if (promo && promo.code) body.promoCode = promo.code;
          const data = await VuammoApi.api("/orders", {
            method: "POST",
            body: JSON.stringify(body)
          });
          clearCartOrdered();
          await VuammoAuth.refreshMe();
          renderPaid(mount, data.order);
          VuammoApi.showToast("Đã trừ ví và tạo đơn");
        } catch (err) {
          if (err.status === 402) {
            document.getElementById("checkoutMsg").innerHTML =
              '<div class="info-note"><p>' +
              escapeHtml(err.message) +
              '</p><a class="btn btn-primary" href="/nap-tien">Nạp thêm</a></div>';
          } else {
            VuammoApi.showToast(err.message || "Không tạo đơn được");
          }
          btn.disabled = false;
          btn.textContent = "Xác nhận trừ ví";
        }
      });
    }

    async function applyPromo() {
      const code = String(document.getElementById("promoInput")?.value || "").trim();
      const msg = document.getElementById("promoMsg");
      if (!code) {
        if (msg) {
          msg.className = "checkout-promo-msg err";
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
          msg.className = "checkout-promo-msg err";
          msg.textContent = err.message || "Mã không hợp lệ";
        } else {
          VuammoApi.showToast(err.message || "Mã không hợp lệ");
        }
      }
    }

    paint();
  }

  function renderPaid(mount, order) {
    const note = order?.deliveryNote || order?.delivery_note || "Đơn đã thanh toán.";
    const code = order?.code || "";
    mount.innerHTML =
      '<div class="info-note checkout-success">' +
      "<strong>Thanh toán thành công!</strong>" +
      (code ? "<p>Mã đơn: <b>" + escapeHtml(code) + "</b></p>" : "") +
      "<p>" +
      escapeHtml(note).replace(/\n/g, "<br>") +
      "</p>" +
      '<p><a class="acct-btn acct-btn--primary" href="/tai-khoan#orders">Xem đơn hàng</a> ' +
      '<a class="btn btn-outline" href="/">Về trang chủ</a></p></div>';
  }

  function renderQrPanel(mount, data) {
    const order = data.order || {};
    const payment = data.payment || {};
    const img = qrImgUrl(payment.qrCode, payment.checkoutUrl);
    mount.innerHTML =
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
        ? '<p><a class="btn btn-primary" href="' +
          escapeHtml(payment.checkoutUrl) +
          '" target="_blank" rel="noopener">Mở trang thanh toán</a></p>'
        : "") +
      '<p class="checkout-note" id="qrPollStatus">Đang chờ thanh toán… giữ trang này mở.</p>' +
      '<p><button type="button" class="btn btn-outline" id="qrRefreshBtn">Tôi đã thanh toán</button></p>' +
      "</div>";
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
          renderPaid(mount, data.order);
          VuammoApi.showToast("Thanh toán thành công");
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
    mount.innerHTML = '<div class="info-note"><p>Đang kiểm tra thanh toán…</p></div>';
    try {
      const data = await VuammoApi.api(
        "/orders/pay/" + encodeURIComponent(code) + "?token=" + encodeURIComponent(token)
      );
      if (data.order?.status === "pending_payment") {
        renderQrPanel(mount, data);
        startPoll(mount, code, token);
      } else {
        clearGuestPay();
        renderPaid(mount, data.order);
      }
    } catch (err) {
      mount.innerHTML =
        '<div class="info-note"><p>' +
        escapeHtml(err.message || "Không tải được đơn") +
        '</p><p><a href="/cart">Quay lại giỏ hàng</a></p></div>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 60));
  } else {
    setTimeout(init, 60);
  }
})();
