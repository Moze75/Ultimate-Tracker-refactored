import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sword, Users, ArrowRight, Zap, Heart, 
  CheckCircle2, Shield, Sparkles, Crown, Star,
  HelpCircle, ChevronDown, ChevronUp, Lock,
  X, ChevronLeft, ChevronRight, Download
} from 'lucide-react';

interface HomePageProps {
  onGetStarted: () => void;
}

/* --- NOUVEAU COMPOSANT POUR LE ZOOM --- */
function ZoomableImageModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center overflow-hidden"
      onClick={onClose} // Ferme si on clique sur le fond noir
    >
      {/* Bouton Fermer */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 rounded-full p-2 transition-colors z-50"
      >
        <X size={32} />
      </button>

      {/* Conteneur de l'image avec scroll si zoomé */}
      <div 
        className={`w-full h-full flex items-center justify-center transition-all duration-300 ${isZoomed ? 'overflow-auto cursor-zoom-out' : 'overflow-hidden cursor-zoom-in'}`}
        onClick={(e) => e.stopPropagation()} // Empêche la fermeture si on clique sur le conteneur
      >
        <img
          src={src}
          alt={alt}
          onClick={() => setIsZoomed(!isZoomed)}
          className={`transition-transform duration-300 ease-out select-none max-w-none ${
            isZoomed 
              ? 'scale-[2] md:scale-[2.5] cursor-zoom-out' // Zoom fort
              : 'max-h-[90vh] max-w-[90vw] object-contain cursor-zoom-in' // Fit écran
          }`}
          style={{
            transformOrigin: 'center center'
          }}
        />
      </div>
      
      {/* Indication visuelle */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm pointer-events-none bg-black/40 px-3 py-1 rounded-full">
        {isZoomed ? 'Cliquez pour dézoomer' : 'Cliquez pour zoomer'}
      </div>
    </div>
  );
}

export function HomePage({ onGetStarted }: HomePageProps) {
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  
  // Ref pour le carrousel
  const carouselRef = useRef<HTMLDivElement>(null);

  // Gestion du scroll pour le bouton flottant
  useEffect(() => {
    const handleScroll = () => {
      setShowFloatingCTA(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const bgStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.8)), url(/fondecran/Table.png)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  };

  const scrollToSubscription = () => {
    document.getElementById('abonnements')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fonction pour sauvegarder l'intention de souscription avant le login
  const handlePlanSelection = (planId: string) => {
    if (planId && planId !== 'free') {
      localStorage.setItem('pending_plan_selection', planId);
    }
    onGetStarted();
  };

  const galleryImages = [
    { src: "https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/Classes.png", alt: "Classes et Personnages" },
    { src: "https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/fiche_perso.png", alt: "Fiche Personnage Complète" },
    { src: "https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/Cr%C3%A9ation_objets_perso.png", alt: "Création d'objets" },
     {src: 'https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/Le-Compagnon-dans-Obsidian.png', alt: "Mode MJ dans Obsidian" },
    { src: "https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/Gestion_loots.png", alt: "Gestion des Loots" },
    { src: "https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/Gestion_sorts.png", alt: "Gestion des Sorts" },
    { src: "https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/choix_fond-%C3%A9cran.png", alt: "Personnalisation" }
      
  ];

  // --- LOGIQUE DU VIEWER ---
  
  const closeViewer = () => setSelectedImageIndex(null);

  const nextImage = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedImageIndex === null) return;
    setSelectedImageIndex((prev) => (prev === null ? null : (prev + 1) % galleryImages.length));
  }, [selectedImageIndex, galleryImages.length]);

  const prevImage = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedImageIndex === null) return;
    setSelectedImageIndex((prev) => (prev === null ? null : (prev - 1 + galleryImages.length) % galleryImages.length));
  }, [selectedImageIndex, galleryImages.length]);

  // --- LOGIQUE DU CARROUSEL (Scroll) ---
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = carouselRef.current.clientWidth * 0.8; // Scroll 80% de la largeur
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Gestion du clavier (Echap, Gauche, Droite)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIndex === null) return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    // Bloquer le scroll du body quand le viewer est ouvert
    if (selectedImageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [selectedImageIndex, nextImage, prevImage]);


  const faqs = [
    {
      question: "Est-ce que c’est gratuit au début ?",
      answer: "Oui. 15 jours d’essai, toutes fonctionnalités, sans carte bancaire."
    },
    {
      question: "Est-ce que c’est comme Roll20 ou Foundry ?",
      answer: "Non. Le Compagnon n’est pas une table virtuelle (VTT). C’est un assistant intelligent pour vos parties en présentiel ou en vocal, conçu pour fluidifier le jeu, pas pour gérer des cartes tactiques complexes."
    },
    {
      question: "Est-ce que ça fonctionne hors ligne ?",
      answer: "Non. L’app est 100% en ligne, pour garantir une navigation rapide, fluide, et à jour. Cependant, une fois installée en tant qu'App (PWA), elle offre une expérience très proche du natif."
    },
    {
      question: "Est-ce compatible mobile/tablette/PC ?",
      answer: "Oui. Vous pouvez y accéder depuis n’importe quel appareil connecté. L'interface s'adapte automatiquement."
    },
    {
      question: "Et si j’ai un bug ou un souci ?",
      answer: "Une équipe réactive est disponible via le support et les Célestes bénéficient d'un support prioritaire."
    }
  ];

  return (
    <div className="min-h-screen text-gray-100 font-sans" style={bgStyle}>
      
      {/* --- SECTION 1 : ACCROCHE --- */}
      <div className="container mx-auto px-4 pt-24 pb-16 text-center relative z-10">
        <div className="inline-block mb-6">
          <img 
            src="/icons/wmremove-transformed.png" 
            alt="Le Compagnon D&D" 
            className="h-32 w-32 mx-auto object-contain animate-pulse"
            style={{ backgroundColor: 'transparent' }}
          />
        </div>
        
        {/* 1. TITRE MODIFIÉ */}
<h1 
  className="text-5xl md:text-7xl font-semibold text-[#EFE6D8] mb-4 tracking-tight" 
  style={{ 
    fontFamily: 'Cinzel, serif',
    textShadow: '0 0 30px rgba(239,230,216,0.4)'
  }}
>
  Le Compagnon
</h1>

<h2 
  className="text-2xl md:text-3xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-6"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  L'outil ultime pour D&D 5e, pensé pour les francophones
</h2>
        
<p 
  className="text-lg text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
>
  Fiches persos. Objets. Combats. Jets. Sorts. Campagnes.<br/>
  Tout est là, <span className="text-white font-semibold" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>automatisé, fluide, et 100% en français</span>. 
  Plus besoin de perdre du temps avec des outils lourds ou en anglais.
</p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={onGetStarted}
            className="btn-primary px-8 py-4 rounded-xl flex items-center gap-3 text-lg font-bold hover:scale-105 transition-transform shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/50"
          >
            Commencer l'aventure
            <ArrowRight size={24} />
          </button>
        </div>
      </div>

      {/* --- SECTION 2 : POURQUOI LE COMPAGNON ? --- */}
      <div className="bg-black/60 backdrop-blur-md py-20 border-y border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
<h2 
  className="text-3xl md:text-4xl font-semibold text-[#EFE6D8] mb-8"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  Pourquoi gérer vos parties est devenu une corvée ?
</h2>
            <div 
  className="space-y-6 text-lg text-gray-300 leading-relaxed"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
>
  <p>
    Entre les feuilles volantes, les applis traduites à moitié, ou les logiciels trop techniques, vous perdez du temps…
    Résultat ? Vos parties ralentissent, et vous perdez le flow.
  </p>
  <p 
    className="font-semibold text-[#EFE6D8] text-xl"
    style={{ fontFamily: 'Cinzel, serif' }}
  >
    Le vrai problème ?
  </p>
  <p>
    Les outils classiques ne sont pas conçus pour vous. Ni pour les MJ francophones. Ni pour les joueurs qui veulent juste... jouer. Nickel.
  </p>
</div>
            
            <div className="mt-12 p-8 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-500/20">
<p 
  className="text-xl md:text-2xl font-semibold text-blue-200"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  C'est exactement pour ça que Le Compagnon a été créé.
</p>
<p 
  className="mt-4 text-blue-100/80"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
>
  une appli 100% ligne, légère et toujours à jours. Pensée pour le plaisir du jeu, sans prise de tête. 
</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 3 : BÉNÉFICES PRINCIPAUX --- */}
      <div className="container mx-auto px-4 py-24">
<h2 
  className="text-3xl md:text-5xl font-semibold text-center text-[#EFE6D8] mb-16"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  Ce que vous allez (enfin) pouvoir vivre…
</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            { icon: <Users className="w-6 h-6" />, text: "Créez un perso complet, prêt à jouer en 5 minutes" },
            { icon: <Sword className="w-6 h-6" />, text: "Automatisez les combats, les jets, la CA, l’inventaire" },
            { icon: <Zap className="w-6 h-6" />, text: "Un vrai assistant pour vos parties autour de la table… ou à distance" },
            { icon: <CheckCircle2 className="w-6 h-6" />, text: "Suivi des objets, des états, des sorts, tout centralisé" },
            { icon: <Crown className="w-6 h-6" />, text: "Maitres du jeu : Envoyez des loots à vos joueurs en 2 clics" },
            { icon: <Download className="w-6 h-6" />, text: "Système 100% connecté : toujours à jour, installable en App (PWA)" }
          ].map((benefit, idx) => (
            <div key={idx} className="flex items-start gap-4 p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300">
              <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                {benefit.icon}
              </div>
<p 
  className="text-lg text-gray-300 pt-1"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
>
  {benefit.text}
</p>
            </div>
          ))}
        </div>
      </div>

      {/* --- SECTION 4 : POUR QUI ? --- */}
      <div className="bg-gradient-to-b from-transparent to-black/60 py-24">
        <div className="container mx-auto px-4">
       <h2 
  className="text-3xl md:text-5xl font-semibold text-center text-[#EFE6D8] mb-4"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  Une appli. Deux profils.
</h2>
<p 
  className="text-xl text-center text-gray-400 mb-16"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
>
  Zéro friction.
</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto mb-24">
            {/* Carte Joueurs */}
            <div className="p-8 rounded-2xl bg-black/40 border border-blue-500/30 relative overflow-hidden group hover:border-blue-500/60 transition-all hover:-translate-y-1 duration-300 shadow-lg hover:shadow-blue-900/20">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sword size={120} />
              </div>
<h3 
  className="text-2xl font-semibold text-blue-400 mb-6 flex items-center gap-3"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  <Users /> Pour les Joueurs
</h3>
              <ul className="space-y-4 text-gray-300">
<li 
  className="flex items-center gap-3"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
>
  <CheckCircle2 size={18} className="text-blue-500 shrink-0"/> Générez 5 persos en plan héro
</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-blue-500 shrink-0"/> Accès rapide aux stats, jets, inventaire</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-blue-500 shrink-0"/> Dice roller 3D intégré</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-blue-500 shrink-0"/> Suivi de la concentration et des états</li>
              </ul>
              <button onClick={scrollToSubscription} className="mt-8 w-full py-3 rounded-lg border border-blue-500/50 text-blue-300 hover:bg-blue-500/10 transition-colors">
                Voir les abonnements
              </button>
            </div>

            {/* Carte MJ */}
            <div className="p-8 rounded-2xl bg-black/40 border border-purple-500/30 relative overflow-hidden group hover:border-purple-500/60 transition-all hover:-translate-y-1 duration-300 shadow-lg hover:shadow-purple-900/20">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Crown size={120} />
              </div>
<h3 
  className="text-2xl font-semibold text-purple-400 mb-6 flex items-center gap-3"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  <Crown /> Pour les Maîtres du Jeu
</h3>
              <ul className="space-y-4 text-gray-300">
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-purple-500 shrink-0"/> Création de campagnes et invitations des joueurs</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-purple-500 shrink-0"/> Envoi d’objets customs</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-purple-500 shrink-0"/> Loots aléatoires et envois ciblés</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-purple-500 shrink-0"/> Visualisation des joueurs connectés</li>
              </ul>
               <button onClick={scrollToSubscription} className="mt-8 w-full py-3 rounded-lg border border-purple-500/50 text-purple-300 hover:bg-purple-500/10 transition-colors">
                Voir les abonnements
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* --- SECTION 5 : VISUELS & DÉMO (CARROUSEL) --- */}
      <div className="py-24 bg-black/20 border-y border-white/5 overflow-hidden">
        <div className="container mx-auto px-4">
<h2 
  className="text-3xl md:text-4xl font-semibold text-center text-[#EFE6D8] mb-12"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  À quoi ça ressemble ?
</h2>

          {/* Conteneur Carrousel avec flèches */}
          <div className="relative group max-w-7xl mx-auto">
            
            {/* Bouton Gauche (Desktop) */}
            <button 
              onClick={() => scrollCarousel('left')}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 p-3 bg-black/70 text-white rounded-full border border-white/10 hover:bg-blue-600 transition-colors shadow-xl"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Zone de scroll (Scroll Snap) */}
            {/* 3. NOUVELLE GALERIE TYPE CARROUSEL */}
            <div 
              ref={carouselRef}
              className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide px-4 md:px-0"
              style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
            >
              {galleryImages.map((img, index) => (
                <div 
                  key={index} 
                  className="snap-center shrink-0 w-[85vw] md:w-[450px] lg:w-[550px] first:pl-0 last:pr-4"
                >
                  <div 
                    onClick={() => setSelectedImageIndex(index)}
                    className="group relative aspect-video rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-gray-900 cursor-pointer transform transition-all duration-300 hover:border-blue-500/50"
                  >
                    <img 
                      src={img.src} 
                      alt={img.alt} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Overlay au survol */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <div className="bg-black/60 p-3 rounded-full text-white border border-white/20 backdrop-blur-sm">
                          <Sparkles size={24} />
                       </div>
                    </div>
                    {/* Légende */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
                    <span 
  className="text-[#EFE6D8] font-semibold text-lg drop-shadow-md"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  {img.alt}
</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bouton Droite (Desktop) */}
            <button 
              onClick={() => scrollCarousel('right')}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 p-3 bg-black/70 text-white rounded-full border border-white/10 hover:bg-blue-600 transition-colors shadow-xl"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          
          {/* Indicateur de swipe pour mobile */}
          <div className="md:hidden flex justify-center gap-2 mt-2">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
            </div>
          </div>

          {/* --- SECTION MOBILE --- */}
          <div className="mt-32 flex flex-col md:flex-row items-center justify-center gap-16 max-w-6xl mx-auto">
            
            {/* Visuel Téléphone */}
            <div className="flex-1 flex justify-center md:justify-end order-2 md:order-1">
               <div className="relative rounded-[2.5rem] border-8 border-gray-900 bg-gray-900 shadow-2xl shadow-blue-900/20 overflow-hidden max-w-[280px] transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                 <img 
                   src="https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/ecran_mobile_1.png" 
                   alt="Interface Mobile Le Compagnon" 
                   className="w-full h-auto block"
                 />
               </div>
            </div>

            {/* Texte Explicatif */}
            <div className="flex-1 text-center md:text-left order-1 md:order-2">
               <div className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-semibold mb-4">
                  App mobile
               </div>
            <h3 
  className="text-3xl md:text-4xl font-semibold text-[#EFE6D8] mb-6 leading-tight"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  Le jeu dans la main, dans votre langue,<br/>
  <span 
    className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400"
    style={{ fontFamily: 'Cinzel, serif' }}
  >
    Préparez votre campagne sur PC, partez à l'aventure sur mobile.
  </span>
</h3>
           <div 
  className="space-y-6 text-lg text-gray-300 leading-relaxed"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
>
  <p>
    Le Compagnon s'adapte à votre façon de jouer, sans compromis.
  </p>
  <p>
Pas de version comprimée ou bricolée après coup :
        </p> 
  <p>
chaque détail a été pensé pour la fluidité, la lisibilité, et l'accessibilité, même en pleine partie.

Et contrairement à d’autres outils, ici tout est en français, dès le premier clic.
Pas de traductions à la volée, pas de confusion :
juste une app claire, accessible, et conçue pour la communauté francophone.
                 </p>
               </div>
            </div>
            
          </div>
          
        </div>
      </div>


      {/* --- SECTION 6 : CHOISISSEZ VOTRE PLAN --- */}
      <div id="abonnements" className="py-24 scroll-mt-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
<h2 
  className="text-3xl md:text-4xl font-semibold text-[#EFE6D8] mb-4"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  Choisissez votre équipement avant d'entrer dans l'arène
</h2>
<p 
  className="text-xl text-gray-400 max-w-2xl mx-auto"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
>
  Quel que soit votre niveau, il y a un plan pour vous accompagner dans vos aventures.
</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1400px] mx-auto">
            
            {/* Plan Gratuit */}
            <div className="relative bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden flex flex-col transition-transform hover:scale-[1.02]">
              <div className="p-6 bg-gray-800/50 border-b border-gray-700">
                <Shield className="w-10 h-10 text-gray-400 mb-4" />
             <h3 
  className="text-2xl font-semibold text-[#EFE6D8]"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  Essai Gratuit
</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-white">0€</span>
                  <span className="text-gray-400 text-sm ml-2">/ 15 jours</span>
                </div>
              </div>
              <div className="p-6 flex-grow">
                <ul className="space-y-3 mb-8">
<li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-gray-500 mt-0.5 shrink-0"/> 1 personnage max</li>
<li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-gray-500 mt-0.5 shrink-0"/> Toutes les fonctionnalités disponibles</li>
<li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-gray-500 mt-0.5 shrink-0"/> Test complet sans CB</li>
                </ul>
              </div>
              <div className="p-6 pt-0 mt-auto">
                 <button onClick={onGetStarted} className="w-full py-3 rounded-lg border border-gray-500 text-gray-300 hover:bg-gray-700 transition-colors font-semibold">
                  → Je teste gratuitement
                </button>
              </div>
            </div>

            {/* Plan Héros */}
            <div className="relative bg-blue-900/20 backdrop-blur-sm border border-blue-500/30 rounded-xl overflow-hidden flex flex-col transition-transform hover:scale-[1.02]">
              <div className="p-6 bg-blue-900/30 border-b border-blue-500/30">
                <Sparkles className="w-10 h-10 text-blue-400 mb-4" />
                <h3 className="text-2xl font-bold text-white">Héros</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-white">10€</span>
                  <span className="text-gray-400 text-sm ml-2">/ an</span>
                </div>
              </div>
              <div className="p-6 flex-grow">
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Jusqu’à 5 personnages</li>
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Création d’objets personnalisés</li>
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Suivi de l’état, de la concentration</li>
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Dice Roller & Character Wizard</li>
                  <li className="flex items-start gap-3 text-gray-300 italic text-sm"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Tous les outils pour le joueur régulier</li>
                </ul>
              </div>
              <div className="p-6 pt-0 mt-auto">
                 <button onClick={() => handlePlanSelection('hero')} className="w-full py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-semibold shadow-lg shadow-blue-900/30">
                  → Je deviens Héros
                </button>
              </div>
            </div>

            {/* Plan MJ */}
            <div className="relative bg-purple-900/20 backdrop-blur-sm border border-purple-500/30 rounded-xl overflow-hidden flex flex-col transition-transform hover:scale-[1.02]">
              <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">POPULAIRE</div>
              <div className="p-6 bg-purple-900/30 border-b border-purple-500/30">
                <Crown className="w-10 h-10 text-purple-400 mb-4" />
                <h3 className="text-2xl font-bold text-white">Maître du Jeu</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-white">15€</span>
                  <span className="text-gray-400 text-sm ml-2">/ an</span>
                </div>
              </div>
              <div className="p-6 flex-grow">
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-purple-500 mt-0.5 shrink-0"/> Jusqu’à 15 personnages</li>
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-purple-500 mt-0.5 shrink-0"/> <strong>Accès complet outils MJ</strong></li>
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-purple-500 mt-0.5 shrink-0"/> Campagnes, Envois d'objets, Gestion Joueurs</li>
                  <li className="flex items-start gap-3 text-gray-300 italic text-sm"><CheckCircle2 size={18} className="text-purple-500 mt-0.5 shrink-0"/> Toutes les fonctionnalités Héros incluses</li>
                </ul>
              </div>
              <div className="p-6 pt-0 mt-auto">
                 <button onClick={() => handlePlanSelection('game_master')} className="w-full py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors font-semibold shadow-lg shadow-purple-900/30">
                  → Je prends le contrôle
                </button>
              </div>
            </div>

            {/* Plan Céleste */}
            <div className="relative bg-yellow-900/10 backdrop-blur-sm border border-yellow-500/50 rounded-xl overflow-hidden flex flex-col transition-transform hover:scale-[1.02] ring-1 ring-yellow-500/30">
              <div className="p-6 bg-yellow-900/20 border-b border-yellow-500/30">
                <Star className="w-10 h-10 text-yellow-400 mb-4" />
                <h3 className="text-2xl font-bold text-white">Céleste</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-white">30€</span>
                  <span className="text-gray-400 text-sm ml-2">/ an</span>
                </div>
              </div>
              <div className="p-6 flex-grow">
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-yellow-500 mt-0.5 shrink-0"/> <strong>Personnages illimités</strong></li>
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-yellow-500 mt-0.5 shrink-0"/> Support ultra-prioritaire</li>
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-yellow-500 mt-0.5 shrink-0"/> Accès anticipé aux nouveautés</li>
                  <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-yellow-500 mt-0.5 shrink-0"/> Toutes fonctionnalités Héros + MJ</li>
                </ul>
                
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-2">
<p 
  className="text-xs text-yellow-200 italic leading-relaxed"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
>
  En choisissant Céleste, vous devenez un pilier du projet. Votre soutien nous aide à maintenir l'app et à la faire évoluer. Merci de faire partie de cette aventure.
</p>
                </div>
              </div>
              <div className="p-6 pt-0 mt-auto">
                 <button onClick={() => handlePlanSelection('celestial')} className="w-full py-3 rounded-lg bg-gradient-to-r from-yellow-600 to-yellow-700 text-white hover:from-yellow-500 hover:to-yellow-600 transition-colors font-semibold shadow-lg shadow-yellow-900/30">
                  → Je rejoins les Célestes
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* --- SECTION 7 : FAQ --- */}
      <div className="py-24 bg-black/40 border-t border-white/5">
        <div className="container mx-auto px-4 max-w-4xl">
<h2 
  className="text-3xl font-semibold text-center text-[#EFE6D8] mb-12"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  Questions fréquentes
</h2>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button 
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                <span 
  className="font-semibold text-[#EFE6D8]"
  style={{ fontFamily: 'Cinzel, serif', fontWeight: 600 }}
>
  {faq.question}
</span>
                  {openFaqIndex === index ? <ChevronUp className="text-blue-400"/> : <ChevronDown className="text-gray-500"/>}
                </button>
                {openFaqIndex === index && (
<div 
  className="px-6 pb-6 text-gray-400 leading-relaxed border-t border-white/5 pt-4 animate-in fade-in slide-in-from-top-2 duration-200"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
>
  {faq.answer}
</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- SECTION 8 : CTA FINAL --- */}
      <div className="py-24 bg-gradient-to-t from-blue-900/20 to-transparent">
        <div className="container mx-auto px-4 text-center">
<h2 
  className="text-4xl font-semibold text-[#EFE6D8] mb-4"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  Prêt à simplifier vos parties de D&D ?
</h2>
<p 
  className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto"
  style={{ fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
>
  Que vous soyez joueur ou MJ, Le Compagnon est là pour vous faire gagner du temps… et du plaisir de jeu.
</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onGetStarted}
              className="btn-primary px-8 py-4 rounded-xl text-lg font-bold hover:scale-105 transition-transform shadow-lg shadow-blue-500/30"
            >
              → Je commence gratuitement
            </button>
            <button 
              onClick={scrollToSubscription}
              className="px-8 py-4 rounded-xl border border-white/20 bg-black/30 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              → Je choisis mon plan
            </button>
          </div>
        </div>
      </div>

      {/* --- SECTION 9 : REMERCIEMENTS --- */}
      <div className="py-16 bg-black/60 border-t border-white/5">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <p className="text-gray-300 mb-6 leading-relaxed">
            Merci d’avoir lu jusqu’ici. Si vous êtes encore là, c’est probablement que vous aimez autant que nous l’univers du jeu de rôle.
            On vous souhaite des parties mémorables, des jets de dés chanceux, et des aventures épiques.
          </p>
          
          {/* 4. CRÉDITS MODIFIÉS */}
          <div className="p-6 bg-white/5 rounded-xl border border-yellow-500/20 inline-block">
             <p className="text-gray-400 text-sm mb-3">Un grand merci à mes incroyables joueur·euse·s et testeurs :</p>
             <p className="text-yellow-400 font-medium mb-2 text-lg">
               Grut, Mhuggen, Philomène, Riane, Draniak et Bluemoown
             </p>
             <p className="text-gray-500 text-xs">Et à toute la communauté du discord Nantais ! 🎲</p>
          </div>
          
          <p className="mt-8 text-blue-400 italic font-medium">
            À bientôt dans le multivers du Compagnon DnD
          </p>
        </div>
      </div>

      {/* --- FOOTER --- */}
      <footer className="bg-black py-12 border-t border-white/10 text-center">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 mb-8">
             <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Lock size={14} /> Paiements 100% sécurisés via Mollie
             </div>
                 {/* 5. LIENS MIS À JOUR */}
             <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
                <a href="https://le-compagnon-dnd.fr/confidentialite.html" className="hover:text-white transition-colors">Mentions légales & Confidentialité</a>
                <a href="https://le-compagnon-dnd.fr/conditions.html" className="hover:text-white transition-colors">CGU</a>
                <a href="mailto:Contact@le-compagnon-dnd.fr" className="hover:text-white transition-colors">Contact : Contact@le-compagnon-dnd.fr</a>
             </div>

             {/* 6. LIEN DISCORD */}
             <div className="mt-4">
               <a 
                 href="https://discord.gg/kCSFfKaqKZ" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 transition-all group"
               >
                  <span className="text-gray-400 text-sm group-hover:text-gray-200">Un bug, une question ?</span>
                  <img 
                    src="https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/Discord%20Logo%20png%20-%20641x220.png" 
                    alt="Discord" 
                    className="h-5 w-auto opacity-80 group-hover:opacity-100 transition-opacity"
                  />
               </a>
             </div>
          </div>
          
          <p className="text-gray-600 text-sm">
            © 2025 Le Compagnon D&D - Une application créée par des joueurs, pour des joueurs.
          </p>
          <p className="text-gray-700 text-xs mt-2 max-w-2xl mx-auto">
            Le Compagnon D&D n'est pas affilié à Wizards of the Coast. Donjons & Dragons est une marque déposée de Wizards of the Coast LLC.
          </p>
        </div>
      </footer>



      {/* --- CTA FLOTTANT --- */}
      <div 
        className={`fixed bottom-8 right-8 z-40 transition-all duration-500 ${
          showFloatingCTA ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        }`}
      >
        <button
          onClick={onGetStarted}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-blue-900/50 flex items-center gap-2 animate-bounce-slow"
        >
          Commencer <ArrowRight size={18} />
        </button>
      </div>

      {/* --- NOUVEAU IMAGE VIEWER AVEC ZOOM --- */}
      {selectedImageIndex !== null && (
        <ZoomableImageModal 
          src={galleryImages[selectedImageIndex].src} 
          alt={galleryImages[selectedImageIndex].alt} 
          onClose={closeViewer} 
        />
      )}

    </div>
  );
}