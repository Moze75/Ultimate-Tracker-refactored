const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { createMollieClient } = require('@mollie/api-client');
const { createClient } = require('@supabase/supabase-js');
const { initVTTWebSocket, initVTTRoutes } = require('./vttServer');

dotenv.config();

const app = express();
const server = http.createServer(app);
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
app.use(express.urlencoded({ extended: true })); // ✅ Parse les webhooks Mollie

// ---------------------------------------------------------
// 1. DÉFINITION DES CODES PROMOS (À MODIFIER SELON VOS BESOINS)
// ---------------------------------------------------------
const VALID_PROMO_CODES = {
  // Exemple 1 : -10% pour tout le monde 
  'LBA10': { type: 'percentage', value: 10 }, 

    // Exemple 1 : -10% pour tout le monde 
  'MJM10': { type: 'percentage', value: 10 }, 

      // Exemple 1 : -10% pour tout le monde 
  'DDNANTAIS10': { type: 'percentage', value: 10 }, 

      // Exemple 1 : -10% pour tout le monde 
  'Naeth10': { type: 'percentage', value: 10 }, 

  // Exemple 1 : -10% pour tout le monde 
  'AIDEDD10': { type: 'percentage', value: 10 }, 

    // Exemple 1 : -10% pour tout le monde 
  'ITA10': { type: 'percentage', value: 10 }, 

};

// 👇 NOUVELLE ROUTE POUR VÉRIFIER UN CODE
app.post('/api/check-promo', (req, res) => {
  const { promoCode } = req.body;
  
  if (promoCode && VALID_PROMO_CODES[promoCode]) {
    const discount = VALID_PROMO_CODES[promoCode];
    // On renvoie les détails de la réduction
    return res.json({ 
      valid: true, 
      type: discount.type, 
      value: discount.value 
    });
  }
  
  return res.json({ valid: false });
});

// ---------------------------------------------------------
// 2. ROUTE DE PAIEMENT (NE PAS TOUCHER À LA LOGIQUE CI-DESSOUS)
// ---------------------------------------------------------
app.post('/api/create-payment', async (req, res) => {
  try {
    const { userId, tier, email, promoCode } = req.body;

    if (!userId || !tier || !email) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const tierPrices = {
      hero: '10.00',
      game_master: '15.00',
      celestial: '30.00',
    };

    const basePriceString = tierPrices[tier];
    if (!basePriceString) {
      return res.status(400).json({ error: 'Tier invalide' });
    }

    let finalAmount = parseFloat(basePriceString);
    let description = `Abonnement ${tier} - Le Compagnon D&D`;

    // --- DÉBUT LOGIQUE PROMO ---
    if (promoCode && VALID_PROMO_CODES[promoCode]) {
      const discount = VALID_PROMO_CODES[promoCode];
      
      // Cas pourcentage (ex: -10%)
      if (discount.type === 'percentage') {
        finalAmount = finalAmount * (1 - discount.value / 100);
        description += ` (Code ${promoCode}: -${discount.value}%)`;
      } 
      // Cas montant fixe (ex: -5€)
      else if (discount.type === 'fixed') {
        finalAmount = Math.max(0, finalAmount - discount.value);
        description += ` (Code ${promoCode}: -${discount.value}€)`;
      }
      
      console.log(`🎟️ Code promo appliqué : ${promoCode}. Ancien prix: ${basePriceString}€ -> Nouveau prix : ${finalAmount.toFixed(2)}€`);
    }
    // --- FIN LOGIQUE PROMO ---

    const payment = await mollieClient.payments.create({
      amount: {
        currency: 'EUR',
        value: finalAmount.toFixed(2), // Important: 2 décimales
      },
      description: description,
      redirectUrl: `${process.env.FRONTEND_URL}/payment-success?userId=${userId}&tier=${tier}`,
      webhookUrl: `${process.env.BACKEND_URL}/api/webhook`,
      metadata: {
        userId,
        tier,
        email,
        promoCodeUsed: promoCode || null,
      },
    });

    console.log('✅ Paiement créé:', payment.id);

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
    console.log('📬 Webhook reçu:', JSON.stringify(req.body, null, 2));
    
    const paymentId = req. body.id;

    // Si pas de payment ID (test Mollie), répondre OK quand même
    if (!paymentId) {
      console.log('⚠️ Webhook de test (pas de payment ID), réponse OK');
      return res.status(200).send('OK');
    }

    const payment = await mollieClient.payments.get(paymentId);

    console.log('📬 Paiement:', payment.id, 'Statut:', payment.status);

    if (payment.status === 'paid') {
      const { userId, tier } = payment.metadata;

      if (! userId || !tier) {
        console.error('❌ Metadata manquante dans le paiement');
        return res.status(200).send('OK'); // Répondre 200 quand même
      }

      console.log('✅ Paiement confirmé pour:', userId, tier);

      const now = new Date();
      const subscriptionEndDate = new Date(now);
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

      // Annuler les anciens abonnements actifs
      await supabase
        .from('user_subscriptions')
        .update({ 
          status: 'cancelled',
          end_date: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'active');

      // Expirer les trials
      await supabase
        .from('user_subscriptions')
        .update({ 
          status: 'expired',
          end_date: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'trial');

      // Créer le nouvel abonnement
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
        console.error('❌ Erreur Supabase:', error);
        // Répondre 200 quand même pour éviter les retry Mollie
        return res.status(200).send('OK');
      }

      console.log('✅ Abonnement créé dans Supabase:', data);
    }

    res. status(200).send('OK');
  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    // IMPORTANT : Répondre 200 même en cas d'erreur pour éviter les retry infinis
    res.status(200).send('OK');
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

initVTTRoutes(app);
initVTTWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Backend démarré sur le port ${PORT}`);
  console.log(`📡 Webhook URL: ${process.env.BACKEND_URL}/api/webhook`);
  console.log(`🗺️  VTT WebSocket: ws://localhost:${PORT}/vtt`);
});