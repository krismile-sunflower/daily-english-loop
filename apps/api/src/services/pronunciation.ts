import type { VocabularyPronunciationResponse } from "@english-learning/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client";
import { vocabularyItems, vocabularyPronunciations, type VocabularyItemRow, type VocabularyPronunciationRow } from "../db/schema";
import { ApiError } from "../utils/http";

const dictionarySource = "dictionaryapi.dev";
const dictionaryApiBaseUrl = "https://api.dictionaryapi.dev/api/v2/entries/en";
const dictionaryRequestTimeoutMs = 4_500;

type Accent = "us" | "uk" | "unknown";

type DictionaryAudioCandidate = {
  audioUrl: string;
  sourceUrl: string;
  accent: Accent;
};

type DictionaryLookupResult =
  | ({ type: "audio" } & DictionaryAudioCandidate)
  | { type: "missing"; sourceUrl: string }
  | { type: "error"; sourceUrl: string };

export async function getVocabularyPronunciation(vocabularyItemId: string): Promise<VocabularyPronunciationResponse> {
  const [item] = await db.select().from(vocabularyItems).where(eq(vocabularyItems.id, vocabularyItemId)).limit(1);
  if (!item) {
    throw new ApiError(404, "VOCABULARY_NOT_FOUND", "Vocabulary item not found.");
  }

  const [cached] = await db
    .select()
    .from(vocabularyPronunciations)
    .where(eq(vocabularyPronunciations.vocabularyItemId, vocabularyItemId))
    .limit(1);

  if (cached) {
    return toPronunciationResponse(item, cached);
  }

  const lookup = await resolveDictionaryAudio(item.word);
  if (lookup.type === "audio") {
    const now = new Date().toISOString();
    const values = {
      id: randomUUID(),
      vocabularyItemId: item.id,
      audioUrl: lookup.audioUrl,
      source: dictionarySource,
      sourceUrl: lookup.sourceUrl,
      accent: lookup.accent,
      resolvedAt: now,
      missingAt: null
    };

    await db
      .insert(vocabularyPronunciations)
      .values(values)
      .onConflictDoUpdate({
        target: vocabularyPronunciations.vocabularyItemId,
        set: {
          audioUrl: values.audioUrl,
          source: values.source,
          sourceUrl: values.sourceUrl,
          accent: values.accent,
          resolvedAt: values.resolvedAt,
          missingAt: values.missingAt
        }
      });

    return {
      vocabularyItemId: item.id,
      word: item.word,
      strategy: "audio",
      audioUrl: lookup.audioUrl,
      source: dictionarySource,
      sourceUrl: lookup.sourceUrl,
      accent: lookup.accent,
      fallbackText: item.word
    };
  }

  if (lookup.type === "missing") {
    const now = new Date().toISOString();
    const values = {
      id: randomUUID(),
      vocabularyItemId: item.id,
      audioUrl: null,
      source: dictionarySource,
      sourceUrl: lookup.sourceUrl,
      accent: null,
      resolvedAt: null,
      missingAt: now
    };

    await db
      .insert(vocabularyPronunciations)
      .values(values)
      .onConflictDoUpdate({
        target: vocabularyPronunciations.vocabularyItemId,
        set: {
          audioUrl: values.audioUrl,
          source: values.source,
          sourceUrl: values.sourceUrl,
          accent: values.accent,
          resolvedAt: values.resolvedAt,
          missingAt: values.missingAt
        }
      });
  }

  return toFallbackResponse(item, lookup.sourceUrl);
}

function toPronunciationResponse(
  item: VocabularyItemRow,
  cached: VocabularyPronunciationRow
): VocabularyPronunciationResponse {
  if (cached.audioUrl) {
    return {
      vocabularyItemId: item.id,
      word: item.word,
      strategy: "audio",
      audioUrl: cached.audioUrl,
      source: cached.source ?? dictionarySource,
      sourceUrl: cached.sourceUrl ?? dictionaryEntryUrl(item.word),
      accent: normalizeAccent(cached.accent),
      fallbackText: item.word
    };
  }

  return toFallbackResponse(item, cached.sourceUrl ?? dictionaryEntryUrl(item.word), cached.source ?? dictionarySource);
}

function toFallbackResponse(item: VocabularyItemRow, sourceUrl: string, source = dictionarySource): VocabularyPronunciationResponse {
  return {
    vocabularyItemId: item.id,
    word: item.word,
    strategy: "browser-tts",
    audioUrl: null,
    source,
    sourceUrl,
    accent: null,
    fallbackText: item.word
  };
}

async function resolveDictionaryAudio(word: string): Promise<DictionaryLookupResult> {
  const sourceUrl = dictionaryEntryUrl(word);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dictionaryRequestTimeoutMs);

  try {
    const response = await fetch(sourceUrl, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });

    if (response.status === 404) {
      return { type: "missing", sourceUrl };
    }

    if (!response.ok) {
      return { type: "error", sourceUrl };
    }

    const data = (await response.json().catch(() => null)) as unknown;
    const candidate = pickBestAudioCandidate(data, sourceUrl);
    return candidate ? { type: "audio", ...candidate } : { type: "missing", sourceUrl };
  } catch {
    return { type: "error", sourceUrl };
  } finally {
    clearTimeout(timeout);
  }
}

function pickBestAudioCandidate(data: unknown, fallbackSourceUrl: string) {
  const candidates = collectAudioCandidates(data, fallbackSourceUrl);
  return (
    candidates.find((candidate) => candidate.accent === "us") ??
    candidates.find((candidate) => candidate.accent === "uk") ??
    candidates[0] ??
    null
  );
}

function collectAudioCandidates(data: unknown, fallbackSourceUrl: string) {
  if (!Array.isArray(data)) {
    return [];
  }

  const candidates: DictionaryAudioCandidate[] = [];
  const seenAudioUrls = new Set<string>();

  for (const entry of data) {
    if (!entry || typeof entry !== "object" || !("phonetics" in entry) || !Array.isArray(entry.phonetics)) {
      continue;
    }

    for (const phonetic of entry.phonetics) {
      if (!phonetic || typeof phonetic !== "object") {
        continue;
      }

      const rawAudio = "audio" in phonetic && typeof phonetic.audio === "string" ? phonetic.audio.trim() : "";
      const audioUrl = normalizeAudioUrl(rawAudio);
      if (!audioUrl || !audioUrl.toLowerCase().includes(".mp3") || seenAudioUrls.has(audioUrl)) {
        continue;
      }

      const sourceUrl =
        "sourceUrl" in phonetic && typeof phonetic.sourceUrl === "string" && phonetic.sourceUrl.trim()
          ? phonetic.sourceUrl.trim()
          : fallbackSourceUrl;
      const phoneticText = "text" in phonetic && typeof phonetic.text === "string" ? phonetic.text : "";

      seenAudioUrls.add(audioUrl);
      candidates.push({
        audioUrl,
        sourceUrl,
        accent: detectAccent(audioUrl, phoneticText)
      });
    }
  }

  return candidates;
}

function normalizeAudioUrl(value: string) {
  if (!value) {
    return null;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (value.startsWith("http://")) {
    return `https://${value.slice("http://".length)}`;
  }

  if (value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `https://api.dictionaryapi.dev${value}`;
  }

  return null;
}

function detectAccent(audioUrl: string, phoneticText: string): Accent {
  const value = `${audioUrl} ${phoneticText}`.toLowerCase();
  if (value.includes("-us.") || value.includes("_us.") || value.includes("/us/") || value.includes("american")) {
    return "us";
  }
  if (value.includes("-uk.") || value.includes("_uk.") || value.includes("/uk/") || value.includes("british")) {
    return "uk";
  }
  return "unknown";
}

function normalizeAccent(value: string | null): Accent {
  return value === "us" || value === "uk" || value === "unknown" ? value : "unknown";
}

function dictionaryEntryUrl(word: string) {
  return `${dictionaryApiBaseUrl}/${encodeURIComponent(word.toLowerCase())}`;
}
