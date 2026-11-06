const buckets = new Map();

function rateLimit({ windowMs, max, key }) {
  return function (req, res, next) {
    const id = String(key(req) || req.ip || "unknown").slice(0, 180);
    const now = Date.now();
    let bucket = buckets.get(id);
    if (!bucket || bucket.reset <= now) {
      bucket = { reset: now + windowMs, n: 0 };
      buckets.set(id, bucket);
    }
    bucket.n += 1;
    if (buckets.size > 8000) {
      for (const [k, v] of buckets) {
        if (v.reset <= now) buckets.delete(k);
      }
    }
    if (bucket.n > max) {
      res.set("Retry-After", String(Math.ceil((bucket.reset - now) / 1000)));
      return res.status(429).json({ error: "Thử lại sau ít phút" });
    }
    return next();
  };
}

module.exports = { rateLimit };
