const IMAGE_BY_NAME = {};
RAW_PRODUCTS.forEach(p => { IMAGE_BY_NAME[p.name] = p.image; });
function imageFor(name){ return IMAGE_BY_NAME[name] || RAW_PRODUCTS[0].image; }

function hay(p){ return (p.name + " " + (p.cats || []).join(" ")).toLowerCase(); }
function hasCat(p, re){ return (p.cats || []).some(c => re.test(String(c))); }

const BRAND_RE = /(luna|9proxy|proxy|residential|ipv4|ipv6|viet\s*nam|vietnam)/i;

const CAT = {
  proxy: p => hasCat(p, /^proxy$/i) || /\bproxy\b/i.test(hay(p)),
  luna: p => hasCat(p, /luna/i) || /luna/i.test(hay(p)),
  nine: p => hasCat(p, /9\s*proxy|9proxy/i) || /9\s*proxy|9proxy/i.test(hay(p)),
  vn: p => /việt\s*nam|vietnam|\bvn\b/i.test(hay(p)),
  residential: p => /residential|dân\s*cư/i.test(hay(p)),
  khac: p => !CAT.luna(p) && !CAT.nine(p),
};

/** Key dùng để tránh trùng loại (CapCut + CapCut) trong cùng một mục */
function productTypeKey(p){
  const leaf = (p.cats || [])
    .map(c => String(c).trim())
    .filter(c => c && !/^(tài khoản|sản phẩm bán chạy|sản phẩm|uncategorized|chưa phân loại|tài khoản khác)$/i.test(c));
  if(leaf.length) return leaf[leaf.length - 1].toLowerCase();
  const m = String(p.name || "").match(BRAND_RE);
  if(m) return m[1].toLowerCase();
  return (typeof slugify === "function" ? slugify(p.name) : String(p.name || "").toLowerCase())
    .split("-").slice(0, 3).join("-") || String(p.id);
}

function scoreHome(p){
  let s = 0;
  if(p.rating >= 4) s += 40 + p.rating * 8;
  if(typeof p.stock === "number" && p.stock > 0) s += 15;
  if(p.regular > p.price) s += 12;
  if((p.cats || []).some(c => /bán chạy/i.test(c))) s += 25;
  return s;
}

/** Lấy sản phẩm CSV theo mục, ưu tiên điểm cao, mỗi loại chỉ 1 sản phẩm */
function pickDiverse(pool, limit){
  const sorted = [...pool].sort((a, b) => scoreHome(b) - scoreHome(a) || a.price - b.price);
  const out = [];
  const seen = new Set();
  for(const p of sorted){
    const key = productTypeKey(p);
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if(out.length >= limit) return out;
  }
  for(const p of sorted){
    if(out.includes(p)) continue;
    out.push(p);
    if(out.length >= limit) break;
  }
  return out;
}

function productIsSelling(p){
  if(!p) return false;
  if(!p.id || !p.slug) return false;
  if(typeof isBlockedProduct === "function" && isBlockedProduct(p)) return false;
  if(p.inStock === false) return false;
  if(typeof p.stock === "number" && p.stock <= 0) return false;
  return true;
}

/** Cùng nguồn với trang Tất cả sản phẩm — chỉ SP đang bán, có đường dẫn SEO. */
function sellingPool(){
  return RAW_PRODUCTS.filter(productIsSelling);
}

const REVIEWS = [
  {
    name: "Minh Anh",
    handle: "@minh.anh.design",
    avatar: "images/reviews/avt01.jpg?v=vn1",
    text: "Mình hợp tác với Vua Proxy từ lúc mới bắt đầu bán lại, và có lãi ngay từ tháng đầu tiên. Giá sỉ tốt nên mình bán lại vẫn lời ổn. Proxy chạy khỏe, support thì luôn sẵn sàng, không bao giờ phải chờ lâu."
  },
  {
    name: "Trần Anh Tuấn",
    handle: "@tuan.dev",
    avatar: "images/reviews/avt03.jpg?v=vn1",
    text: "Mình từng thử nhiều nơi rồi, nhưng Vua Proxy đúng là hiếm có: giá hợp lý mà chất lượng vẫn rất tốt. Kết nối nhanh, mượt, support hiểu vấn đề và giải quyết cực nhanh. Nhờ vậy mình scale scrape và tool nhẹ nhàng hơn hẳn."
  },
  {
    name: "Lê Đức Minh",
    handle: "@minh.agency",
    avatar: "images/reviews/avt05.jpg?v=vn1",
    text: "Team mình lấy combo nhiều quốc gia để chạy ads và tool. Quản lý gói rõ ràng, IP lỗi được xử lý nhanh trong bảo hành. Support rất chuyên nghiệp, giải quyết vấn đề nhanh, không lòng vòng — yên tâm dùng lâu dài."
  },
  {
    name: "Phan Thị Huyền",
    handle: "@huyen.seller",
    avatar: "images/reviews/avt02.jpg?v=vn1",
    text: "Giá cực dễ tiếp cận, lúc đầu mình chỉ test thử vài IP static SG, giờ thì dùng hằng ngày luôn. Ping thấp, chạy tool MMO ổn, thanh toán xong nhận info ngay. Đội ngũ hỗ trợ thân thiện và hướng dẫn rõ từng bước."
  },
  {
    name: "Đỗ Văn Nam",
    handle: "@nam.growth",
    avatar: "images/reviews/avt06.jpg?v=vn1",
    text: "Bên này giá tốt nhưng chất lượng rất xịn. Proxy xoay residential JP nhanh và sạch, không bị block sớm như datacenter. Hỏi gì là có người support liền. Rất hợp để làm growth và các dự án cần tốc độ cao."
  },
  {
    name: "Nguyễn Quang Huy",
    handle: "@huy.freelance",
    avatar: "images/reviews/avt07.jpg?v=vn1",
    text: "Mình thử nhắn support lúc khá muộn mà vẫn có người hỗ trợ ngay, bất ngờ thật sự. Proxy ổn định, hướng dẫn gắn vào trình duyệt và antidetect rõ ràng. Người mới cũng làm được, không bị bỏ mặc."
  },
  {
    name: "Hoàng Minh Đức",
    handle: "@duc.buyer",
    avatar: "images/reviews/avt08.jpg?v=vn1",
    text: "Trước mình dùng dịch vụ đắt hơn mà không bằng ở đây. Gói 30 ngày hợp lý, IP riêng không share, tốc độ ổn để chạy ads. Website mua dễ, chọn quốc gia rõ ràng — thật sự là lựa chọn sáng suốt khi chuyển sang Vua Proxy."
  },
  {
    name: "Trương Hải Yến",
    handle: "@yen.perf",
    avatar: "images/reviews/avt04.jpg?v=vn1",
    text: "Mình đã dùng Vua Proxy cho nhiều chiến dịch performance hơn nửa năm nay. Static DE/FR cực kỳ ổn định, tốc độ nhanh và hiếm khi gặp sự cố. Bảo hành minh bạch nên team rất yên tâm mở rộng thêm gói."
  },
  {
    name: "Nguyễn Văn Khải",
    handle: "@khai.shop",
    avatar: "images/reviews/avt09.jpg?v=vn1",
    text: "Mình thấy Vua Proxy đúng là giải pháp tối ưu cả về chi phí lẫn hiệu quả. Hệ thống giao hàng tự động, tốc độ nhanh và quan trọng nhất là uptime tốt. Giá và gói rõ ràng — rất đáng để gắn bó lâu dài cho shop."
  },
  {
    name: "Phương Thảo",
    handle: "@thaoproxy",
    avatar: "images/reviews/avt10.jpg?v=vn1",
    text: "Giá bán lại bên này quá hời luôn, mình đang kiếm ổn hơn so với chỗ cũ. Support 24/7 thì nhiệt tình khỏi bàn, hỗ trợ từng bước lúc mình mới bắt đầu. Proxy residential xoay scale account ổn, ít die — rất đáng hợp tác lâu dài."
  },
  {
    name: "Hữu Dũng",
    handle: "@dung.proxy",
    avatar: "images/reviews/avt11.jpg?v=vn1",
    text: "Mình chuyển sang Vua Proxy vì giá tốt mà vẫn sạch. Chạy ads và tool song song không bị nghẽn, kết nối mượt. Support hiểu vấn đề nhanh, không phải giải thích đi giải thích lại. Nhờ vậy team scale công việc nhẹ nhàng hơn."
  },
  {
    name: "Thanh Hà",
    handle: "@thanhha.proxy",
    avatar: "images/reviews/avt12.jpg?v=vn1",
    text: "Làm proxy mấy năm rồi, mình khẳng định đây là nơi hiếm hoi có giá hợp lý mà chất lượng vẫn đảm bảo. IP US/UK sạch, gắn antidetect browser mượt. Support chuyên nghiệp, giải quyết nhanh — đáng để gắn bó lâu dài cho cả team."
  },
];

function reviewInitials(name){
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map(w => w[0])
    .join("")
    .toUpperCase();
}

function reviewMarqueeCard(r){
  const initials = reviewInitials(r.name);
  const avatar = r.avatar
    ? `<img class="rm-avatar" src="${r.avatar}" alt="" width="44" height="44" loading="lazy" decoding="async">`
    : `<span class="rm-avatar rm-avatar--fallback" aria-hidden="true">${initials}</span>`;
  return `
  <article class="rm-card">
    <div class="rm-card-head">
      ${avatar}
      <div class="rm-meta">
        <strong>${r.name}</strong>
        <span>${r.handle || ""}</span>
      </div>
    </div>
    <p>${r.text}</p>
  </article>`;
}

function renderReviewsMarquee(){
  const grid = document.getElementById("reviewsMarqueeGrid");
  if(!grid) return;
  const cols = [...grid.querySelectorAll(".reviews-col")];
  if(!cols.length) return;
  const buckets = [[], [], []];
  REVIEWS.forEach((r, i) => buckets[i % 3].push(r));
  cols.forEach((col, idx) => {
    const items = buckets[idx].length ? buckets[idx] : REVIEWS.slice(idx, idx + 4);
    const html = items.map(reviewMarqueeCard).join("");
    col.innerHTML = `<div class="reviews-col-track">${html}${html}</div>`;
  });

  const section = grid.closest(".reviews-marquee") || grid;
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      const on = !!(entries[0] && entries[0].isIntersecting);
      section.classList.toggle("is-paused", !on);
    }, { rootMargin: "80px 0px", threshold: 0.02 });
    io.observe(section);
  }
}
renderReviewsMarquee();


/* ---------- Hero slider ---------- */
(function initHeroSlider(){
  const root = document.getElementById("heroSlider");
  if(!root) return;
  const slides = [...root.querySelectorAll(".hero-slide")];
  const dotsWrap = document.getElementById("heroDots");
  const prevBtn = document.getElementById("heroPrev");
  const nextBtn = document.getElementById("heroNext");
  if(!slides.length) return;

  let index = 0;
  let timer = null;
  const INTERVAL = 5000;

  dotsWrap.innerHTML = slides.map((_,i)=>`<button type="button" aria-label="Slide ${i+1}" ${i===0?"class=\"active\"":""}></button>`).join("");
  const dots = [...dotsWrap.querySelectorAll("button")];

  function goTo(i){
    index = (i + slides.length) % slides.length;
    slides.forEach((s,n)=>s.classList.toggle("is-active", n===index));
    dots.forEach((d,n)=>d.classList.toggle("active", n===index));
  }
  function next(){ goTo(index+1); }
  function prev(){ goTo(index-1); }
  function start(){ stop(); timer = setInterval(next, INTERVAL); }
  function stop(){ if(timer) clearInterval(timer); timer = null; }

  nextBtn?.addEventListener("click", ()=>{ next(); start(); });
  prevBtn?.addEventListener("click", ()=>{ prev(); start(); });
  dots.forEach((d,i)=>d.addEventListener("click", ()=>{ goTo(i); start(); }));
  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  start();
})();

/* ---------- Render ---------- */
document.documentElement.classList.add("js-ready");
const HOME_QUICK = (() => {
  const pool = sellingPool().filter(p => typeof p.stock === "number" && p.stock > 0);
  return pickDiverse(pool.length ? pool : sellingPool(), 25);
})();

let quickExpanded = false;
function renderQuick(){
  const el = document.getElementById("quickPicks");
  if(!el) return;
  const items = quickExpanded ? HOME_QUICK : HOME_QUICK.slice(0,10);
  el.className = "card-grid";
  el.innerHTML = items.map(productCard).join("");
}
renderQuick();
document.getElementById("seeMoreBtn") && (document.getElementById("seeMoreBtn").textContent = `Xem thêm (${Math.max(0, HOME_QUICK.length-10)})`);
document.getElementById("seeMoreBtn")?.addEventListener("click", ()=>{
  quickExpanded = true;
  renderQuick();
});
document.getElementById("seeLessBtn")?.addEventListener("click", ()=>{
  quickExpanded = false;
  renderQuick();
  document.getElementById("quickPicks")?.scrollIntoView({behavior:"smooth", block:"start"});
});

const aiProducts = pickDiverse(sellingPool().filter(CAT.proxy), 10);
const aiGrid = document.getElementById("aiGrid");
if (aiGrid) aiGrid.innerHTML = aiProducts.map(productCard).join("");

const bestList = pickDiverse(sellingPool(), 50);
const PAGE_SIZE = 10;
let currentPage = 1;
function renderBest(){
  const grid = document.getElementById("bestGrid");
  if (!grid) return;
  const start = (currentPage-1)*PAGE_SIZE;
  const items = bestList.slice(start, start+PAGE_SIZE);
  grid.innerHTML = items.map(productCard).join("");
  renderPagination();
}
function renderPagination(){
  const el = document.getElementById("pagination");
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(bestList.length/PAGE_SIZE));
  let html = "";
  const maxShown = 6;
  for(let i=1;i<=Math.min(maxShown,totalPages);i++){
    html += `<button class="${i===currentPage?"active":""}" onclick="goPage(${i})">${i}</button>`;
  }
  if(totalPages > maxShown){
    html += `<span>…</span>`;
    for(let i=totalPages-1;i<=totalPages;i++){
      html += `<button class="${i===currentPage?"active":""}" onclick="goPage(${i})">${i}</button>`;
    }
  }
  html += `<button onclick="goPage(${Math.min(currentPage+1,totalPages)})">→</button>`;
  el.innerHTML = html;
}
window.goPage = p => {
  currentPage = p;
  renderBest();
  document.getElementById("bestseller")?.scrollIntoView({behavior:"smooth"});
};
renderBest();

/* ---------- Interactions ---------- */
window.toggleWish = (btn) => {
  if (!btn) return;
  const item = {
    id: btn.dataset.wishId || btn.getAttribute("data-wish-id"),
    name: btn.dataset.wishName || "",
    price: Number(btn.dataset.wishPrice || 0),
    regular: btn.dataset.wishRegular ? Number(btn.dataset.wishRegular) : null,
    image: btn.dataset.wishImage || "",
    seller: btn.dataset.wishSeller || "",
    rating: btn.dataset.wishRating ? Number(btn.dataset.wishRating) : 0
  };
  if (!item.id) return;

  if (!window.WishStore) {
    const KEY = "vuammo_wish_v1";
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(list)) list = [];
    } catch (_) {
      list = [];
    }
    const id = String(item.id);
    const exists = list.some((x) => String(x.id) === id);
    if (exists) list = list.filter((x) => String(x.id) !== id);
    else {
      list.unshift({
        id,
        name: item.name || "Sản phẩm",
        price: Number(item.price || 0),
        regular: item.regular != null ? Number(item.regular) : null,
        image: item.image || "",
        seller: item.seller || "",
        rating: item.rating || 0
      });
    }
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
    btn.classList.toggle("active", !exists);
    ["wishBadge", "wishBadgeTop"].forEach((idEl) => {
      const badge = document.getElementById(idEl);
      if (badge) badge.textContent = String(list.length);
    });
    showToast(!exists ? "Đã thêm vào wishlist" : "Đã bỏ khỏi wishlist");
    return;
  }

  const on = WishStore.toggle(item);
  btn.classList.toggle("active", on);
  showToast(on ? "Đã thêm vào wishlist" : "Đã bỏ khỏi wishlist");
};

/* addToCart provided by cart-page.js / CartStore when loaded */

let toastTimer;
window.showToast = function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove("show"), 2200);
};

/* ---------- Drawer menu ---------- */
/* Delegation: site-header rebuilds #catMenuBtn/#menuBtn after boot */
const drawer = document.getElementById("drawer");
const backdrop = document.getElementById("drawerBackdrop");
function closeDrawer(){
  drawer?.classList.remove("open");
  backdrop?.classList.remove("open");
}
function openDrawer(){
  drawer?.classList.add("open");
  backdrop?.classList.add("open");
}
document.addEventListener("click", (e) => {
  if (e.target.closest("#catMenuBtn, #menuBtn, #sideNavToggle")) openDrawer();
  if (e.target.closest("#drawerBackdrop")) closeDrawer();
  if (e.target.closest("#drawer a")) closeDrawer();
});

/* ---------- Info block collapse ---------- */
const infoCollapsible = document.getElementById("infoCollapsible");
const infoToggleBtn = document.getElementById("infoToggleBtn");
infoToggleBtn?.addEventListener("click", ()=>{
  const collapsed = infoCollapsible.classList.toggle("collapsed");
  infoToggleBtn.innerHTML = collapsed ? `XEM THÊM <span>↓</span>` : `THU GỌN <span>↑</span>`;
  if(collapsed) infoToggleBtn.scrollIntoView({behavior:"smooth", block:"center"});
});

/* ---------- Trust band count-up (0 → target, once) ---------- */
(function initTrustStatCountUp() {
  const nums = document.querySelectorAll(".trust-stat-num[data-count]");
  if (!nums.length) return;

  function format(el, value) {
    const decimals = Number(el.getAttribute("data-decimals") || 0);
    const suffix = el.getAttribute("data-suffix") || "";
    const n = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
    el.textContent = n + suffix;
  }

  function animate(el) {
    if (el.dataset.counted === "1") return;
    el.dataset.counted = "1";
    const target = Number(el.getAttribute("data-count") || 0);
    const decimals = Number(el.getAttribute("data-decimals") || 0);
    const duration = 1400;
    const start = performance.now();
    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const current = target * easeOutCubic(t);
      format(el, current);
      if (t < 1) requestAnimationFrame(frame);
      else format(el, target);
    }
    format(el, 0);
    requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const root = entry.target;
        root.querySelectorAll(".trust-stat-num[data-count]").forEach(animate);
        io.unobserve(root);
      });
    },
    { threshold: 0.35 }
  );

  const band = document.querySelector(".trust-band-stats") || nums[0].closest(".trust-band");
  if (band) io.observe(band);
  else nums.forEach(animate);
})();

