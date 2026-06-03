const express = require("express");
const pool = require("../db");

const router = express.Router();

function normalizeDomain(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
}

router.post("/license", async (req, res) => {
  try {
    const licenseKey = String(req.body.license_key || req.body.key || "").trim();
    const domain = normalizeDomain(req.body.domain || req.headers.origin || req.headers.referer || "");

    if (!licenseKey) {
      return res.status(400).json({ valid: false, reason: "missing_license_key" });
    }

    const result = await pool.query(
      `SELECT 
          l.id,
          l.license_key,
          l.status,
          l.max_activations,
          l.expires_at,
          l.product_id,
          p.name AS product_name,
          p.status AS product_status
       FROM licenses l
       JOIN products p ON p.id = l.product_id
       WHERE l.license_key = $1
       LIMIT 1`,
      [licenseKey]
    );

    if (!result.rows.length) {
      return res.status(404).json({ valid: false, reason: "license_not_found" });
    }

    const license = result.rows[0];

    if (license.status !== "active") {
      return res.status(403).json({ valid: false, reason: "license_inactive" });
    }

    if (license.product_status !== "active") {
      return res.status(403).json({ valid: false, reason: "product_inactive" });
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return res.status(403).json({ valid: false, reason: "license_expired" });
    }

    if (domain) {
      const existing = await pool.query(
        `SELECT * FROM license_activations
         WHERE license_id = $1 AND lower(domain) = lower($2)
         LIMIT 1`,
        [license.id, domain]
      );

      if (!existing.rows.length) {
        const count = await pool.query(
          `SELECT COUNT(*)::int AS count
           FROM license_activations
           WHERE license_id = $1`,
          [license.id]
        );

        if (count.rows[0].count >= Number(license.max_activations || 1)) {
          return res.status(403).json({
            valid: false,
            reason: "activation_limit_reached"
          });
        }

        await pool.query(
          `INSERT INTO license_activations
             (license_id, domain, ip_address, user_agent, activated_at, last_seen_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [
            license.id,
            domain,
            req.ip,
            req.headers["user-agent"] || ""
          ]
        );
      } else {
        await pool.query(
          `UPDATE license_activations
           SET last_seen_at = NOW(),
               ip_address = $2,
               user_agent = $3
           WHERE id = $1`,
          [
            existing.rows[0].id,
            req.ip,
            req.headers["user-agent"] || ""
          ]
        );
      }
    }

    return res.json({
      valid: true,
      product_id: license.product_id,
      product_name: license.product_name,
      domain
    });
  } catch (err) {
    console.error("License verify error:", err);
    return res.status(500).json({ valid: false, reason: "server_error" });
  }
});

module.exports = router;
