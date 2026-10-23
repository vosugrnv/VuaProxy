/* Load published blog from API into SHARE_POSTS (optional).
   Vua Proxy storefront dùng nội dung tĩnh trong chia-se-data.js — không ghi đè bằng CMS cũ (AI). */
(function () {
  function apiBase() {
    try {
      if (window.VuammoApi && VuammoApi.apiBase) return VuammoApi.apiBase().replace(/\/$/, "");
      if (window.VuammoApi && VuammoApi.base) return VuammoApi.base.replace(/\/$/, "");
    } catch (_) {}
    return "/api";
  }

  if (window.VUAPROXY_BLOG_STATIC) {
    window.VuammoBlogReady = Promise.resolve([]);
    return;
  }

  window.VuammoBlogReady = fetch(apiBase() + "/blog", { credentials: "same-origin" })
    .then(function (r) {
      return r.ok ? r.json() : { items: [] };
    })
    .then(function (data) {
      var items = (data && data.items) || [];
      if (!items.length || typeof SHARE_POSTS === "undefined") return items;
      SHARE_POSTS.splice.apply(SHARE_POSTS, [0, SHARE_POSTS.length].concat(items));
      if (typeof window !== "undefined") window.SHARE_POSTS = SHARE_POSTS;
      return items;
    })
    .catch(function () {
      return [];
    });
})();
