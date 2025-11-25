const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createMollieClient } = require('@mollie/api-client');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const mollieClient = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process. env.SUPABASE_SERVICE_KEY
);

app.use(cors({
  origin: process.env. FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

app.post('/api/create-payment', async (req, res) => {
  try {
    const { userId, tier, email } = req.body;

    if (!userId || !tier || !email) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const tierPrices = {
      hero: '4. 99',
      game_master: '9.99',
      celestial: '24.99',
    };

    const amount = tierPrices[tier];
    if (!amount) {
      return res.status(400).json({ error: 'Tier invalide' });
    }

    const payment = await mollieClient.payments.create({
      amount: {
        currency: 'EUR',
        value: amount,
      },
      description: `Abonnement ${tier} - Le Compagnon D&D`,
      redirectUrl: `${process.env. FRONTEND_URL}/payment-success? userId=${userId}&tier=${tier}`,
      webhookUrl: `${process.env.BACKEND_URL}/api/webhook`,
      metadata: {
        userId,
        tier,
        email,
      },
    });

    console.log('✅ Paiement créé:', payment. id);

    res.json({
      checkoutUrl: payment.getCheckoutUrl(),
      paymentId: payment.id,
    });

  } catch (error) {
    console.error('❌ Erreur création paiement:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhook', async (req, res) => {
  try {
    const paymentId = req.body.id;

    if (!paymentId) {
      return res.status(400).send('No payment ID');
    }

    const payment = await mollieClient.payments.get(paymentId);

    console.log('📬 Webhook reçu:', payment. id, payment.status);

    if (payment.status === 'paid') {
      const { userId, tier } = payment.metadata;

      console.log('✅ Paiement confirmé pour:', userId, tier);

      const now = new Date();
      const subscriptionEndDate = new Date(now);
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

      await supabase
        .from('user_subscriptions')
        .update({ 
          status: 'cancelled',
          end_date: now. toISOString(),
          updated_at: now.toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'active');

      await supabase
        .from('user_subscriptions')
        . update({ 
          status: 'expired',
          end_date: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'trial'); 

      const { data, error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          tier,
          status: 'active',
          start_date: now.toISOString(),
          subscription_end_date: subscriptionEndDate.toISOString(),
          mollie_payment_id: payment.id,
        })
        .select()
        .single();

      if (error) {
        console. error('❌ Erreur Supabase:', error);
        throw error;
      }

      console.log('✅ Abonnement créé dans Supabase:', data);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    res.status(500).send('Webhook error');
  }
});

app.get('/health', (req, res) => {
  res. json({ status: 'OK', timestamp: new Date().toISOString() });
});

app. listen(PORT, () => {
  console.log(`🚀 Backend Mollie démarré sur le port ${PORT}`);
  console.log(`📡 Webhook URL: ${process.env.BACKEND_URL}/api/webhook`);
});