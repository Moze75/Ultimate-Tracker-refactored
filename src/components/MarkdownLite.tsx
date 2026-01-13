import React, { useMemo } from 'react';

// --- COEUR DU RENDU : PARSER RÉCURSIF ---

function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  // Regex combinée pour capturer : Gras, Italique, Liens
  const tokenRegex = /(\*\*.+?\*\*|_[^_]+?_|\[[^\]]+\]\([^)]+\)|\[[^\]]+\])/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // GRAS
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index} className="font-semibold">{renderInline(part.slice(2, -2))}</strong>;
    }
    // ITALIQUE
    if (part.startsWith('_') && part.endsWith('_') && part.length >= 2) {
      return <em key={index} className="italic">{renderInline(part.slice(1, -1))}</em>;
    }
    // LIENS (Nettoyage pour affichage texte seul)
    if (part.startsWith('[') && part.includes(']')) {
      const labelMatch = part.match(/^\[([^\]]+)\]/);
      if (labelMatch) return <React.Fragment key={index}>{renderInline(labelMatch[1])}</React.Fragment>;
    }
    // TEXTE
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

/* ---------- COMPOSANT PRINCIPAL ---------- */

export default function MarkdownLite({ content }: { content: string }) {
  const elements = useMemo(() => {
    // 1. Normalisation : Correction des chevrons encodés venant de la DB
    const src = (content || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const lines = src.split(/\r?\n/);
    const out: React.ReactNode[] = [];

    let ulBuffer: string[] = [];
    let olBuffer: string[] = [];
    let quoteBuffer: string[] = [];
    
    // États pour les Boites
    let inBox = false;
    let boxBuffer: string[] = [];
    let boxTitle: string | null = null;

    const flushUL = () => {
      if (ulBuffer.length > 0) {
        out.push(
          <ul className="list-disc pl-5 space-y-1" key={`ul-${out.length}`}>
            {ulBuffer.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
          </ul>
        );
        ulBuffer = [];
      }
    };
    const flushOL = () => {
      if (olBuffer.length > 0) {
        out.push(
          <ol className="list-decimal pl-5 space-y-1" key={`ol-${out.length}`}>
            {olBuffer.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
          </ol>
        );
        olBuffer = [];
      }
    };
    const flushQuote = () => {
      if (quoteBuffer.length > 0) {
        out.push(
          <blockquote key={`q-${out.length}`} className="border-l-2 border-white/20 pl-3 ml-1 italic text-gray-300 bg-white/5 rounded-sm py-1">
            {renderInline(quoteBuffer.join(' ').trim())}
          </blockquote>
        );
        quoteBuffer = [];
      }
    };
    const flushAllBlocks = () => { flushQuote(); flushUL(); flushOL(); };

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

    for (let i = 0; i < lines.length; i++) {
      let raw = lines[i];

      // --- 1. Gestion des BOX (Encadrés) ---
      const boxStartMatch = raw.match(/<!--\s*BOX(?::\s*(.*?))?\s*-->/);
      const altStartMatch = raw.match(/^\s*II\s*(.*)$/);

      if (!inBox && (boxStartMatch || altStartMatch)) {
        flushAllBlocks();
        let before = '', after = '', title: string | null = null;

        if (boxStartMatch) {
          const fullMatch = boxStartMatch[0];
          const idx = raw.indexOf(fullMatch);
          before = raw.slice(0, idx);
          after = raw.slice(idx + fullMatch.length);
          title = boxStartMatch[1] ? boxStartMatch[1].trim() : null;
        } else if (altStartMatch) {
          after = altStartMatch[1];
        }

        if (before.trim()) out.push(<p key={`p-pre-${out.length}`}>{renderInline(before)}</p>);
        inBox = true;
        boxBuffer = [];
        boxTitle = title;
        if (after.trim()) boxBuffer.push(after);
        continue;
      }

      if (inBox) {
        if (raw.includes('<!-- /BOX -->') || raw.match(/^(.*)\s*\|\|\s*$/)) {
          const closeMatch = raw.includes('<!-- /BOX -->') ? raw.match(/(.*)<!-- \/BOX -->/) : raw.match(/^(.*)\s*\|\|\s*$/);
          const contentBeforeClose = closeMatch ? closeMatch[1].trim() : '';
          if (contentBeforeClose) boxBuffer.push(contentBeforeClose);
          inBox = false;
          flushBox();
          continue;
        }
        boxBuffer.push(raw);
        continue;
      }

      // --- 2. Gestion Tableaux ---
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
          if (!rowLine.trim() || !rowLine.includes('|')) break;
          body.push(splitTableRow(rowLine));
        }
        out.push(
          <div key={`tblwrap-${out.length}`} className="overflow-x-auto my-3">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  {headerCells.map((c, idx) => (
                    <th key={idx} className={`px-3 py-2 bg-white/10 border border-white/15 font-semibold text-${alignments[idx]}`}>
                      {renderInline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, r) => (
                  <tr key={r}>
                    {headerCells.map((_, c) => (
                      <td key={c} className={`px-3 py-2 border border-white/10 text-${alignments[c]}`}>
                        {renderInline(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        i = j - 1;
        continue;
      }

      // --- 3. Pseudo-Tableau "Clé - Valeur" (ex: Airain – Feu) ---
      // MODIFICATION ICI : On utilise une grille avec bordure verticale pour simuler un tableau
      const dashRowMatch = raw.match(/^([^-–*].+?)\s+[–-]\s+(.+)$/);
      if (dashRowMatch && dashRowMatch[1].length < 40 && dashRowMatch[2].length < 60) {
        flushAllBlocks();
        out.push(
            <div key={`dr-${out.length}`} className="grid grid-cols-2 py-1 border-b border-white/5 last:border-0 text-sm">
                <div className="font-semibold text-gray-200 pr-3">{renderInline(dashRowMatch[1])}</div>
                <div className="text-gray-300 pl-3 border-l border-white/20">{renderInline(dashRowMatch[2])}</div>
            </div>
        );
        continue;
      }

      // --- Listes & Citations ---
      const mUL = raw.match(/^\s*[-*]\s+(.*)$/);
      if (mUL) { flushQuote(); flushOL(); ulBuffer.push(mUL[1]); continue; }

      const mOL = raw.match(/^\s*\d+[.)]\s+(.*)$/);
      if (mOL) { flushQuote(); flushUL(); olBuffer.push(mOL[1]); continue; }

      const mQ = raw.match(/^\s*>\s+(.*)$/);
      if (mQ) { flushUL(); flushOL(); quoteBuffer.push(mQ[1]); continue; }

      if ((ulBuffer.length || olBuffer.length || quoteBuffer.length) && raw.trim() !== '') flushAllBlocks();

      // --- Titres (ordre important: du plus specifique au moins specifique) ---
      const h4 = raw.match(/^\s*####\s+(.*)$/);
      if (h4) { out.push(<h4 key={`h4-${out.length}`} className="text-base font-semibold mt-3 mb-1 text-amber-300">{renderInline(h4[1])}</h4>); continue; }

      const h3 = raw.match(/^\s*###\s+(.*)$/);
      if (h3) { out.push(<h3 key={`h3-${out.length}`} className="text-xl font-bold mt-5 mb-2 text-amber-400">{renderInline(h3[1])}</h3>); continue; }

      const h2 = raw.match(/^\s*##\s+(.*)$/);
      if (h2) { out.push(<h2 key={`h2-${out.length}`} className="text-2xl font-bold mt-6 mb-3 text-amber-500">{renderInline(h2[1])}</h2>); continue; }

      const h1 = raw.match(/^\s*#\s+(.*)$/);
      if (h1) { out.push(<h1 key={`h1-${out.length}`} className="text-3xl font-bold mt-6 mb-4 text-white border-b border-amber-500/30 pb-2">{renderInline(h1[1])}</h1>); continue; }


      if (raw.trim() === '') { flushAllBlocks(); out.push(<div key={`sp-${out.length}`} className="h-2" />); continue; }

      const labelMatch = raw.match(/^([\p{L}\p{N}'’ .\-\/+()]+?)\s*:\s+(.*)$/u);
      if (labelMatch) {
        out.push(
          <p key={`kv-${out.length}`} className="mb-2 leading-relaxed">
            <span className="font-semibold">{labelMatch[1]}: </span>{renderInline(labelMatch[2])}
          </p>
        );
        continue;
      }

      out.push(<p key={`p-${out.length}`} className="mb-2 leading-relaxed">{renderInline(raw)}</p>);
    }

    flushAllBlocks();
    if (inBox) flushBox();

    return out;
  }, [content]);

  if (!content) return null;
  return <div className="prose prose-invert max-w-none">{elements}</div>;
}