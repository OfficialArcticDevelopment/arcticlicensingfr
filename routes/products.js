const express = require("express");
const pool = require("../db");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug, category, type, price_cents, short_description,
              description, image_url, version, status, stripe_price_id, created_at
       FROM products
       WHERE status = 'active'
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug, category, type, price_cents, short_description,
              description, image_url, version, status, stripe_price_id, created_at
       FROM products
       WHERE (id = $1 OR slug = $1) AND status = 'active'`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load product" });
  }
});

module.exports = router;
