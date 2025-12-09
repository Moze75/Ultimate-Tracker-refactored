import React, { useMemo } from 'react';

// --- COEUR DU RENDU : PARSER RÉCURSIF ---

// Cette fonction remplace l'ancien système complexe.
// Elle découpe le texte en tokens (Gras, Italique, Lien) et traite le reste comme du texte.
function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  // Regex combinée pour capturer :
  // 1. Gras : **...**
  // 2. Italique : _..._ (sans underscore à l'intérieur)
  // 3. Lien complet : [Texte](URL)
  // 4. Lien simple (reste de nettoyage) : [Texte]
  const tokenRegex = /(\*\*.+?\*\*|_[^_]+?_|\[[^\]]+\]\([^)]+\)|\[[^\]]+\])/g;

  // Le split va créer un tableau alternant [Texte, Token, Texte, Token...]
  // Les espaces autour des tokens sont préservés dans les parties "Texte".
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // CAS 1 : GRAS (**texte**)
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const content = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold">
          {renderInline(content)}
        </strong>
      );
    }

    // CAS 2 : ITALIQUE (_texte_)
    if (part.startsWith('_') && part.endsWith('_') && part.length >= 2) {
      const content = part.slice(1, -1);
      return (
        <em key={index} className="italic">
          {renderInline(content)}
        </em>
      );
    }

    // CAS 3 : LIENS ([Texte](url) ou [Texte])
    // On retire le lien pour ne garder que le texte (Markdown Lite)
    if (part.startsWith('[') && part.includes(']')) {
      const labelMatch = part.match(/^\[([^\]]+)\]/);
      if (labelMatch) {
        // On rend le contenu du label (qui peut contenir du gras/italique)
        return <React.Fragment key={index}>{renderInline(labelMatch[1])}</React.Fragment>;
      }
    }

    // CAS 4 : TEXTE BRUT
    // On retourne le texte tel quel. React gère très bien les espaces ici.
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/* ---------- Helpers tableaux ---------- */

function isTableSeparator(line: string): boolean {
  const l = line.trim();
  if (!l.includes('-')) return false;
  const core = l.replace(/^\|/, '').replace(/\|$/, '');
  const cells = core.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function splitTableRow(line: string): string[] {
  let work = line.trim();
  if (work.startsWith('|')) work = work.slice(1);
  if (work.endsWith('|')) work = work.slice(0, -1);
  work = work.replace(/\\\|/g, '§PIPE§');
  return work.split('|').map((c) => c.replace(/§PIPE§/g, '|').trim());
}

type Align = 'left' | 'center' | 'right';
function parseAlignments(sepLine: string, colCount: number): Align[] {
  const core = sepLine.trim().replace(/^\|/, '').replace(/\|$/, '');
  const specs = core.split('|').map((c) => c.trim());
  const aligns = specs.map<Align>((c) => {
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
  while (aligns.length < colCount) aligns.push('left');
  return aligns;
}

/* ---------- Block-level rendering ---------- */

export default function MarkdownLite({ content }: { content: string }) {
    const flushBox = () => {
      if (!boxBuffer.length) return;
      const inner = boxBuffer.join('\n');
      out.push(
        <div key={`box-${out.length}`} className="rounded-lg border border-white/15 bg-white/5 p-3 my-4">
          {boxTitle && (
            <div className="font-bold text-gray-200 mb-2 uppercase tracking-wide text-sm border-b border-white/10 pb-1">
              {renderInline(boxTitle)}
            </div>
          )}
          <MarkdownLite content={inner} />
        </div>
      );
      boxBuffer = [];
      boxTitle = null;
    };
        ulBuffer = [];
      }
    };
    const flushOL = () => {
      if (olBuffer.length > 0) {
        out.push(
          <ol className="list-decimal pl-5 space-y-1" key={`ol-${out.length}`}>
            {olBuffer.map((item, i) => (
              <li key={`oli-${i}`}>{renderInline(item)}</li>
            ))}
          </ol>
        );
        olBuffer = [];
      }
    };
    const flushQuote = () => {
      if (quoteBuffer.length > 0) {
        const text = quoteBuffer.join(' ').trim();
        out.push(
          <blockquote
            key={`q-${out.length}`}
            className="border-l-2 border-white/20 pl-3 ml-1 italic text-gray-300 bg-white/5 rounded-sm py-1"
          >
            {renderInline(text)}
          </blockquote>
        );
        quoteBuffer = [];
      }
    };
    const flushAllBlocks = () => {
      flushQuote();
      flushUL();
      flushOL();
    };

    const flushBox = () => {
      if (!boxBuffer.length) return;
      const inner = boxBuffer.join('\n');
      out.push(
        <div key={`box-${out.length}`} className="rounded-lg border border-white/15 bg-white/5 p-3">
          <MarkdownLite content={inner} />
        </div>
      );
      boxBuffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      let raw = lines[i];

      // --- Gestion des BOX ---
      if (inBox) {
        if (raw.includes('<!-- /BOX -->') || raw.match(/^(.*)\s*\|\|\s*$/)) {
          const closeMatch = raw.includes('<!-- /BOX -->') 
            ? raw.match(/(.*)<!-- \/BOX -->/) 
            : raw.match(/^(.*)\s*\|\|\s*$/);
            
          const before = closeMatch ? closeMatch[1].trim() : '';
          if (before) boxBuffer.push(before);
          
          inBox = false;
          flushBox();
          continue;
        }
        boxBuffer.push(raw);
        continue;
      }

      if (raw.includes('<!-- BOX -->') || raw.match(/^\s*II\s*(.*)$/)) {
        flushAllBlocks();
        const openMatch = raw.includes('<!-- BOX -->')
          ? raw.match(/(.*)<!-- BOX -->(.*)/)
          : raw.match(/^\s*II\s*(.*)$/);

        // S'il y a du texte avant le début de la boite sur la même ligne
        if (openMatch && openMatch[1] && !raw.match(/^\s*II/)) {
             out.push(<p key={`p-pre-${out.length}`}>{renderInline(openMatch[1])}</p>);
        }
        
        inBox = true;
        boxBuffer = [];
        
        const after = openMatch ? (raw.includes('<!-- BOX -->') ? openMatch[2] : openMatch[1]) : '';
        if (after && after.trim()) boxBuffer.push(after);
        continue;
      }

      // --- Gestion Tableaux ---
      const headerLine = raw;
      const sepLine = lines[i + 1];
      if (headerLine && sepLine && headerLine.includes('|') && isTableSeparator(sepLine)) {
        flushAllBlocks();
        const headerCells = splitTableRow(headerLine);
        const alignments = parseAlignments(sepLine, headerCells.length);
        const body: string[][] = [];
        let j = i + 2;
        for (; j < lines.length; j++) {
          const rowLine = lines[j];
          if (!rowLine || !rowLine.trim() || !rowLine.includes('|')) break;
          body.push(splitTableRow(rowLine));
        }

        out.push(
          <div key={`tblwrap-${out.length}`} className="overflow-x-auto my-3">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  {headerCells.map((cell, idx) => {
                    const align = alignments[idx];
                    const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
                    return (
                      <th key={`th-${idx}`} className={`px-3 py-2 bg-white/10 border border-white/15 font-semibold ${alignClass}`}>
                        {renderInline(cell)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {body.map((row, r) => (
                  <tr key={`tr-${r}`}>
                    {headerCells.map((_, c) => {
                      const cell = row[c] ?? '';
                      const align = alignments[c];
                      const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
                      return (
                        <td key={`td-${r}-${c}`} className={`px-3 py-2 border border-white/10 ${alignClass}`}>
                          {renderInline(cell)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        i = j - 1;
        continue;
      }

      // --- Listes ---
      const mUL = raw.match(/^\s*[-*]\s+(.*)$/);
      if (mUL) {
        flushQuote();
        flushOL();
        ulBuffer.push(mUL[1]);
        continue;
      }

      const mOL = raw.match(/^\s*\d+[.)]\s+(.*)$/);
      if (mOL) {
        flushQuote();
        flushUL();
        olBuffer.push(mOL[1]);
        continue;
      }

      // --- Citations ---
      const mQ = raw.match(/^\s*>\s+(.*)$/);
      if (mQ) {
        flushUL();
        flushOL();
        quoteBuffer.push(mQ[1]);
        continue;
      }

      // Flush si ligne normale
      if ((ulBuffer.length || olBuffer.length || quoteBuffer.length) && raw.trim() !== '') {
        flushAllBlocks();
      }

      // --- Titres ---
      const h4 = raw.match(/^\s*####\s+(.*)$/);
      if (h4) {
        out.push(<div className="font-semibold mt-3 mb-1 tracking-wide" key={`h4-${out.length}`}>{renderInline(h4[1])}</div>);
        continue;
      }
      const h3 = raw.match(/^\s*###\s+(.*)$/);
      if (h3) {
        out.push(<div className="font-bold text-base mt-4 mb-2" key={`h3-${out.length}`}>{renderInline(h3[1])}</div>);
        continue;
      }

      // Pseudo-titre en gras complet
      const fullBold = raw.match(/^\s*\*\*(.+?)\*\*\s*$/);
      if (fullBold) {
        out.push(
          <div className="mt-3 mb-2 uppercase tracking-wide text-[0.95rem] text-gray-200" key={`sub-${out.length}`}>
            {renderInline(fullBold[1])}
          </div>
        );
        continue;
      }

      // Ligne vide
      if (raw.trim() === '') {
        flushAllBlocks();
        out.push(<div className="h-2" key={`sp-${out.length}`} />);
        continue;
      }

      // Label: Valeur
      const labelMatch = raw.match(/^([\p{L}\p{N}'’ .\-\/+()]+?)\s*:\s+(.*)$/u);
      if (labelMatch) {
        out.push(
          <p className="mb-2 leading-relaxed" key={`kv-${out.length}`}>
            <span className="font-semibold">{labelMatch[1]}: </span>
            {renderInline(labelMatch[2])}
          </p>
        );
        continue;
      }

      // Paragraphe standard
      out.push(
        <p className="mb-2 leading-relaxed" key={`p-${out.length}`}>
          {renderInline(raw)}
        </p>
      );
    }

    flushAllBlocks();
    if (inBox) flushBox();

    return out;
  }, [content]);

  if (!content) return null;
  return <div className="prose prose-invert max-w-none">{elements}</div>;
}