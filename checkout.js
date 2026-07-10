// api/payments/checkout.js — creates a Dodo Payments checkout session for
// the selected plan and returns the checkout_url to redirect the browser to.
const { getUserFromToken } = require('../../lib/supabaseServer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Please sign in first.' });

  try {
    const token = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Please sign in first.' });

    const { plan } = req.body || {};
    const productId = plan === 'multilocation' ? process.env.DODO_PRODUCT_MULTILOCATION : process.env.DODO_PRODUCT_STANDARD;
    if (!productId) {
      return res.status(500).json({ error: `Missing Dodo product ID for the ${plan} plan in your environment variables.` });
    }

    const DodoPaymentsPkg = require('dodopayments');
    const DodoPayments = DodoPaymentsPkg.default || DodoPaymentsPkg;
    const client = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode',
    });

    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: user.email, name: user.user_metadata?.full_name || user.email },
      return_url: `${siteUrl}/dashboard.html?checkout=success`,
      metadata: { supabase_user_id: user.id, plan },
    });

    return res.status(200).json({ checkout_url: session.checkout_url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Could not start checkout.' });
  }
};
