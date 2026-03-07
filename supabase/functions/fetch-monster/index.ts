import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

function parseAbilityScore(text: string): number {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 10;
}

function extractTextContent(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&eacute;/g, "é")
    .replace(/&egrave;/g, "è")
    .replace(/&agrave;/g, "à")
    .replace(/&ocirc;/g, "ô")
    .replace(/&icirc;/g, "î")
    .replace(/&ucirc;/g, "û")
    .replace(/&ccedil;/g, "ç")
    .replace(/&ecirc;/g, "ê")
    .replace(/&acirc;/g, "â")
    .replace(/&#(\d+);/g, (_m: string, code: string) => String.fromCharCode(parseInt(code, 10)))
    .trim();
}

interface MonsterListItem {
  name: string;
  slug: string;
  cr: string;
  type: string;
  size: string;
  ac: string;
  hp: string;
  source: string;
}

interface MonsterDetail {
  name: string;
  slug: string;
  size: string;
  type: string;
  alignment: string;
  armor_class: number;
  armor_desc: string;
  hit_points: number;
  hit_points_formula: string;
  speed: Record<string, string>;
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  saving_throws: string;
  skills: string;
  vulnerabilities: string;
  resistances: string;
  damage_immunities: string;
  condition_immunities: string;
  senses: string;
  languages: string;
  challenge_rating: string;
  xp: number;
  traits: Array<{ name: string; description: string }>;
  actions: Array<{ name: string; description: string }>;
  bonus_actions: Array<{ name: string; description: string }>;
  reactions: Array<{ name: string; description: string }>;
  legendary_actions: Array<{ name: string; description: string }>;
  legendary_description: string;
  image_url?: string;
}

async function fetchMonsterList(): Promise<MonsterListItem[]> {
  const res = await fetch("https://www.aidedd.org/monster/fr/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DnDTracker/1.0)",
      Accept: "text/html",
    },
  });

  if (!res.ok) throw new Error(`AideDD returned ${res.status}`);

  const html = await res.text();
  const monsters: MonsterListItem[] = [];

  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return monsters;

  const tbody = tbodyMatch[1];
  const rows = tbody.split(/<\/tr>/i);

  for (const row of rows) {
    const linkMatch = row.match(
      /<a\s+href=['"](fr\/([^'"]+))['"][^>]*>([^<]+)<\/a>/i
    );
    if (!linkMatch) continue;

    const slug = linkMatch[2];
    const name = extractTextContent(linkMatch[3]);

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];

    monsters.push({
      name,
      slug,
      cr: cells.length > 5 ? extractTextContent(cells[5][1]) : "",
      type: cells.length > 6 ? extractTextContent(cells[6][1]) : "",
      size: cells.length > 7 ? extractTextContent(cells[7][1]) : "",
      ac: cells.length > 8 ? extractTextContent(cells[8][1]) : "",
      hp: cells.length > 9 ? extractTextContent(cells[9][1]) : "",
      source: cells.length > 20 ? extractTextContent(cells[20][1]) : "",
    });
  }

  return monsters;
}

// ============================================================
// CORRECTIF PRINCIPAL : parseNameDescPairs supporte maintenant
// la structure réelle d'AideDD : <div class="titre">Nom.</div>
// suivi du texte de description (pas de <p><strong><em>)
// ============================================================
function parseNameDescPairs(
  sectionHtml: string
): Array<{ name: string; description: string }> {
  const items: Array<{ name: string; description: string }> = [];

  // --- STRATÉGIE 1 : <div class="monstrefeature"> (structure réelle AideDD) ---
  // Chaque trait/action est dans un div.monstrefeature avec <b><i>Nom.</i></b> desc
  const featureRegex = /<div\s+class=['"]monstrefeature['"][^>]*>([\s\S]*?)<\/div>/gi;
  const featureMatches = [...sectionHtml.matchAll(featureRegex)];

  if (featureMatches.length > 0) {
    for (const fm of featureMatches) {
      const content = fm[1];
      // Le nom est dans <b><i>...</i></b> ou <i><b>...</b></i> ou <strong><em> etc.
      const nameMatch = content.match(
        /<(?:b|strong)[^>]*>\s*<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>\s*<\/(?:b|strong)>|<(?:i|em)[^>]*>\s*<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>\s*<\/(?:i|em)>/i
      );
      if (nameMatch) {
        const nameText = extractTextContent(nameMatch[1] || nameMatch[2] || "").replace(/\.\s*$/, "");
        const startIdx = (nameMatch.index || 0) + nameMatch[0].length;
        const desc = extractTextContent(content.substring(startIdx)).replace(/^\.\s*/, "").trim();
        if (nameText) items.push({ name: nameText, description: desc });
      } else {
        // Fallback : <b>Nom.</b> ou <strong>Nom.</strong> seul
        const boldMatch = content.match(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/i);
        if (boldMatch) {
          const nameText = extractTextContent(boldMatch[1]).replace(/\.\s*$/, "");
          const startIdx = (boldMatch.index || 0) + boldMatch[0].length;
          const desc = extractTextContent(content.substring(startIdx)).replace(/^\.\s*/, "").trim();
          if (nameText && nameText.length < 100) items.push({ name: nameText, description: desc });
        }
      }
    }
    if (items.length > 0) return items;
  }

  // --- STRATÉGIE 2 (ancienne) : <div class="titre">Nom.</div> ---
  const titreRegex = /<div\s+class=['"]titre['"][^>]*>([\s\S]*?)<\/div>/gi;
  const titreMatches = [...sectionHtml.matchAll(titreRegex)];

  if (titreMatches.length > 0) {
    for (let i = 0; i < titreMatches.length; i++) {
      const nameText = extractTextContent(titreMatches[i][1]).replace(/\.\s*$/, "");
      const startIdx = titreMatches[i].index! + titreMatches[i][0].length;
      const endIdx =
        i + 1 < titreMatches.length
          ? titreMatches[i + 1].index!
          : sectionHtml.length;
      const desc = extractTextContent(sectionHtml.substring(startIdx, endIdx)).trim();
      if (nameText) {
        items.push({ name: nameText, description: desc });
      }
    }
    if (items.length > 0) return items;
  }

  // --- STRATÉGIE 2 : <p> contenant <strong><em> ou <em><strong> ---
  const pBlocks = [...sectionHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];

  if (pBlocks.length > 0) {
    for (const pBlock of pBlocks) {
      const content = pBlock[1];
      const nameMatch = content.match(
        /<strong[^>]*>\s*<em[^>]*>([^<]+)<\/em>\s*<\/strong>|<em[^>]*>\s*<strong[^>]*>([^<]+)<\/strong>\s*<\/em>/i
      );
      if (nameMatch) {
        const nameText = (nameMatch[1] || nameMatch[2] || "").replace(/\.\s*$/, "");
        const startIdx = (nameMatch.index || 0) + nameMatch[0].length;
        const desc = extractTextContent(content.substring(startIdx)).replace(/^\.\s*/, "");
        if (nameText) {
          items.push({ name: nameText, description: desc });
        }
      } else {
        const boldMatch = content.match(/<strong[^>]*>([^<]+)<\/strong>/i);
        if (boldMatch) {
          const nameText = boldMatch[1].replace(/\.\s*$/, "");
          const startIdx = (boldMatch.index || 0) + boldMatch[0].length;
          const desc = extractTextContent(content.substring(startIdx)).replace(/^\.\s*/, "");
          if (nameText && nameText.length < 100) {
            items.push({ name: nameText, description: desc });
          }
        }
      }
    }
    if (items.length > 0) return items;
  }

  // --- STRATÉGIE 3 : <em><strong> ou <strong><em> hors <p> ---
  const entryRegex =
    /<(?:em|i|strong|b)[^>]*>\s*<(?:em|i|strong|b)[^>]*>([^<]+)<\/(?:em|i|strong|b)>\s*<\/(?:em|i|strong|b)>/gi;
  const allMatches = [...sectionHtml.matchAll(entryRegex)];

  if (allMatches.length === 0) {
    // --- STRATÉGIE 4 : <strong>Nom</strong> seul ---
    const altRegex =
      /<(?:strong|b)[^>]*>([^<]+)<\/(?:strong|b)>\s*[.:]?\s*/gi;
    const altMatches = [...sectionHtml.matchAll(altRegex)];

    for (let i = 0; i < altMatches.length; i++) {
      const nameText = extractTextContent(altMatches[i][1]).replace(/\.\s*$/, "");
      const startIdx = altMatches[i].index! + altMatches[i][0].length;
      const endIdx =
        i + 1 < altMatches.length
          ? altMatches[i + 1].index!
          : sectionHtml.length;
      const desc = extractTextContent(sectionHtml.substring(startIdx, endIdx));

      if (nameText && nameText.length < 100) {
        items.push({ name: nameText, description: desc });
      }
    }
    return items;
  }

  for (let i = 0; i < allMatches.length; i++) {
    const nameText = extractTextContent(allMatches[i][1]).replace(/\.\s*$/, "");
    const startIdx = allMatches[i].index! + allMatches[i][0].length;
    const endIdx =
      i + 1 < allMatches.length
        ? allMatches[i + 1].index!
        : sectionHtml.length;
    const desc = extractTextContent(sectionHtml.substring(startIdx, endIdx));

    items.push({ name: nameText, description: desc });
  }

  return items;
}

async function fetchMonsterDetail(slug: string): Promise<MonsterDetail> {
  const url = `https://www.aidedd.org/monster/fr/${slug}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DnDTracker/1.0)",
      Accept: "text/html",
    },
  });

  if (!res.ok) throw new Error(`Monster not found: ${res.status}`);

  const html = await res.text();

  // ============================================================
  // FIX 1 : Extraction du bloc par compteur de profondeur
  // pour ne pas tronquer aux </div> internes
  // ============================================================
  function extractDivByClass(source: string, className: string): string | null {
    const openRegex = new RegExp(
      `<div\\s+class=['"]${className}['"][^>]*>`,
      "i"
    );
    const startMatch = openRegex.exec(source);
    if (!startMatch) return null;

    let depth = 1;
    let pos = startMatch.index + startMatch[0].length;
    const contentStart = pos;

    while (pos < source.length && depth > 0) {
      const openDiv = source.indexOf("<div", pos);
      const closeDiv = source.indexOf("</div>", pos);

      if (closeDiv === -1) break;

      if (openDiv !== -1 && openDiv < closeDiv) {
        depth++;
        pos = openDiv + 4;
      } else {
        depth--;
        if (depth === 0) {
          return source.substring(contentStart, closeDiv);
        }
        pos = closeDiv + 6;
      }
    }
    return null;
  }

  // On prend tout le bloc "blocmonst" ou à défaut "jaune", ou à défaut tout le HTML
  const block = extractDivByClass(html, "blocmonst")
    || extractDivByClass(html, "jaune")
    || html;

  // --- Nom ---
  const nameMatch = block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const name = nameMatch ? extractTextContent(nameMatch[1]) : slug;

  // --- Type, taille, alignement ---
  const typeDiv = block.match(/<div\s+class=['"]type['"][^>]*>([\s\S]*?)<\/div>/i);
  const typeLine = typeDiv ? extractTextContent(typeDiv[1]) : "";
  const typeMatch = typeLine.match(/^(.*?)\s+de\s+taille\s+(\w+),?\s*(.*?)$/i);

  const monsterType = typeMatch ? typeMatch[1].trim() : "";
  const size = typeMatch ? typeMatch[2].trim() : "";
  const alignment = typeMatch ? typeMatch[3].trim() : "";

  // --- Classe d'armure ---
  const acMatch = block.match(/<strong>CA<\/strong>\s*(\d+)\s*(.*?)(?:<br|$)/i);
  const acFallback = block.match(/(?:Classe\s+d['']armure|CA)\s*[:\s]*(\d+)\s*(.*?)(?:<br|<\/|$)/i);
  const armorClass = acMatch
    ? parseInt(acMatch[1], 10)
    : acFallback
    ? parseInt(acFallback[1], 10)
    : 10;
  const armorDesc = acMatch
    ? extractTextContent(acMatch[2])
    : acFallback
    ? extractTextContent(acFallback[2])
    : "";

  // --- Points de vie ---
  const hpMatch = block.match(/<strong>Pv<\/strong>\s*(\d+)\s*(?:\(([\s\S]*?)\))?/i);
  const hpFallback = block.match(/(?:Points?\s+de\s+vie|PV)\s*[:\s]*(\d+)\s*(?:\(([\s\S]*?)\))?/i);
  const hitPoints = hpMatch
    ? parseInt(hpMatch[1], 10)
    : hpFallback
    ? parseInt(hpFallback[1], 10)
    : 1;
  const hitPointsFormula = hpMatch
    ? (hpMatch[2] || "").trim()
    : hpFallback
    ? (hpFallback[2] || "").trim()
    : "";

  // --- Vitesse ---
  const speedMatch = block.match(/<strong>Vitesse<\/strong>\s*([\s\S]*?)(?:<br|<div|$)/i);
  const speedFallback = block.match(/(?:Vitesse|VIT)\s*[:\s]*([\s\S]*?)(?:<br|<\/|<strong)/i);
  const speedText = speedMatch
    ? extractTextContent(speedMatch[1])
    : speedFallback
    ? extractTextContent(speedFallback[1])
    : "";
  const speed: Record<string, string> = {};

  if (speedText) {
    const parts = speedText.split(",").map((s) => s.trim());
    for (const part of parts) {
      const namedSpeed = part.match(/^(nage|vol|fouissement|escalade|creusement)\s+(.+)$/i);
      if (namedSpeed) {
        speed[namedSpeed[1].toLowerCase()] = namedSpeed[2];
      } else if (!speed["marche"]) {
        speed["marche"] = part;
      }
    }
  }

  // --- Caractéristiques ---
  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  const car2Matches = [...block.matchAll(/class=['"]car2['"][^>]*>([\s\S]*?)<\/div>/gi)];
  const car5Matches = [...block.matchAll(/class=['"]car5['"][^>]*>([\s\S]*?)<\/div>/gi)];

  const abilityKeysRow1: Array<keyof typeof abilities> = ["str", "dex", "con"];
  const abilityKeysRow2: Array<keyof typeof abilities> = ["int", "wis", "cha"];

  for (let i = 0; i < Math.min(car2Matches.length, 3); i++) {
    const val = parseAbilityScore(car2Matches[i][1]);
    if (val > 0) abilities[abilityKeysRow1[i]] = val;
  }
  for (let i = 0; i < Math.min(car5Matches.length, 3); i++) {
    const val = parseAbilityScore(car5Matches[i][1]);
    if (val > 0) abilities[abilityKeysRow2[i]] = val;
  }

  const tableAbilityMatch = block.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (tableAbilityMatch && car2Matches.length === 0) {
    const abilityKeys: Array<keyof typeof abilities> = ["str", "dex", "con", "int", "wis", "cha"];
    const rows = [...tableAbilityMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (rows.length >= 12) {
      for (let i = 0; i < 6; i++) {
        const val = parseAbilityScore(rows[i + 6][1]);
        if (val > 0) abilities[abilityKeys[i]] = val;
      }
    }
  }

  // ============================================================
  // FIX 2 : Parsing robuste des champs (Jets de sauvegarde, etc.)
  // via extraction de toutes les paires <strong>Label</strong> Valeur
  // ============================================================
  const headerEnd = block.search(/<div\s+class=['"]rub['"][^>]*>/i);
  const headerBlock = headerEnd > -1 ? block.substring(0, headerEnd) : block;

  const extractAllFields = (htmlBlock: string): Record<string, string> => {
    const fields: Record<string, string> = {};
    const normalized = htmlBlock
      .replace(/<br\s*\/?>/gi, "|||BREAK|||")
      .replace(/<\/div>/gi, "|||BREAK|||")
      .replace(/<\/p>/gi, "|||BREAK|||");
    const lines = normalized.split("|||BREAK|||");
    for (const line of lines) {
      const strongMatch = line.match(/<strong>(.*?)<\/strong>\s*(.*)/i);
      if (strongMatch) {
        const rawLabel = extractTextContent(strongMatch[1]).trim();
        const rawValue = extractTextContent(strongMatch[2]).trim();
        if (rawLabel) fields[rawLabel] = rawValue;
      }
    }
    return fields;
  };

  const allFields = extractAllFields(headerBlock);

  const normalize = (s: string): string =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const findField = (...labels: string[]): string => {
    for (const label of labels) {
      const normalizedLabel = normalize(label);
      for (const [key, value] of Object.entries(allFields)) {
        if (normalize(key) === normalizedLabel) return value;
      }
    }
    for (const label of labels) {
      const normalizedLabel = normalize(label);
      for (const [key, value] of Object.entries(allFields)) {
        const normalizedKey = normalize(key);
        if (normalizedKey.startsWith(normalizedLabel) || normalizedLabel.startsWith(normalizedKey)) {
          return value;
        }
      }
    }
    return "";
  };

  const savingThrows = findField("Jets de sauvegarde", "JdS");
  const skillsText = findField("Compétences");
  const vulnerabilities = findField("Vulnérabilités", "Vulnérabilités aux dégâts");
  const resistances = findField("Résistances aux dégâts", "Résistances");
  const damageImmunities = findField("Immunités aux dégâts");
  const conditionImmunities = findField("Immunités aux conditions");
  const senses = findField("Sens");
  const languages = findField("Langues");

  // --- Challenge Rating / FP ---
  const crMatch1 = block.match(/<strong>FP<\/strong>\s*([\d\/]+)\s*(?:\(([^)]*)\))?/i);
  const crMatch2 = block.match(/(?:Facteur\s+de\s+puissance|FP)\s*[:\s]*([\d\/]+)\s*(?:\(([^)]*)\))?/i);
  const crMatch = crMatch1 || crMatch2;
  const challengeRating = crMatch ? crMatch[1].trim() : "0";
  const xpMatch = crMatch && crMatch[2] ? crMatch[2].match(/[\d\s]+/) : null;
  const xp = xpMatch ? parseInt(xpMatch[0].replace(/\s/g, ""), 10) : 0;

  // ============================================================
  // FIX 3 : Découpage des sections "rub" par positions
  // ============================================================
  const rubPositions: Array<{ title: string; startIdx: number }> = [];
  const rubRegex = /<div\s+class=['"]rub['"][^>]*>([\s\S]*?)<\/div>/gi;
  let rubMatch;
  while ((rubMatch = rubRegex.exec(block)) !== null) {
    rubPositions.push({
      title: extractTextContent(rubMatch[1]).toLowerCase(),
      startIdx: rubMatch.index + rubMatch[0].length,
    });
  }

  const sections: Array<{ title: string; content: string }> = [];
  for (let i = 0; i < rubPositions.length; i++) {
    const endIdx = i + 1 < rubPositions.length
      ? block.lastIndexOf("<div", rubPositions[i + 1].startIdx)
      : block.length;
    sections.push({
      title: rubPositions[i].title,
      content: block.substring(
        rubPositions[i].startIdx,
        endIdx > rubPositions[i].startIdx ? endIdx : block.length
      ),
    });
  }

  // ============================================================
  // FIX 4 : Extraction des traits depuis la zone avant le 1er "rub"
  // ============================================================
  let traits: Array<{ name: string; description: string }> = [];
  let actions: Array<{ name: string; description: string }> = [];
  let bonusActions: Array<{ name: string; description: string }> = [];
  let reactions: Array<{ name: string; description: string }> = [];
  let legendaryActions: Array<{ name: string; description: string }> = [];
  let legendaryDescription = "";

  const firstRubIdx = rubPositions.length > 0
    ? block.lastIndexOf("<div", rubPositions[0].startIdx)
    : block.length;
  const preSection = block.substring(0, firstRubIdx);

  // Chercher après le FP : les traits sont après la ligne FP
  const fpStrongMatch = preSection.match(/<strong>FP<\/strong>\s*[\d\/]+\s*(?:\([^)]*\))?/i);
  if (fpStrongMatch) {
    const fpEnd = fpStrongMatch.index! + fpStrongMatch[0].length;
    const traitBlock = preSection.substring(fpEnd);
    if (traitBlock.match(/<(?:strong|em|p\b|div)/i)) {
      traits = parseNameDescPairs(traitBlock);
    }
  }

  // Fallback : chercher dans les sections "rub" dont le titre contient "trait"
  if (traits.length === 0) {
    for (const sec of sections) {
      const title = sec.title;
      if (
        title.includes("trait") ||
        title === "" ||
        (!title.includes("action") &&
          !title.includes("réaction") &&
          !title.includes("reaction") &&
          !title.includes("légendaire"))
      ) {
        const parsed = parseNameDescPairs(sec.content);
        if (parsed.length > 0 && !title.includes("action")) {
          traits = parsed;
          break;
        }
      }
    }
  }

  // Parsing des sections Actions / Bonus / Réactions / Légendaires
  for (const sec of sections) {
    const title = sec.title;
    if (title.includes("action") && title.includes("légendaire")) {
      const descMatch = sec.content.match(/^([\s\S]*?)(?=<(?:em|i|strong|b|div))/i);
      if (descMatch) legendaryDescription = extractTextContent(descMatch[1]);
      legendaryActions = parseNameDescPairs(sec.content);
    } else if (title.includes("action") && title.includes("bonus")) {
      bonusActions = parseNameDescPairs(sec.content);
    } else if (title.includes("réaction") || title.includes("reaction")) {
      reactions = parseNameDescPairs(sec.content);
    } else if (title.includes("action")) {
      actions = parseNameDescPairs(sec.content);
    }
  }

  // --- Image ---
  let imageUrl: string | undefined;
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch) {
    const src = imgMatch[1];
    if (src.startsWith("http")) {
      imageUrl = src;
    } else if (src.startsWith("/")) {
      imageUrl = `https://www.aidedd.org${src}`;
    } else if (src.startsWith("img/")) {
      imageUrl = `https://www.aidedd.org/monster/${src}`;
    } else {
      imageUrl = `https://www.aidedd.org/monster/fr/${src}`;
    }
  }

  return {
    name,
    slug,
    size,
    type: monsterType,
    alignment,
    armor_class: armorClass,
    armor_desc: armorDesc,
    hit_points: hitPoints,
    hit_points_formula: hitPointsFormula,
    speed,
    abilities,
    saving_throws: savingThrows,
    skills: skillsText,
    vulnerabilities,
    resistances,
    damage_immunities: damageImmunities,
    condition_immunities: conditionImmunities,
    senses,
    languages,
    challenge_rating: challengeRating,
    xp,
    traits,
    actions,
    bonus_actions: bonusActions,
    reactions,
    legendary_actions: legendaryActions,
    legendary_description: legendaryDescription,
    image_url: imageUrl,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "list") {
      const monsters = await fetchMonsterList();
      return jsonResponse(monsters);
    }

    if (action === "detail") {
      const slug = url.searchParams.get("slug");
      if (!slug) return errorResponse("Missing slug parameter", 400);
      const monster = await fetchMonsterDetail(slug);
      return jsonResponse(monster);
    }

    return errorResponse("Invalid action. Use ?action=list or ?action=detail&slug=xxx", 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message);
  }
});