(function () {
  const locations = window.VUAPROXY_LOCATIONS || [];
  const featuredCodes = window.VUAPROXY_LOCATION_FEATURED || [];
  const tabs = window.VUAPROXY_LOCATION_TABS || [];

  function fmtIps(n) {
    return Number(n || 0).toLocaleString("en-US") + " IPs";
  }

  function flagSrc(code) {
    const c = String(code || "").toLowerCase();
    return "/images/flags/" + c + ".png";
  }
  function flagOnError(img, code) {
    if (!img || img.dataset.cdn) return;
    img.dataset.cdn = "1";
    img.src = "https://flagcdn.com/w80/" + String(code || "").toLowerCase() + ".png";
  }

  function productHref(item) {
    return (window.VUAPROXY_countryHref ? window.VUAPROXY_countryHref(item) : ("/tat-ca-khu-vuc/" + (item.slug || item.code)));
  }

  function cardHtml(item) {
    const code = String(item.code || "").toLowerCase();
    const name = String(item.name || code).replace(/"/g, "&quot;");
    return (
      '<a class="loc-card" href="' + productHref(item) + '" data-region="' + item.region + '">' +
        '<img class="loc-flag" src="' + flagSrc(code) + '" alt="' + name + '" width="48" height="48" loading="lazy" onerror="if(!this.dataset.cdn){this.dataset.cdn=1;this.src=\'https://flagcdn.com/w80/' + code + '.png\'}">' +
        '<span class="loc-meta">' +
          '<strong class="loc-name">' + item.name + "</strong>" +
          '<span class="loc-ips">' + fmtIps(item.ips) + "</span>" +
        "</span>" +
      "</a>"
    );
  }

  function renderFeatured() {
    const el = document.getElementById("locFeatured");
    if (!el) return;
    const map = Object.create(null);
    locations.forEach(function (x) { map[x.code] = x; });
    el.innerHTML = featuredCodes
      .map(function (code) { return map[code]; })
      .filter(Boolean)
      .map(cardHtml)
      .join("");
  }

  function renderTabs() {
    const el = document.getElementById("locTabs");
    if (!el) return;
    el.innerHTML = tabs
      .map(function (t, i) {
        return (
          '<button type="button" class="loc-tab' + (i === 0 ? " is-active" : "") + '" data-region="' + t.id + '">' +
          t.label +
          "</button>"
        );
      })
      .join("");
  }

  function renderGrid(region) {
    const el = document.getElementById("locGrid");
    if (!el) return;
    const list =
      !region || region === "all"
        ? locations.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
        : locations.filter(function (x) { return x.region === region; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    el.innerHTML = list.map(cardHtml).join("");
    const count = document.getElementById("locCount");
    if (count) count.textContent = list.length + " quốc gia";
  }

  function wireTabs() {
    const el = document.getElementById("locTabs");
    if (!el) return;
    el.addEventListener("click", function (e) {
      const btn = e.target.closest(".loc-tab");
      if (!btn) return;
      el.querySelectorAll(".loc-tab").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      renderGrid(btn.getAttribute("data-region"));
    });
  }

  function boot() {
    renderFeatured();
    renderTabs();
    renderGrid("all");
    wireTabs();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
