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
      ".header-wallet-balance,#headerWalletBalance,.wallet-balance-badge,#walletBalanceBadge,#cartTotalTop{display:none!important}.nav-actions .chat-btn{background:#fff}.nav-actions .chat-btn:hover{background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.08)}.nav-badge.hidden{display:none!important}.side-nav-chat svg{width:20px;height:20px}" +
      ".footer-col--countries{gap:8px}.footer-country{display:inline-flex!important;align-items:center;gap:10px;font-size:14px;color:#848484;text-decoration:none;line-height:1.2}" +
      ".footer-country:hover{color:var(--brand,#e11d48)}.footer-country-flag{width:22px;height:22px;border-radius:50%;object-fit:cover;flex:0 0 auto;box-shadow:0 0 0 1px rgba(15,23,42,.08)}" +
      ".footer-country-flag--globe{display:inline-flex;align-items:center;justify-content:center;background:#eff6ff;box-shadow:0 0 0 1px rgba(59,130,246,.25)}" +
      ".footer-country--all{color:#3b82f6;font-weight:600}" +
      ".logo{background:transparent!important}.logo-img{background:transparent!important}" +
      ".search-bar svg{fill:none!important;stroke:currentColor}";
    document.head.appendChild(s);
  }
  injectCriticalCss();

  const ACCOUNT_SVG =
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20c1.6-3.6 4.5-5.5 7.5-5.5s5.9 1.9 7.5 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const CHAT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.2 3.2A.8.8 0 0 1 4.5 18.5V16A2.5 2.5 0 0 1 4 13.5v-8z"/></svg>';

  function moneyText(n) {
    if (window.VuammoApi && typeof VuammoApi.money === "function") return VuammoApi.money(n);
    return Number(n || 0).toLocaleString("vi-VN") + "₫";
  }

  function walletBalance() {
    if (window.VuammoAuth && VuammoAuth.getUser()) {
      return Number(VuammoAuth.getUser().balance || 0);
    }
    return 0;
  }

  function syncCountsAndBalance() {
    const bal = walletBalance();
    const balanceEl = document.getElementById("headerWalletBalance");
    if (balanceEl) balanceEl.remove();
    const dropBal = document.getElementById("dropdownWalletBal");
    if (dropBal) dropBal.textContent = moneyText(bal);
    document.querySelectorAll("#walletBalanceBadge, .wallet-balance-badge, #cartTotalTop").forEach((el) => el.remove());
  }

  const SHELL_VER = "v26";

  function navLinksHtml() {
    return (
      '<nav class="nav-links">' +
      '<a href="/gioi-thieu">' +
      '<span class="nav-ico nav-ico--blue" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></span>' +
      "Giới Thiệu</a>" +
      '<a href="/tat-ca-khu-vuc" class="nav-all-proxy" id="navAllProxy" aria-haspopup="true" aria-expanded="false">' +
      '<span class="nav-ico nav-ico--red" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>' +
      'Tất cả Proxy<span class="nav-all-proxy-caret" aria-hidden="true"></span></a>' +
      '<a href="/chia-se"><span class="nav-ico nav-ico--orange" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></span>Chia sẻ</a>' +
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
      '<img class="logo-img" src="/images/logo-vuaproxy.png?v=20260915logo1" alt="Vua Proxy - Proxy tĩnh & proxy xoay">' +
      "</a>" +
      '<div class="search-bar">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      '<input type="text" placeholder="Tìm proxy theo quốc gia...">' +
      "</div>" +
      '<a href="/lien-he" class="header-phone hide-mobile" title="Liên hệ hỗ trợ">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>' +
      "<span>Hỗ trợ 24/7</span></a>" +
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
      header.dataset.vuammoHeaderShell === SHELL_VER &&
      header.querySelector(".header-inner") &&
      header.querySelector(".header-phone") &&
      navRow &&
      header.querySelector(".nav-links") &&
      header.querySelector("#navAllProxy") &&
      header.querySelector("#catMenuBtn") &&
      !header.querySelector(".proxy-type-nav") &&
      !header.querySelector('.nav-links img[src*="khotaikhoan"]') &&
      navActions &&
      navRow.contains(navActions) &&
      header.querySelector(".search-bar");

    if (!complete) {
      header.innerHTML = canonicalHeaderInnerHtml();
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
    ensureCanonicalDrawer();
  }

  function isLoggedIn() {
    try {
      return !!(window.VuammoAuth && typeof VuammoAuth.getUser === "function" && VuammoAuth.getUser());
    } catch (_) {
      return false;
    }
  }

  /** Mobile drawer: chỉ mục liên quan Vua Proxy + đăng nhập/đăng ký */
  function ensureCanonicalDrawer() {
    const drawer = document.getElementById("drawer");
    const inner = drawer && drawer.querySelector(".drawer-inner");
    if (!inner) return;

    const logged = isLoggedIn();
    const authLabel = logged ? "Tài khoản của tôi" : "Đăng nhập / Đăng ký";
    const authHref = "/tai-khoan";

    inner.innerHTML =
      '<div class="drawer-title">Danh mục</div>' +
      '<a href="/tat-ca-khu-vuc">Tất cả quốc gia</a>' +
      '<a href="/tat-ca-khu-vuc/proxy-viet-nam">Proxy Việt Nam</a>' +
      '<a href="/tat-ca-khu-vuc/proxy-my">Proxy Mỹ</a>' +
      '<a href="/tat-ca-san-pham/proxy/proxy-datacenter">Proxy Datacenter</a>' +
      '<a href="/tat-ca-san-pham/proxy/proxy-dan-cu">Proxy Dân cư</a>' +
      '<a href="/#reviews">Đánh giá</a>' +
      '<div class="drawer-title" style="margin-top:18px">Menu</div>' +
      '<a href="/tat-ca-khu-vuc">Tất cả quốc gia</a>' +
      '<a href="/chia-se">Chia sẻ</a>' +
      '<a href="/lien-he">Liên hệ</a>' +
      '<a href="/nap-tien">Nạp tiền</a>' +
      '<a href="/tin-nhan">Tin nhắn</a>' +
      '<a href="' +
      authHref +
      '" data-drawer-auth="1">' +
      authLabel +
      "</a>";

    inner.dataset.vuammoDrawer = "proxy2";
    inner.dataset.proxyMega = "1"; // chặn proxy-mega-menu nhét lại cây danh mục cũ
    inner.dataset.chatLinked = "1";
  }

  /** Desktop side rail: bỏ AI / Game / Khóa học */
  function ensureCleanSideNav() {
    const nav = document.getElementById("sideNav") || document.querySelector(".side-nav");
    if (!nav) return;
    const kill =
      /tai-khoan-cong-cu-ai|\/game(?:\/|$)|\/khoa-hoc(?:\/|$)|buff-|netflix|spotify|capcut|canva|chatgpt/i;
    nav.querySelectorAll("a.side-nav-item").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const title = a.getAttribute("title") || a.textContent || "";
      if (kill.test(href) || /AI|Game|Khóa học|Netflix|Spotify/i.test(title)) a.remove();
    });
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
    actions.querySelectorAll(".wish-btn, .cart-btn").forEach((el) => el.remove());

    if (!force && actions.dataset.vuammoHeader === "v6" && actions.querySelector(".chat-btn") && actions.querySelector(".account-btn")) {
      syncCountsAndBalance();
      return actions;
    }

    actions.innerHTML =
      '<a class="icon-btn account-btn" href="/tai-khoan" aria-label="Tài khoản" title="Tài khoản">' +
      ACCOUNT_SVG +
      "</a>" +
      '<a class="icon-btn chat-btn" href="/tin-nhan" aria-label="Tin nhắn" title="Tin nhắn">' +
      CHAT_SVG +
      '<span class="nav-badge hidden" id="chatBadgeTop">0</span></a>';

    actions.dataset.vuammoHeader = "v6";
    syncCountsAndBalance();
    return actions;
  }

  function stripCartWishUi() {
    document.querySelectorAll('a.wish-btn, a.cart-btn, .badge-wish, .product-wish-btn').forEach((el) => el.remove());
    document.querySelectorAll('a[href="/wishlist"], a[href="/cart"], a[href="wishlist.html"], a[href="cart.html"]').forEach((el) => {
      if (el.classList.contains("bn-item") || el.classList.contains("wish-btn") || el.classList.contains("cart-btn") || el.closest(".bottom-nav") || el.closest(".drawer")) {
        el.remove();
      }
    });
    const addCart = document.getElementById("addToCartBtn");
    if (addCart) addCart.remove();
  }

  function ensureBottomNav() {
    const nav = document.querySelector("nav.bottom-nav");
    if (!nav) return;
    nav.querySelectorAll('a[href="/wishlist"], a[href="/cart"]').forEach((a) => a.remove());
    if (nav.dataset.vuammoBn === "nocart1") return;
    nav.dataset.vuammoBn = "nocart1";
    if (nav.querySelectorAll("a.bn-item").length >= 3) return;
    nav.innerHTML =
      '<a class="bn-item" href="/">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"/></svg>' +
      "<small>Trang chủ</small></a>" +
      '<a class="bn-item" href="/tat-ca-khu-vuc">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>' +
      "<small>Khu vực</small></a>" +
      '<a class="bn-item" href="/chia-se">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h16v12H8l-4 4V5z"/></svg>' +
      "<small>Chia sẻ</small></a>" +
      '<a class="bn-item" href="/tai-khoan">' +
      ACCOUNT_SVG +
      "<small>Tài khoản</small></a>";
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

  const TICKER_TEXT =
    "⚠️ Nghiêm cấm sử dụng PROXY và VPS vào mục đích trái pháp luật. Bạn sẽ phải chịu toàn bộ trách nhiệm trước pháp luật khi sử dụng dịch vụ của chúng tôi. Tks!";

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
        '<span class="site-ticker__warn">' +
        TICKER_TEXT +
        "</span></span>"
      );
    }

    const bar = document.createElement("div");
    bar.className = "site-ticker";
    bar.id = "siteTicker";
    bar.setAttribute("role", "marquee");
    bar.setAttribute("aria-label", "Thông báo Vua Proxy");
    bar.innerHTML =
      '<div class="site-ticker__track">' + unitHtml() + unitHtml() + "</div>";
    /* Ngoài sticky header để animation không làm lag cả header */
    header.insertAdjacentElement("afterend", bar);
  }

  function listingSearchUrl(q) {
    const query = String(q || "").trim();
    if (!query) return "/tat-ca-khu-vuc";
    const needle = query.toLowerCase();
    const locs = window.VUAPROXY_LOCATIONS || [];
    const hit = locs.find((x) => {
      const code = String(x.code || "").toLowerCase();
      const name = String(x.name || "").toLowerCase();
      const nameVi = String(x.nameVi || "").toLowerCase();
      return code === needle || name === needle || nameVi === needle || name.includes(needle) || nameVi.includes(needle);
    });
    if (hit) return window.VUAPROXY_countryHref ? window.VUAPROXY_countryHref(hit) : ("/tat-ca-khu-vuc/" + encodeURIComponent(hit.slug || hit.code));
    return "/tat-ca-khu-vuc";
  }

  function remapLegacyProductListingLinks() {
    document.querySelectorAll('a[href*="/tat-ca-san-pham"]').forEach((a) => {
      const raw = a.getAttribute("href") || "";
      try {
        const u = new URL(raw, location.origin);
        const path = (u.pathname || "").replace(/\/+$/, "") || "/";
        // Giữ URL chi tiết sản phẩm dạng .../slug-12345
        if (/\/tat-ca-san-pham\/[^/]+-\d+$/i.test(path)) return;
        if (path === "/tat-ca-san-pham" || /^\/tat-ca-san-pham\//i.test(path)) {
          a.setAttribute("href", "/tat-ca-khu-vuc");
          if (/tất cả sản phẩm|tất cả proxy|tài khoản/i.test(a.getAttribute("title") || "")) {
            a.setAttribute("title", "Tất cả quốc gia");
          }
          if (/^\s*Tất cả (sản phẩm|Proxy)\s*$/i.test((a.textContent || "").trim())) {
            a.textContent = "Tất cả quốc gia";
          }
        }
      } catch (_) {}
    });
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
    const ver = "20260914hist1";
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      icon.type = "image/png";
      document.head.appendChild(icon);
    }
    icon.type = "image/png";
    icon.href = "/images/favicon.png?v=" + ver;
    let apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      document.head.appendChild(apple);
    }
    apple.href = "/images/apple-touch-icon.png?v=" + ver;
    let shortcut = document.querySelector('link[rel="shortcut icon"]');
    if (shortcut) {
      shortcut.type = "image/png";
      shortcut.href = "/images/favicon.png?v=" + ver;
    }
  }

  function featuredCountriesHtml() {
    const defaults = [
      { code: "us", slug: "proxy-my", name: "Mỹ" },
      { code: "de", slug: "proxy-duc", name: "Đức" },
      { code: "gb", slug: "proxy-anh", name: "Anh" },
      { code: "fr", slug: "proxy-phap", name: "Pháp" },
      { code: "bd", slug: "proxy-bangladesh", name: "Bangladesh" },
      { code: "jp", slug: "proxy-nhat-ban", name: "Nhật Bản" },
      { code: "id", slug: "proxy-indonesia", name: "Indonesia" },
      { code: "au", slug: "proxy-uc", name: "Úc" },
      { code: "in", slug: "proxy-an-do", name: "Ấn Độ" },
      { code: "ca", slug: "proxy-canada", name: "Canada" },
      { code: "sg", slug: "singapore", name: "Singapore" }
    ];
    const locs = window.VUAPROXY_LOCATIONS || [];
    const FEATURED = defaults.map(function (d) {
      const found = locs.find(function (x) { return x.code === d.code; });
      if (!found) return d;
      return {
        code: found.code || d.code,
        slug: found.slug || d.slug,
        name: found.nameVi || found.name || d.name
      };
    });
    const globe =
      '<span class="footer-country-flag footer-country-flag--globe" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="1.7">' +
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' +
      "</svg></span>";
    return (
      FEATURED.map(
        (c) =>
          '<a class="footer-country" href="' + (window.VUAPROXY_countryHref ? window.VUAPROXY_countryHref(c) : ("/tat-ca-khu-vuc/" + (c.slug || c.code))) + '">' +
          '<img class="footer-country-flag" src="/images/flags/' +
          c.code +
          '.png" alt="" width="22" height="22" loading="lazy">' +
          "<span>" +
          c.name +
          "</span></a>"
      ).join("") +
      '<a class="footer-country footer-country--all" href="/tat-ca-khu-vuc">' +
      globe +
      "<span>Tất cả quốc gia</span></a>"
    );
  }

  /** Đồng bộ footer mọi trang theo footer trang chủ (4 cột) */
  function ensureCanonicalFooter() {
    const footer = document.querySelector("footer.site-footer");
    if (!footer || footer.dataset.vuammoFooter === "home4") return;
    footer.dataset.vuammoFooter = "home4";
    footer.innerHTML =
      '<div class="container footer-grid">' +
      '<div class="footer-col footer-col-brand">' +
      '<a href="/" class="logo footer-logo">' +
      '<img class="logo-img" src="/images/logo-vuaproxy.png?v=20260915logo1" alt="Vua Proxy">' +
      "</a>" +
      '<p class="footer-desc">Vua Proxy cung cấp proxy tĩnh IPv4 và proxy xoay residential đa quốc gia — IP sạch, giao tự động, bảo hành rõ ràng.</p>' +
      '<p class="footer-desc"><strong>Giờ làm việc:</strong> 08:00 - 22:00 , <strong>phục vụ tất cả các ngày</strong> (kể cả Lễ &amp; Tết).</p>' +
      '<p class="footer-heading">Theo dõi chúng tôi</p>' +
      '<div class="social-icons">' +
      '<a href="https://www.facebook.com/vuaproxy" target="_blank" rel="noopener" class="social-icon social-fb" aria-label="Facebook"><svg viewBox="0 0 512 512"><path fill="currentColor" d="M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256C0 376 82.7 476.8 194.2 504.5l0-170.3-52.8 0 0-78.2 52.8 0 0-33.7c0-87.1 39.4-127.5 125-127.5 16.2 0 44.2 3.2 55.7 6.4l0 70.8c-6-.6-16.5-1-29.6-1-42 0-58.2 15.9-58.2 57.2l0 27.8 83.6 0-14.4 78.2-69.3 0 0 175.9C413.8 494.8 512 386.9 512 256z"/></svg></a>' +
      '<a href="https://twitter.com/vuaproxy" target="_blank" rel="noopener" class="social-icon social-tw" aria-label="Twitter"><svg viewBox="0 0 512 512"><path fill="currentColor" d="M459.4 151.7c.3 4.5 .3 9.1 .3 13.6 0 138.7-105.6 298.6-298.6 298.6-59.5 0-114.7-17.2-161.1-47.1 8.4 1 16.6 1.3 25.3 1.3 49.1 0 94.2-16.6 130.3-44.8-46.1-1-84.8-31.2-98.1-72.8 6.5 1 13 1.6 19.8 1.6 9.4 0 18.8-1.3 27.6-3.6-48.1-9.7-84.1-52-84.1-103l0-1.3c14 7.8 30.2 12.7 47.4 13.3-28.3-18.8-46.8-51-46.8-87.4 0-19.5 5.2-37.4 14.3-53 51.7 63.7 129.3 105.3 216.4 109.8-1.6-7.8-2.6-15.9-2.6-24 0-57.8 46.8-104.9 104.9-104.9 30.2 0 57.5 12.7 76.7 33.1 23.7-4.5 46.5-13.3 66.6-25.3-7.8 24.4-24.4 44.8-46.1 57.8 21.1-2.3 41.6-8.1 60.4-16.2-14.3 20.8-32.2 39.3-52.6 54.3z"/></svg></a>' +
      '<a href="https://www.youtube.com/@VuaProxy" target="_blank" rel="noopener" class="social-icon social-yt" aria-label="YouTube"><svg viewBox="0 0 576 512"><path fill="currentColor" d="M549.7 124.1C543.5 100.4 524.9 81.8 501.4 75.5 458.9 64 288.1 64 288.1 64S117.3 64 74.7 75.5C51.2 81.8 32.7 100.4 26.4 124.1 15 167 15 256.4 15 256.4s0 89.4 11.4 132.3c6.3 23.6 24.8 41.5 48.3 47.8 42.6 11.5 213.4 11.5 213.4 11.5s170.8 0 213.4-11.5c23.5-6.3 42-24.2 48.3-47.8 11.4-42.9 11.4-132.3 11.4-132.3s0-89.4-11.4-132.3zM232.2 337.6l0-162.4 142.7 81.2-142.7 81.2z"/></svg></a>' +
      '<a href="https://www.tiktok.com/@vuaproxy" target="_blank" rel="noopener" class="social-icon social-tt" aria-label="TikTok"><svg viewBox="0 0 448 512"><path fill="currentColor" d="M448.5 209.9c-44 .1-87-13.6-122.8-39.2l0 178.7c0 33.1-10.1 65.4-29 92.6s-45.6 48-76.6 59.6-64.8 13.5-96.9 5.3-60.9-25.9-82.7-50.8-35.3-56-39-88.9 2.9-66.1 18.6-95.2 40-52.7 69.6-67.7 62.9-20.5 95.7-16l0 89.9c-15-4.7-31.1-4.6-46 .4s-27.9 14.6-37 27.3-14 28.1-13.9 43.9 5.2 31 14.5 43.7 22.4 22.1 37.4 26.9 31.1 4.8 46-.1 28-14.4 37.2-27.1 14.2-28.1 14.2-43.8l0-349.4 88 0c-.1 7.4 .6 14.9 1.9 22.2 3.1 16.3 9.4 31.9 18.7 45.7s21.3 25.6 35.2 34.6c19.9 13.1 43.2 20.1 67 20.1l0 87.4z"/></svg></a>' +
      "</div></div>" +
      '<div class="footer-col">' +
      '<p class="footer-heading">Giới thiệu</p>' +
      '<a href="/gioi-thieu">Về chúng tôi</a>' +
      '<a href="/chinh-sach-bao-mat">Chính sách bảo mật</a>' +
      '<a href="/chinh-sach-cookies">Chính sách Cookies</a>' +
      '<a href="/hinh-thuc-thanh-toan">Hình thức thanh toán</a>' +
      '<a href="/gdpr">GDPR</a>' +
      '<a href="/dmca">DMCA</a>' +
      '<a href="/tai-lieu-api">Tài liệu API</a>' +
      '<a href="/faqs">FAQs</a>' +
      "</div>" +
      '<div class="footer-col">' +
      '<p class="footer-heading">Kênh liên hệ &amp; Hỗ trợ</p>' +
      '<p class="footer-desc">Có vấn đề về proxy hoặc gói hàng? Chat trực tiếp với Vua Proxy để được hỗ trợ nhanh.</p>' +
      '<a href="#" class="js-open-chat footer-chat-btn">💬 Chat trực tiếp ngay</a>' +
      '<a href="mailto:support@vuaproxy.cloud">Email: support@vuaproxy.cloud</a>' +
      "</div>" +
      '<div class="footer-col footer-col--countries" data-footer-countries="1">' +
      '<p class="footer-heading">Quốc gia nổi bật</p>' +
      featuredCountriesHtml() +
      "</div></div>" +
      '<div class="container footer-bottom">' +
      '<div class="footer-bottom-left">Copyright © 2024 <a href="/"><b>Vua Proxy</b>. All rights reserved.</a></div>' +
      '<div class="footer-bottom-right"><img src="https://images.dmca.com/Badges/dmca_protected_sml_120l.png?ID=ca3b1e15-a8de-4b84-aedd-c2b4455a16df" alt="DMCA.com Protection Status" loading="lazy"></div>' +
      "</div>";
  }

  /** FAQ accordion: mở 1 câu → đóng các câu cùng nhóm */
  function wireFaqAccordion() {
    if (document.documentElement.dataset.faqAccordion === "1") return;
    document.documentElement.dataset.faqAccordion = "1";
    document.addEventListener(
      "toggle",
      (e) => {
        const d = e.target;
        if (!d || d.tagName !== "DETAILS" || !d.open) return;
        const parent = d.parentElement;
        if (!parent) return;
        parent.querySelectorAll(":scope > details[open]").forEach((other) => {
          if (other !== d) other.open = false;
        });
      },
      true
    );
  }
  wireFaqAccordion();

  function boot() {
    ensureFavicon();
    ensureCanonicalHeader();
    injectTicker();
    normalizeNavActions(true);
    stripCartWishUi();
    ensureBottomNav();
    ensureCleanSideNav();
    ensureSideNavChat();
    ensureCanonicalDrawer();
    remapLegacyProductListingLinks();
    wireHeaderSearch();
    ensureCanonicalFooter();
    if (window.VuammoAuth && typeof window.VuammoAuth._wireHeaderAfterNormalize === "function") {
      try { window.VuammoAuth._wireHeaderAfterNormalize(); } catch (_) {}
    }
  }

  window.VuammoHeader = {
    normalize: normalizeNavActions,
    ensure: ensureCanonicalHeader,
    sync: syncCountsAndBalance,
    moneyText,
    refreshDrawer: ensureCanonicalDrawer
  };

  function ensureSideBanners() {
    if (document.querySelector('script[data-vuammo-side-banners]')) return;
    const s = document.createElement("script");
    s.src = "/js/side-banners.js?v=20260912bento4";
    s.defer = true;
    s.dataset.vuammoSideBanners = "1";
    document.head.appendChild(s);
  }

  function ensureTrafficViet() {
    if (document.querySelector('script[data-vuaproxy-trafficviet]')) return;
    if (document.querySelector('script[src*="app.trafficviet.vn/widget.js"]')) return;
    const s = document.createElement("script");
    s.src = "https://app.trafficviet.vn/widget.js";
    s.async = true;
    s.dataset.vuaproxyTrafficviet = "1";
    document.head.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
      ensureSideBanners();
      ensureTrafficViet();
    });
  } else {
    boot();
    ensureSideBanners();
    ensureTrafficViet();
  }

  window.addEventListener("vuammo:wish", syncCountsAndBalance);
  window.addEventListener("vuammo:cart", syncCountsAndBalance);
  window.addEventListener("vuammo:user", () => {
    syncCountsAndBalance();
    ensureCanonicalDrawer();
    if (window.VuammoAuth && typeof window.VuammoAuth._wireHeaderAfterNormalize === "function") {
      window.VuammoAuth._wireHeaderAfterNormalize();
    }
  });
})();
