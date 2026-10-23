/* Gán nhãn danh mục — Vua Proxy */
const GENERIC_CAT = /^(tài khoản|sản phẩm bán chạy|sản phẩm|uncategorized|chưa phân loại|khác|proxy)$/i;

const BRAND_NAME_RULES = [
  { title: "Proxy dân cư Việt Nam", re: /việt\s*nam|vietnam|\bvn\b/i },
  { title: "Proxy Datacenter", re: /datacenter|data\s*center|static|ipv4\s*tĩnh|proxy\s*tĩnh/i },
  { title: "Proxy Dân cư", re: /residential|dân\s*cư|luna|xoay/i },
  { title: "9Proxy", re: /9\s*proxy|9proxy/i },
  { title: "Luna proxy", re: /luna\s*proxy|lunaproxy/i },
  { title: "Proxy", re: /\bproxy\b/i }
];

function isServiceName() {
  return false;
}

function inferBrandFromName(name) {
  const n = String(name || "");
  for (const rule of BRAND_NAME_RULES) {
    if (rule.re.test(n)) return rule.title;
  }
  return "Proxy";
}

function productTypeLabels(p) {
  const raw = (p.cats || [])
    .map((c) => String(c).trim())
    .filter((c) => c && !GENERIC_CAT.test(c));
  if (raw.length) return raw;
  const inferred = inferBrandFromName(p.name);
  return [inferred || "Proxy"];
}

const CHILD_SLUG_ALIASES = {};

function leafSlug(parentSlug, title, preferredSlug) {
  let slug =
    preferredSlug ||
    (typeof slugify === "function"
      ? slugify(title)
      : String(title)
          .toLowerCase()
          .replace(/\s+/g, "-"));
  const alias = CHILD_SLUG_ALIASES[parentSlug + "::" + slug];
  if (alias) return alias;
  if (slug === parentSlug) return slug + "-con";
  return slug;
}

function resolveProductCategory(p) {
  const labels = typeof productTypeLabels === "function" ? productTypeLabels(p) : [];
  const tax = (typeof CATEGORY_TAXONOMY !== "undefined" && CATEGORY_TAXONOMY.parents) || [];
  const fallbackParent = tax[0] || { slug: "proxy", title: "Proxy" };

  for (const label of labels) {
    const key = String(label).toLowerCase();
    for (const parent of tax) {
      for (const child of parent.children || []) {
        if (String(child.title).toLowerCase() !== key) continue;
        return {
          parent: { slug: parent.slug, title: parent.title },
          child: {
            slug: leafSlug(parent.slug, child.title, child.slug),
            title: label
          },
          labels
        };
      }
    }
  }

  const leafTitle = labels[0] || "Proxy";
  return {
    parent: { slug: fallbackParent.slug, title: fallbackParent.title },
    child: {
      slug: leafSlug(fallbackParent.slug, leafTitle),
      title: leafTitle
    },
    labels
  };
}

function categoryListingPath(parentOrSlug, childSlug) {
  if (!parentOrSlug || parentOrSlug === "all") return "/tat-ca-khu-vuc";
  if (parentOrSlug === "proxy" || String(parentOrSlug).indexOf("proxy") === 0) return "/tat-ca-khu-vuc";
  if (childSlug) return "/tat-ca-khu-vuc";
  return "/tat-ca-khu-vuc";
}

function categoryPathFromFilterSlug(slug) {
  if (!slug || slug === "all") return "/tat-ca-khu-vuc";
  return "/tat-ca-khu-vuc";
}

if (typeof window !== "undefined") {
  window.productTypeLabels = productTypeLabels;
  window.resolveProductCategory = resolveProductCategory;
  window.categoryListingPath = categoryListingPath;
  window.categoryPathFromFilterSlug = categoryPathFromFilterSlug;
  window.inferBrandFromName = inferBrandFromName;
}
