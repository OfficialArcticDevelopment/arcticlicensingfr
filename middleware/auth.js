const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { isFounderUser, getPermissions } = require("../middleware/auth");
const router = express.Router();

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function safeUser(row, permissions = []) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
    is_founder: isFounderUser(row),
    permissions
  };
}

async function findUserByEmail(email) {
  const result = await pool.query(
    "SELECT id, name, email, password_hash, role, created_at, COALESCE(disabled, FALSE) AS disabled FROM users WHERE lower(email) = lower($1)",
    [email]
  );
  return result.rows[0] || null;
}

async function loginWithRole(req, res, expectedRole) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const row = await findUserByEmail(email);

    if (!row) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (row.disabled) {
      return res.status(403).json({ error: "Account disabled" });
    }

    const ok = await bcrypt.compare(password, row.password_hash || "");

    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (expectedRole === "customer" && row.role === "admin") {
      return res.status(403).json({ error: "Use the admin login for this account" });
    }

    if (expectedRole === "admin" && row.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const permissions = row.role === "admin" ? await getPermissions(row.id) : [];
    const user = safeUser(row, permissions);

    res.json({ token: sign(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);

    if (existing.rows.length) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, lower($2), $3, 'customer')
       RETURNING id, name, email, role, created_at`,
      [name, email, hash]
    );

    const row = result.rows[0];
    const user = safeUser(row, []);

    res.json({ token: sign(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Legacy endpoint retained for old pages, but now behaves as CUSTOMER login only.
router.post("/login", (req, res) => loginWithRole(req, res, "customer"));

// Customer login: admin accounts are rejected here so customers never land in admin by accident.
router.post("/customer-login", (req, res) => loginWithRole(req, res, "customer"));

// Admin login: customer accounts are rejected here.
router.post("/admin-login", (req, res) => loginWithRole(req, res, "admin"));

module.exports = router;
