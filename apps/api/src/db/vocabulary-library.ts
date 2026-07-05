import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { vocabularyItems } from "./schema";

type VocabularySeedItem = typeof vocabularyItems.$inferInsert;
type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1";

type ProfileEntry = {
  word: string;
  level: EnglishLevel;
  pos: string;
  order: number;
};

type EcdictEntry = {
  word: string;
  phonetic: string;
  definition: string;
  translation: string;
  bnc: number;
  frq: number;
};

export const VOCABULARY_LIBRARY_SOURCES = {
  cefrJ:
    "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv",
  octanoveC1:
    "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv",
  ecdict: "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
} as const;

const levels: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1"];
const fixtureWordsPerLevel = 50;
const sourceCacheDir = resolve(process.cwd(), "../../.data/vocabulary-sources");

export async function loadVocabularyLibrary(): Promise<VocabularySeedItem[]> {
  if (process.env.NODE_ENV === "test" || process.env.VOCABULARY_LIBRARY_MODE === "fixture") {
    return buildFixtureVocabulary();
  }

  const [cefrJ, octanoveC1, ecdict] = await Promise.all([
    fetchCachedText("cefrj-vocabulary-profile-1.5.csv", VOCABULARY_LIBRARY_SOURCES.cefrJ),
    fetchCachedText("octanove-vocabulary-profile-c1c2-1.0.csv", VOCABULARY_LIBRARY_SOURCES.octanoveC1),
    fetchCachedText("ecdict.csv", VOCABULARY_LIBRARY_SOURCES.ecdict)
  ]);

  const profileEntries = [...parseProfile(cefrJ, ["A1", "A2", "B1", "B2"]), ...parseProfile(octanoveC1, ["C1"])];
  const candidatesByWord = new Map(profileEntries.map((entry) => [entry.word, entry]));
  const dictionary = parseEcdict(ecdict, candidatesByWord);

  return levels.flatMap((level) => {
    const items = profileEntries
      .filter((entry) => entry.level === level)
      .map((entry) => ({ profile: entry, dictionary: dictionary.get(entry.word) }))
      .filter((entry): entry is { profile: ProfileEntry; dictionary: EcdictEntry } => Boolean(entry.dictionary?.translation))
      .sort((left, right) => vocabularyRank(left.profile, left.dictionary) - vocabularyRank(right.profile, right.dictionary))
      .map(({ profile, dictionary }) => toVocabularySeedItem(profile, dictionary));

    if (items.length === 0) {
      throw new Error(`Vocabulary source only produced ${items.length} ${level} words.`);
    }

    return items;
  });
}

async function fetchCachedText(fileName: string, url: string) {
  await mkdir(sourceCacheDir, { recursive: true });
  const filePath = resolve(sourceCacheDir, fileName);

  try {
    return await readFile(filePath, "utf8");
  } catch {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not download vocabulary source ${url}: ${response.status}`);
    }
    const text = await response.text();
    await writeFile(filePath, text);
    return text;
  }
}

function parseProfile(csv: string, acceptedLevels: EnglishLevel[]) {
  const rows = parseCsv(csv);
  const header = rows.shift() ?? [];
  const headwordIndex = header.indexOf("headword");
  const posIndex = header.indexOf("pos");
  const levelIndex = header.indexOf("CEFR");
  const entries: ProfileEntry[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const level = row[levelIndex] as EnglishLevel | undefined;
    const word = normalizeWord(row[headwordIndex] ?? "");
    if (!level || !acceptedLevels.includes(level) || !isUsableHeadword(word) || seen.has(`${level}:${word}`)) {
      return;
    }
    seen.add(`${level}:${word}`);
    entries.push({
      word,
      level,
      pos: row[posIndex] ?? "word",
      order: index
    });
  });

  return entries;
}

function parseEcdict(csv: string, candidatesByWord: Map<string, ProfileEntry>) {
  const rows = parseCsv(csv);
  const header = rows.shift() ?? [];
  const wordIndex = header.indexOf("word");
  const phoneticIndex = header.indexOf("phonetic");
  const definitionIndex = header.indexOf("definition");
  const translationIndex = header.indexOf("translation");
  const bncIndex = header.indexOf("bnc");
  const frqIndex = header.indexOf("frq");
  const entries = new Map<string, EcdictEntry>();

  for (const row of rows) {
    const word = normalizeWord(row[wordIndex] ?? "");
    if (!candidatesByWord.has(word) || entries.has(word)) {
      continue;
    }

    const translation = cleanTranslation(row[translationIndex] ?? "");
    if (!translation) {
      continue;
    }

    entries.set(word, {
      word,
      phonetic: row[phoneticIndex] ? `/${row[phoneticIndex]}/` : `/${word}/`,
      definition: cleanDefinition(row[definitionIndex] ?? ""),
      translation,
      bnc: Number(row[bncIndex] ?? 0) || 0,
      frq: Number(row[frqIndex] ?? 0) || 0
    });
  }

  return entries;
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function toVocabularySeedItem(profile: ProfileEntry, dictionary: EcdictEntry): VocabularySeedItem {
  return {
    id: `vocab-${profile.level.toLowerCase()}-${slugifyWord(profile.word)}`,
    word: profile.word,
    phonetic: dictionary.phonetic,
    meaningZh: dictionary.translation,
    definitionEn: dictionary.definition || `A ${profile.pos || "word"} listed in the ${profile.level} vocabulary profile.`,
    exampleEn: "",
    exampleZh: "",
    level: profile.level,
    topic: topicFromPartOfSpeech(profile.pos)
  };
}

function vocabularyRank(profile: ProfileEntry, dictionary: EcdictEntry) {
  const frequency = dictionary.frq > 0 ? dictionary.frq : dictionary.bnc > 0 ? dictionary.bnc : 100_000;
  return frequency * 10 + profile.order;
}

function normalizeWord(word: string) {
  return word.trim().toLowerCase();
}

function isUsableHeadword(word: string) {
  return /^[a-z][a-z-]{1,28}$/.test(word) && !word.includes("--");
}

function slugifyWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cleanTranslation(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*(n|v|vi|vt|adj|adv|prep|pron|conj|num|int|abbr)\.\s*/i, "")
        .replace(/^\s*\[[^\]]+\]\s*/, "")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 2)
    .join("；");
}

function cleanDefinition(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 1)
    .join(" ");
}

function topicFromPartOfSpeech(pos: string) {
  const normalized = pos.toLowerCase();
  if (normalized.includes("noun")) return "nouns";
  if (normalized.includes("verb")) return "verbs";
  if (normalized.includes("adjective")) return "adjectives";
  if (normalized.includes("adverb")) return "adverbs";
  if (normalized.includes("preposition")) return "grammar";
  if (normalized.includes("determiner")) return "grammar";
  return "general";
}

function buildFixtureVocabulary(): VocabularySeedItem[] {
  return levels.flatMap((level) =>
    Array.from({ length: fixtureWordsPerLevel }, (_, index) => {
      const word = `${level.toLowerCase()}-fixture-${String(index + 1).padStart(2, "0")}`;
      return {
        id: `vocab-${word}`,
        word,
        phonetic: `/${word}/`,
        meaningZh: `${level} 测试词 ${index + 1}`,
        definitionEn: `Fixture vocabulary item ${index + 1} for ${level}.`,
        exampleEn: `Study "${word}" in a short sentence.`,
        exampleZh: `在短句中学习“${word}”。`,
        level,
        topic: "fixture"
      };
    })
  );
}
