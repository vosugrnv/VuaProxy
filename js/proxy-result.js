(function () {
  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fromLabeled(text) {
    const host = /Host:\s*(\S+)/i.exec(text);
    const port = /Port:\s*(\d+)/i.exec(text);
    const user = /Username:\s*(\S+)/i.exec(text);
    const pass = /Password:\s*(\S+)/i.exec(text);
    if (!host || !port || !user || !pass) return "";
    return host[1] + ":" + port[1] + ":" + user[1] + ":" + pass[1];
  }

  function parse(order) {
    const note = String(order?.deliveryNote || order?.delivery_note || "");
    const received = Array.isArray(order?.receivedLines) ? order.receivedLines.join("\n") : "";
    const text = note + "\n" + received;
    const lines = [];
    const seen = {};
    function add(line) {
      const value = String(line || "").trim();
      if (!value || seen[value]) return;
      seen[value] = 1;
      lines.push(value);
    }
    text.split(/\n/).forEach((line) => {
      const value = line.trim();
      if (/^[A-Za-z0-9._-]+:\d+:[^:\s]+:\S+$/.test(value)) add(value);
    });
    text.split(/\n\s*\n/).forEach((block) => add(fromLabeled(block)));
    if (!lines.length) add(fromLabeled(text));

    const country = (/Quốc gia:\s*([A-Za-z]{2})/i.exec(text) || [])[1] || (/^([A-Z]{2})\s*\|/m.exec(text) || [])[1] || "";
    const type = /SOCKS5/i.test(text) ? "SOCKS5" : /HTTP/i.test(text) ? "HTTP" : "";
    const days = (/(\d+)\s*ngày/i.exec(text) || [])[1] || "";
    const expiry = (/hết hạn\s+([0-9:]+\s*[0-9/]+)/i.exec(text) || [])[1] || "";
    return { lines, country, type, days, expiry };
  }

  function html(order) {
    const info = parse(order);
    if (!info.lines.length) {
      const note = String(order?.deliveryNote || order?.delivery_note || "");
      if (!note) return "";
      return '<div class="px-result px-result--plain">' + esc(note).replace(/\n/g, "<br>") + "</div>";
    }
    const meta = [
      info.country.toUpperCase(),
      info.type,
      info.days ? info.days + " ngày" : "",
      info.expiry ? "hết hạn " + info.expiry : ""
    ]
      .filter(Boolean)
      .join(" · ");
    const rows = info.lines
      .map(
        (line) =>
          '<div class="px-result-row"><code class="px-result-code">' +
          esc(line) +
          '</code><button type="button" class="px-copy" data-copy-proxy="' +
          esc(line) +
          '">Copy</button></div>'
      )
      .join("");
    const all =
      info.lines.length > 1
        ? '<button type="button" class="px-copy px-copy--all" data-copy-proxy="' +
          esc(info.lines.join("\n")) +
          '">Copy tất cả</button>'
        : "";
    return '<div class="px-result">' + rows + (meta ? '<p class="px-result-meta">' + esc(meta) + "</p>" : "") + all + "</div>";
  }

  function bind(root) {
    (root || document).querySelectorAll("[data-copy-proxy]").forEach((btn) => {
      if (btn.getAttribute("data-bound")) return;
      btn.setAttribute("data-bound", "1");
      btn.addEventListener("click", async () => {
        const value = btn.getAttribute("data-copy-proxy") || "";
        const old = btn.textContent;
        try {
          await navigator.clipboard.writeText(value);
          btn.textContent = "Đã copy";
        } catch (_) {
          btn.textContent = value;
        }
        setTimeout(() => {
          btn.textContent = old;
        }, 1200);
      });
    });
  }

  window.VuaproxyResult = { parse: parse, html: html, bind: bind };
})();
