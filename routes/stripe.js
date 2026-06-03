const express = require("express");
const Stripe = require("stripe");
const pool = require("../db");
const { auth } = require("../middleware/auth");
const { fulfillCheckout } = require("../fulfillCheckout");

const router = express.Router();

const stripeKey = process.env.STRIPE_KEY || process.env.STRIPE_SECRET_KEY;

const stripe = stripeKey
  ? new Stripe(stripeKey)
  : null;

function siteUrl() {
  return String(
    process.env.DOMAIN ||
    process.env.FRONTEND_URL ||
    "http://arcticlicensing.com"
  ).replace(/\/+$/, "");
}

async function createBossStripeCheckoutSession({
  product,
  price,
  image,
  items,
  metadata,
  cancelUrl
}) {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  const normalizedItems = Array.isArray(items) && items.length > 0
    ? items
        .map((item) => {
          if (!item || typeof item !== "object") return null;

          const itemName = String(item.product || item.name || "").trim();
          const itemImage = String(item.image || "").trim();
          const itemPrice = Number(item.price);
          const itemProductKey = String(item.productKey || item.key || "").trim();
          const itemProductType = String(item.productType || item.type || "").trim();
          const itemSelectedVariant = String(item.selectedVariant || "").trim();

          if (!itemName || !Number.isFinite(itemPrice)) return null;

          return {
            name: itemName,
            image: itemImage,
            price: itemPrice,
            productKey: itemProductKey,
            productType: itemProductType,
            selectedVariant: itemSelectedVariant
          };
        })
        .filter(Boolean)
    : [];

  if (normalizedItems.length === 0) {
    const fallbackName = String(product || "").trim();
    const fallbackPrice = Number(price);

    if (!fallbackName || !Number.isFinite(fallbackPrice)) {
      throw new Error("Invalid checkout request payload");
    }

    normalizedItems.push({
      name: fallbackName,
      image: String(image || "").trim(),
      price: fallbackPrice,
      productKey: String(metadata?.productKey || metadata?.product_id || "").trim(),
      productType: String(metadata?.productType || "").trim(),
      selectedVariant: String(metadata?.selectedVariant || "").trim()
    });
  }

  const lineItems = [];

  for (const item of normalizedItems) {
    const productData = await stripe.products.create({
      name: item.name,
      description: item.name,
      images: item.image ? [item.image] : [],
      metadata: {
        productKey: item.productKey,
        productType: item.productType,
        selectedVariant: item.selectedVariant,
        productName: item.name,
        arcticProductId: metadata?.product_id || ""
      }
    });

    const priceData = await stripe.prices.create({
      product: productData.id,
      unit_amount: Math.round(item.price * 100),
      currency: "usd"
    });

    lineItems.push({
      price: priceData.id,
      quantity: 1
    });
  }

  const base = siteUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",

    // Do NOT include payment_method_types.
    // Stripe will use payment methods enabled on the Stripe account.

    line_items: lineItems,

    success_url: `${base}/customer-dashboard.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${cancelUrl || "/products/index.html"}`,

    metadata: metadata || {}
  });

  return {
    sessionUrl: session.url,
    sessionId: session.id
  };
}

router.post("/create-checkout-session", auth, async (req, res) => {
  try {
    const productId =
      req.body.product_id ||
      req.body.productId ||
      req.body.id;

    if (!productId) {
      return res.status(400).json({ error: "product_id is required" });
    }

    const productResult = await pool.query(
      "SELECT * FROM products WHERE id = $1 OR slug = $1 LIMIT 1",
      [productId]
    );

    if (!productResult.rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productResult.rows[0];

    if (String(product.status || "").toLowerCase() !== "active") {
      return res.status(400).json({ error: "Product is not active" });
    }

    const checkout = await createBossStripeCheckoutSession({
      product: product.name,
      price: Number(product.price_cents || 0) / 100,
      image: product.image_url || "",
      metadata: {
        user_id: req.user.id,
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug || "",
        productKey: product.id,
        productType: product.type || product.category || "digital"
      },
      cancelUrl: `/products/product.html?id=${encodeURIComponent(product.id)}`
    });

    return res.json({
      url: checkout.sessionUrl,
      checkout_url: checkout.sessionUrl,
      sessionUrl: checkout.sessionUrl,
      sessionId: checkout.sessionId
    });
  } catch (err) {
    console.error("Create checkout session error:", err);
    return res.status(500).json({
      error: err.message || "Failed to create checkout session"
    });
  }
});

router.post("/webhook", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).send("Stripe not configured");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("Missing STRIPE_WEBHOOK_SECRET");
      return res.status(500).send("Stripe webhook secret not configured");
    }

    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).send("Missing Stripe signature");
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );

    console.log("Stripe webhook received:", event.type);

    if (event.type === "checkout.session.completed") {
      const result = await fulfillCheckout(event.data.object, { stripe });
      console.log("Stripe checkout fulfilled:", event.data.object.id, result);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
