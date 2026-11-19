/* Check Proxy — UI giống checkproxy.vip, gọi API Vua Proxy */
(function () {
  const POLL_MS = 1000;
  let checking = false;

  const ICO = {
    file:
      '<svg class="cp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    globe:
      '<svg class="cp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    list:
      '<svg class="cp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    check:
      '<svg class="cp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12l5 5L20 7"/></svg>',
    copy:
      '<svg class="cp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    desktop:
      '<svg class="cp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    shield:
      '<svg class="cp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/></svg>'
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function api(path, options) {
    if (window.VuammoApi && typeof VuammoApi.api === "function") {
      return VuammoApi.api(path, options || {});
    }
    return fetch("/api" + path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      ...(options || {})
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
      return data;
    });
  }

  function toast(msg) {
    if (window.VuammoApi && VuammoApi.showToast) VuammoApi.showToast(msg);
    else alert(msg);
  }

  function updateProxyCount() {
    const n = document
      .getElementById("proxyList")
      .value.split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean).length;
    const label = document.querySelector('label[for="proxyList"]');
    if (label) label.innerHTML = ICO.list + " Proxy List (" + n + ")";
  }

  async function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).value || "";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      toast("Đã copy");
    } catch (_) {
      toast("Không copy được");
    }
  }

  function setProgress(done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("progressText").textContent = done + " / " + total + " (" + pct + "%)";
  }

  async function checkProxies() {
    if (checking) return;
    const proxyList = document
      .getElementById("proxyList")
      .value.split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!proxyList.length) {
      toast("Chưa nhập proxy nào");
      return;
    }

    const format = document.getElementById("proxyFormat").value;
    const type = document.getElementById("proxyType").value;
    const btn = document.getElementById("checkButton");
    checking = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="cp-spin" aria-hidden="true"></span> Checking...';
    document.getElementById("progressBar").style.display = "block";

    const activeProxies = [];
    const inactiveProxies = [];
    const resultTable = document.getElementById("resultTable");
    resultTable.innerHTML = "";

    const frag = document.createDocumentFragment();
    proxyList.forEach((proxy, i) => {
      const tr = document.createElement("tr");
      tr.id = "proxy-row-" + i;
      tr.innerHTML =
        "<td>" +
        (i + 1) +
        "</td><td>" +
        esc(proxy) +
        "</td><td>-</td>" +
        '<td><span class="status-pending">Pending...</span></td><td>-</td>';
      frag.appendChild(tr);
    });
    resultTable.appendChild(frag);
    setProgress(0, proxyList.length);

    try {
      const sub = await api("/proxy-check/submit", {
        method: "POST",
        body: JSON.stringify({ proxies: proxyList, format, type })
      });

      (sub.invalid || []).forEach((b) => {
        const row = document.getElementById("proxy-row-" + b.id);
        if (row) row.cells[3].innerHTML = '<span class="status-error">Sai định dạng</span>';
      });

      const jobId = sub.job_id;
      const total = sub.total;
      let after = 0;

      while (true) {
        const data = await api(
          "/proxy-check/result?job=" +
            encodeURIComponent(jobId) +
            "&after=" +
            after +
            "&limit=5000"
        );

        for (const r of data.results || []) {
          const row = document.getElementById("proxy-row-" + r.id);
          if (!row) continue;
          const proxy = proxyList[r.id];
          row.cells[2].textContent = r.ip || "-";
          row.cells[3].innerHTML = r.live
            ? '<span class="status-live">✔️ live</span>'
            : '<span class="status-die">❌ die</span>';
          row.cells[4].textContent = r.live
            ? String(r.protocol || "-").toUpperCase()
            : "-";
          if (r.live) activeProxies.push(proxy);
          else inactiveProxies.push(proxy);
        }

        if ((data.results || []).length) {
          document.getElementById("activeProxies").value = activeProxies.join("\n");
          document.getElementById("inactiveProxies").value = inactiveProxies.join("\n");
          document.querySelector(".active-proxy").innerHTML =
            ICO.desktop + " Active Proxies (" + activeProxies.length + ")";
          document.querySelector(".inactive-proxy").innerHTML =
            ICO.desktop + " Inactive Proxies (" + inactiveProxies.length + ")";
        }

        after = data.next;
        setProgress(data.done, total);
        if (data.finished && after >= data.done) break;
        if (!(data.results || []).length) await new Promise((r) => setTimeout(r, POLL_MS));
      }

      setProgress(total, total);
      document.getElementById("progressText").textContent +=
        "  —  live " + activeProxies.length + ", die " + inactiveProxies.length;
    } catch (err) {
      document.getElementById("progressText").textContent = "Lỗi: " + (err.message || err);
      toast(err.message || "Không kiểm tra được");
    } finally {
      checking = false;
      btn.disabled = false;
      btn.innerHTML = ICO.check + " Check";
    }
  }

  function paintIcons() {
    const map = [
      ['label[for="proxyFormat"]', ICO.file + " Proxy Format"],
      ['label[for="proxyType"]', ICO.globe + " Proxy Type"],
      ['label[for="proxyList"]', ICO.list + " Proxy List (0)"],
      [".active-proxy", ICO.desktop + " Active Proxies (0)"],
      [".inactive-proxy", ICO.desktop + " Inactive Proxies (0)"],
      [".cp-results h2", ICO.shield + " Proxy Check Results"]
    ];
    map.forEach(([sel, html]) => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    });
    const checkBtn = document.getElementById("checkButton");
    if (checkBtn) checkBtn.innerHTML = ICO.check + " Check";
    document.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.innerHTML = ICO.copy + " Copy";
    });
  }

  function boot() {
    paintIcons();
    document.getElementById("proxyList")?.addEventListener("input", updateProxyCount);
    document.getElementById("checkButton")?.addEventListener("click", checkProxies);
    document.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => copyToClipboard(btn.getAttribute("data-copy")));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
