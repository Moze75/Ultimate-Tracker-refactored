import changelog from '../data/changelog.json';

const tagColors: Record<string, string> = {
  'Nouveauté':    'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Amélioration': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Correction':   'bg-green-500/20 text-green-300 border-green-500/30',
};

interface ChangelogPageProps {
  onBack?: () => void;
}

export function ChangelogPage({ onBack }: ChangelogPageProps) {
  return ( 
<div className="min-h-screen bg-[#0f172a] text-gray-100 py-24 px-4">

  {/* ✅ AJOUT : bouton retour visible seulement si on vient de la homepage */}
  {onBack && (
    <button
      onClick={onBack}
      className="fixed top-4 left-4 text-gray-400 hover:text-white flex items-center gap-2 text-sm transition-colors"
    >
      ← Retour
    </button>
  )}

  <div className="max-w-2xl mx-auto">

        <h1 className="text-4xl font-semibold text-[#EFE6D8] mb-2 text-center"
            style={{ fontFamily: 'Cinzel, serif' }}>
          Journal des mises à jour
        </h1>
        <p className="text-gray-400 text-center mb-16"
           style={{ fontFamily: 'Inter, sans-serif' }}>
          Toutes les mises à jour du Compagnon D&D
        </p>

        <div className="relative">
          {/* Ligne verticale timeline */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />

          <div className="space-y-10 pl-12">
            {changelog.map((entry, i) => (
              <div key={i} className="relative">
                {/* Point sur la timeline */}
                <div className="absolute -left-12 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-[#0f172a]" />

                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-gray-500"
                        style={{ fontFamily: 'Inter, sans-serif' }}>
                    {new Date(entry.date).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${tagColors[entry.tag] ?? 'bg-white/10 text-gray-300 border-white/20'}`}>
                    {entry.tag}
                  </span>
                  <span className="text-xs text-gray-600 font-mono">v{entry.version}</span>
                </div>

                <h2 className="text-lg font-semibold text-[#EFE6D8] mb-3"
                    style={{ fontFamily: 'Cinzel, serif' }}>
                  {entry.title}
                </h2>

                <ul className="space-y-1.5">
                  {entry.changes.map((change, j) => (
                    <li key={j} className="flex items-start gap-2 text-gray-400 text-sm"
                        style={{ fontFamily: 'Inter, sans-serif' }}>
                      <span className="text-blue-500 mt-1 shrink-0">·</span>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}