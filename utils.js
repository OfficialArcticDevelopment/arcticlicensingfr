const crypto = require("crypto");

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}

function normalizeDomain(domain) {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function publicUrl(path = "") {
  const base = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const clean = String(path || "").startsWith("/") ? path : "/" + path;
  return base + clean;
}

function apiUrl(path = "") {
  const clean = String(path || "").startsWith("/") ? path : "/" + path;
  return clean;
}

function licenseKey(prefix = "ARCTIC") {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    parts.push(crypto.randomBytes(3).toString("hex").toUpperCase());
  }
  return `${prefix}-${parts.join("-")}`;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  normalizeOrigin,
  normalizeDomain,
  publicUrl,
  apiUrl,
  licenseKey,
  safeNumber
};
