/* Shared chat helpers: emoji + upload + render attachment */
(function (global) {
  const EMOJIS = [
    "😀", "😁", "😂", "😊", "😍", "😘", "😎", "🤔", "😅", "😢",
    "😭", "😡", "👍", "👎", "🙏", "👏", "🔥", "❤️", "💯", "✅",
    "❌", "⭐", "🎉", "💪", "🤝", "📌", "📎", "📷", "💬", "🙌"
  ];

  const ICON_SMILE =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01"/><path d="M8.2 14.2a4.2 4.2 0 0 0 7.6 0"/></svg>';
  const ICON_CLIP =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.5V8.8a5.3 5.3 0 0 0-10.6 0v8.2a3.5 3.5 0 0 0 7 0V9.5"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isImageMime(mime) {
    return /^image\//i.test(String(mime || ""));
  }

  /** /uploads on admin.* must load from main storefront origin */
  function absMediaUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
    if (!raw.startsWith("/")) return raw;
    if (window.VUAMMO_SITE_ORIGIN) {
      return String(window.VUAMMO_SITE_ORIGIN).replace(/\/$/, "") + raw;
    }
    const host = String((location && location.hostname) || "");
    if (host.startsWith("admin.")) {
      return "https://" + host.replace(/^admin\./, "") + raw;
    }
    return raw;
  }

  function attachmentHtml(url, name, mime) {
    if (!url) return "";
    const abs = absMediaUrl(url);
    const u = esc(abs);
    const n = esc(name || "Tệp đính kèm");
    if (isImageMime(mime) || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(abs || url)) {
      return (
        '<a class="chat-attach-img-wrap" href="' +
        u +
        '" target="_blank" rel="noopener">' +
        '<img class="chat-attach-img" src="' +
        u +
        '" alt="' +
        n +
        '" loading="lazy"></a>'
      );
    }
    return (
      '<a class="chat-attach-file" href="' +
      u +
      '" target="_blank" rel="noopener" download="' +
      n +
      '">📎 ' +
      n +
      "</a>"
    );
  }

  function messageBodyHtml(msg) {
    const url = msg.attachment_url || msg.attachmentUrl || "";
    const name = msg.attachment_name || msg.attachmentName || "";
    const mime = msg.attachment_mime || msg.attachmentMime || "";
    const text = String(msg.body || msg.text || "");
    const attach = attachmentHtml(url, name, mime);
    const showText =
      text && text !== "[Đã gửi tệp đính kèm]"
        ? '<div class="chat-msg-text">' + esc(text) + "</div>"
        : "";
    return attach + showText;
  }

  async function uploadFile(file) {
    if (!file) throw new Error("Thiếu file");
    if (file.size > 6 * 1024 * 1024) throw new Error("File tối đa 6MB");
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Không đọc được file"));
      reader.readAsDataURL(file);
    });
    const api =
      window.VuammoApi && typeof VuammoApi.api === "function"
        ? (path, opts) => VuammoApi.api(path, opts)
        : (path, opts) =>
            fetch("/api" + path, {
              method: opts.method || "GET",
              headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
              credentials: "include",
              body: opts.body
            }).then(async (r) => {
              const j = await r.json().catch(() => ({}));
              if (!r.ok) throw new Error(j.error || "Upload lỗi");
              return j;
            });
    return api("/chat/upload", {
      method: "POST",
      body: JSON.stringify({ data: dataUrl, filename: file.name || "file.bin" })
    });
  }

  function ensureStyles() {
    const st = document.getElementById("vuammo-chat-media-css") || document.createElement("style");
    st.id = "vuammo-chat-media-css";
    st.textContent =
      ".chat-compose-form{position:relative}" +
      ".chat-compose-tools{display:flex;align-items:center;gap:2px;padding:0 2px 0 6px;flex-shrink:0}" +
      ".chat-tool-btn{appearance:none;border:0;background:transparent;width:36px;height:36px;border-radius:10px;cursor:pointer;color:#64748b;display:inline-flex;align-items:center;justify-content:center;padding:0}" +
      ".chat-tool-btn:hover,.chat-tool-btn.is-active{background:#f1f5f9;color:#0f172a}" +
      ".chat-tool-btn svg{display:block}" +
      ".chat-emoji-pop{display:none;position:absolute;bottom:calc(100% + 8px);left:8px;z-index:50;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 12px 32px rgba(15,23,42,.14);padding:10px;grid-template-columns:repeat(6,1fr);gap:2px;width:248px}" +
      ".chat-emoji-pop.is-open{display:grid}" +
      ".chat-emoji-pop button{appearance:none;border:0;background:transparent;font-size:20px;width:36px;height:36px;border-radius:8px;cursor:pointer;line-height:1}" +
      ".chat-emoji-pop button:hover{background:#f1f5f9}" +
      ".chat-attach-img-wrap{display:block;line-height:0;border-radius:14px;overflow:hidden}" +
      ".chat-attach-img{display:block;width:auto;height:auto;max-width:min(340px,78vw);max-height:420px;object-fit:contain;border-radius:14px;background:#fff}" +
      ".adm-bubble:has(.chat-attach-img-wrap){padding:4px;background:transparent!important}" +
      ".adm-bubble:has(.chat-attach-img-wrap) .chat-msg-text{padding:6px 8px 2px;color:inherit}" +
      ".msg-bubble:has(.chat-attach-img-wrap){padding:4px;background:transparent!important;border:0}" +
      ".chat-attach-file{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:10px;background:rgba(15,23,42,.06);color:inherit;text-decoration:none;font-weight:600;font-size:13px;margin:0 0 6px}" +
      ".adm-bubble.user .chat-attach-file{background:rgba(15,23,42,.08)}" +
      ".adm-bubble.staff .chat-attach-file{background:rgba(255,255,255,.2);color:#fff}" +
      ".msg-bubble--user .chat-attach-file{background:rgba(255,255,255,.18);color:#fff}" +
      ".chat-pending{display:none;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid #eef2f7;background:#f8fafc;font-size:12px;color:#64748b}" +
      ".chat-pending.is-on{display:flex}" +
      ".chat-pending img{width:36px;height:36px;object-fit:cover;border-radius:6px}" +
      ".chat-pending button{border:0;background:#fee2e2;color:#b91c1c;border-radius:6px;padding:4px 8px;cursor:pointer;font:inherit;font-size:12px}";
    if (!st.parentNode) document.head.appendChild(st);
  }

  function wireComposer(opts) {
    ensureStyles();
    const form = opts.form;
    const input = opts.input;
    if (!form || !input || form.dataset.composeWired === "1") return;
    form.dataset.composeWired = "1";
    form.classList.add("chat-compose-form");
    form.style.position = "relative";

    let pending = null;
    const tools = document.createElement("div");
    tools.className = "chat-compose-tools";

    const emojiBtn = document.createElement("button");
    emojiBtn.type = "button";
    emojiBtn.className = "chat-tool-btn";
    emojiBtn.title = "Emoji";
    emojiBtn.setAttribute("aria-label", "Chèn emoji");
    emojiBtn.setAttribute("aria-expanded", "false");
    emojiBtn.innerHTML = ICON_SMILE;

    const fileBtn = document.createElement("label");
    fileBtn.className = "chat-tool-btn";
    fileBtn.title = "Gửi ảnh / file";
    fileBtn.setAttribute("aria-label", "Gửi ảnh hoặc file");
    fileBtn.style.cursor = "pointer";
    fileBtn.innerHTML =
      '<input type="file" hidden accept="image/*,.pdf,.zip,.doc,.docx,.txt,.rar">' + ICON_CLIP;
    const fileInput = fileBtn.querySelector("input");

    tools.appendChild(emojiBtn);
    tools.appendChild(fileBtn);
    if (input.parentNode === form) form.insertBefore(tools, input);

    const pop = document.createElement("div");
    pop.className = "chat-emoji-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Chọn emoji");
    pop.innerHTML = EMOJIS.map((e) => '<button type="button" tabindex="-1">' + e + "</button>").join("");
    form.appendChild(pop);

    const pendingBar = document.createElement("div");
    pendingBar.className = "chat-pending";
    if (form.parentNode) form.parentNode.insertBefore(pendingBar, form);

    function closeEmoji() {
      pop.classList.remove("is-open");
      emojiBtn.classList.remove("is-active");
      emojiBtn.setAttribute("aria-expanded", "false");
    }

    function openEmoji() {
      pop.classList.add("is-open");
      emojiBtn.classList.add("is-active");
      emojiBtn.setAttribute("aria-expanded", "true");
    }

    function setPending(file, previewUrl) {
      pending = { file, previewUrl };
      pendingBar.classList.add("is-on");
      pendingBar.innerHTML =
        (previewUrl ? '<img src="' + esc(previewUrl) + '" alt="">' : "<span>📎</span>") +
        "<span>" +
        esc(file.name) +
        '</span><button type="button">Gỡ</button>';
      pendingBar.querySelector("button").onclick = () => {
        pending = null;
        pendingBar.classList.remove("is-on");
        pendingBar.innerHTML = "";
        fileInput.value = "";
      };
    }

    emojiBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pop.classList.contains("is-open")) closeEmoji();
      else openEmoji();
    });

    pop.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const start = input.selectionStart != null ? input.selectionStart : input.value.length;
        const end = input.selectionEnd != null ? input.selectionEnd : input.value.length;
        const v = input.value;
        input.value = v.slice(0, start) + b.textContent + v.slice(end);
        input.focus();
        const pos = start + String(b.textContent || "").length;
        try {
          input.setSelectionRange(pos, pos);
        } catch (_) {}
        closeEmoji();
      });
    });

    document.addEventListener("click", (e) => {
      if (!pop.classList.contains("is-open")) return;
      if (pop.contains(e.target) || emojiBtn.contains(e.target)) return;
      closeEmoji();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeEmoji();
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) {
        alert("File tối đa 6MB");
        fileInput.value = "";
        return;
      }
      if (/^image\//.test(file.type)) setPending(file, URL.createObjectURL(file));
      else setPending(file, "");
    });

    form.addEventListener(
      "submit",
      async (e) => {
        if (form.dataset.mediaHandling === "1") return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const text = String(input.value || "").trim();
        if (!text && !pending) return;
        form.dataset.mediaHandling = "1";
        closeEmoji();
        try {
          let attachment = null;
          if (pending && pending.file) {
            const up = await uploadFile(pending.file);
            attachment = {
              url: up.url,
              name: up.name || pending.file.name,
              mime: up.mime || pending.file.type || ""
            };
          }
          input.value = "";
          pending = null;
          pendingBar.classList.remove("is-on");
          pendingBar.innerHTML = "";
          fileInput.value = "";
          await opts.onSend({ text, attachment });
        } catch (err) {
          alert(err.message || "Không gửi được");
        } finally {
          form.dataset.mediaHandling = "0";
        }
      },
      true
    );
  }

  global.VuammoChatMedia = {
    EMOJIS,
    esc,
    messageBodyHtml,
    absMediaUrl,
    attachmentHtml,
    uploadFile,
    wireComposer,
    ensureStyles
  };
})(typeof window !== "undefined" ? window : globalThis);
