/* Side promo rails — CapCut (trái) + Netflix (phải), fixed theo màn hình rộng */
(function () {
  if (document.getElementById("sidePromoRails")) return;

  const path = String(location.pathname || "");
  if (/\/(admin|tin-nhan|thanh-toan)(\/|$)/i.test(path)) return;
  /* Country pages: full-bleed dark sections — side rails che tiêu đề */
  if (/\/tat-ca-khu-vuc\/[a-z0-9-]+\/?$/i.test(path)) return;
  /* Dark LoHa-style hero occupies full first viewport — hide rails on that page */
  if (document.getElementById("heroDark")) return;

  if (!document.getElementById("sidePromoRailsCss")) {
    const style = document.createElement("style");
    style.id = "sidePromoRailsCss";
    style.textContent = `
.side-promo-rails{display:none;pointer-events:none}
.side-promo-rails.is-visible{display:block}
.side-promo{
  position:fixed;top:calc(50% + 72px);transform:translateY(-50%);
  width:251px;height:min(78vh,640px);
  z-index:28;pointer-events:auto;
  display:flex;flex-direction:column;
  border-radius:16px;overflow:hidden;
  background:#fff;border:none;box-shadow:none;
  text-decoration:none;color:inherit;
  transition:transform .2s ease;
}
.side-promo:hover{transform:translateY(calc(-50% - 4px))}
.side-promo--left{left:max(68px, calc(60px + (100vw - 1222px - 60px) / 2 - 271px))}
.side-promo--right{right:max(12px, calc((100vw - 1222px - 60px) / 2 - 271px))}
.side-promo-ad{
  position:relative;flex:1 1 auto;min-height:0;
  display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  gap:12px;padding:16px 14px 14px;overflow:hidden;
}
.side-promo-ad::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.45;
  background:
    radial-gradient(120% 80% at 10% 0%, rgba(255,255,255,.22), transparent 55%),
    radial-gradient(90% 70% at 100% 100%, rgba(255,255,255,.12), transparent 50%);
}
.side-promo--capcut .side-promo-ad{
  background:linear-gradient(165deg,#5b21b6 0%,#db2777 48%,#06b6d4 100%);
}
.side-promo--netflix .side-promo-ad{
  background:linear-gradient(165deg,#450a0a 0%,#9f1239 42%,#1c1917 100%);
}
.side-promo-ad > *{position:relative;z-index:1}
.side-promo-kicker{
  align-self:stretch;display:flex;align-items:center;justify-content:space-between;gap:8px;
}
.side-promo-tag{
  display:inline-flex;align-items:center;height:24px;padding:0 10px;
  border-radius:999px;background:rgba(255,255,255,.22);color:#fff;
  font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  backdrop-filter:blur(6px);
}
.side-promo-tag--hot{background:#fff;color:#e11d48}
.side-promo-headline{
  margin:0;text-align:center;color:#fff;
  font-family:Manrope,system-ui,sans-serif;
  font-size:15px;font-weight:800;line-height:1.3;
  text-shadow:0 2px 10px rgba(0,0,0,.25);
}
.side-promo-shot{
  width:min(100%,210px);aspect-ratio:1/1;flex:0 0 auto;
  border-radius:18px;overflow:hidden;
  background:rgba(255,255,255,.12);
  box-shadow:0 10px 28px rgba(0,0,0,.28);
}
.side-promo--capcut .side-promo-shot{
  border-radius:50%;
  background:#000;
  box-shadow:0 10px 28px rgba(0,0,0,.35),inset 0 0 0 2px rgba(255,255,255,.12);
}
.side-promo-shot img{
  width:100%;height:100%;object-fit:cover;object-position:center;display:block;
}
.side-promo--capcut .side-promo-shot img{
  object-fit:cover;transform:scale(1.12);filter:none;
}
.side-promo-pitch{
  text-align:center;color:rgba(255,255,255,.95);
  font-size:12px;font-weight:700;line-height:1.4;
}
.side-promo-pitch strong{display:block;margin-top:2px;font-size:18px;font-weight:800}
.side-promo-body{
  display:flex;flex-direction:column;gap:4px;
  padding:14px 14px 16px;background:#fff;flex:0 0 auto;
}
.side-promo-title{
  font-family:Manrope,system-ui,sans-serif;
  font-size:16px;font-weight:800;line-height:1.25;color:#1a1220;
}
.side-promo-shop{
  font-size:12px;font-weight:700;color:#6b7280;line-height:1.3;
}
.side-promo-shop::before{
  content:"";display:inline-block;width:8px;height:8px;margin-right:6px;
  border-radius:50%;background:#22c55e;vertical-align:middle;
}
.side-promo-sub{font-size:13px;color:#7a6b74;line-height:1.35}
.side-promo-price{
  margin-top:4px;font-size:20px;font-weight:800;color:#e11d48;
}
.side-promo-cta{
  margin-top:10px;display:inline-flex;align-items:center;justify-content:center;
  height:38px;border-radius:10px;background:#e11d48;color:#fff;
  font-size:14px;font-weight:700;letter-spacing:.02em;
}
@media (max-width:1839px){
  .side-promo-rails,.side-promo-rails.is-visible{display:none!important}
}
@media (min-width:1840px) and (max-width:1999px){
  .side-promo{width:224px;height:min(78vh,580px)}
  .side-promo--left{left:max(68px, calc(60px + (100vw - 1222px - 60px) / 2 - 244px))}
  .side-promo--right{right:max(12px, calc((100vw - 1222px - 60px) / 2 - 244px))}
  .side-promo-shot{width:min(100%,186px)}
}
`;
    document.head.appendChild(style);
  }

  const LEFT = {
    theme: "capcut",
    href: "/tat-ca-khu-vuc/proxy-my",
    title: "Proxy Mỹ",
    shop: "Vua Proxy",
    sub: "Residential & Datacenter",
    price: "Từ 10.000₫",
    image: "/images/flags/us.png",
    tag: "Hot",
    hot: "US",
    headline: "Proxy Mỹ\nIP sạch · giao nhanh",
    pitch: "Chỉ từ",
    pitchStrong: "10.000₫"
  };
  const RIGHT = {
    theme: "netflix",
    href: "/tat-ca-khu-vuc",
    title: "Tất cả quốc gia",
    shop: "Vua Proxy",
    sub: "Đa quốc gia",
    price: "Xem gói",
    image: "/images/flags/vn.png",
    tag: "190 nước",
    hot: "NEW",
    headline: "Chọn quốc gia\nmua proxy ngay",
    pitch: "Khám phá",
    pitchStrong: "Tất cả khu vực"
  };

  function card(item, side) {
    const headline = item.headline.split("\n").join("<br>");
    return (
      '<a class="side-promo side-promo--' +
      side +
      " side-promo--" +
      item.theme +
      '" href="' +
      item.href +
      '" title="' +
      item.title +
      '">' +
      '<span class="side-promo-ad">' +
      '<span class="side-promo-kicker">' +
      '<span class="side-promo-tag">' +
      item.tag +
      "</span>" +
      '<span class="side-promo-tag side-promo-tag--hot">' +
      item.hot +
      "</span>" +
      "</span>" +
      '<p class="side-promo-headline">' +
      headline +
      "</p>" +
      '<span class="side-promo-shot"><img src="' +
      item.image +
      '" alt="' +
      item.title +
      '" loading="lazy" width="210" height="210"></span>' +
      '<span class="side-promo-pitch">' +
      item.pitch +
      "<strong>" +
      item.pitchStrong +
      "</strong></span>" +
      "</span>" +
      '<span class="side-promo-body">' +
      '<span class="side-promo-title">' +
      item.title +
      "</span>" +
      '<span class="side-promo-shop">' +
      item.shop +
      "</span>" +
      '<span class="side-promo-sub">' +
      item.sub +
      "</span>" +
      '<span class="side-promo-price">' +
      item.price +
      "</span>" +
      '<span class="side-promo-cta">Mua ngay</span>' +
      "</span></a>"
    );
  }

  const wrap = document.createElement("div");
  wrap.id = "sidePromoRails";
  wrap.className = "side-promo-rails";
  wrap.innerHTML = card(LEFT, "left") + card(RIGHT, "right");
  document.body.appendChild(wrap);

  function syncVisibility() {
    const wide = window.matchMedia("(min-width: 1840px)").matches;
    wrap.classList.toggle("is-visible", wide);
  }
  syncVisibility();
  window.addEventListener("resize", syncVisibility, { passive: true });
})();
