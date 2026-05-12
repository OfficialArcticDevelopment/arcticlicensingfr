const pool = require("./db");
const { licenseKey } = require("./utils");

async function fulfillCheckout(session) {
  const client = await pool.connect();

  try {
    if (!session || !session.id) {
      throw new Error("Invalid Stripe checkout session");
    }

    if (session.payment_status !== "paid") {
      throw new Error(`Checkout session is not paid. Current status: ${session.payment_status}`);
    }

    const userId = String(session.metadata?.user_id || "").trim();
    const productId = String(session.metadata?.product_id || "").trim();

    if (!userId || !productId) {
      throw new Error("Missing Stripe metadata for fulfillment");
    }

    await client.query("BEGIN");

    const existingInvoice = await client.query(
      "SELECT id FROM invoices WHERE stripe_session_id = $1",
      [session.id]
    );

    if (existingInvoice.rows.length) {
      await client.query("COMMIT");
      return { ok: true, alreadyFulfilled: true };
    }

    const productCheck = await client.query(
      "SELECT id FROM products WHERE id = $1",
      [productId]
    );

    if (!productCheck.rows.length) {
      throw new Error(`Product not found for fulfillment: ${productId}`);
    }

    const userCheck = await client.query(
      "SELECT id FROM users WHERE id = $1",
      [userId]
    );

    if (!userCheck.rows.length) {
      throw new Error(`User not found for fulfillment: ${userId}`);
    }

    const amount = Number(session.amount_total || 0);
    const currency = session.currency || "usd";

    await client.query(
      `INSERT INTO invoices
       (user_id, product_id, amount_cents, currency, status, stripe_session_id, stripe_payment_intent)
       VALUES ($1, $2, $3, $4, 'paid', $5, $6)`,
      [
        userId,
        productId,
        amount,
        currency,
        session.id,
        session.payment_intent || null
      ]
    );

    const key = licenseKey(process.env.LICENSE_PREFIX || "ARCTIC");

    await client.query(
      `INSERT INTO licenses
       (license_key, product_id, user_id, status, max_activations)
       VALUES ($1, $2, $3, 'active', 1)`,
      [key, productId, userId]
    );

    await client.query("COMMIT");
    return { ok: true, alreadyFulfilled: false };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { fulfillCheckout };
