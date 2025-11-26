import React from 'react';
import { 
  Sword, Users, ArrowRight, Zap, Heart, 
  CheckCircle2, Shield, Sparkles, Crown, Star 
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../types/subscription';

// On définit une interface simplifiée pour l'affichage si nécessaire, 
// ou on utilise directement celle importée.
// Pour la Home, on a besoin d'afficher les visuels.

interface HomePageProps {
  onGetStarted: () => void;
}

export function HomePage({ onGetStarted }: HomePageProps) {

  const bgStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.8)), url(/fondecran/Table.png)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  };

  const scrollToSubscription = () => {
    document.getElementById('abonnements')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Liste des images pour la galerie
  const galleryImages = [
    { src: "/Visuels_HomePage/Classes.png", alt: "Classes et Personnages" },
    { src: "/Visuels_HomePage/fiche_perso.png", alt: "Fiche Personnage Complète" },
    { src: "https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/Cr%C3%A9ation_objets_perso.png", alt: "Création d'objets" },
    { src: "/Visuels_HomePage/Gestion_loots.png", alt: "Gestion des Loots" },
    { src: "/Visuels_HomePage/Gestion_sorts.png", alt: "Gestion des Sorts" },
    { src: "https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/choix_fond-%C3%A9cran.png", alt: "Personnalisation" }
  ];

  // Helper pour les couleurs des cartes (repris de SubscriptionPage pour la cohérence visuelle)
  const getPlanColor = (color: string) => {
    switch (color) {
      case 'gray': return 'border-gray-500/30 bg-gray-500/10 text-gray-400';
      case 'blue': return 'border-blue-500/50 bg-blue-500/10 text-blue-400';
      case 'purple': return 'border-purple-500/50 bg-purple-500/10 text-purple-400';
      case 'gold': return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400';
      default: return 'border-gray-500/30 bg-gray-500/10 text-gray-400';
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'hero': return <Sparkles className="w-8 h-8" />;
      case 'game_master': return <Crown className="w-8 h-8" />;
      case 'celestial': return <Star className="w-8 h-8" />;
      default: return <Shield className="w-8 h-8" />;
    }
  };

  return (
    <div className="min-h-screen text-gray-100" style={bgStyle}>
      
      {/* --- SECTION 1 : ACCROCHE --- */}
      <div className="container mx-auto px-4 pt-24 pb-16 text-center">
        <div className="inline-block mb-8">
          <img 
            src="/icons/wmremove-transformed.png" 
            alt="Le Compagnon D&D" 
            className="h-28 w-28 mx-auto object-contain animate-pulse"
            style={{ backgroundColor: 'transparent' }}
          />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight" style={{
          textShadow: `0 0 30px rgba(255, 255, 255, 0.3)`
        }}>
          Le Compagnon ultime pour D&D 5e <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            pensé pour les francophones
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
          Fiches persos. Objets. Combats. Jets. Sorts. Campagnes.<br/>
          Tout est là, <span className="text-white font-semibold">automatisé, fluide, et 100% en français</span>. 
          Plus besoin de perdre du temps avec des outils lourds ou en anglais.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={onGetStarted}
            className="btn-primary px-8 py-4 rounded-xl flex items-center gap-3 text-lg font-bold hover:scale-105 transition-transform shadow-lg shadow-blue-500/20"
          >
            Commencer l'aventure
            <ArrowRight size={24} />
          </button>
          <button
             onClick={scrollToSubscription}
             className="px-8 py-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white font-semibold hover:bg-white/10 transition-all"
          >
            Voir les offres
          </button>
        </div>
      </div>

      {/* --- SECTION 2 : POURQUOI LE COMPAGNON ? --- */}
      <div className="bg-black/40 backdrop-blur-md py-20 border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
              Pourquoi gérer vos parties est devenu une corvée ?
            </h2>
            <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
              <p>
                Entre les feuilles volantes, les applis traduites à moitié, ou les logiciels trop techniques, vous perdez du temps…
                Résultat ? Vos parties ralentissent, et vous perdez le flow.
              </p>
              <p className="font-medium text-white text-xl">
                Le vrai problème ?
              </p>
              <p>
                Les outils classiques ne sont pas conçus pour vous. Ni pour les MJ francophones. Ni pour les joueurs qui veulent juste... jouer. Nickel.
              </p>
            </div>
            
            <div className="mt-12 p-8 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-500/20">
              <p className="text-xl md:text-2xl font-semibold text-blue-200">
                C’est exactement pour ça que Le Compagnon D&D a été créé.
              </p>
              <p className="mt-4 text-blue-100/80">
                Une appli 100% en ligne, légère, et toujours à jour pensée pour le plaisir de jeu, pas pour la prise de tête.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 3 : BÉNÉFICES PRINCIPAUX --- */}
      <div className="container mx-auto px-4 py-24">
        <h2 className="text-3xl md:text-5xl font-bold text-center text-white mb-16">
          Ce que vous allez (enfin) pouvoir vivre…
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            { icon: <Users className="w-6 h-6" />, text: "Créez un perso complet, prêt à jouer en 5 minutes" },
            { icon: <Sword className="w-6 h-6" />, text: "Automatisez les combats, les jets, la CA, l’inventaire" },
            { icon: <Heart className="w-6 h-6" />, text: "Gagnez du temps à chaque session, restez dans l’immersion" },
            { icon: <Zap className="w-6 h-6" />, text: "Un vrai assistant pour vos parties autour de la table… ou à distance" },
            { icon: <CheckCircle2 className="w-6 h-6" />, text: "Suivi des objets, des états, des sorts, tout centralisé" },
            { icon: <Sparkles className="w-6 h-6" />, text: "Système 100% connecté : toujours à jour, aucune installation" }
          ].map((benefit, idx) => (
            <div key={idx} className="flex items-start gap-4 p-6 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-colors">
              <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                {benefit.icon}
              </div>
              <p className="text-lg text-gray-200 font-medium pt-1">
                {benefit.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* --- SECTION 4 : POUR QUI ? --- */}
      <div className="bg-gradient-to-b from-transparent to-black/60 py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-bold text-center text-white mb-4">
            Une appli. Deux profils.
          </h2>
          <p className="text-xl text-center text-gray-400 mb-16">Zéro friction.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto mb-24">
            {/* Carte Joueurs */}
            <div className="p-8 rounded-2xl bg-black/40 border border-blue-500/30 relative overflow-hidden group hover:border-blue-500/60 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sword size={120} />
              </div>
              <h3 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-3">
                <Users /> Pour les Joueurs
              </h3>
              <ul className="space-y-4 text-gray-300">
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-blue-500"/> Générez 5 perso en plan héro</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-blue-500"/> Accès rapide aux stats, jets, inventaire</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-blue-500"/> Dice roller 3D intégré</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-blue-500"/> Suivi de la concentration et des états</li>
              </ul>
            </div>

            {/* Carte MJ */}
            <div className="p-8 rounded-2xl bg-black/40 border border-purple-500/30 relative overflow-hidden group hover:border-purple-500/60 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Crown size={120} />
              </div>
              <h3 className="text-2xl font-bold text-purple-400 mb-6 flex items-center gap-3">
                <Crown /> Pour les Maîtres du Jeu
              </h3>
              <ul className="space-y-4 text-gray-300">
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-purple-500"/> Création et partage de campagnes</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-purple-500"/> Envoi d’objets et d’audios en direct</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-purple-500"/> Gestion des notes MJ privées</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-purple-500"/> Visualisation des joueurs en temps réel</li>
              </ul>
            </div>
          </div>

          {/* --- ABONNEMENTS (Reprise visuelle) --- */}
          <div id="abonnements" className="scroll-mt-24">
            <h3 className="text-2xl font-bold text-white text-center mb-12 opacity-90">
              Des formules adaptées à votre aventure
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const colorClass = getPlanColor(plan.color);
                return (
                  <div key={plan.id} className={`relative bg-gray-900/80 backdrop-blur-sm border rounded-xl overflow-hidden hover:scale-105 transition-all duration-300 ${colorClass.split(' ')[0]} ${plan.popular ? 'ring-2 ring-yellow-500/50' : ''}`}>
                    {plan.popular && (
                      <div className="absolute top-4 right-4 bg-yellow-500 text-gray-900 px-3 py-1 rounded-full text-xs font-bold">
                        POPULAIRE
                      </div>
                    )}
                    <div className="p-6 flex flex-col h-full">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${colorClass.split(' ')[1]} ${colorClass.split(' ')[2]}`}>
                        {getPlanIcon(plan.id)}
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">{plan.name}</h4>
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-white">{plan.price === 0 ? "Gratuit" : `${plan.price}€`}</span>
                        <span className="text-gray-400 text-sm ml-1">{plan.price === 0 ? "" : "/an"}</span>
                      </div>
                      
                      <ul className="space-y-2 mb-8 flex-grow">
                        {plan.features.slice(0, 4).map((feat, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                             <CheckCircle2 size={14} className={`shrink-0 mt-1 ${colorClass.split(' ')[2]}`} />
                             {feat}
                          </li>
                        ))}
                        {plan.features.length > 4 && (
                          <li className="text-xs text-gray-500 italic">+ autres avantages...</li>
                        )}
                      </ul>

                      <button
                        onClick={onGetStarted}
                        className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                          plan.id === 'celestial' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
                          plan.id === 'game_master' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                          plan.id === 'hero' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                          'bg-gray-700 hover:bg-gray-600 text-white'
                        }`}
                      >
                        Choisir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* --- SECTION 5 : VISUELS & DÉMO --- */}
      <div className="py-24 bg-black/20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
            À quoi ça ressemble ?
          </h2>
          <p className="text-gray-400 text-center mb-12">Jetez un coup d'œil à l'interface</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryImages.map((img, index) => (
              <div key={index} className="group relative aspect-video rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-gray-900">
                <img 
                  src={img.src} 
                  alt={img.alt} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                  <span className="text-white font-medium text-lg">{img.alt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer simple */}
      <footer className="text-center text-gray-500 text-sm py-8 border-t border-white/5 bg-black/40">
        <div className="flex justify-center gap-6 mb-4">
            <a href="https://le-compagnon-dnd.fr/confidentialite.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Confidentialité</a>
            <a href="https://le-compagnon-dnd.fr/conditions.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Conditions</a>
        </div>
        © 2025 Le Compagnon D&D - Tous droits réservés
      </footer>
    </div>
  );
}