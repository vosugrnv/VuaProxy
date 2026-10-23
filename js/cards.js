/* ---------- Shared product card renderer (used by home, category & cart pages) ---------- */
const money = n => n.toLocaleString("vi-VN") + "₫";

function escapeAttr(s){ return String(s || "").replace(/"/g,"&quot;"); }

function shopNameOf(p){
  if(p && p.seller) return String(p.seller).trim();
  return "Vua Proxy";
}

function shopLinkOf(){
  return "/tat-ca-san-pham";
}

function discountBadge(p){
  if(!p.regular || p.regular <= p.price) return "";
  const pct = Math.round(100 - (p.price/p.regular)*100);
  return `<span class="badge-discount">-${pct}%</span>`;
}

function productCard(p){
  const rating = (p.rating && p.rating > 0 ? p.rating : 4.6).toFixed(1).replace(".", ",");
  const href = (typeof productHref === "function")
    ? productHref(p)
    : (typeof productSeoPath === "function")
      ? productSeoPath(p)
      : ("/tat-ca-san-pham/" + (p.slug || slugify(p.name)) + "-" + p.id);
  const shop = shopNameOf(p);
  const seed = (Number(p.id) || 0) * 17 + String(p.name || "").length * 13;
  const soldN = 800 + (seed % 15000);
  const sold = soldN >= 1000
    ? (soldN / 1000).toFixed(1).replace(".", ",") + "k"
    : String(soldN);
  return `
  <div class="product-card">
    ${discountBadge(p)}
    <a class="product-thumb" href="${href}"><img src="${p.image}" alt="${escapeAttr(p.name)}" loading="lazy"></a>
    <div class="product-body">
      <h3><a href="${href}">${p.name}</a></h3>
      <div class="rating"><span class="stars">★★★★★</span> ${rating} · ${sold} đã bán</div>
      <div class="price-row">
        <span class="price-label">Từ</span>
        <span class="price-now">${money(p.price)}</span>
        ${p.regular && p.regular > p.price ? `<span class="price-old">${money(p.regular)}</span>` : ""}
      </div>
      <a class="btn btn-primary" href="${href}">Mua Ngay</a>
    </div>
  </div>`;
}
