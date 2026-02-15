import React from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, Plus, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { getWeaponCategory } from '../../utils/weaponProficiencyChecker'; 

/* Types locaux (alignés sur EquipmentTab) */
type MetaType = 'armor' | 'shield' | 'weapon' | 'potion' | 'equipment' | 'jewelry' | 'tool' | 'other';
type WeaponCategory = 'Armes courantes' | 'Armes de guerre' | 'Armes de guerre dotées de la propriété Légère' | 'Armes de guerre présentant la propriété Finesse ou Légère';
interface WeaponMeta { damageDice: string; damageType: 'Tranchant' | 'Perforant' | 'Contondant'; properties: string; range: string; category?: WeaponCategory; }
interface ArmorMeta { base: number; addDex: boolean; dexCap?: number | null; label: string; }
interface ShieldMeta { bonus: number; }
export interface ItemMeta {
  type: MetaType;
  quantity?: number;
  equipped?: boolean;
  weapon?: WeaponMeta;
  armor?: ArmorMeta;
  shield?: ShieldMeta;
}
type CatalogKind = 'armors' | 'shields' | 'weapons' | 'adventuring_gear' | 'tools' | 'gems';
interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  description?: string;
  armor?: ArmorMeta;
  shield?: ShieldMeta;
  weapon?: WeaponMeta;
  imageUrl?: string;
}

/* Helpers locaux */
const ULT_BASE = 'https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Equipements';
const URLS = {
  armors: `${ULT_BASE}/Armures.md`,
  shields: `${ULT_BASE}/Boucliers.md`,
  weapons: `${ULT_BASE}/Armes.md`,
  adventuring_gear: `${ULT_BASE}/Equipements_daventurier.md`,
  tools: `${ULT_BASE}/Outils.md`,
  gems: `${ULT_BASE}/Pierres%20pr%C3%A9cieuses.md`,
};

const stripPriceParentheses = (name: string) =>
  name.replace(/\s*\((?:\d+|\w+|\s|,|\.|\/|-)+\s*p[oa]?\)\s*$/i, '').trim();

const smartCapitalize = (name: string) => {
  const base = stripPriceParentheses(name).trim();
  if (!base) return '';
  const lower = base.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch catalogue échoué: ${url}`);
  return await res.text();
}

function parseMarkdownTable(md: string): string[][] {
  const rows: string[][] = [];
  const lines = md.split('\n');
  for (const line of lines) {
    const l = line.trim();
    if (l.startsWith('|') && l.endsWith('|') && l.includes('|')) {
      const cells = l.substring(1, l.length - 1).split('|').map(c => c.trim());
      if (cells.every(c => /^[-:\s]+$/.test(c))) continue;
      rows.push(cells);
    }
  }
  return rows;
}

function looksLikeHeader(cellA: string, cellB: string, keyword: RegExp) {
  return keyword.test(cellB || '') || /^nom$/i.test(cellA || '');
}

/* Parsers catalogue */
function parseArmors(md: string): CatalogItem[] {
  const items: CatalogItem[] = [];
  const lines = md.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|') && line.endsWith('|') && line.includes('|')) {
      const cells = line.substring(1, line.length - 1).split('|').map(c => c.trim());
      
      if (cells.length >= 2) {
        const [nomRaw, ca] = cells;
        const nomNorm = nomRaw.toLowerCase();
        const caNorm = (ca || '').toLowerCase();
        
        if (
          !nomRaw || !ca ||
          (nomNorm.includes('armure') && caNorm.includes('classe')) ||
          (nomRaw.includes('-') && nomRaw.length > 5) ||
          (ca.includes('-') && ca.length > 5) ||
          nomRaw === '—' || ca === '—' ||
          nomRaw === '---' || ca === '---' ||
          caNorm.includes('force') || caNorm.includes('discrétion') ||
          nomNorm === 'force' || nomNorm === 'discrétion'
        ) {
          continue;
        }
        
        const nom = stripPriceParentheses(nomRaw);
        if (!nom || nom === '---' || nom.length < 2) continue;
        
        let base = 10, addDex = false, dexCap: number | null = null;
        
        if (ca.toLowerCase().includes('modificateur de dex')) {
          const baseMatch = ca.match(/(\d+)/);
          const capMatch = ca.match(/max\s*(\d+)/i);
          if (baseMatch) {
            base = parseInt(baseMatch[1]);
            addDex = true;
            dexCap = capMatch ? parseInt(capMatch[1]) : null;
          }
        } else {
          const numberMatch = ca.match(/^\s*(\d+)\s*$/);
          if (numberMatch) {
            base = parseInt(numberMatch[1]);
          } else {
            const anyNumberMatch = ca.match(/(\d+)/);
            if (anyNumberMatch) {
              base = parseInt(anyNumberMatch[1]);
            }
          }
        }
        
        items.push({ 
          id: `armor:${nom}`, 
          kind: 'armors', 
          name: nom, 
          armor: { base, addDex, dexCap, label: ca } 
        });
      }
    }
  }
  return items;
}

function parseShields(md: string): CatalogItem[] {
  const rows = parseMarkdownTable(md);
  const items: CatalogItem[] = [];
  for (const row of rows) {
    if (row.length < 2) continue;
    const [nomRaw, ca] = row;
    if (!nomRaw) continue;
    if (looksLikeHeader(nomRaw, ca, /classe d'armure|ca/i)) continue;
    const nom = stripPriceParentheses(nomRaw);
    const m = ca.match(/\+?\s*(\d+)/);
    const bonus = m ? +m[1] : 2;
    items.push({ id: `shield:${nom}`, kind: 'shields', name: nom, shield: { bonus } });
  }
  return items;
}

function parseWeapons(md: string): CatalogItem[] {
  const rows = parseMarkdownTable(md);
  const items: CatalogItem[] = [];
  for (const row of rows) {
    if (row.length < 3) continue;
    const [nomRaw, degats, props] = row;
    if (!nomRaw) continue;
    if (/^nom$/i.test(nomRaw) || /d[ée]g[âa]ts/i.test(degats)) continue;
    const nom = stripPriceParentheses(nomRaw);
    const dmgMatch = (degats || '').match(/(\d+d\d+)/i);
    const damageDice = dmgMatch ? dmgMatch[1] : '1d6';
    let damageType: 'Tranchant' | 'Perforant' | 'Contondant' = 'Tranchant';
    if (/contondant/i.test(degats)) damageType = 'Contondant';
    else if (/perforant/i.test(degats)) damageType = 'Perforant';
    let range = 'Corps à corps';
    const pm = (props || '').match(/portée\s*([\d,\.\/\s]+)/i);
    if (pm) {
      const first = pm[1].trim().split(/[\/\s]/)[0]?.trim() || '';
      if (first) range = `${first} m`;
    }
    const detectedCategory = getWeaponCategory(nom);
    const category: WeaponCategory | undefined =
      detectedCategory === 'Armes courantes' ? 'Armes courantes' :
      detectedCategory === 'Armes de guerre (Finesse ou Légère)' ? 'Armes de guerre présentant la propriété Finesse ou Légère' :
      detectedCategory === 'Armes de guerre (Légère)' ? 'Armes de guerre dotées de la propriété Légère' :
      detectedCategory === 'Armes de guerre' ? 'Armes de guerre' : undefined;
    items.push({ id: `weapon:${nom}`, kind: 'weapons', name: nom, weapon: { damageDice, damageType, properties: props || '', range, category } });
  }
  return items;
}

function isMarkdownTableLine(line: string) {
  const l = line.trim();
  return l.startsWith('|') && l.endsWith('|') && l.includes('|');
}

function MarkdownLite({ text }: { text: string }) {
  const renderText = (str: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-gray-200">{part.slice(2, -2)}</strong>;
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const blocks = text.split(/\n{2,}/g).map(b => b.split('\n'));
  return (
    <div className="space-y-2">
      {blocks.map((lines, idx) => {
        if (lines.length >= 2 && isMarkdownTableLine(lines[0])) {
          const tableLines: string[] = [];
          for (const l of lines) if (isMarkdownTableLine(l)) tableLines.push(l);
          const rows: string[][] = [];
          for (const tl of tableLines) {
            const cells = tl.substring(1, tl.length - 1).split('|').map(c => c.trim());
            if (cells.every(c => /^[-:\s]+$/.test(c))) continue;
            rows.push(cells);
          }
          if (rows.length === 0) return null;
          const header = rows[0];
          const body = rows.slice(1);
          return (
            <div key={idx} className="overflow-x-auto">
              <table className="w-full text-left text-sm border border-gray-700/50 rounded-md overflow-hidden">
                <thead className="bg-gray-800/60">
                  <tr>{header.map((c, i) => <th key={i} className="px-2 py-1 border-b border-gray-700/50">{renderText(c)}</th>)}</tr>
                </thead>
                <tbody>
                  {body.map((r, ri) => (
                    <tr key={ri} className="odd:bg-gray-800/30">
                      {r.map((c, ci) => <td key={ci} className="px-2 py-1 align-top border-b border-gray-700/30">{renderText(c)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (lines.every(l => l.trim().startsWith('- '))) {
          return <ul key={idx} className="list-disc pl-5 space-y-1">{lines.map((l, i) => <li key={i} className="text-sm text-gray-300">{renderText(l.replace(/^- /, ''))}</li>)}</ul>;
        }
        return <p key={idx} className="text-sm text-gray-300 whitespace-pre-wrap">{renderText(lines.join('\n'))}</p>;
      })}
    </div>
  );
}

function parseMarkdownTables(md: string): string[][][] {
  const tables: string[][][] = [];
  const lines = md.split('\n');
  let current: string[][] | null = null;
  for (const raw of lines) {
    const line = raw.trimRight();
    if (isMarkdownTableLine(line)) {
      const cells = line.substring(1, line.length - 1).split('|').map(c => c.trim());
      if (!current) current = [];
      current.push(cells);
    } else {
      if (current && current.length > 0) tables.push(current);
      current = null;
    }
  }
  if (current && current.length > 0) tables.push(current);
  return tables;
}

function parseTools(md: string): CatalogItem[] {
  const items: CatalogItem[] = [];
  const tables = parseMarkdownTables(md);
  const noiseRow = (s: string) =>
    !s || /^autres? outils?$/i.test(s) || /^types? d'?outils?$/i.test(s) ||
    /^outils?$/i.test(s) || /^sommaire$/i.test(s) || /^table des matières$/i.test(s) ||
    /^généralités?$/i.test(s) || /^introduction$/i.test(s);

  for (const table of tables) {
    if (table.length === 0) continue;
    let header = table[0];
    const body = table.slice(1);
    const headerLooksLikeHeader = header.some(c => /nom|outil|description|prix|coût|co[ûu]t/i.test(c));
    if (!headerLooksLikeHeader) header = header.map((_, i) => (i === 0 ? 'Nom' : `Col${i + 1}`));
    for (const row of body) {
      const name = stripPriceParentheses(row[0] || '').trim();
      if (!name || noiseRow(name)) continue;
      const parts: string[] = [];
      for (let i = 1; i < Math.min(row.length, header.length); i++) {
        const h = header[i]?.trim();
        const v = (row[i] || '').trim();
        if (!v) continue;
        if (/prix|co[ûu]t/i.test(h)) continue;
        parts.push(`${smartCapitalize(h)}: ${v}`);
      }
      const desc = parts.join('\n');
      items.push({ id: `tools:${name}`, kind: 'tools', name, description: desc });
    }
  }

  const lines = md.split('\n');
  const sections: { name: string; desc: string }[] = [];
  let currentSection: { name: string; buf: string[] } | null = null;
  const isHeader = (line: string) => /^#{2,3}\s+/.test(line);
  const headerName = (line: string) => line.replace(/^#{2,3}\s+/, '').trim();

  for (const raw of lines) {
    if (isHeader(raw)) {
      if (currentSection) {
        const nm = stripPriceParentheses(currentSection.name);
        const ds = currentSection.buf.join('\n').trim();
        if (nm && ds && !noiseRow(nm)) sections.push({ name: nm, desc: ds });
      }
      currentSection = { name: headerName(raw), buf: [] };
    } else {
      if (currentSection) currentSection.buf.push(raw);
    }
  }
  if (currentSection) {
    const nm = stripPriceParentheses(currentSection.name);
    const ds = currentSection.buf.join('\n').trim();
    if (nm && ds && !noiseRow(nm)) sections.push({ name: nm, desc: ds });
  }

  const seen = new Set(items.map(i => norm(i.name)));
  for (const sec of sections) {
    if (seen.has(norm(sec.name))) continue;
    items.push({ id: `tools:${sec.name}`, kind: 'tools', name: sec.name, description: sec.desc });
  }
  const dedup = new Map<string, CatalogItem>();
  for (const it of items) { if (!dedup.has(it.id)) dedup.set(it.id, it); }
  return [...dedup.values()];
}

function parseGems(md: string): CatalogItem[] {
  const items: CatalogItem[] = [];
  const tables = parseMarkdownTables(md);
  
  for (const table of tables) {
    if (table.length === 0) continue;
    const header = table[0];
    const body = table.slice(1);
    const nameColIdx = header.findIndex(h => /pierre|gemme|nom/i.test(h));
    const valueColIdx = header.findIndex(h => /valeur|prix|co[ûu]t/i.test(h));
    const descColIdx = header.findIndex(h => /description|effet/i.test(h));
    
    if (nameColIdx === -1) continue;
    
    for (const row of body) {
      const rawName = row[nameColIdx] || '';
      const name = stripPriceParentheses(rawName).trim();
      
      if (!name || name === '---' || name === '—' || name.length < 2 ||
          /^pierre|^gemme|^valeur|^nom|^description/i.test(name) || /^-+$/.test(name)) {
        continue;
      }
      
      const parts: string[] = [];
      
      if (valueColIdx !== -1 && row[valueColIdx]) {
        let value = row[valueColIdx].trim();
        if (value && value !== '---' && value !== '—') {
          const numMatch = value.match(/(\d+)\s*(po|pa|pc|or|argent|cuivre)?/i);
          if (numMatch) {
            const amount = numMatch[1];
            let currency = numMatch[2] ? numMatch[2].toLowerCase() : '';
            if (!currency || currency === 'po' || currency === 'or') {
              currency = parseInt(amount) >= 100 ? 'po' : parseInt(amount) >= 10 ? 'pa' : 'pc';
            } else if (currency === 'pa' || currency === 'argent') {
              currency = 'pa';
            } else if (currency === 'pc' || currency === 'cuivre') {
              currency = 'pc';
            }
            const symbol = currency === 'po' ? '🟡' : currency === 'pa' ? '⚪' : '🟤';
            const label = currency === 'po' ? "pièce d'or" : currency === 'pa' ? "pièce d'argent" : "pièce de cuivre";
            const fullLabel = parseInt(amount) > 1 ? `${label}s` : label;
            parts.push(`**Valeur**: ${symbol} ${amount} ${fullLabel}`);
          } else {
            parts.push(`**Valeur**: ${value}`);
          }
        }
      }
      
      if (descColIdx !== -1 && row[descColIdx]) {
        const desc = row[descColIdx].trim();
        if (desc && desc !== '---' && desc !== '—') {
          parts.push(desc);
        }
      }
      
      const description = parts.join('\n\n');
      if (!description) continue;
      
      items.push({ id: `gem:${name}`, kind: 'gems', name, description });
    }
  }
  return items;
}

function parseSectionedList(md: string, kind: CatalogKind): CatalogItem[] {
  const items: CatalogItem[] = [];
  const lines = md.split('\n');
  let current: { name: string; descLines: string[] } | null = null;

  const isNoiseName = (n: string) =>
    !n || /^sommaire$/i.test(n) || /^table des matières$/i.test(n) || /^introduction$/i.test(n);

  const flush = () => {
    if (!current) return;
    const rawName = current.name || '';
    const cleanName = stripPriceParentheses(rawName);
    const desc = current.descLines.join('\n').trim();
    if (!cleanName.trim() || isNoiseName(cleanName) || !desc) {
      current = null;
      return;
    }
    items.push({ id: `${kind}:${cleanName}`, kind, name: cleanName, description: desc });
    current = null;
  };

  for (const line of lines) {
    const h = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (h) { if (current) flush(); current = { name: h[1].trim(), descLines: [] }; continue; }
    if (/^---\s*$/.test(line)) { if (current) { flush(); continue; } }
    if (current) current.descLines.push(line);
  }
  if (current) flush();
  return items;
}

/* Props */
type FilterState = {
  weapons: boolean;
  armors: boolean;
  shields: boolean;
  adventuring_gear: boolean;
  tools: boolean;
  gems: boolean;
};

export function EquipmentListModal({
  onClose,
  onAddItem,
  allowedKinds = null,
  multiAdd = false,
}: {
  onClose: () => void;
  onAddItem: (item: { name: string; description?: string; meta: ItemMeta }) => void;
  allowedKinds?: CatalogKind[] | null;
  multiAdd?: boolean;
}) {
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [all, setAll] = React.useState<CatalogItem[]>([]);
  const [filters, setFilters] = React.useState<FilterState>({
    weapons: true, armors: true, shields: true, adventuring_gear: true, tools: true, gems: true
  });
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [addedItems, setAddedItems] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState<string | null>(null);

  // Helpers pour le style des catégories
  const getKindLabel = (kind: CatalogKind): string => {
    switch (kind) {
      case 'weapons': return 'Armes';
      case 'armors': return 'Armures';
      case 'shields': return 'Boucliers';
      case 'adventuring_gear': return 'Équipements';
      case 'tools': return 'Outils';
      case 'gems': return 'Bijoux';
      default: return kind;
    }
  };

  const getKindStyle = (kind: CatalogKind) => {
    switch (kind) {
      case 'weapons': return { activeClass: 'bg-red-900/30 text-red-300 border border-red-500/30' };
      case 'armors': return { activeClass: 'bg-purple-900/30 text-purple-300 border border-purple-500/30' };
      case 'shields': return { activeClass: 'bg-blue-900/30 text-blue-300 border border-blue-500/30' };
      case 'adventuring_gear': return { activeClass: 'bg-gray-700 text-gray-200 border border-gray-500/30' };
      case 'tools': return { activeClass: 'bg-teal-900/30 text-teal-300 border border-teal-500/30' };
      case 'gems': return { activeClass: 'bg-yellow-900/30 text-yellow-300 border border-yellow-500/30' };
      default: return { activeClass: 'bg-gray-700 text-gray-200' };
    }
  };

  const getKindBadge = (kind: CatalogKind) => {
    switch (kind) {
      case 'weapons': return 'bg-red-900/30 text-red-300';
      case 'armors': return 'bg-purple-900/30 text-purple-300';
      case 'shields': return 'bg-blue-900/30 text-blue-300';
      case 'adventuring_gear': return 'bg-gray-800/60 text-gray-300';
      case 'tools': return 'bg-teal-900/30 text-teal-300';
      case 'gems': return 'bg-yellow-900/30 text-yellow-300';
      default: return 'bg-gray-800 text-gray-300';
    }
  };

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [armorsMd, shieldsMd, weaponsMd, gearMd, toolsMd, gemsMd] = await Promise.all([
          fetchText(URLS.armors), fetchText(URLS.shields), fetchText(URLS.weapons),
          fetchText(URLS.adventuring_gear), fetchText(URLS.tools), fetchText(URLS.gems),
        ]);

        const list: CatalogItem[] = [
          ...parseArmors(armorsMd),
          ...parseShields(shieldsMd),
          ...parseWeapons(weaponsMd),
          ...parseTools(toolsMd),
          ...parseGems(gemsMd),
          ...parseSectionedList(gearMd, 'adventuring_gear'),
        ];

        const seen = new Set<string>();
        const cleaned = list.filter(ci => {
          const nm = (ci.name || '').trim();
          if (!nm) return false;
          const id = ci.id;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        
        setAll(cleaned);
      } catch (e) {
        console.error('Erreur de chargement:', e);
        toast.error('Erreur de chargement de la liste');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const effectiveFilters: FilterState = React.useMemo(() => {
    if (!allowedKinds) return filters;
    return {
      weapons: allowedKinds.includes('weapons'),
      armors: allowedKinds.includes('armors'),
      shields: allowedKinds.includes('shields'),
      adventuring_gear: allowedKinds.includes('adventuring_gear'),
      tools: allowedKinds.includes('tools'),
      gems: allowedKinds.includes('gems'),
    };
  }, [allowedKinds, filters]);

  const noneSelected = !effectiveFilters.weapons && !effectiveFilters.armors && !effectiveFilters.shields && 
                       !effectiveFilters.adventuring_gear && !effectiveFilters.tools && !effectiveFilters.gems;

  const filtered = React.useMemo(() => {
    if (noneSelected) return [];
    const q = query.trim().toLowerCase();
    return all.filter(ci => {
      if (!effectiveFilters[ci.kind]) return false;
      if (allowedKinds && !allowedKinds.includes(ci.kind)) return false;
      if (!q) return true;
      if (smartCapitalize(ci.name).toLowerCase().includes(q)) return true;
      if ((ci.kind === 'adventuring_gear' || ci.kind === 'tools' || ci.kind === 'gems') && 
          (ci.description || '').toLowerCase().includes(q)) return true;
      return false;
    });
  }, [all, query, effectiveFilters, allowedKinds, noneSelected]);

  const handlePick = async (ci: CatalogItem) => {
    if (adding || (multiAdd && addedItems.has(ci.id))) return;

    try {
      setAdding(ci.id);

      let meta: ItemMeta = { type: 'equipment', quantity: 1, equipped: false };
      if (ci.kind === 'armors' && ci.armor) meta = { type: 'armor', quantity: 1, equipped: false, armor: ci.armor };
      if (ci.kind === 'shields' && ci.shield) meta = { type: 'shield', quantity: 1, equipped: false, shield: ci.shield };
      if (ci.kind === 'weapons' && ci.weapon) meta = { type: 'weapon', quantity: 1, equipped: false, weapon: ci.weapon };
      if (ci.kind === 'tools') meta = { type: 'tool', quantity: 1, equipped: false };
      if (ci.kind === 'gems') meta = { type: 'jewelry', quantity: 1, equipped: false };
      
      const description = (ci.kind === 'adventuring_gear' || ci.kind === 'tools' || ci.kind === 'gems') 
        ? (ci.description || '').trim() : '';
      
      await onAddItem({ name: ci.name, description, meta });
      
      if (multiAdd) {
        setAddedItems(prev => new Set(prev).add(ci.id));
        toast.success(`${ci.name} ajouté !`);
      } else {
        toast.success(`${ci.name} ajouté !`);
        onClose();
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setAdding(null);
    }
  };

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  
  const typeButtons: CatalogKind[] = ['weapons', 'armors', 'shields', 'adventuring_gear', 'tools', 'gems'];

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 10000 }}
      onClick={onClose}
    >
      <div 
        className="frame-card frame-card--light frame-card--no-frame w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Liste des équipements</h3>
            {multiAdd && addedItems.size > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-900/30 text-green-300">
                {addedItems.size} sélectionné{addedItems.size > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de recherche et filtres */}
                <div className="px-5 py-3 border-b border-gray-700/30 space-y-3 flex-shrink-0 bg-black/10">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un équipement..."
              className="input-dark w-full px-3 py-2 rounded-md"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const allOn = Object.values(filters).every(v => v);
                setFilters({
                  weapons: !allOn, armors: !allOn, shields: !allOn,
                  adventuring_gear: !allOn, tools: !allOn, gems: !allOn,
                });
              }}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                Object.values(filters).every(v => v)
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Tout
            </button>
            {typeButtons.map(k => {
              if (allowedKinds && !allowedKinds.includes(k)) return null;
              return (
                <button
                  key={k}
                  onClick={() => setFilters(prev => ({ ...prev, [k]: !prev[k] }))}
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${
                    effectiveFilters[k]
                      ? getKindStyle(k).activeClass
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {getKindLabel(k)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-gray-600 border-t-yellow-500 rounded-full mx-auto mb-3" />
              <p className="text-gray-400">Chargement du catalogue...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {query ? `Aucun résultat pour "${query}"` : 'Aucun équipement disponible'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map(ci => {
                const isOpen = expanded[ci.id];
                const isAdded = addedItems.has(ci.id);
                const isAdding = adding === ci.id;

                const preview = (
                  <>
                    {ci.kind === 'armors' && ci.armor && <span>CA: {ci.armor.label}</span>}
                    {ci.kind === 'shields' && ci.shield && <span>Bonus: +{ci.shield.bonus}</span>}
                    {ci.kind === 'weapons' && ci.weapon && <span>{ci.weapon.damageDice} {ci.weapon.damageType}</span>}
                    {ci.kind === 'gems' && <span>Bijou/Gemme</span>}
                    {(ci.kind === 'adventuring_gear' || ci.kind === 'tools') && <span>Équipement</span>}
                  </>
                );

                return (
                  <div key={ci.id} className="flex flex-col">
                    <button
                      onClick={() => !isAdded ? handlePick(ci) : toggleExpand(ci.id)}
                      disabled={isAdding}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        isAdded
                          ? 'border-green-500/50 bg-green-900/20'
                          : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-gray-100 font-medium truncate">
                              {smartCapitalize(ci.name)}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getKindBadge(ci.kind)}`}>
                              {getKindLabel(ci.kind)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {preview}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                          isAdded ? 'bg-green-500 border-green-500' : 'border-gray-600'
                        }`}>
                          {isAdded && <Check className="w-3 h-3 text-white" />}
                          {isAdding && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />}
                        </div>
                      </div>
                    </button>
                    {isOpen && (ci.kind === 'adventuring_gear' || ci.kind === 'tools' || ci.kind === 'gems') && (
                      <div className="px-3 py-2 bg-gray-800/30 rounded-b-lg border-x border-b border-gray-700">
                        <MarkdownLite text={(ci.description || '').trim()} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
                <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-700/30 flex-shrink-0 bg-black/10">
          <div className="text-sm text-gray-400">
            {filtered.length} équipement{filtered.length > 1 ? 's' : ''}
            {addedItems.size > 0 && (
              <span className="text-green-400 ml-2">
                • {addedItems.size} sélectionné{addedItems.size > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              {multiAdd ? 'Annuler' : 'Fermer'}
            </button>
            {multiAdd && (
              <button
                onClick={onClose}
                className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Valider ({addedItems.size})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ✅ Rendre dans le body pour éviter les problèmes de z-index et de positionnement
  return createPortal(modalContent, document.body);
}