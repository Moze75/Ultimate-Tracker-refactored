import React from 'react';
import { Sword, Users, BookOpen, ArrowRight, Dice6, Zap, Package, Heart } from 'lucide-react';

interface HomePageProps {
  onGetStarted: () => void;
}

export function HomePage({ onGetStarted }: HomePageProps) {

  const bgStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(/fondecran/Table.png)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  };

  const features = [
    {
      icon: <Sword className="w-8 h-8" />,
      title: "Gestion de Personnages",
      description: "Créez et gérez vos personnages D&D avec un système complet de fiches détaillées."
    },
     {
      icon: <Users className="w-8 h-8" />,
      title: "Mode Maître du Jeu",
      description: "Envoyez des items à vos joueurs et gérez vos campagnes en temps réel."
    },
       {
      icon: <Zap className="w-8 h-8" />,
      title: "Equipement Automatique",
      description: "Mise à jour automatique des statistiques en équipant des objets et équipements."
    },
      {
      icon: <Dice6 className="w-8 h-8" />,
      title: "Dés 3D",
      description: "Lancez vos dés avec des animations 3D réalistes pour une immersion totale."
    },
     {
      icon: <Package className="w-8 h-8" />,
      title: "Objets Personnalisés",
      description: "Créez vos propres objets avec des images personnalisables et des effets uniques."
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: "Gestion Complète",
      description: "Points de vie, sorts, attaques et de nombreuses autres fonctionnalités pour vos personnages."
    }
  ];


  const news = [
    {
      date: "Janvier 2025",
      title: "Lancement de la version Beta",
      content: "Bienvenue sur Le Compagnon D&D ! Nous sommes ravis de vous présenter notre outil de gestion de parties."
    },

  ];

  return (
    <div className="min-h-screen" style={bgStyle}>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-20 pt-12">
          <div className="inline-block mb-6">
            <img 
              src="/icons/wmremove-transformed.png" 
              alt="Le Compagnon D&D" 
              className="h-24 w-24 mx-auto object-contain animate-pulse"
              style={{ backgroundColor: 'transparent' }}
            />
          </div>
          
          <h1 className="text-6xl font-bold text-white mb-6" style={{
            textShadow: `
              0 0 15px rgba(255, 255, 255, 0.9),
              0 0 20px rgba(255, 255, 255, 0.6),
              0 0 30px rgba(255, 255, 255, 0.4)
            `
          }}>
            Le Compagnon D&D
          </h1>
          
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto" style={{
            textShadow: '0 0 10px rgba(255, 255, 255, 0.3)'
          }}>
            Votre assistant numérique pour gérer vos personnages, organiser vos parties 
            et vivre des aventures épiques dans l'univers de Donjons & Dragons.
          </p>
          
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={onGetStarted}
              className="btn-primary px-8 py-3 rounded-lg flex items-center gap-2 text-lg font-semibold hover:scale-105 transition-transform"
            >
              Commencer l'aventure
              <ArrowRight size={24} />
            </button>
            
            <button
              onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all"
            >
              En savoir plus
            </button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12 opacity-90">
            Fonctionnalités
          </h2>
          
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="stat-card p-6 hover:border-blue-500/50 transition-colors"
              >
                <div className="text-blue-400 mb-4 opacity-80">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* News Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12 opacity-90">
            Actualités
          </h2>
          
          <div className="max-w-3xl mx-auto space-y-4">
            {news.map((item, index) => (
              <div key={index} className="stat-card p-6 border-l-4 border-blue-500/30">
                <div className="flex items-start gap-4 flex-col sm:flex-row">
                  <div className="text-blue-400 text-xs font-mono uppercase tracking-wider sm:min-w-[120px]">
                    {item.date}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-100 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-300">
                      {item.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thanks Section */}
        <div className="mb-20">
          <div className="stat-card p-8 max-w-4xl mx-auto border-l-4 border-yellow-500/30">
            <div className="flex items-center justify-center mb-6">
              <Stars className="w-10 h-10 text-yellow-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-white text-center mb-6 opacity-90">
              Remerciements
            </h2>
            
            <div className="text-gray-300 text-center space-y-4 leading-relaxed">
              <p className="text-base">
                Un grand merci à mes joueurs pour leur aide précieuse dans le développement de cette application, coeur sur vous les copains :
              </p>
              
              <div className="flex justify-center gap-3 flex-wrap my-6">
                <span className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300 font-semibold">
                  Grut
                </span>
                <span className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-300 font-semibold">
                  Mhuggen
                </span>
                <span className="px-4 py-2 bg-pink-500/10 border border-pink-500/30 rounded-lg text-pink-300 font-semibold">
                  Philomène
                </span>
                <span className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-300 font-semibold">
                  Riane
                </span>
              </div>
              
              <p className="text-sm text-gray-400">
               Merci égalements aux précieux retours de Draniak et Bluemoown du discord Nantais (meilleure commu dnd btw) ! 🎲
              </p>
            </div>
          </div>
        </div>

        
        {/* About Section */}
        <div id="about" className="mb-20">
          <div className="stat-card p-8 max-w-4xl mx-auto border-t-2 border-blue-500/20">
            <h2 className="text-2xl font-bold text-white text-center mb-6 opacity-90">
              À propos
            </h2>
            
            <div className="text-gray-300 space-y-4 leading-relaxed text-sm">
              <p>
                <strong className="text-gray-100">Le Compagnon D&D</strong> est une application web 
                conçue pour faciliter la gestion de vos parties de Donjons & Dragons. 
                Que vous soyez Maître de Jeu ou joueur, notre plateforme vous offre 
                tous les outils nécessaires pour vivre des aventures mémorables.
              </p>
              
              <p>
                <strong className="text-gray-100">Fonctionnalités principales :</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Création et gestion complète de personnages</li>
                <li>Suivi des points de vie, sorts et inventaires</li>
                <li>Organisation de parties multijoueurs</li>
                <li>Journal de campagne partagé</li>
                <li>Outils de combat et lanceurs de dés intégrés</li>
                <li>Synchronisation en temps réel entre joueurs</li>
              </ul>
              
              <p>
                Notre objectif est de rendre vos sessions de jeu plus fluides et immersives, 
                tout en gardant l'esprit du jeu de rôle papier que nous aimons tant.
              </p>
              
              <p className="text-sm text-gray-400 pt-4 border-t border-gray-700">
                <strong>Note :</strong> Le Compagnon D&D est un projet indépendant non affilié 
                à Wizards of the Coast. Donjons & Dragons est une marque déposée de Wizards of the Coast LLC.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-400 text-sm space-y-4 pb-8">
          <div className="flex justify-center gap-6 flex-wrap">
            <a
              href="https://le-compagnon-dnd.fr/confidentialite.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-200 underline transition-colors"
            >
              Politique de confidentialité
            </a>
            <span className="hidden sm:inline">·</span>
            <a
              href="https://le-compagnon-dnd.fr/conditions.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-200 underline transition-colors"
            >
              Conditions d'utilisation
            </a>
          </div>
          
          <div>
            © 2025 Le Compagnon D&D - Tous droits réservés
          </div>
        </footer>
      </div>
    </div>
  );
}