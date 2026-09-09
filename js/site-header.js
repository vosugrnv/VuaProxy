/* Sitewide header chrome — đồng bộ nav-actions kiểu ảnh 2 trên mọi trang */
(function () {
  /** CSS tối thiểu cho dropdown — tránh header vỡ khi style.css cache cũ */
  function injectCriticalCss() {
    if (document.getElementById("vuammo-header-critical")) return;
    const s = document.createElement("style");
    s.id = "vuammo-header-critical";
    s.textContent =
      ".account-menu-wrap{position:relative!important;display:inline-flex!important;align-items:center;flex:0 0 auto;flex-direction:row;z-index:70}" +
      ".account-dropdown{position:absolute!important;top:calc(100% + 8px);right:0;left:auto;z-index:90;min-width:220px;" +
      "background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 12px 28px rgba(15,23,42,.12);padding:8px;" +
      "display:none!important;visibility:hidden!important;pointer-events:none!important}" +
      ".account-menu-wrap.is-open .account-dropdown{display:block!important;visibility:visible!important;pointer-events:auto!important}" +
      ".account-dropdown-head{padding:10px 12px 12px;border-bottom:1px solid #f1f5f9;margin-bottom:6px}" +
      ".account-dropdown-name{margin:0 0 2px;font-size:14px;font-weight:700;color:#0f172a}" +
      ".account-dropdown-email{margin:0;font-size:12px;color:#64748b;word-break:break-all}" +
      ".account-dropdown-bal{margin:10px 0 0;padding:8px 10px;background:#fff1f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#64748b}" +
      ".account-dropdown-bal strong{display:block;margin-top:2px;font-size:16px;font-weight:800;color:#dc2626}" +
      ".account-dropdown-item{display:block!important;width:100%!important;text-align:left;border:0;background:transparent;" +
      "padding:10px 12px;border-radius:8px;font:inherit;font-size:13.5px;font-weight:600;color:#0f172a;text-decoration:none;cursor:pointer;box-sizing:border-box}" +
      ".account-dropdown-logout{color:#dc2626;margin-top:4px;border-top:1px solid #f1f5f9}" +
      ".header-wallet-balance,#headerWalletBalance,.wallet-balance-badge,#walletBalanceBadge,#cartTotalTop{display:none!important}.nav-actions .chat-btn{background:#fff}.nav-actions .chat-btn:hover{background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.08)}.nav-badge.hidden{display:none!important}.side-nav-chat svg{width:20px;height:20px}";
    document.head.appendChild(s);
  }
  injectCriticalCss();

  const ACCOUNT_SVG =
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20c1.6-3.6 4.5-5.5 7.5-5.5s5.9 1.9 7.5 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const CHAT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.2 3.2A.8.8 0 0 1 4.5 18.5V16A2.5 2.5 0 0 1 4 13.5v-8z"/></svg>';
  const WISH_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s-7-4.4-9.5-8.6C.7 8.8 2 5 5.6 4.2 8 3.6 10 4.7 12 7c2-2.3 4-3.4 6.4-2.8C22 5 23.3 8.8 21.5 12.4 19 16.6 12 21 12 21z"/></svg>';
  const CART_SVG =
    '<svg viewBox="0 0 24 24"><path d="M3 4h2l1.6 9.6a2 2 0 0 0 2 1.7h7.4a2 2 0 0 0 2-1.6L19.5 8H6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="19.5" r="1.4" fill="currentColor"/><circle cx="16.5" cy="19.5" r="1.4" fill="currentColor"/></svg>';

  function moneyText(n) {
    if (window.VuammoApi && typeof VuammoApi.money === "function") return VuammoApi.money(n);
    return Number(n || 0).toLocaleString("vi-VN") + "₫";
  }

  function wishCount() {
    if (window.WishStore) return WishStore.read().length;
    try {
      const list = JSON.parse(localStorage.getItem("vuammo_wish_v1") || "[]");
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  }

  function cartCount() {
    if (window.CartStore) {
      return CartStore.read().reduce((s, i) => s + (i.qty || 1), 0);
    }
    try {
      const list = JSON.parse(localStorage.getItem("vuammo_cart_v1") || "[]");
      return Array.isArray(list) ? list.reduce((s, i) => s + (i.qty || 1), 0) : 0;
    } catch {
      return 0;
    }
  }

  function walletBalance() {
    if (window.VuammoAuth && VuammoAuth.getUser()) {
      return Number(VuammoAuth.getUser().balance || 0);
    }
    return 0;
  }

  function syncCountsAndBalance() {
    const wishN = wishCount();
    const cartN = cartCount();
    const bal = walletBalance();
    const loggedIn = !!(window.VuammoAuth && VuammoAuth.getUser());

    ["wishBadgeTop", "wishBadge"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(wishN);
    });
    ["cartBadgeTop", "cartBadge"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(cartN);
    });

    const balanceEl = document.getElementById("headerWalletBalance");
    if (balanceEl) balanceEl.remove();
    const dropBal = document.getElementById("dropdownWalletBal");
    if (dropBal) dropBal.textContent = moneyText(bal);

    // Gỡ pill cũ nếu còn
    document.querySelectorAll("#walletBalanceBadge, .wallet-balance-badge, #cartTotalTop").forEach((el) => el.remove());
  }

  const SHELL_VER = "v5";

  function navLinksHtml() {
    return (
      '<nav class="nav-links">' +
      '<a href="/gioi-thieu"><img src="https://khotaikhoan.net/wp-content/uploads/2026/02/Untitled-1-03.png.webp" alt="">Giới Thiệu</a>' +
      '<a href="/tat-ca-san-pham"><span class="nav-ico nav-ico--red" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>Tất cả sản phẩm</a>' +
      '<a href="/chia-se"><span class="nav-ico nav-ico--orange" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></span>Chia sẻ (99+)</a>' +
      '<a href="/lien-he"><span class="nav-ico nav-ico--green" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg></span>Liên hệ</a>' +
      '<a href="/nap-tien"><span class="nav-ico nav-ico--pink" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/><path d="M16 14h2"/></svg></span>Nạp tiền</a>' +
      "</nav>"
    );
  }

  function canonicalHeaderInnerHtml() {
    return (
      '<div class="container header-inner">' +
      '<button class="icon-btn hide-desktop" id="menuBtn" aria-label="Menu">' +
      '<svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      "</button>" +
      '<a href="/" class="logo">' +
      '<img class="logo-img" src="/images/logo-vuammo.png" alt="Vua MMO - Nền tảng giao dịch sản phẩm số">' +
      "</a>" +
      '<div class="search-bar">' +
      '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      '<input type="text" placeholder="Tìm sản phẩm ...">' +
      "</div>" +
      '<a href="/dang-ky-nguoi-ban" class="header-phone hide-mobile" title="Đăng ký làm người bán">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
      "<span>Đăng ký làm người bán</span></a>" +
      '<button class="icon-btn hide-desktop" id="userBtn" aria-label="Tài khoản">' +
      ACCOUNT_SVG +
      "</button>" +
      "</div>" +
      '<div class="nav-row hide-mobile">' +
      '<div class="container nav-row-inner">' +
      '<button class="cat-menu-btn" id="catMenuBtn" type="button">' +
      '<span class="cat-menu-icon"><svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>' +
      "<span>Tất cả danh mục</span></button>" +
      navLinksHtml() +
      '<div class="nav-actions" id="headerActions"></div>' +
      "</div></div>"
    );
  }

  function ensureCanonicalHeader() {
    let header = document.querySelector("header.site-header");
    if (!header) {
      header = document.createElement("header");
      header.className = "site-header";
      const side = document.getElementById("sideNav") || document.querySelector(".side-nav");
      if (side && side.parentNode) side.insertAdjacentElement("afterend", header);
      else document.body.insertBefore(header, document.body.firstChild);
    }

    const navActions = header.querySelector(".nav-actions");
    const navRow = header.querySelector(".nav-row");
    const complete =
      header.querySelector(".header-inner") &&
      header.querySelector(".header-phone") &&
      navRow &&
      header.querySelector(".nav-links") &&
      navActions &&
      navRow.contains(navActions) &&
      header.querySelector(".cat-menu-btn") &&
      header.querySelector(".search-bar");

    if (!complete) {
      header.innerHTML = canonicalHeaderInnerHtml();
    } else {
      const links = header.querySelector(".nav-links");
      if (links && !/Nạp tiền/i.test(links.textContent || "")) {
        links.outerHTML = navLinksHtml();
      }
    }
    header.dataset.vuammoHeaderShell = SHELL_VER;

    // Active state
    const path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    header.querySelectorAll(".nav-links a").forEach((a) => {
      try {
        const href = new URL(a.getAttribute("href"), location.origin).pathname.replace(/\/+$/, "") || "/";
        a.classList.toggle("is-active", href === path || (href !== "/" && path.indexOf(href) === 0));
      } catch (_) {}
    });

    return header;
  }

  function ensureDrawerExtras() {
    const drawer = document.querySelector(".drawer-inner");
    if (!drawer || drawer.dataset.chatLinked === "1") return;
    if (![...drawer.querySelectorAll("a")].some((a) => /\/tin-nhan/.test(a.getAttribute("href") || ""))) {
      const a = document.createElement("a");
      a.href = "/tin-nhan";
      a.textContent = "Tin nhắn";
      drawer.appendChild(a);
    }
    drawer.dataset.chatLinked = "1";
  }

  function normalizeNavActions(force) {
    let actions = document.querySelector(".nav-actions");
    if (!actions) {
      const ha = document.getElementById("headerActions") || document.querySelector(".header-actions");
      if (ha) {
        ha.classList.add("nav-actions");
        actions = ha;
      }
    }
    if (!actions) return null;

    document.querySelectorAll("#walletBalanceBadge, .wallet-balance-badge").forEach((el) => el.remove());

    if (!force && actions.dataset.vuammoHeader === "v5" && actions.querySelector(".chat-btn") && actions.querySelector(".cart-btn") && actions.querySelector(".wish-btn")) {
      syncCountsAndBalance();
      return actions;
    }

    const wishN = wishCount();
    const cartN = cartCount();

    actions.innerHTML =
      '<a class="icon-btn account-btn" href="/tai-khoan" aria-label="Tài khoản" title="Tài khoản">' +
      ACCOUNT_SVG +
      "</a>" +
      '<a class="icon-btn chat-btn" href="/tin-nhan" aria-label="Tin nhắn" title="Tin nhắn">' +
      CHAT_SVG +
      '<span class="nav-badge hidden" id="chatBadgeTop">0</span></a>' +
      '<a class="icon-btn wish-btn" href="/wishlist" aria-label="Wishlist" title="Danh sách yêu thích">' +
      WISH_SVG +
      '<span class="nav-badge" id="wishBadgeTop">' +
      wishN +
      "</span></a>" +
      '<a class="cart-btn" href="/cart" aria-label="Giỏ hàng" title="Giỏ hàng">' +
      '<span class="cart-icon-circle">' +
      CART_SVG +
      '<span class="nav-badge" id="cartBadgeTop">' +
      cartN +
      "</span></span></a>";

    const wishMobile = document.getElementById("wishBadge");
    if (wishMobile) wishMobile.textContent = String(wishN);
    const cartMobile = document.getElementById("cartBadge");
    if (cartMobile) cartMobile.textContent = String(cartN);

    actions.dataset.vuammoHeader = "v5";
    return actions;
  }

  function ensureSideNavChat() {
    const nav = document.getElementById("sideNav") || document.querySelector(".side-nav");
    if (!nav || nav.querySelector(".side-nav-chat")) return;
    const a = document.createElement("a");
    a.href = "/tin-nhan";
    a.className = "side-nav-item side-nav-chat";
    a.title = "Tin nhắn";
    a.setAttribute("aria-label", "Tin nhắn");
    a.innerHTML = CHAT_SVG;
    const firstItem = nav.querySelector("a.side-nav-item");
    if (firstItem) nav.insertBefore(a, firstItem.nextSibling);
    else nav.appendChild(a);
  }

  const TICKER_INTRO =
    "Vua MMO – Nền tảng giao dịch sản phẩm số uy tín. Mua bán tài khoản số, phần mềm bản quyền và dịch vụ số. Giao dịch trung gian an toàn, hỗ trợ nhanh.";
  const TICKER_WARN =
    "⚠️ Cảnh báo: Vui lòng yêu cầu shop bảo hành trực tiếp trên nền tảng bằng tính năng bảo hành để được bảo đảm quyền lợi. Không nhận bảo hành qua bất kỳ kênh nào khác — rất có thể bạn sẽ nhận sản phẩm cũ đã bán cho người khác. Không giao dịch ngoài nền tảng — Vua MMO không chịu trách nhiệm khi mua bán riêng.";

  function injectTicker() {
    if (document.getElementById("siteTicker")) return;
    const header = document.querySelector(".site-header");
    if (!header) return;

    if (!document.getElementById("vuammo-ticker-critical")) {
      const s = document.createElement("style");
      s.id = "vuammo-ticker-critical";
      s.textContent =
        ".site-ticker{background:#fff;border-bottom:1px solid #fee2e2;overflow:hidden;height:34px;display:flex;align-items:center;contain:layout paint style;transform:translateZ(0)}" +
        ".site-ticker__track{display:flex;width:max-content;align-items:center;animation:siteTickerRtl 70s linear infinite;transform:translate3d(0,0,0);backface-visibility:hidden}" +
        ".site-ticker__unit{display:inline-flex;align-items:center;flex:0 0 auto;white-space:nowrap;padding-right:4rem}" +
        ".site-ticker__intro,.site-ticker__warn{font-size:13px;font-weight:600;line-height:1.3;color:#dc2626}" +
        ".site-ticker__gap{display:inline-block;width:4.5rem;flex:0 0 auto;height:1px}" +
        ".site-ticker:hover .site-ticker__track{animation-play-state:paused}" +
        "@keyframes siteTickerRtl{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}";
      document.head.appendChild(s);
    }

    function unitHtml() {
      return (
        '<span class="site-ticker__unit">' +
        '<span class="site-ticker__intro">' +
        TICKER_INTRO +
        "</span>" +
        '<span class="site-ticker__gap" aria-hidden="true"></span>' +
        '<span class="site-ticker__warn">' +
        TICKER_WARN +
        "</span></span>"
      );
    }

    const bar = document.createElement("div");
    bar.className = "site-ticker";
    bar.id = "siteTicker";
    bar.setAttribute("role", "marquee");
    bar.setAttribute("aria-label", "Thông báo và cảnh báo Vua MMO");
    bar.innerHTML =
      '<div class="site-ticker__track">' + unitHtml() + unitHtml() + "</div>";
    /* Ngoài sticky header để animation không làm lag cả header */
    header.insertAdjacentElement("afterend", bar);
  }

  function listingSearchUrl(q) {
    const base = "/tat-ca-san-pham";
    const query = String(q || "").trim();
    return query ? base + "?q=" + encodeURIComponent(query) : base;
  }

  function wireHeaderSearch() {
    const params = new URLSearchParams(location.search);
    const preset = params.get("q");
    document.querySelectorAll(".search-bar").forEach((bar) => {
      if (bar.dataset.searchWired === "1") return;
      bar.dataset.searchWired = "1";
      const input = bar.querySelector("input");
      if (!input) return;
      input.type = "search";
      input.name = "q";
      input.setAttribute("autocomplete", "off");
      input.setAttribute("enterkeyhint", "search");
      if (preset && !input.value) input.value = preset;
      const go = () => {
        location.href = listingSearchUrl(input.value);
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          go();
        }
      });
      const icon = bar.querySelector("svg");
      if (icon) {
        icon.style.cursor = "pointer";
        icon.setAttribute("role", "button");
        icon.setAttribute("aria-label", "Tìm kiếm");
        icon.addEventListener("click", (e) => {
          e.preventDefault();
          go();
        });
      }
    });
  }

  function ensureFavicon() {
    if (document.querySelector('link[rel="icon"]')) return;
    const base = "/images/";
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/png";
    icon.href = "/images/favicon.png?v=20260908f4";
    document.head.appendChild(icon);
    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = "/images/apple-touch-icon.png?v=20260908f4";
    document.head.appendChild(apple);
  }

  function boot() {
    ensureFavicon();
    ensureCanonicalHeader();
    injectTicker();
    normalizeNavActions(true);
    ensureSideNavChat();
    ensureDrawerExtras();
    wireHeaderSearch();
    if (window.VuammoAuth && typeof window.VuammoAuth._wireHeaderAfterNormalize === "function") {
      try { window.VuammoAuth._wireHeaderAfterNormalize(); } catch (_) {}
    }
  }

  window.VuammoHeader = {
    normalize: normalizeNavActions,
    ensure: ensureCanonicalHeader,
    sync: syncCountsAndBalance,
    moneyText,
    wishCount,
    cartCount
  };

  function ensureSideBanners() {
    if (document.querySelector('script[data-vuammo-side-banners]')) return;
    const s = document.createElement("script");
    s.src = "/js/side-banners.js?v=20260909side8";
    s.defer = true;
    s.dataset.vuammoSideBanners = "1";
    document.head.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
      ensureSideBanners();
    });
  } else {
    boot();
    ensureSideBanners();
  }

  window.addEventListener("vuammo:wish", syncCountsAndBalance);
  window.addEventListener("vuammo:cart", syncCountsAndBalance);
  window.addEventListener("vuammo:user", () => {
    syncCountsAndBalance();
    if (window.VuammoAuth && typeof window.VuammoAuth._wireHeaderAfterNormalize === "function") {
      window.VuammoAuth._wireHeaderAfterNormalize();
    }
  });
})();
