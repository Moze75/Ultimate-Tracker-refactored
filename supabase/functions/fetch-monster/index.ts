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

  const jauneMatch = html.match(
    /<div\s+class="jaune"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/div|$)/i
  );
  const block = jauneMatch ? jauneMatch[1] : html;

  const nameMatch = block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const name = nameMatch ? extractTextContent(nameMatch[1]) : slug;

  const typeLineMatch = block.match(
    /<h1[^>]*>[\s\S]*?<\/h1>\s*([\s\S]*?)(?:<br|<div|<strong|<table)/i
  );
  const typeLine = typeLineMatch ? extractTextContent(typeLineMatch[1]) : "";
  const typeMatch = typeLine.match(
    /^(.*?)\s+de\s+taille\s+(\w+),?\s*(.*?)$/i
  );

  const monsterType = typeMatch ? typeMatch[1].trim() : "";
  const size = typeMatch ? typeMatch[2].trim() : "";
  const alignment = typeMatch ? typeMatch[3].trim() : "";

  const acMatch = block.match(
    /(?:Classe\s+d['']armure|CA)\s*[:\s]*(\d+)\s*(.*?)(?:<br|<\/|$)/i
  );
  const armorClass = acMatch ? parseInt(acMatch[1], 10) : 10;
  const armorDesc = acMatch ? extractTextContent(acMatch[2]) : "";

  const hpMatch = block.match(
    /(?:Points?\s+de\s+vie|PV)\s*[:\s]*(\d+)\s*(?:\(([\s\S]*?)\))?/i
  );
  const hitPoints = hpMatch ? parseInt(hpMatch[1], 10) : 1;
  const hitPointsFormula = hpMatch && hpMatch[2] ? hpMatch[2].trim() : "";

  const speedMatch = block.match(
    /(?:Vitesse|VIT)\s*[:\s]*([\s\S]*?)(?:<br|<\/|<strong)/i
  );
  const speedText = speedMatch ? extractTextContent(speedMatch[1]) : "";
  const speed: Record<string, string> = {};

  if (speedText) {
    const parts = speedText.split(",").map((s) => s.trim());
    for (const part of parts) {
      const namedSpeed = part.match(
        /^(nage|vol|fouissement|escalade|creusement)\s+(.+)$/i
      );
      if (namedSpeed) {
        speed[namedSpeed[1].toLowerCase()] = namedSpeed[2];
      } else if (!speed["marche"]) {
        speed["marche"] = part;
      }
    }
  }

  const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  const carClasses = ["car1", "car2", "car3", "car4", "car5", "car6"];
  const abilityKeys: Array<keyof typeof abilities> = [
    "str",
    "dex",
    "con",
    "int",
    "wis",
    "cha",
  ];

  for (let i = 0; i < carClasses.length; i++) {
    const carRegex = new RegExp(
      `class="${carClasses[i]}"[^>]*>([\\s\\S]*?)<\\/div>`,
      "i"
    );
    const carMatch = block.match(carRegex);
    if (carMatch) {
      abilities[abilityKeys[i]] = parseAbilityScore(carMatch[1]);
    }
  }

  const tableAbilityMatch = block.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (tableAbilityMatch) {
    const rows = [...tableAbilityMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (rows.length >= 12) {
      for (let i = 0; i < 6; i++) {
        const val = parseAbilityScore(rows[i + 6][1]);
        if (val > 0) abilities[abilityKeys[i]] = val;
      }
    }
  }

  const extractField = (label: string): string => {
    const regex = new RegExp(
      `(?:<strong>)?${label}(?:<\\/strong>)?\\s*[:\\s]*(.*?)(?:<br|<\\/|<strong)`,
      "i"
    );
    const m = block.match(regex);
    return m ? extractTextContent(m[1]) : "";
  };

  const savingThrows =
    extractField("Jets de sauvegarde") || extractField("JdS");
  const skillsText =
    extractField("Compétences") || extractField("Comp\\.?");
  const vulnerabilities = extractField("Vulnérabilités");
  const resistances =
    extractField("Résistances aux dégâts") || extractField("Résistances");
  const damageImmunities = extractField("Immunités aux dégâts");
  const conditionImmunities = extractField("Immunités aux conditions");
  const senses = extractField("Sens");
  const languages = extractField("Langues");

  const crMatch = block.match(
    /(?:Facteur\s+de\s+puissance|FP)\s*[:\s]*([\d\/]+)\s*(?:\(([^)]*)\))?/i
  );
  const challengeRating = crMatch ? crMatch[1].trim() : "0";
  const xpMatch = crMatch && crMatch[2] ? crMatch[2].match(/[\d\s]+/) : null;
  const xp = xpMatch ? parseInt(xpMatch[0].replace(/\s/g, ""), 10) : 0;

  const sectionRegex =
    /<div\s+class="rub"[^>]*>([\s\S]*?)<\/div>([\s\S]*?)(?=<div\s+class="rub"|<\/div>\s*$|$)/gi;
  const sections: Array<{ title: string; content: string }> = [];
  let secMatch;

  while ((secMatch = sectionRegex.exec(block)) !== null) {
    sections.push({
      title: extractTextContent(secMatch[1]).toLowerCase(),
      content: secMatch[2],
    });
  }

  let traits: Array<{ name: string; description: string }> = [];
  let actions: Array<{ name: string; description: string }> = [];
  let bonusActions: Array<{ name: string; description: string }> = [];
  let reactions: Array<{ name: string; description: string }> = [];
  let legendaryActions: Array<{ name: string; description: string }> = [];
  let legendaryDescription = "";

  const firstSectionStart = block.search(/<div\s+class="rub"/i);
  if (firstSectionStart > 0) {
    const preSection = block.substring(0, firstSectionStart);
    const crIndex = preSection.lastIndexOf("FP");
    const afterCrMatch = crIndex > -1 ? preSection.indexOf("<br", crIndex) : -1;
    if (afterCrMatch > -1) {
      const traitBlock = preSection.substring(afterCrMatch);
      traits = parseNameDescPairs(traitBlock);
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
