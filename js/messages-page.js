/* Trang tin nhắn — sidebar phòng chat + khung hội thoại */
(function () {
  const SUPPORT_ID = "vuammo_support";
  const SUPPORT = {
    roomId: SUPPORT_ID,
    channel: "support",
    shopToken: "",
    name: "Vua MMO",
    avatar: "/images/logo-vuammo.png",
    subtitle: "Hỗ trợ sàn · thường trả lời trong vài phút",
    hello: "Xin chào 👋 Bạn cần Vua MMO hỗ trợ gì hôm nay?",
    replies: [
      "Cảm ơn bạn đã nhắn tin! Đội ngũ Vua MMO sẽ phản hồi trong ít phút.",
      "Bạn vui lòng cho mình xin thêm thông tin đơn hàng hoặc sản phẩm nhé.",
      "Vua MMO hỗ trợ 8:00 – 22:00 hàng ngày. Bạn chờ mình chút nhé!"
    ]
  };

  const listEl = document.getElementById("msgThreadList");
  const countEl = document.getElementById("msgThreadCount");
  const emptyEl = document.getElementById("msgEmpty");
  const chatEl = document.getElementById("msgChat");
  const bodyEl = document.getElementById("msgChatBody");
  const formEl = document.getElementById("msgChatForm");
  const inputEl = document.getElementById("msgChatInput");
  const nameEl = document.getElementById("msgChatName");
  const subEl = document.getElementById("msgChatSub");
  const avatarEl = document.getElementById("msgChatAvatar");
  const layoutEl = document.getElementById("msgLayout");
  const backBtn = document.getElementById("msgBackBtn");

  if (!listEl || !chatEl) return;

  /** @type {Record<string, object>} */
  let rooms = {};
  let activeId = "";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function visitorKey() {
    try {
      let k = localStorage.getItem("vuammo_visitor_key");
      if (!k) {
        k = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem("vuammo_visitor_key", k);
      }
      return k;
    } catch (_) {
      return "anon";
    }
  }

  function storageKey(roomId) {
    return "vuammo_chat_room_" + String(roomId || "support");
  }

  function slugifyName(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  /** URL-facing key: /tin-nhan/phuongshop hoặc /tin-nhan/vuammo */
  function roomPublicKey(room) {
    if (!room) return "vuammo";
    if (room.roomId === SUPPORT_ID || room.channel === "support") return "vuammo";
    const token = room.shopToken || String(room.roomId || "").replace(/^shop_/, "");
    if (typeof shopByToken === "function") {
      const shop = shopByToken(token);
      if (shop) return shop.slug || slugifyName(shop.name) || token;
    }
    if (typeof shopBySlug === "function" && room.name) {
      const byName = shopBySlug(slugifyName(room.name));
      if (byName) return byName.slug;
    }
    return slugifyName(room.name) || token || "shop";
  }

  function prettyChatPath(roomOrId) {
    const room =
      typeof roomOrId === "object" && roomOrId
        ? roomOrId
        : rooms[roomOrId] || { roomId: roomOrId };
    const key = roomPublicKey(room);
    return "/tin-nhan/" + encodeURIComponent(key);
  }

  function resolvePeerToRoomId(want) {
    const raw = String(want || "").trim();
    if (!raw) return "";
    const key = decodeURIComponent(raw).replace(/^\/+/, "");
    if (
      !key ||
      key === "vuammo" ||
      key === "support" ||
      key === "vuammo_support" ||
      key === SUPPORT_ID
    ) {
      return SUPPORT_ID;
    }
    if (key.indexOf("shop_") === 0) return key;
    if (typeof shopBySlug === "function") {
      const bySlug = shopBySlug(key);
      if (bySlug) return "shop_" + bySlug.token;
    }
    if (typeof shopByToken === "function") {
      const byTok = shopByToken(key);
      if (byTok) return "shop_" + byTok.token;
    }
    if (window.VUAMMO_SHOPS && Array.isArray(window.VUAMMO_SHOPS)) {
      const hit = window.VUAMMO_SHOPS.find(
        (s) =>
          String(s.slug || "") === key ||
          String(s.name || "").toLowerCase() === key.toLowerCase() ||
          slugifyName(s.name) === key
      );
      if (hit) return "shop_" + hit.token;
    }
    return "shop_" + key;
  }

  function peerFromLocation() {
    const pathMatch = location.pathname.match(/\/tin-nhan\/([^/\?#]+)/i);
    if (pathMatch) return decodeURIComponent(pathMatch[1]);
    const params = new URLSearchParams(location.search);
    return String(params.get("shop") || params.get("room") || params.get("with") || "").trim();
  }

  function shopMeta(token, nameHint) {
    const t = String(token || "").trim();
    let name = String(nameHint || "").trim() || "Shop";
    let avatar = "/images/logo-vuammo.png";
    if (t && typeof shopByToken === "function") {
      const s = shopByToken(t);
      if (s) {
        name = s.name || name;
        avatar =
          typeof shopAvatarUrl === "function"
            ? shopAvatarUrl(s)
            : typeof absAssetUrl === "function"
              ? absAssetUrl(s.avatar || avatar)
              : s.avatar || avatar;
      }
    } else if (typeof absAssetUrl === "function") {
      avatar = absAssetUrl(avatar);
    }
    return { name, avatar };
  }

  function upsertRoom(partial) {
    const id = String(partial.roomId || "").trim();
    if (!id) return null;
    const isShop = id.indexOf("shop_") === 0;
    const token = partial.shopToken || (isShop ? id.replace(/^shop_/, "") : "");
    const meta = isShop ? shopMeta(token, partial.name || partial.shopName) : null;
    const prev = rooms[id] || {};
    rooms[id] = {
      roomId: id,
      channel: partial.channel || (isShop ? "shop" : "support"),
      shopToken: token,
      name: isShop ? meta.name : SUPPORT.name,
      avatar: isShop ? meta.avatar : SUPPORT.avatar,
      subtitle: isShop
        ? "Gian hàng trên Vua MMO"
        : SUPPORT.subtitle,
      hello: isShop
        ? "Xin chào! Bạn đang chat với " + (meta.name || "shop") + ". Hãy gửi câu hỏi của bạn."
        : SUPPORT.hello,
      replies: isShop
        ? [
            "Shop đã nhận tin. Mình check giúp bạn ngay.",
            "Bạn cần hỗ trợ gì thêm ạ?",
            "Cảm ơn bạn đã inbox. Shop phản hồi trong giờ 8:00–22:00."
          ]
        : SUPPORT.replies,
      lastBody: partial.lastBody != null ? partial.lastBody : prev.lastBody || "",
      lastAt: partial.lastAt || prev.lastAt || null,
      msgCount: partial.msgCount != null ? partial.msgCount : prev.msgCount || 0,
      lastRole: partial.lastRole != null ? partial.lastRole : prev.lastRole || "",
      unread: partial.unread != null ? Number(partial.unread) : Number(prev.unread || 0)
    };
    return rooms[id];
  }

  function formatTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString("vi-VN");
    } catch {
      return "";
    }
  }

  function sortedRooms() {
    return Object.values(rooms).sort((a, b) => {
      const ua = Number(a.unread || 0);
      const ub = Number(b.unread || 0);
      if (ub !== ua) return ub - ua;
      const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      if (a.roomId === SUPPORT_ID) return -1;
      if (b.roomId === SUPPORT_ID) return 1;
      return 0;
    });
  }

  function renderList() {
    const list = sortedRooms();
    if (countEl) countEl.textContent = list.length + " hội thoại";
    listEl.innerHTML = list
      .map((r) => {
        const preview = r.lastBody || (r.roomId === SUPPORT_ID ? "Hỗ trợ sàn Vua MMO" : "Chat với shop");
        const on = r.roomId === activeId ? " is-active" : "";
        const unread = Number(r.unread || 0) > 0;
        return (
          '<button type="button" class="msg-thread' +
          on +
          (unread ? " has-unread" : "") +
          '" data-room="' +
          esc(r.roomId) +
          '">' +
          '<img class="msg-thread-avatar" src="' +
          esc(r.avatar) +
          '" alt="">' +
          '<span class="msg-thread-main">' +
          '<span class="msg-thread-name">' +
          esc(r.name) +
          (unread ? ' <span class="msg-unread-dot"></span>' : "") +
          "</span>" +
          '<span class="msg-thread-preview">' +
          esc(String(preview).slice(0, 72)) +
          "</span>" +
          "</span>" +
          '<span class="msg-thread-meta">' +
          (unread ? '<span class="msg-unread-badge">Mới</span>' : "") +
          '<span class="msg-thread-time">' +
          esc(formatTime(r.lastAt)) +
          "</span></span>" +
          "</button>"
        );
      })
      .join("");

    listEl.querySelectorAll("[data-room]").forEach((btn) => {
      btn.addEventListener("click", () => selectRoom(btn.getAttribute("data-room")));
    });
  }

  function appendMsg(text, who, attach) {
    if (!bodyEl) return;
    const el = document.createElement("div");
    el.className = "msg-bubble msg-bubble--" + (who === "user" ? "user" : "bot");
    const msg = {
      body: text || "",
      text: text || "",
      attachment_url: (attach && attach.url) || "",
      attachment_name: (attach && attach.name) || "",
      attachment_mime: (attach && attach.mime) || ""
    };
    if (window.VuammoChatMedia && typeof VuammoChatMedia.messageBodyHtml === "function" && (msg.attachment_url || msg.body)) {
      el.style.whiteSpace = "normal";
      el.innerHTML = VuammoChatMedia.messageBodyHtml(msg);
    } else {
      el.textContent = text || "";
    }
    if (attach && attach.url) {
      el.dataset.attachUrl = attach.url;
      el.dataset.attachName = attach.name || "";
      el.dataset.attachMime = attach.mime || "";
    }
    bodyEl.appendChild(el);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function saveLocal(roomId) {
    if (!bodyEl) return;
    try {
      const list = [...bodyEl.querySelectorAll(".msg-bubble")].map((el) => ({
        who: el.classList.contains("msg-bubble--user") ? "user" : "bot",
        text: el.querySelector(".chat-msg-text")
          ? el.querySelector(".chat-msg-text").textContent || ""
          : el.dataset.attachUrl
            ? ""
            : el.textContent || "",
        attachmentUrl: el.dataset.attachUrl || "",
        attachmentName: el.dataset.attachName || "",
        attachmentMime: el.dataset.attachMime || ""
      }));
      localStorage.setItem(storageKey(roomId), JSON.stringify(list.slice(-80)));
    } catch (_) {}
  }

  function loadLocal(roomId) {
    try {
      const raw = localStorage.getItem(storageKey(roomId));
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list) && list.length) return list;
    } catch (_) {}
    return null;
  }

  async function loadServerMessages(roomId) {
    if (!window.VuammoApi) return null;
    try {
      const data = await VuammoApi.api(
        "/chat/messages?roomId=" +
          encodeURIComponent(roomId) +
          "&visitorKey=" +
          encodeURIComponent(visitorKey())
      );
      const msgs = data.messages || [];
      if (!msgs.length) return null;
      return msgs.map((m) => ({
        who: m.role === "user" ? "user" : "bot",
        text: m.body || "",
        at: m.created_at,
        attachmentUrl: m.attachment_url || "",
        attachmentName: m.attachment_name || "",
        attachmentMime: m.attachment_mime || ""
      }));
    } catch (_) {
      return null;
    }
  }

  async function selectRoom(roomId) {
    const id = String(roomId || "").trim();
    if (!id) return;
    if (!rooms[id]) upsertRoom({ roomId: id });
    activeId = id;
    const room = rooms[id];
    renderList();

    if (emptyEl) emptyEl.hidden = true;
    chatEl.hidden = false;
    if (layoutEl) layoutEl.classList.add("msg-layout--chat");

    if (nameEl) nameEl.textContent = room.name;
    if (subEl) {
      subEl.innerHTML =
        '<span class="chat-online-dot"></span>' + esc(room.subtitle || "");
    }
    if (avatarEl) {
      avatarEl.src = room.avatar || SUPPORT.avatar;
      avatarEl.alt = room.name;
    }

    bodyEl.innerHTML = "";
    const server = await loadServerMessages(id);
    const local = loadLocal(id);
    const msgs = server && server.length ? server : local;
    if (msgs && msgs.length) {
      msgs.forEach((m) =>
        appendMsg(m.text, m.who, {
          url: m.attachmentUrl || "",
          name: m.attachmentName || "",
          mime: m.attachmentMime || ""
        })
      );
      const last = msgs[msgs.length - 1];
      room.lastBody = last.text || (last.attachmentUrl ? "[Đã gửi tệp đính kèm]" : room.lastBody);
      if (last.at) room.lastAt = last.at;
    } else {
      appendMsg(room.hello, "bot");
      saveLocal(id);
    }
    room.unread = 0;
    try {
      if (window.VuammoApi) {
        await VuammoApi.api("/chat/read", {
          method: "POST",
          body: JSON.stringify({
            roomId: id,
            visitorKey: visitorKey()
          })
        });
      }
    } catch (_) {}
    renderList();
    if (inputEl) inputEl.focus();

    const path = prettyChatPath(room);
    const order = new URLSearchParams(location.search).get("order");
    history.replaceState(null, "", path + (order ? "?order=" + encodeURIComponent(order) : ""));
  }

  async function sendMessage(text, attachment) {
    const room = rooms[activeId];
    if (!room) return;
    const hasAttach = !!(attachment && attachment.url);
    if (!text && !hasAttach) return;
    appendMsg(text, "user", attachment || null);
    room.lastBody = text || (hasAttach ? "[Đã gửi tệp đính kèm]" : "");
    room.lastAt = new Date().toISOString();
    saveLocal(activeId);
    renderList();

    try {
      if (window.VuammoApi) {
        await VuammoApi.api("/chat/messages", {
          method: "POST",
          body: JSON.stringify({
            roomId: room.roomId,
            channel: room.channel,
            visitorKey: visitorKey(),
            role: "user",
            body: text || "",
            shopToken: room.shopToken || "",
            shopName: room.channel === "shop" ? room.name : "",
            attachmentUrl: hasAttach ? attachment.url : "",
            attachmentName: hasAttach ? attachment.name || "" : "",
            attachmentMime: hasAttach ? attachment.mime || "" : ""
          })
        });
      }
    } catch (_) {}

    if (hasAttach) return;
    const replies = room.replies || SUPPORT.replies;
    setTimeout(() => {
      if (activeId !== room.roomId) return;
      const reply = replies[Math.floor(Math.random() * replies.length)];
      appendMsg(reply, "bot");
      room.lastBody = reply;
      room.lastAt = new Date().toISOString();
      saveLocal(activeId);
      renderList();
    }, 700);
  }

  function scanLocalRooms() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key.indexOf("vuammo_chat_room_") !== 0) continue;
        const roomId = key.replace("vuammo_chat_room_", "");
        if (!roomId) continue;
        let lastBody = "";
        try {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(list) && list.length) {
            lastBody = list[list.length - 1].text || "";
          }
        } catch (_) {}
        upsertRoom({ roomId, lastBody });
      }
    } catch (_) {}
  }

  async function loadApiThreads() {
    if (!window.VuammoApi) return;
    try {
      const data = await VuammoApi.api(
        "/chat/threads/mine?visitorKey=" + encodeURIComponent(visitorKey())
      );
      (data.threads || []).forEach((t) => {
        upsertRoom({
          roomId: t.roomId,
          channel: t.channel,
          shopToken: t.shopToken,
          shopName: t.shopName,
          lastBody: t.lastBody,
          lastAt: t.lastAt,
          msgCount: t.msgCount,
          lastRole: t.lastRole || "",
          unread: Number(t.unread || 0)
        });
      });
    } catch (_) {}
  }

  async function loadOrderShops() {
    if (!window.VuammoApi) return;
    try {
      const data = await VuammoApi.api("/orders");
      (data.orders || []).forEach((o) => {
        const token = String(o.shopToken || "").trim();
        if (!token) return;
        upsertRoom({
          roomId: "shop_" + token,
          channel: "shop",
          shopToken: token,
          shopName: o.shopName || "",
          lastBody: o.lastBody || "Đơn #" + (o.code || "")
        });
      });
    } catch (_) {}
  }

  if (window.VuammoChatMedia && formEl && inputEl) {
    VuammoChatMedia.wireComposer({
      form: formEl,
      input: inputEl,
      onSend: async ({ text, attachment }) => {
        if (!activeId) return;
        await sendMessage(text, attachment);
      }
    });
  } else {
    formEl?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = (inputEl && inputEl.value.trim()) || "";
      if (!text || !activeId) return;
      inputEl.value = "";
      sendMessage(text);
    });
  }

  backBtn?.addEventListener("click", () => {
    if (layoutEl) layoutEl.classList.remove("msg-layout--chat");
    chatEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    activeId = "";
    history.replaceState(null, "", "/tin-nhan");
    renderList();
  });

  async function boot() {
    const nextPath = "/tin-nhan" + (location.search || "");
    if (window.VuammoAuth) {
      try {
        await VuammoAuth.refreshMe();
      } catch (_) {}
      if (!VuammoAuth.requireLogin(nextPath)) return;
    } else if (!window.VuammoApi) {
      location.href = "/tai-khoan?next=" + encodeURIComponent(nextPath);
      return;
    } else {
      try {
        await VuammoApi.api("/auth/me");
      } catch {
        location.href = "/tai-khoan?next=" + encodeURIComponent(nextPath);
        return;
      }
    }

    upsertRoom(SUPPORT);
    scanLocalRooms();
    await Promise.all([loadApiThreads(), loadOrderShops()]);

    const params = new URLSearchParams(location.search);
    const want = peerFromLocation();
    const orderCode = String(params.get("order") || "").trim();
    if (want) {
      const roomId = resolvePeerToRoomId(want);
      const seeded = upsertRoom({ roomId });
      if (orderCode && seeded && seeded.channel === "shop") {
        seeded.hello =
          "Xin chào! Bạn đang chat với " +
          seeded.name +
          " về đơn #" +
          orderCode +
          ". Hãy mô tả vấn đề hoặc câu hỏi của bạn.";
        seeded.subtitle = "Chat về đơn #" + orderCode + " · gian hàng trên Vua MMO";
      }
      renderList();
      await selectRoom(roomId);
    } else {
      renderList();
    }
  }

  boot();
})();
