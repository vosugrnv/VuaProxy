/* Mega menu danh mục proxy — kiểu 3 tab + khu vực + quốc gia */
(function initProxyMegaMenu() {
  const tax = typeof CATEGORY_TAXONOMY !== "undefined" ? CATEGORY_TAXONOMY : null;
  const regionMap = typeof PROXY_MEGA_REGIONS !== "undefined" ? PROXY_MEGA_REGIONS : {};
  if (!tax || !tax.mega || !tax.mega.length) return;

  function flagUrl(code) {
    const c = String(code || "un").toLowerCase();
    return "/images/flags/" + c + ".png";
  }
  function flagImgHtml(code, name) {
    const c = String(code || "un").toLowerCase();
    const label = String(name || c).replace(/"/g, "&quot;");
    return (
      '<img src="' +
      flagUrl(c) +
      '" alt="' +
      label +
      '" width="20" height="20" loading="lazy" onerror="if(!this.dataset.cdn){this.dataset.cdn=1;this.src=\'https://flagcdn.com/w40/' +
      c +
      '.png\'}">'
    );
  }

  function regionIconSvg(kind) {
    const icons = {
      asia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
      eu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>',
      am: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3c-2 3-4 5-4 9a4 4 0 0 0 8 0c0-4-2-6-4-9z"/><path d="M8 20h8"/></svg>',
      af: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M5 7h14M7 12h10M9 17h6"/></svg>',
      oc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 16c3-1 5 1 8 0s5-2 8-1"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="8" r="2.5"/></svg>',
      mmo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v4M12 3a7 7 0 0 1 7 7c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 7-7z"/></svg>',
      vn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4z"/></svg>'
    };
    return icons[kind] || icons.asia;
  }

  function typeIconSvg(slug) {
    if (slug === "proxy-datacenter") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="10" width="18" height="5" rx="1"/><rect x="3" y="16" width="18" height="5" rx="1"/><circle cx="7" cy="6.5" r=".8" fill="currentColor"/><circle cx="7" cy="12.5" r=".8" fill="currentColor"/><circle cx="7" cy="18.5" r=".8" fill="currentColor"/></svg>';
    }
    if (slug === "proxy-dan-cu-viet-nam") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21V9"/><path d="M8 9h8"/><path d="M6 21h12"/><path d="M12 3l2 4h-4l2-4z"/><path d="M9 6c-2 1-3 3-3 5"/><path d="M15 6c2 1 3 3 3 5"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 18a5 5 0 0 1 1-9.9A6 6 0 0 1 19 11a4 4 0 0 1 0 8H7z"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/></svg>';
  }

  function getRegionsForType(type) {
    const list = [];
    (type.regionKeys || []).forEach((key) => {
      if (type.customRegions && type.customRegions[key]) list.push(type.customRegions[key]);
      else if (regionMap[key]) list.push(regionMap[key]);
    });
    return list;
  }

  function countryHref(_typeSlug, country) {
    if (window.VUAPROXY_countryHref) return window.VUAPROXY_countryHref(country);
    const seg = String((country && (country.slug || country.code)) || "")
      .toLowerCase()
      .trim();
    if (seg) return "/tat-ca-khu-vuc/" + encodeURIComponent(seg);
    return "/tat-ca-khu-vuc";
  }

  let root = document.getElementById("proxyMegaMenu");
  if (!root) {
    root = document.createElement("div");
    root.id = "proxyMegaMenu";
    root.className = "proxy-mega";
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.appendChild(root);
  }

  let activeType = tax.mega[0].slug;
  let activeRegion = null;
  let scrollSpyLock = false;
  let scrollSpyTimer = 0;

  function countryCardsHtml(typeSlug, countries) {
    return (countries || [])
      .map((c) => {
        return (
          '<a class="proxy-mega-country" href="' +
          countryHref(typeSlug, c) +
          '">' +
          flagImgHtml(c.code, c.name) +
          "<span>" +
          c.name +
          "</span>" +
          "</a>"
        );
      })
      .join("");
  }

  function getSectionScrollTop(main, section) {
    return main.scrollTop + (section.getBoundingClientRect().top - main.getBoundingClientRect().top);
  }

  function setActiveRegionTab(slug) {
    if (!slug) return;
    activeRegion = slug;
    root.querySelectorAll(".proxy-mega-region").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-region") === slug);
    });
  }

  function syncActiveFromScroll(main) {
    if (!main || scrollSpyLock) return;
    const sections = Array.from(main.querySelectorAll("[data-region-section]"));
    if (!sections.length) return;
    const head = main.querySelector(".proxy-mega-main-head");
    const probeY = main.getBoundingClientRect().top + (head ? head.offsetHeight : 0) + 20;
    let current = sections[0].getAttribute("data-region-section");
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= probeY) {
        current = sections[i].getAttribute("data-region-section");
      } else break;
    }
    if (current) setActiveRegionTab(current);
  }

  function wireScrollSpy() {
    const main = root.querySelector(".proxy-mega-main");
    if (!main || main.dataset.spy === "1") return;
    main.dataset.spy = "1";
    main.addEventListener(
      "scroll",
      () => {
        syncActiveFromScroll(main);
      },
      { passive: true }
    );
  }

  function scrollToRegion(slug) {
    const main = root.querySelector(".proxy-mega-main");
    const section = root.querySelector('[data-region-section="' + slug + '"]');
    if (!main || !section) return;
    scrollSpyLock = true;
    setActiveRegionTab(slug);
    const head = main.querySelector(".proxy-mega-main-head");
    const headH = head ? head.offsetHeight + 6 : 6;
    const top = Math.max(0, getSectionScrollTop(main, section) - headH);
    main.scrollTo({ top: top, behavior: "smooth" });
    window.clearTimeout(scrollSpyTimer);
    scrollSpyTimer = window.setTimeout(() => {
      scrollSpyLock = false;
      setActiveRegionTab(slug);
    }, 700);
  }

  function render() {
    const type = tax.mega.find((t) => t.slug === activeType) || tax.mega[0];
    const regions = getRegionsForType(type);
    if (!activeRegion || !regions.some((r) => r.slug === activeRegion)) {
      activeRegion = regions[0] ? regions[0].slug : null;
    }

    const tabs = tax.mega
      .map((t) => {
        const on = t.slug === type.slug ? " is-active" : "";
        return (
          '<button type="button" class="proxy-mega-tab' +
          on +
          '" data-type="' +
          t.slug +
          '">' +
          '<span class="proxy-mega-tab-ic" aria-hidden="true">' +
          typeIconSvg(t.slug) +
          "</span>" +
          "<span>" +
          t.title +
          "</span>" +
          '<span class="proxy-mega-caret" aria-hidden="true"></span>' +
          "</button>"
        );
      })
      .join("");

    const side = regions
      .map((r) => {
        const on = r.slug === activeRegion ? " is-active" : "";
        return (
          '<button type="button" class="proxy-mega-region' +
          on +
          '" data-region="' +
          r.slug +
          '">' +
          '<span class="proxy-mega-region-ic" aria-hidden="true">' +
          regionIconSvg(r.icon) +
          "</span>" +
          "<span>" +
          r.title +
          "</span>" +
          '<span class="proxy-mega-chevron" aria-hidden="true">›</span>' +
          "</button>"
        );
      })
      .join("");

    const sections = regions
      .map((r) => {
        return (
          '<section class="proxy-mega-section" data-region-section="' +
          r.slug +
          '" id="mega-region-' +
          r.slug +
          '">' +
          '<h3 class="proxy-mega-section-title">' +
          r.title +
          " · " +
          ((r.countries && r.countries.length) || 0) +
          " quốc gia</h3>" +
          '<div class="proxy-mega-grid">' +
          countryCardsHtml(type.slug, r.countries) +
          "</div></section>"
        );
      })
      .join("");

    root.innerHTML =
      '<div class="proxy-mega-panel" role="dialog" aria-label="Danh mục proxy">' +
      '<div class="proxy-mega-tabs">' +
      tabs +
      '<a class="proxy-mega-all" href="/tat-ca-khu-vuc">Xem tất cả quốc gia →</a>' +
      "</div>" +
      '<div class="proxy-mega-body">' +
      '<aside class="proxy-mega-side">' +
      '<p class="proxy-mega-side-label">Khu vực</p>' +
      '<div class="proxy-mega-side-list">' +
      side +
      "</div></aside>" +
      '<div class="proxy-mega-main">' +
      '<div class="proxy-mega-main-head">' +
      "<strong>" +
      (type.panelTitle || type.title) +
      "</strong>" +
      '<a href="/tat-ca-khu-vuc">Xem tất cả quốc gia</a>' +
      "</div>" +
      '<div class="proxy-mega-scroll-body">' +
      sections +
      "</div></div></div></div>";

    const main = root.querySelector(".proxy-mega-main");
    if (main) main.scrollTop = 0;
    setActiveRegionTab(activeRegion || (regions[0] && regions[0].slug));
    // wait a frame so layout/height is ready
    window.requestAnimationFrame(() => wireScrollSpy());
  }

  function syncTriggerExpanded(on) {
    document.querySelectorAll("#navAllProxy, .nav-all-proxy").forEach((el) => {
      el.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  function open() {
    render();
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.classList.add("is-open");
    document.documentElement.classList.add("proxy-mega-open");
    syncTriggerExpanded(true);
  }

  function close() {
    root.classList.remove("is-open");
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("proxy-mega-open");
    syncTriggerExpanded(false);
  }

  function toggle() {
    if (root.classList.contains("is-open")) close();
    else open();
  }

  root.addEventListener("click", (e) => {
    // Giữ dropdown khi đổi tab: không để click bubble ra document (render() gỡ node làm closest fail)
    e.stopPropagation();
    // Click nền mờ (ngoài panel) → đóng
    if (!e.target.closest(".proxy-mega-panel")) {
      close();
      return;
    }
    const typeBtn = e.target.closest("[data-type]");
    if (typeBtn) {
      e.preventDefault();
      activeType = typeBtn.getAttribute("data-type");
      activeRegion = null;
      render();
      return;
    }
    const regionBtn = e.target.closest("[data-region]");
    if (regionBtn) {
      e.preventDefault();
      const slug = regionBtn.getAttribute("data-region");
      if (slug) scrollToRegion(slug);
    }
  });

  document.addEventListener("click", (e) => {
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    const insideMega = path.includes(root) || !!(e.target && e.target.closest && e.target.closest("#proxyMegaMenu"));

    const allProxy = e.target.closest("#navAllProxy, .nav-all-proxy");
    if (allProxy) {
      e.preventDefault();
      e.stopPropagation();
      if (window.matchMedia("(max-width:699px)").matches) {
        close();
        location.href = "/tat-ca-khu-vuc";
        return;
      }
      toggle();
      return;
    }

    // Nút Tất cả danh mục → drawer (không mở mega)
    const catBtn = e.target.closest("#catMenuBtn");
    if (catBtn) {
      close();
      return;
    }

    if (root.classList.contains("is-open") && !insideMega && !e.target.closest("#navAllProxy") && !e.target.closest(".nav-all-proxy")) {
      close();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  function relabelBtn() {
    const btn = document.getElementById("navAllProxy");
    if (!btn) return;
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", root.classList.contains("is-open") ? "true" : "false");
    const cat = document.getElementById("catMenuBtn");
    if (cat) {
      const label = cat.querySelector("span:not(.cat-menu-icon)");
      if (label) label.textContent = "Tất cả danh mục";
    }
  }
  relabelBtn();
  document.addEventListener("vuammo:header", relabelBtn);

  window.VuaProxyMega = {
    open,
    close,
    toggle,
    render,
    openType(typeSlug) {
      if (typeSlug) activeType = typeSlug;
      activeRegion = null;
      open();
    }
  };

  // Mobile drawer: giữ menu gọn (site-header lo canonical). Không nhét cây danh mục dài.
  const drawer = document.getElementById("drawer");
  if (drawer) {
    const inner = drawer.querySelector(".drawer-inner");
    if (inner && !inner.dataset.proxyMega && !inner.dataset.vuammoDrawer) {
      inner.dataset.proxyMega = "1";
    }
  }
})();
