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
    .replace(/&eacute;/g, "e")
    .replace(/&egrave;/g, "e")
    .replace(/&agrave;/g, "a")
    .replace(/&ocirc;/g, "o")
    .replace(/&icirc;/g, "i")
    .replace(/&ucirc;/g, "u")
    .replace(/&ccedil;/g, "c")
    .replace(/&ecirc;/g, "e")
    .replace(/&acirc;/g, "a")
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

function parseNameDescPairs(
  sectionHtml: string
): Array<{ name: string; description: string }> {
  const items: Array<{ name: string; description: string }> = [];

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

  const entryRegex =
    /<(?:em|i|strong|b)[^>]*>\s*<(?:em|i|strong|b)[^>]*>([^<]+)<\/(?:em|i|strong|b)>\s*<\/(?:em|i|strong|b)>/gi;
  const allMatches = [...sectionHtml.matchAll(entryRegex)];

  if (allMatches.length === 0) {
    const altRegex =
      /<(?:strong|b)[^>]*>([^<]+)<\/(?:strong|b)>\s*[.:]?\s*/gi;
    const altMatches = [...sectionHtml.matchAll(altRegex)];

    for (let i = 0; i < altMatches.length; i++) {
      const nameText = extractTextContent(altMatches[i][1]).replace(
        /\.\s*$/,
        ""
      );
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
    const nameText = extractTextContent(allMatches[i][1]).replace(
      /\.\s*$/,
      ""
    );
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
  // FIX 1 : Extraction du bloc "jaune" par compteur de profondeur
  // au lieu d'une regex non-greedy qui tronque aux </div> internes
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

      if (closeDiv === -1) break; // malformé, on sort

      if (openDiv !== -1 && openDiv < closeDiv) {
        depth++;
        pos = openDiv + 4; // avancer après "<div"
      } else {
        depth--;
        if (depth === 0) {
          return source.substring(contentStart, closeDiv);
        }
        pos = closeDiv + 6; // avancer après "</div>"
      }
    }
    return null; // pas trouvé le fermant
  }

  const block = extractDivByClass(html, "jaune") || html;

  // ============================================================
  // Le reste du parsing est identique mais fonctionne maintenant
  // sur le bloc COMPLET (traits, actions, etc. inclus)
  // ============================================================

  const nameMatch = block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const name = nameMatch ? extractTextContent(nameMatch[1]) : slug;

  const typeDiv = block.match(/<div\s+class=['"]type['"][^>]*>([\s\S]*?)<\/div>/i);
  const typeLine = typeDiv ? extractTextContent(typeDiv[1]) : "";
  const typeMatch = typeLine.match(
    /^(.*?)\s+de\s+taille\s+(\w+),?\s*(.*?)$/i
  );

  const monsterType = typeMatch ? typeMatch[1].trim() : "";
  const size = typeMatch ? typeMatch[2].trim() : "";
  const alignment = typeMatch ? typeMatch[3].trim() : "";

  // ... (AC, HP, Speed, Abilities — inchangés) ...

  // ============================================================
  // FIX 2 : Découpage des sections "rub" par positions, pas par regex
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

  // Le contenu de chaque section = de la fin de son <div class="rub">
  // jusqu'au début de la section suivante (ou fin du bloc)
  const sections: Array<{ title: string; content: string }> = [];
  for (let i = 0; i < rubPositions.length; i++) {
    const endIdx = i + 1 < rubPositions.length
      ? block.lastIndexOf("<div", rubPositions[i + 1].startIdx)
      : block.length;
    sections.push({
      title: rubPositions[i].title,
      content: block.substring(rubPositions[i].startIdx, endIdx > rubPositions[i].startIdx ? endIdx : block.length),
    });
  }

  // ============================================================
  // FIX 3 : Extraction des traits — chercher <strong>FP</strong>
  // au lieu de "FP" en texte brut, et simplifier les fallbacks
  // ============================================================
  let traits: Array<{ name: string; description: string }> = [];

  const firstRubIdx = rubPositions.length > 0
    ? block.lastIndexOf("<div", rubPositions[0].startIdx)
    : block.length;
  const preSection = block.substring(0, firstRubIdx);

  // Chercher la position de <strong>FP</strong> (pas juste "FP" en texte brut)
  const fpStrongMatch = preSection.match(/<strong>FP<\/strong>\s*[\d\/]+\s*(?:\([^)]*\))?/i);
  if (fpStrongMatch) {
    const fpEnd = fpStrongMatch.index! + fpStrongMatch[0].length;
    const traitBlock = preSection.substring(fpEnd);
    // Ne parser que s'il reste du contenu significatif (pas juste des <br>)
    if (traitBlock.match(/<(?:strong|em|p\b)/i)) {
      traits = parseNameDescPairs(traitBlock);
    }
  }

  // Fallback: chercher dans les sections "rub" nommées "trait" ou générique
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

  // Fallback 3: si aucun trait n'a été trouvé, chercher une section "rub" nommée "trait" ou sans titre
  if (traits.length === 0) {
    for (const sec of sections) {
      const title = sec.title;
      if (
        title.includes("trait") ||
        title === "" ||
        (!title.includes("action") && !title.includes("réaction") && !title.includes("reaction") && !title.includes("légendaire"))
      ) {
        const parsed = parseNameDescPairs(sec.content);
        if (parsed.length > 0 && !title.includes("action")) {
          traits = parsed;
          break;
        }
      }
    }
  }

  for (const sec of sections) {
    const title = sec.title;
    if (title.includes("action") && title.includes("légendaire")) {
      const descMatch = sec.content.match(/^([\s\S]*?)(?=<(?:em|i|strong|b))/i);
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

  let imageUrl: string | undefined;
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch) {
    const src = imgMatch[1];
    if (src.startsWith('http')) {
      imageUrl = src;
    } else if (src.startsWith('/')) {
      imageUrl = `https://www.aidedd.org${src}`;
    } else if (src.startsWith('img/')) {
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
