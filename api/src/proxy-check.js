const crypto = require("crypto");
const { execFile } = require("child_process");
const net = require("net");

const MAX_PROXIES = 100;
const CONCURRENCY = 8;
const TIMEOUT_MS = 12000;
const JOB_TTL_MS = 30 * 60 * 1000;
const TEST_URL = "https://api.ipify.org?format=json";

const jobs = new Map();

function cleanupJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.expiresAt <= now) jobs.delete(id);
  }
  if (jobs.size > 200) {
    const oldest = [...jobs.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    for (let i = 0; i < oldest.length - 150; i++) jobs.delete(oldest[i][0]);
  }
}

function runCurl(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "curl",
      args,
      { timeout: TIMEOUT_MS + 2000, windowsHide: true, maxBuffer: 64 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = String(stderr || stdout || err.message || "timeout")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 120);
          reject(new Error(msg || "timeout"));
          return;
        }
        resolve(String(stdout || ""));
      }
    );
  });
}

function isBlockedHost(host) {
  const h = String(host || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "0.0.0.0" || h === "::" || h === "::1") return true;
  if (net.isIP(h) === 4) {
    const parts = h.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  }
  if (net.isIP(h) === 6) {
    if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  }
  return false;
}

function parseProxy(raw, format) {
  const line = String(raw || "").trim();
  if (!line || line.length > 240) return null;
  let host = "";
  let port = "";
  let username = "";
  let password = "";

  if (format === "host:port") {
    const m = line.match(/^([^:@\s]+):(\d{1,5})$/);
    if (!m) return null;
    host = m[1];
    port = m[2];
  } else if (format === "host:port:username:password") {
    const m = line.match(/^([^:@\s]+):(\d{1,5}):([^:]+):(.+)$/);
    if (!m) return null;
    host = m[1];
    port = m[2];
    username = m[3];
    password = m[4];
  } else if (format === "username:password@host:port") {
    const m = line.match(/^([^:@\s]+):([^@]+)@([^:@\s]+):(\d{1,5})$/);
    if (!m) return null;
    username = m[1];
    password = m[2];
    host = m[3];
    port = m[4];
  } else if (format === "username:password:host:port") {
    const m = line.match(/^([^:@\s]+):([^:]+):([^:@\s]+):(\d{1,5})$/);
    if (!m) return null;
    username = m[1];
    password = m[2];
    host = m[3];
    port = m[4];
  } else if (format === "host:port@username:password") {
    const m = line.match(/^([^:@\s]+):(\d{1,5})@([^:@\s]+):(.+)$/);
    if (!m) return null;
    host = m[1];
    port = m[2];
    username = m[3];
    password = m[4];
  } else {
    return null;
  }

  const portNum = Number(port);
  if (!host || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) return null;
  if (isBlockedHost(host)) return null;
  return { host, port: portNum, username, password, raw: line };
}

function proxyUrl(parsed, protocol) {
  const auth =
    parsed.username || parsed.password
      ? encodeURIComponent(parsed.username || "") +
        ":" +
        encodeURIComponent(parsed.password || "") +
        "@"
      : "";
  const scheme = protocol === "socks5" ? "socks5h" : "http";
  return scheme + "://" + auth + parsed.host + ":" + parsed.port;
}

async function probeOnce(parsed, protocol) {
  const started = Date.now();
  const out = await runCurl([
    "-sS",
    "--max-time",
    String(Math.ceil(TIMEOUT_MS / 1000)),
    "-x",
    proxyUrl(parsed, protocol),
    TEST_URL
  ]);
  let ip = "";
  try {
    const data = JSON.parse(out);
    ip = String(data.ip || "").trim();
  } catch (_) {
    ip = String(out || "").trim();
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && !ip.includes(":")) {
    throw new Error("no ip");
  }
  return { ip, latency: Date.now() - started, protocol };
}

async function checkOne(parsed, type) {
  const order =
    type === "socks5" ? ["socks5"] : type === "http" ? ["http"] : ["http", "socks5"];
  let lastErr = "die";
  for (const protocol of order) {
    try {
      const ok = await probeOnce(parsed, protocol);
      return { live: true, ip: ok.ip, latency: ok.latency, protocol, error: "" };
    } catch (err) {
      lastErr = String(err.message || err).slice(0, 80);
    }
  }
  return { live: false, ip: "", latency: 0, protocol: "", error: lastErr };
}

async function runJob(job) {
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= job.queue.length) return;
      const item = job.queue[i];
      const result = await checkOne(item.parsed, job.type);
      job.results.push({
        id: item.id,
        live: result.live,
        ip: result.ip,
        latency: result.latency,
        protocol: result.protocol,
        error: result.error
      });
      job.done += 1;
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY, job.queue.length) }, () => worker());
  await Promise.all(workers);
  job.finished = true;
}

function submit(req, res) {
  cleanupJobs();
  try {
    const format = String(req.body.format || "host:port:username:password");
    const type = String(req.body.type || "auto").toLowerCase();
    if (!["auto", "http", "socks5"].includes(type)) {
      return res.status(400).json({ error: "Loại proxy không hợp lệ" });
    }
    const allowedFormats = new Set([
      "host:port:username:password",
      "username:password@host:port",
      "username:password:host:port",
      "host:port@username:password",
      "host:port"
    ]);
    if (!allowedFormats.has(format)) {
      return res.status(400).json({ error: "Định dạng proxy không hợp lệ" });
    }
    const rawList = Array.isArray(req.body.proxies) ? req.body.proxies : [];
    if (!rawList.length) return res.status(400).json({ error: "Chưa nhập proxy nào" });
    if (rawList.length > MAX_PROXIES) {
      return res.status(400).json({ error: "Tối đa " + MAX_PROXIES + " proxy mỗi lần kiểm tra" });
    }

    const invalid = [];
    const queue = [];
    rawList.forEach((raw, id) => {
      const parsed = parseProxy(raw, format);
      if (!parsed) invalid.push({ id, proxy: String(raw || "").slice(0, 120) });
      else queue.push({ id, parsed });
    });

    const jobId = crypto.randomBytes(12).toString("hex");
    const job = {
      id: jobId,
      createdAt: Date.now(),
      expiresAt: Date.now() + JOB_TTL_MS,
      type,
      queue,
      results: [],
      done: 0,
      finished: queue.length === 0,
      total: queue.length + invalid.length
    };
    jobs.set(jobId, job);
    if (queue.length) runJob(job).catch((err) => console.error("proxy-check job", err));

    return res.json({
      job_id: jobId,
      total: job.total,
      queued: queue.length,
      invalid
    });
  } catch (err) {
    console.error("proxy-check submit", err);
    return res.status(500).json({ error: "Không tạo được phiên kiểm tra" });
  }
}

function result(req, res) {
  cleanupJobs();
  try {
    const jobId = String(req.query.job || "").trim();
    const after = Math.max(0, Number(req.query.after || 0) || 0);
    const limit = Math.min(5000, Math.max(1, Number(req.query.limit || 500) || 500));
    const job = jobs.get(jobId);
    if (!job) return res.status(404).json({ error: "Phiên kiểm tra không tồn tại hoặc đã hết hạn" });
    const slice = job.results.slice(after, after + limit);
    return res.json({
      results: slice,
      done: job.done,
      next: after + slice.length,
      finished: !!job.finished,
      total: job.total
    });
  } catch (err) {
    console.error("proxy-check result", err);
    return res.status(500).json({ error: "Không lấy được kết quả" });
  }
}

module.exports = { submit, result, parseProxy, MAX_PROXIES };
