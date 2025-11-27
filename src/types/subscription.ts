export type SubscriptionTier = 'free' | 'hero' | 'game_master' | 'celestial'; // ✅ Ajout de 'celestial'

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  price: number;
  priceLabel: string;
  maxCharacters: number;
  features: string[];
  popular?: boolean;
  color: 'gray' | 'blue' | 'purple' | 'gold'; // ✅ Ajout de 'gold'
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: 'trial' | 'active' | 'cancelled' | 'expired';
  start_date: string;
  end_date?: string | null;
  trial_end_date?: string | null;
  subscription_end_date?: string | null;
  mollie_customer_id?: string | null;
  mollie_subscription_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Essai Gratuit',
    price: 0,
    priceLabel: '15 jours',
    maxCharacters: 1,
    color: 'gray',
    features: [
      'Toutes les fonctionnalités de base',
      'Création et gestion de personnage',
      'Combat, inventaire, équipement',
      'Calculs automatiques',
      '15 jours pour tester l\'application',
    ],
  },
  {
    id: 'hero',
    name: 'Héros',
    price: 10,
    priceLabel: '10€/an',
    maxCharacters: 5,
    color: 'blue',
    popular: true,
    features: [
      'Accès à toutes les fonctionnalités principales de l\'app',
      'Création d\'objets personnalisés',
      'Gestion automatique des valeurs de CA',
      'Calcul automatique des bonus',
      'Créer votre personnage avec le Character Wizard',
      'Gestion et suivi des états, de la concentration',
      'Dice Roller et pleins d\'autres fonctions',
    ],
  },
  {
    id: 'game_master',
    name: 'Maître du Jeu',
    price: 15,
    priceLabel: '15€/an',
    maxCharacters: 15,
    color: 'purple',
    features: [
      'Mode Campagne activé',
      'Envoi d\'objets aux joueurs',
      'Envoi d\'or aux joueurs',
      'Gestion des notes de campagne',
      'Partage de campagne avec vos joueurs',
      'Toutes les fonctionnalités Héros',
    ],
  },
  {
    id: 'celestial',
    name: 'Céleste',
    price: 30,
    priceLabel: '30€/an',
    maxCharacters: Infinity,
    color: 'gold',
    features: [
      'Personnages illimités',
      'Support VIP ultra-prioritaire',
      'Accès anticipé aux nouveautés',
      'Soutenez le développement de l\'app',
      'Participez à l\'évolution du projet',
      'Toutes les fonctionnalités MJ',
    ],
  },
  // Ajoutez ceci à la fin du fichier
export interface PromoCode {
  code: string;
  discountType: 'percentage' | 'fixed_amount';
  value: number; // ex: 10 pour 10% ou 10€
}
];