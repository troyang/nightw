const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');

const app = express();

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// CORS configuration - restrict to allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Configuration from environment variables
const PRODUCT_NAME = process.env.PRODUCT_NAME;
const BASE_URL = process.env.BASE_URL;
const SUCCESS_PATH = process.env.SUCCESS_PATH;
const CANCEL_PATH = process.env.CANCEL_PATH;
const CURRENCY = process.env.CURRENCY;

app.post('/api/create-checkout', async (req, res) => {
  try {
    if (!BASE_URL) {
      throw new Error('BASE_URL environment variable is not configured');
    }

    const data = req.body;

    // Create Stripe Checkout Session with all incoming data as metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: data.email,
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: PRODUCT_NAME,
            },
            unit_amount: data.price,
          },
          quantity: 1,
        },
      ],
      // Pass all incoming data as metadata
      metadata: data,
      success_url: `${BASE_URL}${SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}${CANCEL_PATH}`,
    });

    res.json({
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
});

// Webhook endpoint to handle Stripe events (payment completed, etc.)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    console.log('Payment successful!');
    console.log('Customer email:', session.customer_email);
    console.log('Metadata (car wash details):', session.metadata);

    // Here you can:
    // - Save to database
    // - Send confirmation email
    // - Trigger any other business logic
  }

  res.json({ received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Checkout endpoint: POST http://localhost:${PORT}/api/create-checkout`);
});
