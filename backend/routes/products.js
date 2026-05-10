const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  const { category, type, search, max_price } = req.query;
  const params = [];
  const where = [`status='active'`];
  if (category) { params.push(category); where.push(`category=$${params.length}`); }
  if (type) { params.push(type); where.push(`type=$${params.length}`); }
  if (search) { params.push(`%${search}%`); where.push(`(name ILIKE $${params.length} OR short_description ILIKE $${params.length})`); }
  if (max_price) { params.push(Number(max_price) * 100); where.push(`price_cents <= $${params.length}`); }
  const result = await pool.query(`SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, params);
  res.json({ products: result.rows });
});

router.get('/:slug', async (req, res) => {
  const result = await pool.query('SELECT * FROM products WHERE slug=$1 OR id=$1 LIMIT 1', [req.params.slug]);
  const product = result.rows[0];
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

router.get('/:id/downloads', authRequired, async (req, res) => {
  const result = await pool.query(
    `SELECT d.* FROM downloads d
     JOIN licenses l ON l.product_id=d.product_id
     WHERE d.product_id=$1 AND l.user_id=$2 AND l.status='active'
     ORDER BY d.created_at DESC`,
    [req.params.id, req.user.id]
  );
  res.json({ downloads: result.rows });
});

module.exports = router;
