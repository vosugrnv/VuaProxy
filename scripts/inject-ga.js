/**
 * Inject Google Analytics gtag (G-HXPVPM0RJL) right after <head> on all HTML pages.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GA_ID = "G-HXPVPM0RJL";
const SNIPPET =
  "<!-- Google tag (gtag.js) -->\n" +
  '<script async src="https://www.googletagmanager.com/gtag/js?id=' +
  GA_ID +
  '"></script>\n' +
  "<script>\n" +
  "  window.dataLayer = window.dataLayer || [];\n" +
  "  function gtag(){dataLayer.push(arguments);}\n" +
  "  gtag('js', new Date());\n" +
  "\n" +
  "  gtag('config', '" +
  GA_ID +
  "');\n" +
  "</script>\n";

const SKIP = new Set(["admin.html", "node_modules", ".git"]);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name) || ent.name === "node_modules" || ent.name === ".git") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

let added = 0;
let skipped = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (rel === "admin.html" || rel.endsWith("/admin.html")) {
    skipped++;
    continue;
  }
  let html = fs.readFileSync(file, "utf8");
  if (html.includes(GA_ID) && html.includes("googletagmanager.com/gtag/js")) {
    skipped++;
    continue;
  }
  if (!/<head[^>]*>/i.test(html)) {
    skipped++;
    continue;
  }
  html = html.replace(/<head([^>]*)>/i, (m) => m + "\n" + SNIPPET);
  fs.writeFileSync(file, html);
  added++;
}

console.log("GA injected:", added, "skipped:", skipped);
