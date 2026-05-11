const express = require("express");
const pool = require("../db");
const { auth } = require("../middleware/auth");
const router = express.Router();

router.use(auth);

router.get("/summary", async (req, res) => {
  try {
    const [licenses, downloads, invoices, tickets] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM licenses WHERE user_id = $1", [req.user.id]),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM downloads d
         JOIN licenses l ON l.product_id = d.product_id
         WHERE l.user_id = $1 AND l.status = 'active' AND d.status = 'active'`,
        [req.user.id]
      ),
      pool.query("SELECT COUNT(*)::int AS count FROM invoices WHERE user_id = $1", [req.user.id]),
      pool.query("SELECT COUNT(*)::int AS count FROM support_tickets WHERE user_id = $1", [req.user.id])
    ]);

    res.json({
      user: req.user,
      licenses: licenses.rows[0].count,
      downloads: downloads.rows[0].count,
      invoices: invoices.rows[0].count,
      tickets: tickets.rows[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

router.get("/licenses", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, p.name AS product_name, p.slug AS product_slug, p.version AS product_version
       FROM licenses l
       JOIN products p ON p.id = l.product_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load licenses" });
  }
});

router.get("/activations", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, l.license_key, p.name AS product_name
       FROM license_activations a
       JOIN licenses l ON l.id = a.license_id
       JOIN products p ON p.id = l.product_id
       WHERE l.user_id = $1
       ORDER BY a.last_seen_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load activations" });
  }
});

router.get("/downloads", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT d.*, p.name AS product_name
       FROM downloads d
       JOIN products p ON p.id = d.product_id
       JOIN licenses l ON l.product_id = d.product_id
       WHERE l.user_id = $1 AND l.status = 'active' AND d.status = 'active'
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load downloads" });
  }
});

router.get("/invoices", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, p.name AS product_name
       FROM invoices i
       LEFT JOIN products p ON p.id = i.product_id
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load invoices" });
  }
});

router.post("/support", async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    const result = await pool.query(
      `INSERT INTO support_tickets (user_id, subject, message, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING *`,
      [req.user.id, subject, message]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create support ticket" });
  }
});

module.exports = router;
