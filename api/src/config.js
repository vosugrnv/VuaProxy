const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const webOriginRaw = process.env.WEB_ORIGIN || "http://127.0.0.1";
const webOriginList = String(webOriginRaw)
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

module.exports = {
  port: Number(process.env.PORT || 3100),
  host: process.env.HOST || "127.0.0.1",
  webOrigin: webOriginRaw,
  /** First origin for PayOS return URLs / emails (WEB_ORIGIN may be a comma list). */
  webOriginPrimary: webOriginList[0] || "http://127.0.0.1",
  webOriginList,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtDays: Number(process.env.JWT_DAYS || 14),
  holdDays: Number(process.env.HOLD_DAYS || 3),
  adminEmails: String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  payos: {
    clientId: process.env.PAYOS_CLIENT_ID || "",
    apiKey: process.env.PAYOS_API_KEY || "",
    checksumKey: process.env.PAYOS_CHECKSUM_KEY || "",
    mock: process.env.PAYOS_MOCK === "1"
  },
  octoprox: {
    baseUrl: String(process.env.OCTOPROX_BASE_URL || "").replace(/\/$/, ""),
    username: process.env.OCTOPROX_USERNAME || "",
    password: process.env.OCTOPROX_PASSWORD || "",
    proxyHost: process.env.OCTOPROX_PROXY_HOST || "",
    proxyPort: Number(process.env.OCTOPROX_PROXY_PORT || 8080),
    credentialType: process.env.OCTOPROX_CREDENTIAL_TYPE || "",
    credentialConfig: process.env.OCTOPROX_CREDENTIAL_CONFIG || "",
    connectorConfig: process.env.OCTOPROX_CONNECTOR_CONFIG || "",
    dcCredentialType: process.env.OCTOPROX_DC_CREDENTIAL_TYPE || "",
    dcCredentialConfig: process.env.OCTOPROX_DC_CREDENTIAL_CONFIG || "",
    dcConnectorConfig: process.env.OCTOPROX_DC_CONNECTOR_CONFIG || ""
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "1",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from:
      process.env.MAIL_FROM ||
      (process.env.SMTP_USER ? `"Vua Proxy" <${process.env.SMTP_USER}>` : "")
  }
};
