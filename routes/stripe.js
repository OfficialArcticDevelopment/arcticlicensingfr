const express = require("express");
const Stripe = require("stripe");
const pool = require("../db");
const { licenseKey } = require("../utils");
const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

async function fulfillCheckout(session) {
  const client = await pool.connect();

  try {
    const userId = Number(session.metadata && session.metadata.user_id);
    const productId = session.metadata && session.metadata.product_id;

    if (!userId || !productId) {
      throw new Error("Missing Stripe metadata for fulfillment");
    }

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM invoices WHERE stripe_session_id = $1",
      [session.id]
    );

    if (existing.rows.length) {
      await client.query("COMMIT");
      return { alreadyFulfilled: true };
    }

    const amount = Number(session.amount_total || 0);
    const currency = session.currency || "usd";

    await client.query(
      `INSERT INTO invoices
       (user_id, product_id, amount_cents, currency, status, stripe_session_id, stripe_payment_intent)
       VALUES ($1,$2,$3,$4,'paid',$5,$6)`,
      [userId, productId, amount, currency, session.id, session.payment_intent || null]
    );

    const key = licenseKey(process.env.LICENSE_PREFIX || "ARCTIC");

    await client.query(
      `INSERT INTO licenses
       (license_key, product_id, user_id, status, max_activations)
       VALUES ($1, $2, $3, 'active', 1)`,
      [key, productId, userId]
    );

    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

router.post("/webhook", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).send("Stripe not configured");
    }

    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    if (secret) {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } else {
      event = JSON.parse(req.body.toString());
    }

    if (event.type === "checkout.session.completed") {
      await fulfillCheckout(event.data.object);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
