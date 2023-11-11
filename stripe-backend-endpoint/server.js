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
const PREMIUM_SUBSCRIPTION_PRICE_ID = 'price_1OAI2VAJoSOk3o2btpasvNuF';
const SUPREME_SUBSCRIPTION_PRICE_ID = 'price_1OAI3ZAJoSOk3o2bg7d9XhZR';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.post('/create-customer-and-subscribe', async (req, res) => {
  try {
    const { email, paymentType, paymentMethodId } = req.body;

    // Create a new customer object
    const customer = await stripe.customers.create({
      email: email,
    })

    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    })

    // Set the payment method as the default for the customer
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    // Determine the appropriate pricing plan for the subscription
    let priceId;
    switch (paymentType) {
      case 1: // Premium Subscription
        priceId = PREMIUM_SUBSCRIPTION_PRICE_ID; 
        break;
      case 2: // Supreme Subscription
        priceId = SUPREME_SUBSCRIPTION_PRICE_ID;
        break;
      default:
        throw new Error('Invalid payment type');
    }

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
    });

    res.send({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });

  } catch (error) {
    res.status(400).send({ error: error.message });
  }
})

app.post('/check-subscription', async (req, res) => {
  console.log('Received request for /check-subscription with body:', req.body);

  try {
    const { email } = req.body;
    if (!email) {
      console.log('Email not provided in request body');
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log(`Attempting to retrieve customer with email: ${email}`);
    
    // Remember to include the appropriate expansion for subscriptions
    const customers = await stripe.customers.list({ 
      email,
      expand: ['data.subscriptions']
    });

    console.log(`Retrieved customers: ${customers.data.length}`);

    // Find the first active subscription (if any) and determine its type
    let subscriptionType = null;
    let activeSubscriptionFound = false;
    if (customers.data.length > 0) {
      const customerSubscriptions = customers.data[0].subscriptions.data;
      for (const subscription of customerSubscriptions) {
        if (subscription.status === 'active') {
          activeSubscriptionFound = true;
          const priceId = subscription.items.data[0].price.id;
          
          console.log(`priceId found is ${priceId}`)
          
          // Determine the type of subscription based on priceId
          if (priceId === PREMIUM_SUBSCRIPTION_PRICE_ID) {
            subscriptionType = 'PREMIUM';
          } else if (priceId === SUPREME_SUBSCRIPTION_PRICE_ID) {
            subscriptionType = 'SUPREME';
          }
          break;
        }
      }
    }

    console.log(`Subscription type: ${subscriptionType}`);

    if (activeSubscriptionFound) {
      res.json({ type: subscriptionType });
    } else {
      res.json({ type: 'FREE' });
    }
  } catch (error) {
    console.error('Error in /check-subscription:', error);
    res.status(500).json({ error: error.message });
  }
});
