// Service pour charger et parser le catalogue d'équipements
type CatalogKind = 'armors' | 'shields' | 'weapons' | 'adventuring_gear' | 'tools' | 'gems'; // ✅ Ajout de 'gems'

interface ArmorMeta {
  base: number;
  addDex: boolean;
  dexCap?: number | null;
  label: string;
}

interface ShieldMeta {
  bonus: number;
}

interface WeaponMeta {
  damageDice: string;
  damageType: 'Tranchant' | 'Perforant' | 'Contondant';
  properties: string;
  range: string;
  category?: string;
}

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  description?: string;
  armor?: ArmorMeta;
  shield?: ShieldMeta;
  weapon?: WeaponMeta;
  imageUrl?: string;
}

const ULT_BASE = 'https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Equipements';
const URLS = {
  armors: `${ULT_BASE}/Armures.md`,
  shields: `${ULT_BASE}/Boucliers.md`,
  weapons: `${ULT_BASE}/Armes.md`,
  adventuring_gear: `${ULT_BASE}/Equipements_daventurier.md`,
  tools: `${ULT_BASE}/Outils.md`,
  gems: `${ULT_BASE}/Pierres%20pr%C3%A9cieuses.md`, // ✅ AJOUT
};

const stripPriceParentheses = (name: string) =>
  name.replace(/\s*\((?:\d+|\w+|\s|,|\.|\/|-)+\s*p[oa]?\)\s*$/i, '').trim();

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
          !nomRaw ||
          !ca ||
          nomNorm.includes('armure') && caNorm.includes('classe') ||
          nomRaw.includes('-') && nomRaw.length > 5 ||
          ca.includes('-') && ca.length > 5 ||
          nomRaw === '—' ||
          ca === '—' ||
          nomRaw === '---' ||
          ca === '---' ||
          caNorm.includes('force') ||
          caNorm.includes('discrétion') ||
          nomNorm === 'force' ||
          nomNorm === 'discrétion'
        ) {
          continue;
        }
        
        const nom = stripPriceParentheses(nomRaw);

        if (!nom || nom === '---' || nom.length < 2) {
          continue;
        }
        
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
            addDex = false;
            dexCap = null;
          } else {
            const anyNumberMatch = ca.match(/(\d+)/);
            if (anyNumberMatch) {
              base = parseInt(anyNumberMatch[1]);
              addDex = false;
              dexCap = null;
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
    if (/^nom$/i.test(nomRaw) || /classe d'armure|ca/i.test(ca)) continue;
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
    else if (/tranchant/i.test(degats)) damageType = 'Tranchant';
    let range = 'Corps à corps';
    const pm = (props || '').match(/portée\s*([\d,\.\/\s]+)/i);
    if (pm) {
      const first = pm[1].trim().split(/[\/\s]/)[0]?.trim() || '';
      if (first) range = `${first} m`;
    }
    items.push({ 
      id: `weapon:${nom}`, 
      kind: 'weapons', 
      name: nom, 
      weapon: { damageDice, damageType, properties: props || '', range } 
    });
  }
  return items;
}

function parseGems(md: string): CatalogItem[] {
  console.log('🔍 parseGems: Début du parsing');
  
  const items: CatalogItem[] = [];
  const lines = md.split('\n');
  
  let inTable = false;
  let headerProcessed = false;
  let nameColIdx = -1;
  let valueColIdx = -1;
  let descColIdx = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Détecter une ligne de table
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.substring(1, line.length - 1).split('|').map(c => c.trim());
      
      // Ligne de séparation (ex: |---|---|)
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        inTable = true;
        console.log('✅ Ligne de séparation détectée, début de table');
        continue;
      }
      
      // Header de la table
      if (!headerProcessed && !inTable) {
        console.log('📋 Header détecté:', cells);
        nameColIdx = cells.findIndex(h => /pierre|gemme|nom/i.test(h));
        valueColIdx = cells.findIndex(h => /valeur|prix|co[ûu]t/i.test(h));
        descColIdx = cells.findIndex(h => /description|courte/i.test(h));
        
        if (nameColIdx === -1) nameColIdx = 0; // Fallback sur première colonne
        
        console.log('Index des colonnes:', { nameColIdx, valueColIdx, descColIdx });
        headerProcessed = true;
        continue;
      }
      
      // Ligne de données
      if (inTable && headerProcessed) {
        const rawName = cells[nameColIdx] || '';
        const name = stripPriceParentheses(rawName).trim();
        
        // Filtrer les lignes invalides
        if (!name || 
            name.length < 2 ||
            /^pierre|^gemme|^valeur|^nom|^description/i.test(name)) {
          console.log(`  ⚠️ Ligne ignorée: "${name}"`);
          continue;
        }
        
        // Construire la description
        const parts: string[] = [];
        
        // Valeur
        if (valueColIdx !== -1 && cells[valueColIdx]) {
          let value = cells[valueColIdx].trim();
          if (value && value !== '---' && value !== '—') {
            const numMatch = value.match(/(\d+)\s*(po|pa|pc)?/i);
            if (numMatch) {
              const amount = numMatch[1];
              let currency = numMatch[2] ? numMatch[2].toLowerCase() : 'po';
              
              if (!currency || currency === 'po' || currency === 'or') {
                currency = parseInt(amount) >= 100 ? 'po' : 
                           parseInt(amount) >= 10 ? 'pa' : 'pc';
              } else if (currency === 'pa' || currency === 'argent') {
                currency = 'pa';
              } else if (currency === 'pc' || currency === 'cuivre') {
                currency = 'pc';
              }
              
              const symbol = currency === 'po' ? '🟡' : 
                            currency === 'pa' ? '⚪' : '🟤';
              const label = currency === 'po' ? "pièce d'or" : 
                           currency === 'pa' ? "pièce d'argent" : 
                           "pièce de cuivre";
              
              const fullLabel = parseInt(amount) > 1 ? `${label}s` : label;
              
              parts.push(`Valeur: ${symbol} ${amount} ${fullLabel}`);
            }
          }
        }
        
        // Description
        if (descColIdx !== -1 && cells[descColIdx]) {
          const desc = cells[descColIdx].trim();
          if (desc && desc !== '---' && desc !== '—') {
            parts.push(desc);
          }
        }
        
        const description = parts.join('\n\n') || 'Pierre précieuse';
        
        console.log(`  ✅ Gemme ajoutée: "${name}"`);
        
        items.push({
          id: `gem:${name}`,
          kind: 'gems',
          name,
          description
        });
      }
    } else {
      // Ligne non-table => réinitialiser
      if (inTable) {
        console.log('⚠️ Fin de table détectée');
        inTable = false;
      }
    }
  }
  
  console.log(`\n📊 parseGems: ${items.length} gemmes parsées au total`);
  console.log('Liste des gemmes:', items.map(g => g.name).join(', '));
  
  return items;
}

function parseSectionedList(md: string, kind: CatalogKind): CatalogItem[] {
  const items: CatalogItem[] = [];
  const lines = md.split('\n');
  let current: { name: string; descLines: string[] } | null = null;

  const isNoiseName = (n: string) =>
    !n ||
    /^sommaire$/i.test(n) ||
    /^table des matières$/i.test(n) ||
    /^introduction$/i.test(n);

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
    if (h) {
      if (current) flush();
      current = { name: h[1].trim(), descLines: [] };
      continue;
    }
    if (/^---\s*$/.test(line)) {
      if (current) {
        flush();
        continue;
      }
    }
    if (current) current.descLines.push(line);
  }
  if (current) flush();
  return items;
}

// Cache global
let cachedCatalog: CatalogItem[] | null = null;

export async function loadEquipmentCatalog(): Promise<CatalogItem[]> {
  console.log('🔄 loadEquipmentCatalog: Début du chargement');
  
  if (cachedCatalog) {
    console.log('✅ Retour du cache:', cachedCatalog.length, 'items');
    return cachedCatalog;
  }

  try {
    console.log('📥 Chargement des fichiers depuis GitHub...');
    console.log('URLs:', URLS);
    
    const [armorsMd, shieldsMd, weaponsMd, gearMd, toolsMd, gemsMd] = await Promise.all([
      fetchText(URLS.armors),
      fetchText(URLS.shields),
      fetchText(URLS.weapons),
      fetchText(URLS.adventuring_gear),
      fetchText(URLS.tools),
      fetchText(URLS.gems),
    ]);

    console.log('✅ Fichiers chargés:');
    console.log('  - Armures:', armorsMd.length, 'chars');
    console.log('  - Boucliers:', shieldsMd.length, 'chars');
    console.log('  - Armes:', weaponsMd.length, 'chars');
    console.log('  - Équipement:', gearMd.length, 'chars');
    console.log('  - Outils:', toolsMd.length, 'chars');
    console.log('  - 💎 GEMMES:', gemsMd.length, 'chars');

    console.log('\n🔨 Parsing des fichiers...');
    
    const armorsItems = parseArmors(armorsMd);
    console.log('  ✅ Armures:', armorsItems.length);
    
    const shieldsItems = parseShields(shieldsMd);
    console.log('  ✅ Boucliers:', shieldsItems.length);
    
    const weaponsItems = parseWeapons(weaponsMd);
    console.log('  ✅ Armes:', weaponsItems.length);
    
    const gearItems = parseSectionedList(gearMd, 'adventuring_gear');
    console.log('  ✅ Équipement:', gearItems.length);
    
    const toolsItems = parseSectionedList(toolsMd, 'tools');
    console.log('  ✅ Outils:', toolsItems.length);
    
    console.log('\n🔍 Appel de parseGems...');
    const gemsItems = parseGems(gemsMd);
    console.log('  ✅ Gemmes:', gemsItems.length);

    const list: CatalogItem[] = [
      ...armorsItems,
      ...shieldsItems,
      ...weaponsItems,
      ...gearItems,
      ...toolsItems,
      ...gemsItems,
    ];
    
    console.log('\n📊 Total avant dédupliquer:', list.length);

    // Dédupliquer
    const seen = new Set<string>();
    const cleaned = list.filter(ci => {
      const nm = (ci.name || '').trim();
      if (!nm) return false;
      const id = ci.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    cachedCatalog = cleaned;
    return cleaned;
  } catch (error) {
    console.error('Erreur chargement catalogue:', error);
    throw error;
  }
}

// Fonction helper pour obtenir un équipement aléatoire par type
export function getRandomEquipmentByType(
  catalog: CatalogItem[],
  types: CatalogKind[]
): CatalogItem | null {
  const filtered = catalog.filter(item => types.includes(item.kind));
  if (filtered.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex];
}