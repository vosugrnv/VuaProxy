/* Shared proxy packages per country — names always include country */
(function (global) {
  const PKG_ORDER = ["share", "dc-single", "pack100", "pack100-dc"];

  function countryLabel(country) {
    return (country && (country.nameVi || country.name)) || "";
  }

  function packageDefs(country) {
    if (!country || !country.code) return [];
    const isVN = country.code === "vn";
    const label = countryLabel(country);
    const mul = isVN ? 1 : 2;
    const dcShared = 8000 * mul;
    const dcPrivate = 40000 * mul;
    const residential = 10000 * mul;
    const pack100 = 650000 * mul;
    const pack100Dc = 400000 * mul;

    return [
      {
        key: "share",
        title: "Proxy dân cư tĩnh Private · " + label,
        baseTitle: "Proxy dân cư tĩnh Private",
        monthPrice: residential,
        days: 30,
        note: isVN ? "ISP: FPT/Viettel/VNPT/Mobifone" : "Private · dùng riêng"
      },
      {
        key: "dc-single",
        title: "Proxy Datacenter · " + label,
        baseTitle: "Proxy Datacenter",
        monthPrice: dcShared,
        monthPricePrivate: dcPrivate,
        days: 30,
        note:
          "Dùng chung " +
          dcShared.toLocaleString("vi-VN") +
          "₫ · Dùng riêng " +
          dcPrivate.toLocaleString("vi-VN") +
          "₫ / 30 ngày"
      },
      {
        key: "pack100",
        title: "Gói 100 proxy · " + label,
        baseTitle: "Gói 100 proxy",
        monthPrice: pack100,
        days: 30,
        note: "1 đơn vị = 100 proxy"
      },
      {
        key: "pack100-dc",
        title: "Gói 100 proxy datacenter · " + label,
        baseTitle: "Gói 100 proxy datacenter",
        monthPrice: pack100Dc,
        days: 30,
        note: "1 đơn vị = 100 proxy DC · HOT"
      }
    ];
  }

  function packageProductId(countryCode, packageKey) {
    const locs = global.VUAPROXY_LOCATIONS || [];
    let ci = locs.findIndex((x) => x.code === countryCode);
    if (ci < 0) ci = 0;
    let pi = PKG_ORDER.indexOf(packageKey);
    if (pi < 0) pi = 0;
    return 820000 + ci * 10 + pi;
  }

  function slugify(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function packageToProduct(country, pkg) {
    const id = packageProductId(country.code, pkg.key);
    const name = pkg.title;
    return {
      id: id,
      slug: slugify(name) + "-" + country.code + "-" + pkg.key,
      name: name,
      price: pkg.monthPrice,
      regular: pkg.monthPricePrivate || pkg.monthPrice,
      pricePrivate: pkg.monthPricePrivate || null,
      image: "/images/flags/" + country.code + ".png",
      rating: 4.9,
      cats: ["proxy", country.code, pkg.key],
      inStock: true,
      stock: 999,
      seller: "Vua Proxy",
      sellerSlug: "vuaproxy",
      sellerToken: "vuaproxy",
      description:
        name +
        " — thuê theo ngày trên Vua Proxy. Quốc gia: " +
        countryLabel(country) +
        " (" +
        String(country.code).toUpperCase() +
        ").",
      metaTitle: name + " | Vua Proxy",
      metaDescription: name + ". IP sạch, giao tự động tại Vua Proxy.",
      countryCode: country.code,
      countryName: countryLabel(country),
      packageKey: pkg.key,
      note: pkg.note || "",
      href: (window.VUAPROXY_countryHref ? window.VUAPROXY_countryHref(country) : ("/tat-ca-khu-vuc/" + (country.slug || country.code))),
      source: "country-package",
      active: true
    };
  }

  function allCountryPackages(locations) {
    const list = Array.isArray(locations) ? locations : global.VUAPROXY_LOCATIONS || [];
    const rows = [];
    list.forEach((c) => {
      packageDefs(c).forEach((pkg) => rows.push(packageToProduct(c, pkg)));
    });
    return rows;
  }

  global.VUAPROXY_packageDefs = packageDefs;
  global.VUAPROXY_packageProductId = packageProductId;
  global.VUAPROXY_allCountryPackages = allCountryPackages;
  global.VUAPROXY_packageToProduct = packageToProduct;
})(typeof window !== "undefined" ? window : globalThis);
