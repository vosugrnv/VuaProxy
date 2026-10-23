/* Vua Proxy — single brand shop stub (no multi-vendor marketplace) */
const VUAMMO_SHOPS = [
  {
    id: 1,
    name: "Vua Proxy",
    slug: "vua-proxy",
    token: "vuaproxy",
    city: "Hà Nội",
    district: "Cầu Giấy",
    rating: 4.9,
    joinedYear: 2024,
    bio: "Vua Proxy cung cấp proxy tĩnh IPv4 và proxy xoay residential đa quốc gia — giao nhanh, bảo hành rõ ràng.",
    avatar: "/images/icon-vuaproxy.png?v=20260915logo1",
    chatRoomId: "shop_vuaproxy"
  }
];

function absAssetUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "/images/icon-vuaproxy.png?v=20260915logo1";
  if (/^(https?:|data:|blob:|\/)/i.test(s)) return s;
  return "/" + s.replace(/^\.\//, "");
}
VUAMMO_SHOPS.forEach((shop) => {
  if (shop && shop.avatar) shop.avatar = absAssetUrl(shop.avatar);
});
function shopByToken(token) {
  if (!token) return null;
  return VUAMMO_SHOPS.find((s) => s.token === String(token)) || null;
}
function shopBySlug(slug) {
  if (!slug) return null;
  return VUAMMO_SHOPS.find((s) => s.slug === String(slug)) || null;
}
function shopByName(name) {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  return VUAMMO_SHOPS.find((s) => s.name.toLowerCase() === n) || null;
}
function shopHref() {
  return "/tat-ca-san-pham";
}
function shopAvatarUrl(shop) {
  if (!shop) return "/images/icon-vuaproxy.png?v=20260915logo1";
  return absAssetUrl(shop.avatar || "/images/icon-vuaproxy.png?v=20260915logo1");
}
function productsOfShop(shop) {
  if (!shop || typeof RAW_PRODUCTS === "undefined") return [];
  return RAW_PRODUCTS.filter(
    (p) => p.sellerToken === shop.token || String(p.seller || "") === shop.name
  );
}

if (typeof window !== "undefined") {
  window.VUAMMO_SHOPS = VUAMMO_SHOPS;
  window.absAssetUrl = absAssetUrl;
  window.shopAvatarUrl = shopAvatarUrl;
}
