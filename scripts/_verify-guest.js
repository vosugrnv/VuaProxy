const https = require("https");

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { Accept: "application/json" };
    if (data) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(data);
    }
    const r = https.request(
      { hostname: "vuammovn.pro", path: "/api" + path, method, headers },
      (x) => {
        let d = "";
        x.on("data", (c) => (d += c));
        x.on("end", () => resolve({ status: x.statusCode, body: d.slice(0, 500) }));
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log("health", await req("GET", "/health"));
  console.log("checkout empty", await req("POST", "/orders/checkout-qr", { items: [] }));
  console.log(
    "checkout bad",
    await req("POST", "/orders/checkout-qr", {
      items: [{ id: "x", name: "Test", price: 1000, qty: 1 }]
    })
  );
})();
