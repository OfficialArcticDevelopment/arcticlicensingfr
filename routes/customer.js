const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

router.get('/summary', async (req, res) => {
  const userId = req.user.id;
  const [licenses, downloads, invoices, tickets] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='active')::int active FROM licenses WHERE user_id=$1`, [userId]),
    pool.query(`SELECT d.*, p.name product_name FROM downloads d JOIN products p ON p.id=d.product_id JOIN licenses l ON l.product_id=p.id WHERE l.user_id=$1 AND l.status='active' ORDER BY d.created_at DESC LIMIT 5`, [userId]),
    pool.query(`SELECT COUNT(*)::int total FROM invoices WHERE user_id=$1`, [userId]),
    pool.query(`SELECT COUNT(*)::int total FROM support_tickets WHERE user_id=$1 AND status!='closed'`, [userId])
  ]);
  res.json({ summary: { licenses: licenses.rows[0], latest_downloads: downloads.rows, invoices: invoices.rows[0].total, open_tickets: tickets.rows[0].total } });
});

router.get('/licenses', async (req, res) => {
  const result = await pool.query(`SELECT l.*, p.name product_name, p.version product_version FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.user_id=$1 ORDER BY l.created_at DESC`, [req.user.id]);
  res.json({ licenses: result.rows });
});

router.get('/activations', async (req, res) => {
  const result = await pool.query(`SELECT a.*, p.name product_name, l.license_key FROM license_activations a JOIN licenses l ON l.id=a.license_id JOIN products p ON p.id=a.product_id WHERE l.user_id=$1 ORDER BY a.last_checked_at DESC`, [req.user.id]);
  res.json({ activations: result.rows });
});

router.get('/downloads', async (req, res) => {
  const result = await pool.query(`SELECT DISTINCT ON (d.id) d.*, p.name product_name FROM downloads d JOIN products p ON p.id=d.product_id JOIN licenses l ON l.product_id=p.id WHERE l.user_id=$1 AND l.status='active' ORDER BY d.id, d.created_at DESC`, [req.user.id]);
  res.json({ downloads: result.rows });
});

router.get('/invoices', async (req, res) => {
  const result = await pool.query(`SELECT i.*, p.name product_name FROM invoices i LEFT JOIN products p ON p.id=i.product_id WHERE i.user_id=$1 ORDER BY i.created_at DESC`, [req.user.id]);
  res.json({ invoices: result.rows });
});

router.post('/support', async (req, res) => {
  const { subject, message, priority } = req.body;
  const result = await pool.query(`INSERT INTO support_tickets (user_id, subject, message, priority) VALUES ($1,$2,$3,$4) RETURNING *`, [req.user.id, subject, message, priority || 'normal']);
  res.status(201).json({ ticket: result.rows[0] });
});

module.exports = router;
