const jwt = require("jsonwebtoken");
const pool = require("../db");

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      "SELECT id, email, name, role, created_at FROM users WHERE id = $1",
      [payload.id]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid user" });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { auth, requireAdmin };
