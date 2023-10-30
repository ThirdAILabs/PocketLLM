const express = require('express');
const app = express();

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

app.use(express.json()); // for parsing application/json

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // or specific domain instead of '*'
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
})

const PORT = process.env.PORT || 8080;

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.post('/create-payment-intent', async (req, res) => {
    try {
      const { paymentType } = req.body;
  
      let amount;
  
      switch(paymentType) {
        case 1: // Monthly Subscription
          amount = 999;
          break;
        case 2: // Yearly Subscription
          amount = 9999;
          break;
        default:
          throw new Error('Invalid payment type');
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
      });
  
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {
      res.status(400).send({ error: error.message });
    }
  });

app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
    const sig = request.headers['stripe-signature'];
  
    let event;
  
    try {
      event = stripe.webhooks.constructEvent(request.body, sig, 'your_webhook_secret');
    } catch (err) {
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }
  
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // Handle the successful payment intent here
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  
    response.json({received: true});
  });
  