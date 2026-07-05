import type { VocabularyExample, VocabularyExamplesResponse } from "@english-learning/shared";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client";
import {
  vocabularyExamples,
  vocabularyItems,
  type VocabularyExampleRow,
  type VocabularyItemRow
} from "../db/schema";
import { ApiError } from "../utils/http";

const tatoebaApiBaseUrl = "https://api.tatoeba.org/v1/sentences";
const tatoebaWebBaseUrl = "https://tatoeba.org";
const tatoebaAudioBaseUrl = "https://audio.tatoeba.org/sentences";
const tatoebaRequestTimeoutMs = 5_500;
const tatoebaAudioRequestTimeoutMs = 3_000;
const maxExamples = 3;
const missingCacheVersion = "examples:v3:bilingual";

type TatoebaLookupResult =
  | { type: "examples"; examples: ResolvedExample[] }
  | { type: "missing" }
  | { type: "error" };

type ResolvedExample = {
  text: string;
  translationZh: string;
  sentenceId: number;
  translationId: number;
  owner: string | null;
  translationOwner: string | null;
  license: string | null;
  sourceUrl: string;
  audioUrl: string | null;
};

type TatoebaSentence = {
  id?: unknown;
  text?: unknown;
  lang?: unknown;
  license?: unknown;
  owner?: unknown;
  is_unapproved?: unknown;
  translations?: unknown;
};

type TatoebaTranslation = {
  id?: unknown;
  text?: unknown;
  lang?: unknown;
  script?: unknown;
  owner?: unknown;
  is_unapproved?: unknown;
  is_direct?: unknown;
};

export async function getVocabularyExamples(vocabularyItemId: string): Promise<VocabularyExamplesResponse> {
  const [item] = await db.select().from(vocabularyItems).where(eq(vocabularyItems.id, vocabularyItemId)).limit(1);
  if (!item) {
    throw new ApiError(404, "VOCABULARY_NOT_FOUND", "Vocabulary item not found.");
  }

  const cachedRows = await db
    .select()
    .from(vocabularyExamples)
    .where(eq(vocabularyExamples.vocabularyItemId, item.id))
    .orderBy(asc(vocabularyExamples.text));

  const cachedExamples = cachedRows.filter(isBilingualCacheRow);
  if (cachedExamples.length > 0 || cachedRows.some((row) => row.missingAt && row.sourceUrl === missingCacheVersion)) {
    return toExamplesResponse(item, await hydrateCachedExamplesWithAudio(cachedExamples));
  }

  const lookup = await resolveTatoebaExamples(item.word);
  if (lookup.type === "examples") {
    const now = new Date().toISOString();
    const values = lookup.examples.map((example) => ({
      id: randomUUID(),
      vocabularyItemId: item.id,
      text: example.text,
      translationZh: example.translationZh,
      sentenceId: example.sentenceId,
      translationId: example.translationId,
      owner: example.owner,
      translationOwner: example.translationOwner,
      license: example.license,
      sourceUrl: example.sourceUrl,
      audioUrl: example.audioUrl,
      audioResolvedAt: example.audioUrl ? now : null,
      audioMissingAt: example.audioUrl ? null : now,
      resolvedAt: now,
      missingAt: null
    }));

    for (const value of values) {
      await db
        .insert(vocabularyExamples)
        .values(value)
        .onConflictDoUpdate({
          target: [vocabularyExamples.vocabularyItemId, vocabularyExamples.sentenceId],
          set: {
            text: value.text,
            translationZh: value.translationZh,
            translationId: value.translationId,
            owner: value.owner,
            translationOwner: value.translationOwner,
            license: value.license,
            sourceUrl: value.sourceUrl,
            audioUrl: value.audioUrl,
            audioResolvedAt: value.audioResolvedAt,
            audioMissingAt: value.audioMissingAt,
            resolvedAt: value.resolvedAt,
            missingAt: value.missingAt
          }
        });
    }

    return toExamplesResponse(item, values);
  }

  if (lookup.type === "missing") {
    const now = new Date().toISOString();
    await db.insert(vocabularyExamples).values({
      id: randomUUID(),
      vocabularyItemId: item.id,
      text: "",
      translationZh: "",
      sentenceId: null,
      translationId: null,
      owner: null,
      translationOwner: null,
      license: null,
      sourceUrl: missingCacheVersion,
      audioUrl: null,
      audioResolvedAt: null,
      audioMissingAt: null,
      resolvedAt: null,
      missingAt: now
    });
  }

  return toExamplesResponse(item, []);
}

function toExamplesResponse(item: VocabularyItemRow, examples: VocabularyExample[]): VocabularyExamplesResponse {
  return {
    vocabularyItemId: item.id,
    word: item.word,
    examples: sortResponseExamples(examples),
    fallbackDefinition: {
      definitionEn: item.definitionEn,
      meaningZh: item.meaningZh
    }
  };
}

function sortResponseExamples(examples: VocabularyExample[]) {
  return [...examples].sort((left, right) => {
    if (Boolean(left.audioUrl) !== Boolean(right.audioUrl)) {
      return left.audioUrl ? -1 : 1;
    }

    return left.text.length - right.text.length || left.sentenceId - right.sentenceId;
  });
}

function isBilingualCacheRow(row: VocabularyExampleRow) {
  return Boolean(
    row.resolvedAt &&
      row.text.trim() &&
      row.translationZh.trim() &&
      row.sentenceId !== null &&
      row.translationId !== null &&
      row.sourceUrl
  );
}

function toExample(row: VocabularyExampleRow): VocabularyExample {
  if (
    !row.sourceUrl ||
    row.sentenceId === null ||
    row.translationId === null ||
    !row.text.trim() ||
    !row.translationZh.trim()
  ) {
    throw new Error("Cached vocabulary example is missing bilingual metadata.");
  }

  return {
    id: row.id,
    text: row.text,
    translationZh: row.translationZh,
    sentenceId: row.sentenceId,
    translationId: row.translationId,
    owner: row.owner,
    translationOwner: row.translationOwner,
    license: row.license,
    sourceUrl: row.sourceUrl,
    audioUrl: row.audioUrl
  };
}

async function hydrateCachedExamplesWithAudio(rows: VocabularyExampleRow[]) {
  return Promise.all(
    rows.map(async (row) => {
      if (row.audioUrl || row.audioResolvedAt || row.audioMissingAt || row.sentenceId === null) {
        return toExample(row);
      }

      const audioUrl = await resolveTatoebaAudioUrl(row.sentenceId);
      const now = new Date().toISOString();
      await db
        .update(vocabularyExamples)
        .set({
          audioUrl,
          audioResolvedAt: audioUrl ? now : null,
          audioMissingAt: audioUrl ? null : now
        })
        .where(eq(vocabularyExamples.id, row.id));

      return toExample({
        ...row,
        audioUrl,
        audioResolvedAt: audioUrl ? now : null,
        audioMissingAt: audioUrl ? null : now
      });
    })
  );
}

async function resolveTatoebaExamples(word: string): Promise<TatoebaLookupResult> {
  const audioFirst = await fetchTatoebaExamples(word, true);
  let hadError = audioFirst.type === "error";
  let examples = audioFirst.type === "examples" ? audioFirst.examples : [];

  if (examples.length < maxExamples) {
    const regular = await fetchTatoebaExamples(word, false);
    hadError = hadError || regular.type === "error";
    examples = mergeExamples(examples, regular.type === "examples" ? regular.examples : []);
  }

  if (examples.length > 0) {
    return { type: "examples", examples: await resolveAudioForExamples(examples.slice(0, maxExamples)) };
  }

  return hadError ? { type: "error" } : { type: "missing" };
}

async function fetchTatoebaExamples(word: string, requireAudio: boolean): Promise<TatoebaLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), tatoebaRequestTimeoutMs);

  try {
    const response = await fetch(tatoebaSearchUrl(word, requireAudio), {
      headers: { accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) {
      return response.status === 404 ? { type: "missing" } : { type: "error" };
    }

    const data = (await response.json().catch(() => null)) as unknown;
    const examples = pickBestExamples(data, word);
    return examples.length > 0 ? { type: "examples", examples } : { type: "missing" };
  } catch {
    return { type: "error" };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveAudioForExamples(examples: ResolvedExample[]) {
  return Promise.all(
    examples.map(async (example) => ({
      ...example,
      audioUrl: await resolveTatoebaAudioUrl(example.sentenceId)
    }))
  );
}

async function resolveTatoebaAudioUrl(sentenceId: number) {
  const audioUrl = `${tatoebaAudioBaseUrl}/eng/${sentenceId}.mp3`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), tatoebaAudioRequestTimeoutMs);

  try {
    const response = await fetch(audioUrl, {
      method: "HEAD",
      headers: { accept: "audio/mpeg" },
      signal: controller.signal
    });

    return response.ok ? audioUrl : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function pickBestExamples(data: unknown, word: string) {
  const sentences = extractSentences(data);
  const seenSentenceIds = new Set<number>();

  return sentences
    .map((sentence) => toResolvedExample(sentence, word))
    .filter((example): example is ResolvedExample => {
      if (!example || seenSentenceIds.has(example.sentenceId)) {
        return false;
      }

      seenSentenceIds.add(example.sentenceId);
      return true;
    })
    .sort((left, right) => left.text.length - right.text.length || left.sentenceId - right.sentenceId)
    .slice(0, maxExamples);
}

function mergeExamples(...groups: ResolvedExample[][]) {
  const seen = new Set<number>();
  const merged: ResolvedExample[] = [];

  for (const group of groups) {
    for (const example of group) {
      if (seen.has(example.sentenceId)) {
        continue;
      }

      seen.add(example.sentenceId);
      merged.push(example);
      if (merged.length >= maxExamples) {
        return merged;
      }
    }
  }

  return merged;
}

function extractSentences(data: unknown): TatoebaSentence[] {
  if (!data || typeof data !== "object" || !("data" in data) || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.filter((item): item is TatoebaSentence => Boolean(item && typeof item === "object"));
}

function toResolvedExample(sentence: TatoebaSentence, word: string): ResolvedExample | null {
  const sentenceId = toNumber(sentence.id);
  const text = toTrimmedString(sentence.text);
  const lang = toTrimmedString(sentence.lang);

  if (
    sentenceId === null ||
    !text ||
    lang !== "eng" ||
    sentence.is_unapproved === true ||
    !containsWordLike(text, word)
  ) {
    return null;
  }

  const translation = pickChineseTranslation(sentence.translations);
  if (!translation) {
    return null;
  }

  return {
    text,
    translationZh: translation.text,
    sentenceId,
    translationId: translation.id,
    owner: toNullableString(sentence.owner),
    translationOwner: translation.owner,
    license: toNullableString(sentence.license),
    sourceUrl: `${tatoebaWebBaseUrl}/en/sentences/show/${sentenceId}`,
    audioUrl: null
  };
}

function pickChineseTranslation(value: unknown) {
  const translations = flattenTranslations(value)
    .map((translation) => {
      const id = toNumber(translation.id);
      const text = toTrimmedString(translation.text);
      const lang = toTrimmedString(translation.lang);

      if (id === null || !text || lang !== "cmn" || translation.is_unapproved === true) {
        return null;
      }

      return {
        id,
        text,
        script: toTrimmedString(translation.script),
        owner: toNullableString(translation.owner),
        isDirect: translation.is_direct === true
      };
    })
    .filter((translation): translation is NonNullable<typeof translation> => Boolean(translation));

  return (
    translations.find((translation) => translation.script === "Hans" && translation.isDirect) ??
    translations.find((translation) => translation.script === "Hans") ??
    translations.find((translation) => translation.isDirect) ??
    translations[0] ??
    null
  );
}

function flattenTranslations(value: unknown): TatoebaTranslation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const flattened: TatoebaTranslation[] = [];
  for (const item of value) {
    if (Array.isArray(item)) {
      flattened.push(...flattenTranslations(item));
    } else if (item && typeof item === "object") {
      flattened.push(item as TatoebaTranslation);
    }
  }

  return flattened;
}

function containsWordLike(text: string, word: string) {
  const normalizedWord = word.toLowerCase().trim();
  if (!normalizedWord) {
    return false;
  }

  if (!/^[a-z]+(?:[-'][a-z]+)*$/.test(normalizedWord)) {
    return text.toLowerCase().includes(normalizedWord);
  }

  const suffix = normalizedWord.length > 3 ? "(?:s|es|ed|ing)?" : "";
  return new RegExp(`(^|[^a-z])${escapeRegExp(normalizedWord)}${suffix}([^a-z]|$)`, "i").test(text);
}

function tatoebaSearchUrl(word: string, requireAudio: boolean) {
  const params = new URLSearchParams({
    lang: "eng",
    q: word,
    "trans:lang": "cmn",
    "showtrans:lang": "cmn",
    sort: "relevance",
    limit: "12"
  });
  if (requireAudio) {
    params.set("has_audio", "yes");
  }
  return `${tatoebaApiBaseUrl}?${params.toString()}`;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableString(value: unknown) {
  const text = toTrimmedString(value);
  return text || null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
