import React, { useMemo } from 'react';

export type MarkdownCtx = {
  characterId?: string | null;
  className?: string;
  subclassName?: string | null;
  checkedMap?: Map<string, boolean>;
  onToggle?: (featureKey: string, checked: boolean) => void;
  section?: { level: number; origin: 'class' | 'subclass'; title: string };
};

function sentenceCase(s: string) {
  const t = (s || '').toLocaleLowerCase('fr-FR').trim();
  if (!t) return t;
  const first = t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1);
  return first.replace(/\b([A-Z]{2,})\b/g, '$1');
}

function slug(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function MarkdownLite({ text, ctx }: { text: string; ctx: MarkdownCtx }) {
  const nodes = useMemo(() => parseMarkdownLite(text, ctx), [text, ctx]);
  return <>{nodes}</>;
}

// --- PARSER INLINE ROBUSTE (Remplace l'ancienne logique fragile) ---
function formatInline(text: string): React.ReactNode {
  if (!text) return null;

  // 1. Nettoyage des liens [Texte](URL) -> Texte pour ne pas casser le parsing
  let cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Nettoyage des restes [Texte] -> Texte
  cleaned = cleaned.replace(/\[([^\]]+)\]/g, '$1');

  // 2. Regex combinée pour Gras (**...**) et Italique (_..._ ou *...*)
  // On utilise split pour ne jamais perdre d'espaces
  const tokenRegex = /(\*\*.+?\*\*|_[^_]+?_|\*[^*]+?\*)/g;

  const parts = cleaned.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // GRAS : **texte**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} className="text-white font-semibold">
          {/* On permet l'italique à l'intérieur du gras */}
          {formatInlineInner(part.slice(2, -2))}
        </strong>
      );
    }

    // ITALIQUE : _texte_ ou *texte*
    if (
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2) ||
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic text-gray-100">
          {part.slice(1, -1)}
        </em>
      );
    }

    // TEXTE NORMAL (Les espaces sont préservés par le split)
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

// Helper pour éviter la récursion infinie dans le gras
function formatInlineInner(text: string): React.ReactNode {
  const parts = text.split(/(_[^_]+?_|\*[^*]+?\*)/g);
  return parts.map((part, index) => {
    if ((part.startsWith('_') && part.endsWith('_')) || (part.startsWith('*') && part.endsWith('*'))) {
      return <em key={index} className="italic">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function parseMarkdownLite(md: string, ctx: MarkdownCtx): React.ReactNode[] {
  // FIX: On remplace les chevrons encodés (&lt;) pour que la détection des BOX fonctionne
  const normalized = md.replace(/&lt;!--/g, '<!--').replace(/--&gt;/g, '-->');

  const lines = normalized.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      out.push(<div key={`sp-${key++}`} className="h-2" />);
      i++;
      continue;
    }

    // Séparateur horizontal ---
    if (/^\s*---+\s*$/.test(line)) {
      out.push(<div key={`hr-${key++}`} className="my-3 border-t border-white/10" />);
      i++;
      continue;
    }

    // Sections spéciales D&D (Temps d'incantation, etc.)
    const boldLabelMatch = line.match(/^\s*\*\*([^*]+)\*\*(.*)$/);
    if (boldLabelMatch) {
      const labelRaw = boldLabelMatch[1].trim();
      const afterLabel = boldLabelMatch[2].trim();
      
      const specialLabels = [
        'amélioration de sort mineur',
        'améliorations de sorts mineurs',
        'aux niveaux supérieurs',
        'à des niveaux supérieurs',
        'niveaux supérieurs',
        'temps d\'incantation',
        'portée',
        'composantes',
        'durée',
      ];
      
      if (specialLabels.some(sl => labelRaw.toLowerCase().includes(sl))) {
        const hasColon = afterLabel.startsWith(':');
        const content = hasColon ? afterLabel.substring(1).trim() : afterLabel;
        
        out.push(
          <div key={`special-${key++}`} className="mt-3 mb-2">
            <strong className="text-white font-semibold">{labelRaw}</strong>
            {hasColon && <span className="text-white font-semibold"> :</span>}
            {content && <span className="ml-1 text-gray-300">{formatInline(content)}</span>}
          </div>
        );
        i++;
        continue;
      }
    }

    // Case à cocher #### / #####
    const chk = line.match(/^\s*#####{0,1}\s+(.*)$/);
    if (chk) {
      const rawLabel = chk[1];
      const label = sentenceCase(rawLabel);
      const featureKey = slug(
        `${ctx.section?.level ?? 'x'}-${ctx.section?.origin ?? 'class'}-${ctx.section?.title ?? ''}--${label}`
      );
      const checked = ctx.checkedMap?.get(featureKey) ?? false;
      const id = `chk-${key}`;

      out.push(
        <div key={`chk-${key++}`} className="flex items-start gap-2 mt-2">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => ctx.onToggle?.(featureKey, e.currentTarget.checked)}
            className="mt-0.5 h-4 w-4 accent-violet-500 bg-black/40 border border-white/20 rounded cursor-pointer"
          />
          <label htmlFor={id} className="text-sm text-white/90 cursor-pointer select-none">
            {formatInline(label)}
          </label>
        </div>
      );
      i++;
      continue;
    }

    // Titres h1, h2, h3
    const h3 = line.match(/^\s*###\s+(.*)$/i);
    if (h3) {
      out.push(<h4 key={`h3-${key++}`} className="text-white font-semibold text-sm sm:text-base mt-4 mb-2">{formatInline(sentenceCase(h3[1]))}</h4>);
      i++; continue;
    }
    const h2 = line.match(/^\s*##\s+(.*)$/i);
    if (h2) {
      out.push(<h4 key={`h2-${key++}`} className="text-white font-semibold text-sm sm:text-base mt-4 mb-2">{formatInline(sentenceCase(h2[1]))}</h4>);
      i++; continue;
    }
    const h1 = line.match(/^\s*#\s+(.*)$/i);
    if (h1) {
      out.push(<h4 key={`h1-${key++}`} className="text-white font-semibold text-sm sm:text-base mt-4 mb-2">{formatInline(sentenceCase(h1[1]))}</h4>);
      i++; continue;
    }

    // Gestion des BOITES <!-- BOX: Titre --> ... <!-- /BOX -->
    // On capture le titre optionnel après 'BOX:'
    const boxMatch = line.match(/^\s*<!--\s*BOX(?::\s*(.*?))?\s*-->/i);
    if (boxMatch) {
      const title = boxMatch[1] ? boxMatch[1].trim() : null;
      const boxContent: string[] = [];
      i++; // On saute la ligne d'ouverture
      
      while (i < lines.length) {
        // Détection de fin de boite
        if (lines[i].match(/^\s*<!--\s*\/BOX\s*(?:-->)?/i)) {
          i++; // On saute la fermeture
          break;
        }
        boxContent.push(lines[i]);
        i++;
      }

      // Rendu récursif du contenu de la boite
      const inner = parseMarkdownLite(boxContent.join('\n'), ctx);
      out.push(
        <div key={`box-${key++}`} className="rounded-lg border border-white/15 bg-white/5 p-3 my-4">
          {title && (
            <div className="font-bold text-gray-200 mb-2 uppercase tracking-wide text-sm border-b border-white/10 pb-1">
              {formatInline(title)}
            </div>
          )}
          <div className="text-sm">{inner}</div>
        </div>
      );
      continue;
    }

    
    // Tableaux
    if (line.includes('|')) {
      const block: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        block.push(lines[i]);
        i++;
      }
      const tableNode = renderTable(block, key);
      if (tableNode) {
        out.push(tableNode);
        key++;
        continue;
      }
      // Si ce n'est pas un tableau valide, on affiche comme texte
      out.push(
        <p key={`pf-${key++}`} className="text-sm text-gray-300 mb-2">
          {formatInline(block.join(' '))}
        </p>
      );
      continue;
    }

    // Liste à puces
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push(
        <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1 text-gray-300 mb-3">
          {items.map((it, idx) => (
            <li key={`li-${idx}`} className="text-sm">
              {formatInline(it)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Liste ordonnée
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(
        <ol key={`ol-${key++}`} className="list-decimal pl-5 space-y-1 text-gray-300 mb-3">
          {items.map((it, idx) => (
            <li key={`oli-${idx}`} className="text-sm">
              {formatInline(it)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraphe standard
    // On regroupe les lignes de texte successives pour former un paragraphe cohérent
    const buff: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].includes('|') &&
      !/^\s*#{1,6}\s+/.test(lines[i]) &&
      !/^\s*---+\s*$/.test(lines[i]) &&
      !/^\s*\*\*[^*]+\*\*/.test(lines[i]) // Ne pas fusionner si la ligne commence par un label gras
    ) {
      buff.push(lines[i]);
      i++;
    }
    
    // Rendu simple du paragraphe (sans la logique "block" qui cassait tout)
    const content = buff.join(' ').trim();
    if (content) {
      out.push(
        <p key={`p-${key++}`} className="text-sm text-gray-300 leading-relaxed mb-2">
          {formatInline(content)}
        </p>
      );
    }
  }

  return out;
}

function renderTable(block: string[], key: number): React.ReactNode | null {
  if (block.length < 2) return null;
  const rows = block.map(r =>
    r
      .split('|')
      .map(c => c.trim())
      .filter((_, idx, arr) => !(idx === 0 && arr[0] === '') && !(idx === arr.length - 1 && arr[arr.length - 1] === ''))
  );

  const hasSep = rows[1] && rows[1].every(cell => /^:?-{3,}:?$/.test(cell));
  const header = hasSep ? rows[0] : null;
  const body = hasSep ? rows.slice(2) : rows;

  return (
    <div key={`tbl-${key}`} className="overflow-x-auto my-4">
      <table className="min-w-[360px] w-full text-sm border-collapse border border-gray-700/50 rounded-lg overflow-hidden">
        {header && (
          <thead>
            <tr className="bg-gray-800/50">
              {header.map((h, i) => (
                <th key={`th-${i}`} className="text-left text-gray-200 font-semibold px-3 py-2 border border-gray-700/50">
                  {formatInline(sentenceCase(h))}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((cells, r) => (
            <tr key={`tr-${r}`} className={r % 2 === 0 ? 'bg-gray-800/20' : 'bg-gray-800/30'}>
              {cells.map((c, ci) => (
                <td key={`td-${ci}`} className="px-3 py-2 text-gray-300 border border-gray-700/50">
                  {formatInline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}