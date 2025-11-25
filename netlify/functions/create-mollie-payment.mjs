// netlify/functions/create-mollie-payment.mjs
import mollieClient from '@mollie/api-client';

/**
 * Netlify Function pour créer un paiement Mollie.
 *
 * Attendu en POST JSON:
 * {
 *   "userId": "uuid-supabase",
 *   "tier": "hero" | "game_master" | "celestial"
 * }
 *
 * Réponse:
 * {
 *   "checkoutUrl": "https://www.mollie.com/payscreen/..."
 * }
 */

// Mapping des plans (ADAPTE LES MONTANTS SI BESOIN)
const PLANS = {
  free: {
    amount: '0.00',
    description: 'Essai gratuit - Le Compagnon D&D',
  },
  hero: {
    amount: '9.99',
    description: 'Abonnement Hero - Le Compagnon D&D (1 an)',
  },
  game_master: {
    amount: '19.99',
    description: 'Abonnement Maître du Jeu - Le Compagnon D&D (1 an)',
  },
  celestial: {
    amount: '29.99',
    description: 'Abonnement Céleste - Le Compagnon D&D (1 an)',
  },
};

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const mollieApiKey = process.env.MOLLIE_API_KEY;
    const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://www.le-compagnon-dnd.fr';

    if (!mollieApiKey) {
      console.error('Missing MOLLIE_API_KEY env var');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    const mollie = mollieClient.createMollieClient({ apiKey: mollieApiKey });

    const body = JSON.parse(event.body || '{}');
    const { userId, tier } = body;

    if (!userId || !tier) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing userId or tier' }),
      };
    }

    const plan = PLANS[tier];
    if (!plan || plan.amount === '0.00') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or free tier for payment' }),
      };
    }

    const payment = await mollie.payments.create({
      amount: {
        currency: 'EUR',
        value: plan.amount,
      },
      description: plan.description,
      redirectUrl: `${publicBaseUrl}/subscription/confirmation?status=paid&tier=${tier}`,
      // Tu pourras ajouter un webhook plus tard si tu crées une autre function Netlify :
      // webhookUrl: `${publicBaseUrl}/.netlify/functions/mollie-webhook`,
      metadata: {
        userId,
        tier,
      },
    });

    const checkoutUrl = payment._links.checkout && payment._links.checkout.href;
    if (!checkoutUrl) {
      console.error('No checkout link from Mollie');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create payment' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ checkoutUrl }),
    };
  } catch (err) {
    console.error('create-mollie-payment error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
