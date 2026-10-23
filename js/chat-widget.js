/* Chat widget — Vua Proxy support vs phòng chat từng shop */
(function () {
  const fab = document.getElementById("chatFabBtn");
  const panel = document.getElementById("chatPanel");
  const closeBtn = document.getElementById("chatCloseBtn");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const messages = document.getElementById("chatMessages");
  const badge = document.getElementById("chatFabBadge");
  const titleEl = document.querySelector(".chat-panel-title");
  const subEl = document.querySelector(".chat-panel-sub");
  const avatarEl = document.querySelector(".chat-panel-header .chat-avatar");
  if (!fab || !panel) return;

  const SUPPORT = {
    id: "vuammo_support",
    name: "Vua Proxy",
    avatar: "/images/icon-vuaproxy.png?v=20260915logo1",
    subtitle: "Hỗ trợ đơn proxy · thường trả lời trong vài phút",
    hello: "",
    replies: []
  };

  let mode = SUPPORT;
  let persistKey = "vuammo_chat_v1_support";

  function visitorKey() {
    try {
      const u =
        window.VuammoAuth && typeof VuammoAuth.getUser === "function"
          ? VuammoAuth.getUser()
          : null;
      if (u && u.id) {
        const uidKey = "u_" + String(u.id);
        try {
          localStorage.setItem("vuammo_visitor_key", uidKey);
        } catch (_) {}
        return uidKey;
      }
      let k = localStorage.getItem("vuammo_visitor_key");
      if (!k || String(k).indexOf("u_") === 0) {
        k =
          "v_" +
          Math.random().toString(36).slice(2) +
          Date.now().toString(36);
        localStorage.setItem("vuammo_visitor_key", k);
      }
      return k;
    } catch (_) {
      return "anon";
    }
  }

  function channelOf() {
    return mode.id === SUPPORT.id ? "support" : "shop";
  }

  function syncServer(text, who) {
    const role = who === "user" ? "user" : channelOf() === "support" ? "support" : "shop";
    const payload = {
      roomId: mode.id,
      channel: channelOf(),
      visitorKey: visitorKey(),
      role: who === "user" ? "user" : role,
      body: text,
      shopToken: mode.id.indexOf("shop_") === 0 ? mode.id.replace(/^shop_/, "") : "",
      shopName: mode.id === SUPPORT.id ? "" : mode.name || ""
    };
    try {
      if (window.VuammoApi && typeof VuammoApi.api === "function") {
        VuammoApi.api("/chat/messages", {
          method: "POST",
          body: JSON.stringify(payload)
        }).catch(function () {});
      } else {
        fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        }).catch(function () {});
      }
    } catch (_) {}
  }

  function shopModeFromEl(el) {
    const token = el.getAttribute("data-shop-token") || "";
    const name = el.getAttribute("data-shop-name") || "Shop";
    const rawAvatar = el.getAttribute("data-shop-avatar") || "/images/logo-vuaproxy.png?v=20260915logo1";
    const avatar = typeof absAssetUrl === "function" ? absAssetUrl(rawAvatar) : (rawAvatar.charAt(0) === "/" || /^https?:/i.test(rawAvatar) ? rawAvatar : "/" + rawAvatar);
    const room = el.getAttribute("data-shop-room") || ("shop_" + (token || name));
    return {
      id: room,
      name: name,
      avatar: avatar,
      subtitle: "Chat trực tiếp với shop · gian hàng trên Vua Proxy",
      hello: "",
      replies: []
    };
  }

  function storageKey(roomId) {
    return "vuammo_chat_room_" + String(roomId || "support");
  }

  function applyHeader() {
    if (titleEl) titleEl.textContent = mode.name;
    if (subEl) {
      subEl.innerHTML =
        '<span class="chat-online-dot"></span>' +
        (mode.subtitle || "Thường trả lời trong vài phút");
    }
    if (avatarEl) {
      avatarEl.src = mode.avatar || SUPPORT.avatar;
      avatarEl.alt = mode.name;
    }
    if (fab) {
      fab.setAttribute(
        "aria-label",
        mode.id === SUPPORT.id ? "Chat trực tiếp với Vua Proxy" : "Chat trực tiếp với shop " + mode.name
      );
      fab.classList.toggle("chat-fab--shop", mode.id !== SUPPORT.id);
    }
  }

  function clearMessages() {
    if (!messages) return;
    messages.innerHTML = "";
  }

  function appendMsg(text, who) {
    if (!messages) return;
    const el = document.createElement("div");
    el.className = "chat-msg chat-msg-" + (who === "user" ? "user" : "bot");
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function loadHistory() {
    clearMessages();
    try {
      const raw = localStorage.getItem(persistKey);
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list) && list.length) {
        list.forEach((m) => appendMsg(m.text, m.who));
        return;
      }
    } catch (_) {}
    // Tắt chat tự động — không chèn lời chào bot; chờ admin/shop trả lời thật.
  }

  function saveHistory() {
    if (!messages) return;
    try {
      const list = [...messages.querySelectorAll(".chat-msg")].map((el) => ({
        who: el.classList.contains("chat-msg-user") ? "user" : "bot",
        text: el.textContent || ""
      }));
      localStorage.setItem(persistKey, JSON.stringify(list.slice(-80)));
    } catch (_) {}
  }

  function openPanel() {
    applyHeader();
    loadHistory();
    panel.hidden = false;
    if (badge) {
      badge.style.display = "none";
      badge.textContent = "";
    }
    try {
      localStorage.setItem("vuammo_chat_fab_seen", "1");
    } catch (_) {}
    try {
      if (window.VuammoApi) {
        VuammoApi.api("/chat/read", {
          method: "POST",
          body: JSON.stringify({
            roomId: mode.id,
            visitorKey: visitorKey()
          })
        }).catch(function () {});
      }
    } catch (_) {}
    if (input) input.focus();
    let inbox = panel.querySelector(".chat-inbox-link");
    if (!inbox) {
      inbox = document.createElement("a");
      inbox.className = "chat-inbox-link";
      inbox.href = "/tin-nhan";
      inbox.textContent = "Mở hộp thư →";
      const header = panel.querySelector(".chat-panel-header");
      if (header) header.insertAdjacentElement("afterend", inbox);
    }
    if (mode.id === SUPPORT.id) inbox.href = "/tin-nhan/vuaproxy";
    else inbox.href = shopChatUrl(mode);
  }

  function closePanel() {
    panel.hidden = true;
  }

  function requireChatLogin(nextPath) {
    const next = nextPath || location.pathname + location.search || "/";
    const auth = window.VuammoAuth;
    if (auth && typeof auth.requireLogin === "function") {
      const run = function () {
        return !!auth.requireLogin(next);
      };
      if (typeof auth.refreshMe === "function") {
        return Promise.resolve(auth.refreshMe())
          .catch(function () {})
          .then(run);
      }
      return Promise.resolve(run());
    }
    if (!window.VuammoApi || !VuammoApi.getToken()) {
      location.href = "/tai-khoan?next=" + encodeURIComponent(next);
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }

  function openSupport() {
    requireChatLogin(location.pathname + location.search || "/").then(function (ok) {
      if (!ok) return;
      mode = SUPPORT;
      persistKey = storageKey(SUPPORT.id);
      openPanel();
    });
  }

  function openShopChat(cfg) {
    requireChatLogin(location.pathname + location.search || "/").then(function (ok) {
      if (!ok) return;
      mode = cfg || SUPPORT;
      const shops =
        (window.VUAMMO_SHOPS && Array.isArray(window.VUAMMO_SHOPS) && window.VUAMMO_SHOPS) ||
        (window.ShopsData && Array.isArray(window.ShopsData) && window.ShopsData) ||
        [];
      if (shops.length && mode.id && mode.id.indexOf("shop_") === 0) {
        const token = mode.id.replace(/^shop_/, "");
        const found = shops.find(
          (s) => String(s.token || s.id || "") === token || String(s.slug || "") === token
        );
        if (found) {
          if (found.avatar && (!mode.avatar || mode.avatar.indexOf("logo-vuammo") >= 0)) {
            mode.avatar = found.avatar;
          }
          if (found.name && mode.name === "Shop") mode.name = found.name;
        }
      }
      persistKey = storageKey(mode.id);
      openPanel();
    });
  }

  try {
    if (new URLSearchParams(location.search).get("openChat") === "1") {
      setTimeout(function () {
        fab.click();
      }, 400);
    }
  } catch (_) {}

  fab.addEventListener("click", function () {
    // FAB luôn là kênh Vua Proxy (hỗ trợ sàn) — bắt buộc đăng nhập
    requireChatLogin(location.pathname + location.search || "/").then(function (ok) {
      if (!ok) return;
      if (panel.hidden) {
        mode = SUPPORT;
        persistKey = storageKey(SUPPORT.id);
        openPanel();
      } else if (mode.id !== SUPPORT.id) {
        mode = SUPPORT;
        persistKey = storageKey(SUPPORT.id);
        openPanel();
      } else closePanel();
    });
  });
  if (closeBtn) closeBtn.addEventListener("click", closePanel);

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const text = (input && input.value.trim()) || "";
      if (!text) return;
      appendMsg(text, "user");
      if (input) input.value = "";
      saveHistory();
      syncServer(text, "user");
      // Không auto-reply mỗi tin — chỉ chào 1 lần (loadHistory). Admin trả lời thật.
    });
  }

  function shopChatUrl(cfg) {
    const room = (cfg && cfg.id) || SUPPORT.id;
    if (room === SUPPORT.id) return "/tin-nhan/vuaproxy";
    const token = String(room).replace(/^shop_/, "");
    let slug = token;
    try {
      if (typeof shopByToken === "function") {
        const s = shopByToken(token);
        if (s && (s.slug || s.name)) slug = s.slug || s.name;
      }
    } catch (_) {}
    return "/tin-nhan/" + encodeURIComponent(slug);
  }

  function goShopInbox(el) {
    const cfg = shopModeFromEl(el);
    const next = shopChatUrl(cfg);
    const auth = window.VuammoAuth;
    if (auth && typeof auth.requireLogin === "function") {
      const run = function () {
        if (!auth.requireLogin(next)) return;
        location.href = next;
      };
      if (typeof auth.refreshMe === "function") {
        Promise.resolve(auth.refreshMe())
          .catch(function () {})
          .then(run);
        return;
      }
      run();
      return;
    }
    if (!window.VuammoApi || !VuammoApi.getToken()) {
      location.href = "/tai-khoan?next=" + encodeURIComponent(next);
      return;
    }
    location.href = next;
  }

  document.addEventListener("click", function (e) {
    const shopTrigger = e.target.closest(".js-open-shop-chat");
    if (shopTrigger) {
      e.preventDefault();
      goShopInbox(shopTrigger);
      return;
    }
    const supportTrigger = e.target.closest(".js-open-chat");
    if (supportTrigger) {
      e.preventDefault();
      openSupport();
    }
  });

  window.VuammoChat = {
    openSupport,
    openShop: openShopChat,
    openShopInbox: goShopInbox,
    close: closePanel
  };

  // Badge FAB: ẩn mặc định nếu đã mở; chỉ hiện khi có tin chưa đọc
  (async function syncFabBadge() {
    if (!badge) return;
    try {
      if (localStorage.getItem("vuammo_chat_fab_seen") === "1") {
        badge.style.display = "none";
      }
    } catch (_) {}
    if (!window.VuammoApi) {
      if (!badge.style.display) badge.style.display = "none";
      return;
    }
    try {
      const data = await VuammoApi.api(
        "/chat/threads/mine?visitorKey=" + encodeURIComponent(visitorKey())
      );
      const unread = (data.threads || []).reduce((n, t) => n + Number(t.unread || 0), 0);
      if (unread > 0) {
        badge.textContent = unread > 99 ? "99+" : String(unread);
        badge.style.display = "";
      } else {
        badge.textContent = "";
        badge.style.display = "none";
      }
    } catch (_) {
      badge.style.display = "none";
    }
  })();
})();
