(function () {
  const locations = window.VUAPROXY_LOCATIONS || [];
  function flagUrl(code) {
    return "/images/flags/" + String(code || "").toLowerCase() + ".png";
  }
  function bindFlagFallback(img, code) {
    if (!img) return;
    img.addEventListener("error", function once() {
      img.removeEventListener("error", once);
      img.src = "https://flagcdn.com/w160/" + String(code || "").toLowerCase() + ".png";
    });
  }

  function pathKey() {
    const parts = (location.pathname || "").replace(/\/+$/, "").split("/").filter(Boolean);
    const i = parts.indexOf("tat-ca-khu-vuc");
    if (i >= 0 && parts[i + 1]) return String(parts[i + 1]).toLowerCase();
    const q = new URLSearchParams(location.search).get("code") || new URLSearchParams(location.search).get("slug");
    return q ? String(q).toLowerCase() : "";
  }

  function fmtIps(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  function fmtXu(n) {
    return Math.round(Number(n || 0)).toLocaleString("vi-VN") + " Xu";
  }

  function findCountry(key) {
    if (window.VUAPROXY_findLocation) return window.VUAPROXY_findLocation(key);
    const k = String(key || "").toLowerCase();
    return (
      locations.find(function (x) { return x.slug === k; }) ||
      locations.find(function (x) { return x.code === k; }) ||
      null
    );
  }
  function countryHref(item) {
    return window.VUAPROXY_countryHref
      ? window.VUAPROXY_countryHref(item)
      : ("/tat-ca-khu-vuc/" + (item.slug || item.code));
  }

  /** Giá chuẩn: (giá 30 ngày / 30) × số ngày × số lượng — Type HTTP/SOCKS không ảnh hưởng */
  function calcTotal(monthPrice, days, qty) {
    const d = Math.max(1, Number(days) || 1);
    const q = Math.max(1, Number(qty) || 1);
    const m = Math.max(0, Number(monthPrice) || 0);
    return Math.round((m / 30) * d * q);
  }

  function packageDefs(country) {
    const isVN = country.code === "vn";
    const isUS = country.code === "us";
    const label = country.nameVi || country.name || String(country.code || "").toUpperCase();
    // Ngoài VN: giá ×2
    const mul = isVN ? 1 : 2;
    // Datacenter: dùng chung 8k/30n · dùng riêng 40k/30n (VN); nước ngoài gấp đôi
    const dcShared = 8000 * mul;
    const dcPrivate = 40000 * mul;
    const residential = 10000 * mul;
    const pack100 = 650000 * mul;
    const pack100Dc = 400000 * mul;

    return [
      {
        key: "share",
        title: "Proxy dân cư tĩnh Private · " + label,
        highlight: false,
        features: [
          "Cam kết sử dụng riêng 100%",
          "Phù hợp với chơi game, xây kênh"
        ],
        // VN: nhà mạng (không đổi giá) | nước khác: Private
        extraField: isVN
          ? { name: "isp", label: "Chọn nhà mạng", type: "select", options: ["FPT", "Viettel", "VNPT", "Mobifone"], affectsPrice: false }
          : {
              name: "loai",
              label: "Loại proxy",
              type: "select",
              options: ["Private"],
              affectsPrice: false,
              prices: { Private: residential }
            },
        qtyLabel: "Số lượng",
        days: 30,
        monthPrice: residential
      },
      {
        key: "dc-single",
        title: "Proxy Datacenter · " + label,
        highlight: false,
        features: [
          { text: "Dùng riêng còn 128 Proxy", danger: true },
          "Độ ổn định cao phù hợp chơi game",
          "Không giới hạn dung lượng sử dụng",
          "Thời gian mua càng lâu giá càng rẻ"
        ],
        extraField: {
          name: "loai",
          label: "Loại proxy",
          type: "select",
          options: ["Dùng chung", "Dùng riêng"],
          affectsPrice: true,
          prices: { "Dùng chung": dcShared, "Dùng riêng": dcPrivate }
        },
        qtyLabel: "Số lượng",
        days: 30,
        monthPrice: dcShared,
        noteUS: isUS
          ? ("Dùng riêng Mỹ: " + dcPrivate.toLocaleString("vi-VN") + "đ / 30 ngày")
          : ""
      },
      {
        key: "pack100",
        title: "Gói 100 proxy · " + label,
        highlight: false,
        features: [
          "Chất lượng gói sẽ kém hơn loại proxy lẻ",
          "Gói 100 proxy không được đổi proxy",
          "Đổi bảo mật riêng từng proxy trong gói",
          "Băng thông không giới hạn",
          "Mua càng lâu giá càng rẻ"
        ],
        qtyLabel: "Số lượng 1=100 proxy",
        days: 30,
        monthPrice: pack100
      },
      {
        key: "pack100-dc",
        title: "Gói 100 proxy datacenter · " + label,
        highlight: true,
        features: [
          "Chất lượng gói sẽ kém hơn loại proxy lẻ",
          "Gói 100 proxy không được đổi proxy",
          "Đổi bảo mật riêng từng proxy trong gói",
          "Băng thông không giới hạn",
          "Mua càng lâu giá càng rẻ"
        ],
        qtyLabel: "Số lượng 1=100 proxy",
        days: 30,
        monthPrice: pack100Dc
      }
    ];
  }

  function featHtml(f) {
    if (typeof f === "string") {
      return '<li><span class="lcp-feat-ic" aria-hidden="true"></span><span>' + f + "</span></li>";
    }
    return (
      '<li class="' + (f.danger ? "is-danger" : "") + '">' +
        '<span class="lcp-feat-ic" aria-hidden="true"></span><span>' + f.text + "</span>" +
      "</li>"
    );
  }

  function extraFieldHtml(field) {
    if (!field) return "";
    if (field.type === "select") {
      const pricesAttr = field.prices
        ? ' data-loai-prices="' + encodeURIComponent(JSON.stringify(field.prices)) + '"'
        : "";
      const affect = field.affectsPrice ? ' data-affects-price="1"' : "";
      return (
        "<label>" + field.label +
        '<select name="' + field.name + '"' + pricesAttr + affect + ">" +
        field.options.map(function (o) { return "<option value=\"" + o + "\">" + o + "</option>"; }).join("") +
        "</select></label>"
      );
    }
    return (
      "<label>" + field.label +
      '<input type="text" name="' + field.name + '" value="' + (field.value || "") + '">' +
      "</label>"
    );
  }

  function resolveMonthPrice(form) {
    const loai = form.querySelector('select[name="loai"]');
    if (loai && loai.getAttribute("data-affects-price") === "1") {
      try {
        const map = JSON.parse(decodeURIComponent(loai.getAttribute("data-loai-prices") || "{}"));
        const v = map[loai.value];
        if (v != null) return Number(v);
      } catch (_) {}
    }
    return Number(form.getAttribute("data-month") || 0);
  }

  function formCardHtml(pkg, country) {
    const id = "pkg-" + pkg.key;
    const initial = calcTotal(pkg.monthPrice, pkg.days, 1);
    const extra = pkg.extraField
      ? extraFieldHtml(pkg.extraField)
      : '<label class="lcp-field-spacer">Gói cố định<input type="text" value="100 proxy / đơn vị" disabled tabindex="-1"></label>';
    return (
      '<article class="lcp-form-card' + (pkg.highlight ? " is-hot" : "") + '" data-pkg="' + pkg.key + '">' +
        '<header class="lcp-form-head">' +
          (pkg.highlight ? '<span class="lcp-hot-pill">HOT</span>' : "") +
          "<h3>" + pkg.title + "</h3>" +
        "</header>" +
        '<div class="lcp-form-body">' +
          '<ul class="lcp-form-feats">' + pkg.features.map(featHtml).join("") + "</ul>" +
          '<form class="lcp-form" id="' + id + '" data-country="' + country.code + '" data-country-name="' +
            String(country.nameVi || country.name).replace(/"/g, "&quot;") +
            '" data-pkg="' + pkg.key + '" data-title="' +
            String(pkg.title).replace(/"/g, "&quot;") +
            '" data-month="' + pkg.monthPrice + '">' +
            '<div class="lcp-form-fields">' +
              extra +
              '<label>Ngày sử dụng<input type="number" name="days" value="' + pkg.days + '" min="1" max="365"></label>' +
              '<label>' + pkg.qtyLabel + '<input type="number" name="qty" value="1" min="1" max="99"></label>' +
              '<label>Type<select name="type"><option>HTTP</option><option>SOCKS5</option></select></label>' +
              '<label>User<input type="text" name="user" value="Random"></label>' +
              '<label>Password<input type="text" name="pass" value="Random"></label>' +
            "</div>" +
            '<div class="lcp-form-foot">' +
              '<div class="lcp-form-price"><span class="lcp-price-label">Tổng thanh toán</span><strong class="lcp-xu">' + fmtXu(initial) + "</strong></div>" +
              '<button type="submit" class="lcp-buy">Mua ngay</button>' +
            "</div>" +
          "</form>" +
        "</div>" +
      "</article>"
    );
  }

  function wireForms() {
    document.querySelectorAll(".lcp-form").forEach(function (form) {
      const xuEl = form.querySelector(".lcp-xu");

      function recalc() {
        const month = resolveMonthPrice(form);
        const total = calcTotal(month, form.days.value, form.qty.value);
        if (xuEl) xuEl.textContent = fmtXu(total);
      }

      form.addEventListener("input", recalc);
      form.addEventListener("change", recalc);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const month = resolveMonthPrice(form);
        const days = Math.max(1, Number(form.days.value || 30));
        const qty = Math.max(1, Number(form.qty.value || 1));
        const unit = calcTotal(month, days, 1);
        const total = unit * qty;
        const code = form.getAttribute("data-country") || "us";
        const countryName = form.getAttribute("data-country-name") || code.toUpperCase();
        const pkgKey = form.getAttribute("data-pkg") || "share";
        const title = form.getAttribute("data-title") || "Proxy";
        const type = (form.type && form.type.value) || "HTTP";
        const user = (form.user && form.user.value) || "Random";
        const pass = (form.pass && form.pass.value) || "Random";
        const isp = form.isp ? form.isp.value : "";
        const loai = form.loai ? form.loai.value : "";
        const titleHasCountry =
          title.indexOf(countryName) >= 0 ||
          title.toLowerCase().indexOf(" · " + code) >= 0;
        const parts = titleHasCountry
          ? [title, days + " ngày", type]
          : [title, countryName, days + " ngày", type];
        if (isp) parts.push(isp);
        if (loai) parts.push(loai);
        const name = parts.join(" · ");
        const productId =
          typeof window.VUAPROXY_packageProductId === "function"
            ? window.VUAPROXY_packageProductId(code, pkgKey)
            : null;
        const id =
          "lcp-" +
          code +
          "-" +
          pkgKey +
          "-" +
          days +
          "-" +
          type +
          (isp ? "-" + isp : "") +
          (loai ? "-" + loai : "") +
          "-" +
          user +
          "-" +
          pass;

        const item = {
          id: id.replace(/\s+/g, "_").toLowerCase(),
          productId: productId,
          name: name,
          price: unit,
          qty: qty,
          image: "/images/flags/" + code + ".png",
          countryCode: code,
          country: countryName,
          packageKey: pkgKey,
          seller: "Vua Proxy",
          sellerSlug: "vuaproxy",
          days: days,
          meta: days + " ngày · x" + qty + (loai ? " · " + loai : "") + (isp ? " · " + isp : "")
        };

        if (window.CartStore && CartStore.write && CartStore.setSelectedIds) {
          CartStore.write([item]);
          CartStore.setSelectedIds([String(item.id)]);
        } else if (typeof window.addToCart === "function") {
          window.addToCart(item);
        }

        function openPay() {
          if (window.VuammoCheckoutModal && VuammoCheckoutModal.open) {
            VuammoCheckoutModal.open({ items: [item] });
            return;
          }
          location.href = "/thanh-toan";
        }

        if (window.VuammoCheckoutModal) {
          openPay();
          return;
        }
        const script = document.createElement("script");
        script.src = "/js/checkout-modal.js?v=20261022wallet1";
        script.onload = openPay;
        script.onerror = function () {
          location.href = "/thanh-toan";
        };
        document.head.appendChild(script);
      });
      recalc();
    });
  }

  function renderMore(currentCode) {
    const el = document.getElementById("lcpMoreGrid");
    if (!el) return;
    const list = locations
      .filter(function (x) { return x.code !== currentCode; })
      .sort(function (a, b) { return b.ips - a.ips; })
      .slice(0, 12);
    el.innerHTML = list.map(function (item) {
      return (
        '<a class="loc-card" href="' + countryHref(item) + '">' +
          '<img class="loc-flag" src="' + flagUrl(item.code) + '" alt="' + item.name + '" width="48" height="48" loading="lazy" onerror="if(!this.dataset.cdn){this.dataset.cdn=1;this.src=\'https://flagcdn.com/w80/' + item.code + '.png\'}">' +
          '<span class="loc-meta"><strong class="loc-name">' + item.name + "</strong>" +
          '<span class="loc-ips">' + fmtIps(item.ips) + " IPs</span></span></a>"
      );
    }).join("");
  }

  function cartoonAvatar(variant) {
    const map = {
      a:
        '<svg class="lcp-cartoon" viewBox="0 0 80 80" aria-hidden="true">' +
        '<rect width="80" height="80" fill="#fde68a"/>' +
        '<ellipse cx="40" cy="72" rx="26" ry="18" fill="#fb7185"/>' +
        '<circle cx="40" cy="38" r="18" fill="#f5c6a5"/>' +
        '<path d="M22 34c2-16 34-16 36 0 0-14-10-24-18-24S22 20 22 34Z" fill="#7c2d12"/>' +
        '<circle cx="33" cy="38" r="2.2" fill="#1f2937"/><circle cx="47" cy="38" r="2.2" fill="#1f2937"/>' +
        '<path d="M35 46c2.5 3 7.5 3 10 0" stroke="#b45309" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
        "</svg>",
      b:
        '<svg class="lcp-cartoon" viewBox="0 0 80 80" aria-hidden="true">' +
        '<rect width="80" height="80" fill="#bfdbfe"/>' +
        '<ellipse cx="40" cy="72" rx="26" ry="18" fill="#2563eb"/>' +
        '<circle cx="40" cy="38" r="18" fill="#e8b892"/>' +
        '<path d="M20 36c3-18 37-18 40 0v-4c0-12-10-20-20-20S20 20 20 32Z" fill="#111827"/>' +
        '<circle cx="33" cy="38" r="2.2" fill="#111827"/><circle cx="47" cy="38" r="2.2" fill="#111827"/>' +
        '<path d="M35 47c2.8 2.4 7.2 2.4 10 0" stroke="#9a3412" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
        "</svg>",
      c:
        '<svg class="lcp-cartoon" viewBox="0 0 80 80" aria-hidden="true">' +
        '<rect width="80" height="80" fill="#ddd6fe"/>' +
        '<ellipse cx="40" cy="72" rx="26" ry="18" fill="#8b5cf6"/>' +
        '<circle cx="40" cy="38" r="18" fill="#f0c4a8"/>' +
        '<path d="M18 34c4-18 40-18 44 0 1-16-12-26-22-26S17 18 18 34Z" fill="#f59e0b"/>' +
        '<circle cx="33" cy="38" r="2.2" fill="#1f2937"/><circle cx="47" cy="38" r="2.2" fill="#1f2937"/>' +
        '<path d="M35 46c2.5 3 7.5 3 10 0" stroke="#b45309" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
        "</svg>",
      you:
        '<svg class="lcp-cartoon" viewBox="0 0 80 80" aria-hidden="true">' +
        '<rect width="80" height="80" fill="#1e293b"/>' +
        '<ellipse cx="40" cy="74" rx="24" ry="16" fill="#0f172a"/>' +
        '<circle cx="40" cy="40" r="17" fill="#cbd5e1"/>' +
        '<path d="M18 34c6-18 38-18 44 0H18Z" fill="#020617"/>' +
        '<path d="M22 28c8-14 28-14 36 0-4-12-12-18-18-18S26 16 22 28Z" fill="#111827"/>' +
        '<rect x="24" y="36" width="32" height="10" rx="5" fill="#020617"/>' +
        '<circle cx="32" cy="41" r="2.4" fill="#38bdf8"/><circle cx="48" cy="41" r="2.4" fill="#38bdf8"/>' +
        '<path d="M36 50h8" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>' +
        "</svg>"
    };
    return map[variant] || map.a;
  }

  function bentoVisual(kind, country) {
    const cc = String(country.code || "us").toUpperCase();
    const flag = String(country.code || "us").toLowerCase();
    const ipsShort = fmtIps(Math.max(80, Math.round((country.ips || 160) / 280)));
    const uid = "lcp" + kind + cc;

    if (kind === "uptime") {
      return (
        '<div class="lcp-viz-panel" aria-hidden="true">' +
        '<div class="lcp-viz lcp-viz--net">' +
        '<svg class="lcp-viz-svg" viewBox="0 0 320 148" fill="none">' +
        '<defs><filter id="' + uid + 'g" x="-80%" y="-80%" width="260%" height="260%">' +
        '<feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
        '<g stroke="rgba(255,255,255,.22)" stroke-width="1">' +
        '<path d="M16 24 H304 M16 48 H304 M16 72 H304 M16 96 H304 M16 120 H304"/>' +
        '<path d="M40 12 V136 M80 12 V136 M120 12 V136 M160 12 V136 M200 12 V136 M240 12 V136 M280 12 V136"/>' +
        "</g>" +
        '<path d="M28 118 L72 86 L120 98 L168 52 L216 70 L268 34" stroke="rgba(255,255,255,.92)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
        '<g fill="rgba(255,255,255,.7)">' +
        '<circle cx="72" cy="86" r="3"/><circle cx="120" cy="98" r="2.5"/><circle cx="216" cy="70" r="2.8"/><circle cx="268" cy="34" r="3"/>' +
        "</g>" +
        '<g class="lcp-node-hot" filter="url(#' + uid + 'g)" transform="translate(168 52)">' +
        '<circle r="12" fill="rgba(255,255,255,.16)"/><circle r="5" fill="#fff"/>' +
        '<path d="M-6.5 -6.5 L6.5 6.5 M6.5 -6.5 L-6.5 6.5" stroke="#05070d" stroke-width="1.8" stroke-linecap="round"/>' +
        "</g></svg>" +
        '<span class="lcp-viz-pill"><span class="lcp-viz-pill-plus">+</span>99% Success</span>' +
        "</div></div>"
      );
    }

    if (kind === "privacy") {
      const tiles = ["a", "b", "you", "c"];
      return (
        '<div class="lcp-viz-panel" aria-hidden="true">' +
        '<div class="lcp-viz lcp-viz--faces">' +
        tiles
          .map(function (v) {
            const you = v === "you";
            return (
              '<span class="lcp-face lcp-face--' + v + (you ? " is-you" : "") + '">' +
              cartoonAvatar(v) +
              (you ? '<em>You</em><span class="lcp-cursor" aria-hidden="true"></span>' : "") +
              "</span>"
            );
          })
          .join("") +
        "</div></div>"
      );
    }

    if (kind === "speed") {
      return (
        '<div class="lcp-viz-panel" aria-hidden="true">' +
        '<div class="lcp-viz lcp-viz--chart">' +
        '<div class="lcp-ping-label"><b>12ms</b> Ping</div>' +
        '<svg class="lcp-viz-svg" viewBox="0 0 320 148" fill="none">' +
        '<defs><linearGradient id="' + uid + 'a" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#fff" stop-opacity=".28"/>' +
        '<stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
        '<g stroke="rgba(255,255,255,.08)" stroke-width="1">' +
        '<path d="M18 30 H302 M18 58 H302 M18 86 H302 M18 114 H302"/>' +
        "</g>" +
        '<path class="lcp-chart-area" d="M18 112 C58 104,78 96,108 88 C138 80,158 70,188 52 C218 34,248 44,302 28 L302 138 L18 138 Z" fill="url(#' + uid + 'a)"/>' +
        '<path class="lcp-chart-line" d="M18 112 C58 104,78 96,108 88 C138 80,158 70,188 52 C218 34,248 44,302 28" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
        '<circle class="lcp-chart-dot" cx="188" cy="52" r="5.5" fill="#fff"/>' +
        "</svg>" +
        '<span class="lcp-flag-float"><img src="/images/flags/' + flag + '.png" alt="" width="14" height="14" loading="lazy" onerror="this.style.display=\'none\'">' + cc + "</span>" +
        "</div></div>"
      );
    }

    if (kind === "ip") {
      return (
        '<div class="lcp-viz-panel lcp-viz-panel--soft" aria-hidden="true">' +
        '<div class="lcp-viz lcp-viz--dash">' +
        '<div class="lcp-dash-left">' +
        '<span class="lcp-dash-kicker">Total Usage</span>' +
        '<strong class="lcp-dash-stat">' + ipsShort + " IPs</strong>" +
        '<div class="lcp-bars" aria-hidden="true">' +
        '<i style="--h:42%"></i><i style="--h:68%"></i><i style="--h:55%"></i><i style="--h:88%"></i><i style="--h:72%"></i><i style="--h:96%"></i><i style="--h:64%"></i>' +
        "</div></div>" +
        '<div class="lcp-dash-toggles">' +
        '<button type="button" tabindex="-1" class="is-on">Total</button>' +
        '<button type="button" tabindex="-1">Refresh</button>' +
        '<button type="button" tabindex="-1">Rotation</button>' +
        "</div></div></div>"
      );
    }

    if (kind === "support") {
      return (
        '<div class="lcp-viz-panel lcp-viz-panel--soft" aria-hidden="true">' +
        '<div class="lcp-viz lcp-viz--support">' +
        '<div class="lcp-support-thread">' +
        '<div class="lcp-support-row">' +
        '<span class="lcp-chat-av">' + cartoonAvatar("a") + "</span>" +
        '<span class="lcp-chat-bubble">Xin chào, cần hỗ trợ proxy ' + cc + "?</span>" +
        "</div>" +
        '<div class="lcp-support-row is-me">' +
        '<span class="lcp-chat-bubble is-me"><span class="lcp-online-dot"></span>Online 24/7 ✓</span>' +
        "</div></div>" +
        '<div class="lcp-support-side">' +
        "<div><b>User A</b><em>24 chats</em></div>" +
        "<div><b>User B</b><em>12 chats</em></div>" +
        '<div class="is-active"><b>You</b><em>Live</em></div>' +
        "</div></div></div>"
      );
    }

    return (
      '<div class="lcp-viz-panel lcp-viz-panel--soft" aria-hidden="true">' +
      '<div class="lcp-viz lcp-viz--price">' +
      '<span class="lcp-price-pill">Từ 8.000đ / IP</span>' +
      '<div class="lcp-price-row">' +
      '<span class="lcp-price-input">Số lượng IP</span>' +
      '<span class="lcp-price-send" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9z"/></svg>' +
      "</span></div>" +
      '<span class="lcp-price-note">Giá tốt · chất lượng ổn định</span>' +
      "</div></div>"
    );
  }

  function renderWhy(country) {
    const name = country.nameVi || country.name;
    const titleEl = document.getElementById("lcpWhyTitle");
    const subEl = document.getElementById("lcpWhySub");
    const bento = document.getElementById("lcpBento");
    if (titleEl) {
      titleEl.textContent = "Tại Sao Nên Chọn Proxy Dân Cư Của Vua Proxy";
    }
    if (subEl) {
      subEl.textContent =
        "Mạng proxy dân cư " + name + " chất lượng cao — khoảng " +
        fmtIps(country.ips) +
        " IP, giao tự động, ổn định cho ads, MMO, SEO và kiểm thử.";
    }
    if (!bento) return;

    const cards = [
      {
        tag: "Tính năng nổi bật",
        tone: "green",
        title: "Quản lý proxy thông minh",
        body:
          "Dễ dàng theo dõi và quản lý proxy " + name + " theo thời gian thực trên dashboard hiện đại. Uptime 99% giúp bạn scale mượt mà.",
        viz: "uptime"
      },
      {
        tag: "Tính năng nổi bật",
        tone: "green",
        title: "Bảo mật hàng đầu",
        body:
          "Bảo vệ hoạt động online với IP dân cư " + name + " thật. Tách phiên, giảm lộ IP gốc — phù hợp antidetect browser.",
        viz: "privacy"
      },
      {
        tag: "Tính năng nổi bật",
        tone: "green",
        title: "Tốc độ & Hiệu năng",
        body:
          "Duy trì hiệu suất cao khi chạy đa phiên tới " + name + ". Ping thấp, ổn định cho tool, game và kiểm thử realtime.",
        viz: "speed"
      },
      {
        tag: "Tính năng nổi bật",
        tone: "green",
        title: "Quản lý IP linh hoạt",
        body:
          "Tự động thay IP, xoay phiên và cấu hình port linh hoạt. HTTP/SOCKS5 giúp duy trì hoạt động liên tục với tỷ lệ thành công cao.",
        viz: "ip"
      },
      {
        tag: "Hỗ trợ",
        tone: "amber",
        title: "Hỗ trợ 24/7",
        body:
          "Đội ngũ Vua Proxy luôn sẵn sàng hỗ trợ kỹ thuật và hướng dẫn gắn proxy " + name + " — kể cả ngày lễ.",
        viz: "support"
      },
      {
        tag: "Bảng giá",
        tone: "amber",
        title: "Tối ưu chi phí",
        body:
          "Gói dân cư & datacenter " + name + " giá rõ, mua đúng nhu cầu. Theo dõi đơn hàng dễ dàng — chất lượng ổn định.",
        viz: "price"
      }
    ];

    bento.innerHTML = cards
      .map(function (c) {
        return (
          '<article class="lcp-bento-card">' +
          '<p class="lcp-bento-tag lcp-bento-tag--' + c.tone + '">' + c.tag + "</p>" +
          "<h3>" + c.title + "</h3>" +
          "<p>" + c.body + "</p>" +
          bentoVisual(c.viz, country) +
          "</article>"
        );
      })
      .join("");
  }


  var LCP_REVIEWS = [
    { name: "Minh Anh", handle: "@minh.anh.design", avatar: "/images/reviews/avt01.jpg?v=vn1", text: "Mình hợp tác với Vua Proxy từ lúc mới bắt đầu bán lại, có lãi ngay tháng đầu. Giá sỉ tốt, proxy chạy khỏe, support luôn sẵn sàng." },
    { name: "Trần Anh Tuấn", handle: "@tuan.dev", avatar: "/images/reviews/avt03.jpg?v=vn1", text: "Giá hợp lý mà chất lượng rất tốt. Kết nối nhanh, mượt, support hiểu vấn đề và xử lý cực nhanh — scale scrape nhẹ nhàng hơn." },
    { name: "Lê Đức Minh", handle: "@minh.agency", avatar: "/images/reviews/avt05.jpg?v=vn1", text: "Team lấy combo nhiều quốc gia chạy ads. IP lỗi xử lý nhanh trong bảo hành. Support chuyên nghiệp, không lòng vòng." },
    { name: "Phan Thị Huyền", handle: "@huyen.seller", avatar: "/images/reviews/avt02.jpg?v=vn1", text: "Giá dễ tiếp cận, ping thấp, chạy tool MMO ổn. Thanh toán xong nhận info ngay. Hỗ trợ hướng dẫn rõ từng bước." },
    { name: "Đỗ Văn Nam", handle: "@nam.growth", avatar: "/images/reviews/avt06.jpg?v=vn1", text: "Proxy residential sạch, không bị block sớm như datacenter. Hỏi gì có người support liền — hợp growth cần tốc độ." },
    { name: "Nguyễn Quang Huy", handle: "@huy.freelance", avatar: "/images/reviews/avt07.jpg?v=vn1", text: "Nhắn support lúc muộn vẫn có người trả lời. Proxy ổn định, gắn antidetect rõ ràng. Người mới cũng làm được." },
    { name: "Hoàng Minh Đức", handle: "@duc.buyer", avatar: "/images/reviews/avt08.jpg?v=vn1", text: "Trước dùng chỗ đắt hơn mà không bằng. Gói 30 ngày hợp lý, IP riêng, website chọn quốc gia rõ — chuyển sang Vua Proxy rất đáng." },
    { name: "Trương Hải Yến", handle: "@yen.perf", avatar: "/images/reviews/avt04.jpg?v=vn1", text: "Dùng cho chiến dịch performance hơn nửa năm. Static DE/FR ổn định, bảo hành minh bạch — team yên tâm mở rộng." },
    { name: "Nguyễn Văn Khải", handle: "@khai.shop", avatar: "/images/reviews/avt09.jpg?v=vn1", text: "Tối ưu cả chi phí lẫn hiệu quả. Giao hàng tự động, uptime tốt, gói rõ ràng — gắn bó lâu dài cho shop." },
    { name: "Phương Thảo", handle: "@thaoproxy", avatar: "/images/reviews/avt10.jpg?v=vn1", text: "Giá bán lại hời, support 24/7 nhiệt tình. Proxy residential xoay scale account ổn, ít die." },
    { name: "Hữu Dũng", handle: "@dung.proxy", avatar: "/images/reviews/avt11.jpg?v=vn1", text: "Chuyển sang vì giá tốt mà vẫn sạch. Chạy ads + tool không nghẽn. Support hiểu vấn đề nhanh." },
    { name: "Thanh Hà", handle: "@thanhha.proxy", avatar: "/images/reviews/avt12.jpg?v=vn1", text: "Giá hợp lý mà chất lượng đảm bảo. IP US/UK sạch, gắn antidetect mượt. Support chuyên nghiệp — đáng gắn bó lâu dài." }
  ];

  function reviewInitials(name) {
    return String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map(function (w) { return w[0]; })
      .join("")
      .toUpperCase();
  }

  function reviewCardHtml(r) {
    const initials = reviewInitials(r.name);
    const avatar = r.avatar
      ? '<img class="rm-avatar" src="' + r.avatar + '" alt="" width="44" height="44" loading="lazy">'
      : '<span class="rm-avatar rm-avatar--fallback" aria-hidden="true">' + initials + "</span>";
    return (
      '<article class="rm-card">' +
      '<div class="rm-card-head">' + avatar +
      '<div class="rm-meta"><strong>' + r.name + "</strong><span>" + (r.handle || "") + "</span></div></div>" +
      "<p>" + r.text + "</p></article>"
    );
  }

  function renderReviews() {
    const grid = document.getElementById("lcpReviewsGrid");
    if (!grid) return;
    const cols = Array.prototype.slice.call(grid.querySelectorAll(".reviews-col"));
    if (!cols.length) return;
    const buckets = [[], [], []];
    LCP_REVIEWS.forEach(function (r, i) { buckets[i % 3].push(r); });
    cols.forEach(function (col, idx) {
      const items = buckets[idx].length ? buckets[idx] : LCP_REVIEWS.slice(idx, idx + 4);
      const html = items.map(reviewCardHtml).join("");
      col.innerHTML = '<div class="reviews-col-track">' + html + html + "</div>";
    });
  }

  function seoContent(country) {
    const name = country.nameVi || country.name;
    const nameEn = country.name || name;
    const ips = fmtIps(country.ips);
    const code = String(country.code || "").toUpperCase();

    const articles = [
      {
        h2: "Proxy dân cư " + name + " là gì?",
        body:
          "<p><strong>Proxy dân cư " + name + "</strong> (residential proxy) là IP thật từ nhà mạng / ISP tại " + nameEn +
          ". Khi bạn kết nối qua proxy dân cư " + name + ", website sẽ nhận diện bạn như người dùng thực tại " + name +
          " — tỷ lệ bị chặn thấp hơn datacenter, phù hợp MMO, ads, kiểm thử và nghiên cứu thị trường.</p>" +
          "<p>Tại Vua Proxy, pool proxy dân cư " + name + " gồm khoảng <strong>" + ips + " IP</strong>, giao tự động, hỗ trợ HTTP/SOCKS5, không giới hạn băng thông theo gói.</p>"
      },
      {
        h2: "Proxy datacenter " + name + " là gì?",
        body:
          "<p><strong>Proxy datacenter " + name + "</strong> là IP từ máy chủ đặt tại trung tâm dữ liệu gắn vị trí " + name +
          ". Ưu điểm là tốc độ cao, ổn định, giá rẻ hơn dân cư — phù hợp game, tool tự động, kiểm thử API hoặc tải lớn.</p>" +
          "<p>Bạn có thể chọn <em>dùng chung</em> để tiết kiệm hoặc <em>dùng riêng</em> để giảm chia sẻ IP. Gói datacenter " + name +
          " tại Vua Proxy hỗ trợ tùy chọn số ngày, số lượng và giao ngay sau thanh toán.</p>"
      },
      {
        h2: "Công dụng của Proxy " + name + "?",
        body:
          "<ul>" +
          "<li><strong>Chạy ads / affiliate:</strong> tạo nhiều profile với IP " + name + " sạch, giảm liên kết tài khoản.</li>" +
          "<li><strong>MMO &amp; thương mại điện tử:</strong> đăng ký, quản lý shop, kiểm giá đúng thị trường " + name + ".</li>" +
          "<li><strong>SEO &amp; nghiên cứu:</strong> xem SERP, ads và nội dung địa phương như người dùng tại " + nameEn + ".</li>" +
          "<li><strong>Bảo mật phiên:</strong> tách IP thật, giảm lộ vị trí khi dùng tool hoặc trình duyệt giả lập.</li>" +
          "<li><strong>Kiểm thử sản phẩm:</strong> mô phỏng truy cập từ " + name + " trước khi ra mắt thị trường.</li>" +
          "</ul>"
      },
      {
        h2: "Nên mua Proxy " + name + " ở đâu?",
        body:
          "<p>Chọn nhà cung cấp có <strong>IP sạch</strong>, giao tự động, bảo hành rõ và hỗ trợ nhanh. Vua Proxy cung cấp proxy dân cư &amp; datacenter " +
          name + " với gói linh hoạt (share, datacenter lẻ, gói 100 proxy), thanh toán Xu/ví, dùng ngay sau khi mua.</p>" +
          "<p>Nếu bạn cần IP ổn định cho lâu dài, ưu tiên gói dân cư " + name + "; nếu cần tốc độ và chi phí thấp cho tool/game, chọn datacenter " + name + ".</p>"
      }
    ];

    const faqs = [
      {
        q: "Proxy dân cư " + name + " khác gì proxy datacenter " + name + "?",
        a:
          "Proxy dân cư dùng IP nhà mạng thật tại " + name + ", khó bị phát hiện hơn. Proxy datacenter dùng IP máy chủ, nhanh và rẻ hơn nhưng dễ bị một số nền tảng hạn chế hơn."
      },
      {
        q: "Mua Proxy " + name + " tại Vua Proxy có giao ngay không?",
        a:
          "Có. Sau khi thanh toán thành công, hệ thống giao proxy " + name + " tự động vào đơn hàng / tài khoản của bạn."
      },
      {
        q: "Proxy " + name + " hỗ trợ HTTP và SOCKS5 không?",
        a:
          "Có. Các gói proxy " + name + " tại Vua Proxy cho phép chọn Type HTTP hoặc SOCKS5 khi đặt mua."
      },
      {
        q: "Pool Proxy " + name + " có bao nhiêu IP?",
        a:
          "Hiện pool proxy " + name + " trên Vua Proxy khoảng " + ips + " IP (cập nhật theo nguồn cung). Mã quốc gia: " + code + "."
      },
      {
        q: "Tôi có thể dùng Proxy " + name + " cho AdsPower, Gologin, Multilogin không?",
        a:
          "Được. Điền host/port/user/pass proxy " + name + " vào antidetect browser hoặc tool của bạn — hỗ trợ profile riêng theo từng tài khoản."
      }
    ];

    return { articles: articles, faqs: faqs, name: name, nameEn: nameEn, ips: ips };
  }

  function renderSeo(country) {
    const seo = seoContent(country);
    const titleEl = document.getElementById("lcpSeoTitle");
    const leadEl = document.getElementById("lcpSeoLead");
    const faqTitle = document.getElementById("lcpSeoFaqTitle");
    const articlesEl = document.getElementById("lcpSeoArticles");
    const faqEl = document.getElementById("lcpFaqList");

    if (titleEl) titleEl.textContent = "Tìm hiểu Proxy " + seo.name + " tại Vua Proxy";
    if (leadEl) {
      leadEl.textContent =
        "Giải thích Proxy dân cư " + seo.name + ", Proxy datacenter " + seo.name +
        " và công dụng thực tế — khoảng " + seo.ips + " IP sẵn sàng mua.";
    }
    if (faqTitle) faqTitle.textContent = "Câu hỏi thường gặp về Proxy " + seo.name;

    if (articlesEl) {
      articlesEl.innerHTML = seo.articles
        .map(function (a) {
          return (
            '<article class="lcp-seo-card">' +
            "<h2>" + a.h2 + "</h2>" +
            '<div class="lcp-seo-body">' + a.body + "</div>" +
            "</article>"
          );
        })
        .join("");
    }

    if (faqEl) {
      faqEl.innerHTML = seo.faqs
        .map(function (f, i) {
          return (
            '<details class="lcp-faq-item"' + (i === 0 ? " open" : "") + ">" +
            "<summary>" + f.q + "</summary>" +
            "<div class=\"lcp-faq-a\"><p>" + f.a + "</p></div>" +
            "</details>"
          );
        })
        .join("");
    }

    // JSON-LD FAQ + WebPage for SEO
    var old = document.getElementById("lcpSeoJsonLd");
    if (old) old.remove();
    var script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "lcpSeoJsonLd";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          name: "Mua Proxy " + seo.name + " — Dân cư & Datacenter | Vua Proxy",
          description:
            "Proxy dân cư " + seo.name + " và proxy datacenter " + seo.name +
            ". " + seo.ips + " IP, giao tự động tại Vua Proxy.",
          url: "https://www.vuaproxy.cloud" + countryHref(country),
          inLanguage: "vi"
        },
        {
          "@type": "FAQPage",
          mainEntity: seo.faqs.map(function (f) {
            return {
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a }
            };
          })
        }
      ]
    });
    document.head.appendChild(script);
  }

  function boot() {
    const key = pathKey();
    const country = findCountry(key);
    if (country && country.slug && key === country.code && key !== country.slug) {
      try {
        history.replaceState(null, "", countryHref(country) + (location.search || "") + (location.hash || ""));
      } catch (_) {}
    }
    if (!country) {
      location.replace("/tat-ca-khu-vuc");
      return;
    }

    const page = document.getElementById("locCountryPage");
    if (page) page.hidden = false;

    const nameVi = country.nameVi || country.name;
    const title = "Proxy Dân Cư " + nameVi;
    document.getElementById("docTitle").textContent =
      "Mua Proxy " + nameVi + " — Dân cư & Datacenter | Vua Proxy";
    document.getElementById("docDesc").setAttribute(
      "content",
      "Proxy dân cư " + nameVi + " là gì? Proxy datacenter " + nameVi +
        " là gì? Mua Proxy " + nameVi + " giá tốt tại Vua Proxy — " +
        fmtIps(country.ips) + " IP, giao tự động, HTTP/SOCKS5."
    );
    document.getElementById("docCanonical").setAttribute(
      "href",
      "https://www.vuaproxy.cloud" + countryHref(country)
    );

    document.getElementById("bcCountry").textContent = country.nameVi || country.name || country.code.toUpperCase();
    document.getElementById("lcpTitle").textContent = title;
    document.getElementById("lcpIpLine").textContent = fmtIps(country.ips) + " IP " + nameVi + " cao cấp";
    document.getElementById("lcpFlag").src = flagUrl(country.code);
    document.getElementById("lcpFlag").alt = nameVi;
    bindFlagFallback(document.getElementById("lcpFlag"), country.code);
    document.getElementById("lcpFlagName").textContent = nameVi;
    document.getElementById("lcpFlagIps").textContent = fmtIps(country.ips) + " IPs";
    document.getElementById("lcpPackTitle").textContent = "Proxy Dân Cư " + nameVi + " tại Vua Proxy";

    const grid = document.getElementById("lcpFormGrid");
    if (grid) {
      grid.innerHTML = packageDefs(country).map(function (p) { return formCardHtml(p, country); }).join("");
      wireForms();
    }
    renderWhy(country);
    renderReviews();
    renderSeo(country);
    renderMore(country.code);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
