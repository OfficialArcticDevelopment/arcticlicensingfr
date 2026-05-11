const express = require("express");
const pool = require("../db");
const { normalizeDomain } = require("../utils");
const router = express.Router();

router.post("/verify", async (req, res) => {
  const client = await pool.connect();

  try {
    const { license_key, product_id, domain, ip, version } = req.body;

    if (!license_key || !product_id) {
      return res.status(400).json({
        valid: false,
        reason: "license_key and product_id are required"
      });
    }

    await client.query("BEGIN");

    const licenseResult = await client.query(
      `SELECT l.*, p.name AS product_name, p.version AS product_version, p.status AS product_status
       FROM licenses l
       JOIN products p ON p.id = l.product_id
       WHERE l.license_key = $1 AND l.product_id = $2`,
      [license_key, product_id]
    );

    if (!licenseResult.rows.length) {
      await client.query("ROLLBACK");
      return res.json({ valid: false, reason: "license_not_found" });
    }

    const license = licenseResult.rows[0];

    if (license.status !== "active") {
      await client.query("ROLLBACK");
      return res.json({ valid: false, reason: `license_${license.status}` });
    }

    if (license.product_status !== "active") {
      await client.query("ROLLBACK");
      return res.json({ valid: false, reason: "product_inactive" });
    }

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.json({ valid: false, reason: "license_expired" });
    }

    const cleanDomain = normalizeDomain(domain);
    const cleanIp = String(ip || "").trim();

    const activations = await client.query(
      `SELECT * FROM license_activations WHERE license_id = $1 ORDER BY created_at ASC`,
      [license.id]
    );

    let matching = activations.rows.find(a => {
      const sameDomain = cleanDomain && normalizeDomain(a.domain) === cleanDomain;
      const sameIp = cleanIp && String(a.ip || "").trim() === cleanIp;
      return sameDomain || sameIp;
    });

    let activationStatus = "existing";

    if (!matching) {
      if (activations.rows.length >= license.max_activations) {
        await client.query("ROLLBACK");
        return res.json({
          valid: false,
          reason: "activation_limit_reached",
          product: {
            id: license.product_id,
            name: license.product_name,
            version: license.product_version
          },
          activation_status: "blocked",
          max_activations: license.max_activations,
          current_activations: activations.rows.length
        });
      }

      const created = await client.query(
        `INSERT INTO license_activations (license_id, domain, ip, version, last_seen_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [license.id, cleanDomain || null, cleanIp || null, version || null]
      );

      matching = created.rows[0];
      activationStatus = "created";
    } else {
      await client.query(
        `UPDATE license_activations
         SET last_seen_at = NOW(), version = COALESCE($2, version)
         WHERE id = $1`,
        [matching.id, version || null]
      );
    }

    const countResult = await client.query(
      "SELECT COUNT(*)::int AS count FROM license_activations WHERE license_id = $1",
      [license.id]
    );

    await client.query("COMMIT");

    res.json({
      valid: true,
      reason: "valid",
      product: {
        id: license.product_id,
        name: license.product_name,
        version: license.product_version
      },
      activation_status: activationStatus,
      max_activations: license.max_activations,
      current_activations: countResult.rows[0].count
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ valid: false, reason: "server_error" });
  } finally {
    client.release();
  }
});

module.exports = router;
