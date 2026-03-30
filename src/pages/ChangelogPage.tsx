import changelog from '../data/changelog.json';

const tagColors: Record<string, string> = {
  'Nouveauté':    'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Amélioration': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Correction':   'bg-green-500/20 text-green-300 border-green-500/30',
};

const tagDot: Record<string, string> = {
  'Nouveauté':    'bg-blue-400',
  'Amélioration': 'bg-purple-400',
  'Correction':   'bg-green-400',
};

interface ChangelogPageProps {
  onBack?: () => void;
}

export function ChangelogPage({ onBack }: ChangelogPageProps) {
  return (
    <div className="relative min-h-screen text-gray-100 overflow-hidden">

      {/* ── Fond image ── */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            'url(https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Table_19.9.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      />

      {/* ── Overlays pour lisibilité ── */}
      {/* Assombrit globalement */}
      <div className="fixed inset-0 bg-[#0a0e1a]/80" />
      {/* Vignette sur les bords */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(5,8,18,0.85) 100%)',
        }}
      />
      {/* Dégradé en bas pour fondre */}
      <div
        className="fixed bottom-0 left-0 right-0 h-48 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(5,8,18,0.95))',
        }}
      />

      {/* ── Bouton retour ── */}
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-4 left-4 z-50 flex items-center gap-2 text-sm text-gray-400 hover:text-[#EFE6D8] transition-colors duration-200 group"
        >
          <span className="group-hover:-translate-x-0.5 transition-transform duration-200">←</span>
          Retour
        </button>
      )}

      {/* ── Contenu ── */}
      <div className="relative z-10 py-24 px-4">
        <div className="max-w-2xl mx-auto">

          {/* En-tête */}
          <div className="text-center mb-16">
            {/* Petite ligne décorative au-dessus du titre */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#c9a96e]/60" />
              <span className="text-[#c9a96e]/70 text-xs tracking-[0.3em] uppercase font-light"
                    style={{ fontFamily: 'Cinzel, serif' }}>
                Compagnon D&D
              </span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#c9a96e]/60" />
            </div>

            <h1
              className="text-4xl font-semibold text-[#EFE6D8] mb-3 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Journal des mises à jour
            </h1>

            {/* Séparateur ornemental */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#c9a96e]/40" />
              <span className="text-[#c9a96e]/50 text-lg">⚔</span>
              <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#c9a96e]/40" />
            </div>

            <p className="text-gray-400 text-sm tracking-wide"
               style={{ fontFamily: 'Inter, sans-serif' }}>
              Toutes les mises à jour du Compagnon D&amp;D
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Ligne verticale */}
            <div
              className="absolute left-4 top-0 bottom-0 w-px"
              style={{
                background:
                  'linear-gradient(to bottom, transparent, rgba(201,169,110,0.25) 10%, rgba(201,169,110,0.15) 90%, transparent)',
              }}
            />

            <div className="space-y-10 pl-12">
              {changelog.map((entry, i) => (
                <div key={i} className="relative group">

                  {/* Point timeline — couleur selon le tag */}
                  <div
                    className={`
                      absolute -left-[2.85rem] top-1.5
                      w-3 h-3 rounded-full border-2 border-[#0a0e1a]
                      shadow-[0_0_8px_2px_rgba(0,0,0,0.6)]
                      transition-transform duration-200 group-hover:scale-125
                      ${tagDot[entry.tag] ?? 'bg-gray-400'}
                    `}
                  />

                  {/* Carte */}
                  <div
                    className="
                      rounded-lg border border-white/[0.07]
                      bg-white/[0.04] backdrop-blur-sm
                      px-5 py-4
                      shadow-[0_4px_24px_rgba(0,0,0,0.4)]
                      transition-all duration-200
                      group-hover:border-[#c9a96e]/20
                      group-hover:bg-white/[0.07]
                    "
                  >
                    {/* Méta : date + tag + version */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span
                        className="text-xs text-gray-500"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {new Date(entry.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          tagColors[entry.tag] ?? 'bg-white/10 text-gray-300 border-white/20'
                        }`}
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {entry.tag}
                      </span>
                      <span
                        className="text-xs text-[#c9a96e]/50 font-mono ml-auto"
                      >
                        v{entry.version}
                      </span>
                    </div>

                    {/* Titre */}
                    <h2
                      className="text-base font-semibold text-[#EFE6D8] mb-3 leading-snug"
                      style={{ fontFamily: 'Cinzel, serif' }}
                    >
                      {entry.title}
                    </h2>

                    {/* Séparateur fin */}
                    <div className="h-px bg-white/5 mb-3" />

                    {/* Liste des changements */}
                    <ul className="space-y-1.5">
                      {entry.changes.map((change, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-gray-400 text-sm leading-relaxed"
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          <span className="text-[#c9a96e]/60 mt-1 shrink-0 text-xs">◆</span>
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pied de page discret */}
          <div className="mt-16 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#c9a96e]/20" />
              <span className="text-[#c9a96e]/30 text-xs tracking-widest uppercase"
                    style={{ fontFamily: 'Cinzel, serif' }}>
                Fin du journal
              </span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#c9a96e]/20" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}