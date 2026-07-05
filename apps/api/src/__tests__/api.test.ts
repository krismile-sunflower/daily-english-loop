import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const tempDir = mkdtempSync(join(tmpdir(), "english-learning-api-"));
process.env.DATABASE_URL = `file:${join(tempDir, "test.db")}`;
process.env.JWT_SECRET = "test-secret";

const { app } = await import("../app");
const { runMigrations } = await import("../db/migrate");
const { seedDatabase } = await import("../db/seed");
const { client, db } = await import("../db/client");
const { vocabularyExamples } = await import("../db/schema");

let userCounter = 0;

function cookieFrom(response: Response) {
  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Missing set-cookie header");
  }
  return cookie.split(";")[0] ?? cookie;
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

async function loginDemoUser() {
  const loginResponse = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "learner@example.com",
      password: "password123"
    })
  });
  expect(loginResponse.status).toBe(200);
  return cookieFrom(loginResponse);
}

async function registerLearner(level?: string) {
  userCounter += 1;
  const registerResponse = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `learner-${userCounter}-${Date.now()}@example.com`,
      name: "Learner",
      password: "password123"
    })
  });
  expect(registerResponse.status).toBe(201);
  const cookie = cookieFrom(registerResponse);

  if (level) {
    const updateResponse = await app.request("/api/auth/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ level })
    });
    expect(updateResponse.status).toBe(200);
  }

  return cookie;
}

async function getVocabularyItems(cookie: string, level = "A1") {
  const response = await app.request(`/api/vocabulary?level=${level}&page=1&pageSize=5`, { headers: { cookie } });
  expect(response.status).toBe(200);
  const payload = await json(response);
  return payload.items as Array<{ id: string; word: string; level: string }>;
}

function requireItem<T>(item: T | undefined): T {
  if (!item) {
    throw new Error("Expected vocabulary item to exist.");
  }
  return item;
}

beforeAll(async () => {
  await runMigrations();
  await seedDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

afterAll(() => {
  client.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("api learning loop", () => {
  it("registers, updates level, reviews vocabulary, completes a lesson, practices, and updates dashboard", async () => {
    const registerResponse = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `learner-${Date.now()}@example.com`,
        name: "Learner",
        password: "password123"
      })
    });

    expect(registerResponse.status).toBe(201);
    const cookie = cookieFrom(registerResponse);

    const meBefore = await app.request("/api/auth/me", {
      headers: { cookie }
    });
    expect(meBefore.status).toBe(200);

    const updateResponse = await app.request("/api/auth/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ level: "B1" })
    });
    expect(updateResponse.status).toBe(200);

    const vocabularyResponse = await app.request("/api/vocabulary", { headers: { cookie } });
    const vocabulary = await json(vocabularyResponse);
    const items = vocabulary.items as Array<{ id: string; level: string }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.level).toBe("B1");

    const reviewResponse = await app.request(`/api/vocabulary/${items[0]?.id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ grade: "good" })
    });
    expect(reviewResponse.status).toBe(200);

    const lessonsResponse = await app.request("/api/lessons", { headers: { cookie } });
    const lessonPayload = await json(lessonsResponse);
    const lessons = lessonPayload.lessons as Array<{ id: string }>;
    expect(lessons.length).toBeGreaterThan(0);

    const completeResponse = await app.request(`/api/lessons/${lessons[0]?.id}/complete`, {
      method: "POST",
      headers: { cookie }
    });
    expect(completeResponse.status).toBe(200);

    const practiceResponse = await app.request("/api/practice/session", { headers: { cookie } });
    const practicePayload = await json(practiceResponse);
    const exercises = practicePayload.exercises as Array<{ id: string; options: string[] }>;
    expect(exercises.length).toBeGreaterThan(0);

    const submitResponse = await app.request("/api/practice/submit", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        answers: exercises.slice(0, 2).map((exercise) => ({
          exerciseId: exercise.id,
          answer: exercise.options[0]
        }))
      })
    });
    expect(submitResponse.status).toBe(200);

    const dashboardResponse = await app.request("/api/progress/dashboard", { headers: { cookie } });
    const dashboard = await json(dashboardResponse);
    const today = dashboard.today as { newWords: number; reviews: number; lessonsCompleted: number; exercisesCompleted: number };
    expect(today.newWords).toBe(1);
    expect(today.reviews).toBe(1);
    expect(today.lessonsCompleted).toBe(1);
    expect(today.exercisesCompleted).toBe(2);
  });

  it("rejects protected endpoints without a session", async () => {
    const response = await app.request("/api/progress/dashboard");
    expect(response.status).toBe(401);
  });

  it("serves a vocabulary library for every supported level", async () => {
    const cookie = await loginDemoUser();

    for (const level of ["A1", "A2", "B1", "B2", "C1"]) {
      const response = await app.request(`/api/vocabulary?level=${level}&page=1&pageSize=50`, { headers: { cookie } });
      expect(response.status).toBe(200);
      const payload = await json(response);
      const items = payload.items as Array<{ word: string; level: string }>;
      const words = new Set(items.map((item) => item.word));

      expect(items.length).toBe(50);
      expect(payload.total).toBeGreaterThanOrEqual(50);
      expect(payload.page).toBe(1);
      expect(payload.pageSize).toBe(50);
      expect(payload.totalPages).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(payload.topics)).toBe(true);
      expect(words.size).toBe(items.length);
      expect(items.every((item) => item.level === level)).toBe(true);
    }

    const searchResponse = await app.request("/api/vocabulary?level=B1&q=fixture&page=1&pageSize=10", {
      headers: { cookie }
    });
    const searchPayload = await json(searchResponse);
    expect((searchPayload.items as unknown[]).length).toBe(10);
    expect(searchPayload.total).toBeGreaterThanOrEqual(50);
  });

  it("returns stable daily shuffled new vocabulary without changing normal library order", async () => {
    const cookieA = await registerLearner("A1");

    const normalResponse = await app.request("/api/vocabulary?level=A1&status=new&page=1&pageSize=10", {
      headers: { cookie: cookieA }
    });
    const normalPayload = await json(normalResponse);
    const normalWords = (normalPayload.items as Array<{ word: string }>).map((item) => item.word);
    expect(normalWords).toEqual([...normalWords].sort());

    const now = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const firstResponse = await app.request("/api/vocabulary?level=A1&status=new&shuffle=daily&page=1&pageSize=10", {
      headers: { cookie: cookieA }
    });
    const secondResponse = await app.request("/api/vocabulary?level=A1&status=new&shuffle=daily&page=1&pageSize=10", {
      headers: { cookie: cookieA }
    });

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.setSystemTime(tomorrow);
    const tomorrowResponse = await app.request("/api/vocabulary?level=A1&status=new&shuffle=daily&page=1&pageSize=10", {
      headers: { cookie: cookieA }
    });

    const firstWords = ((await json(firstResponse)).items as Array<{ word: string }>).map((item) => item.word);
    const secondWords = ((await json(secondResponse)).items as Array<{ word: string }>).map((item) => item.word);
    const tomorrowWords = ((await json(tomorrowResponse)).items as Array<{ word: string }>).map((item) => item.word);

    expect(firstWords).toEqual(secondWords);
    expect(firstWords).not.toEqual(normalWords);
    expect(firstWords).not.toEqual(tomorrowWords);
  });

  it("schedules vocabulary reviews with enhanced SM-2 intervals", async () => {
    const cookie = await registerLearner("A1");
    const items = await getVocabularyItems(cookie, "A1");
    const againItem = requireItem(items[0]);
    const hardItem = requireItem(items[1]);
    const goodItem = requireItem(items[2]);
    const easyItem = requireItem(items[3]);
    const now = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    async function review(itemId: string, grade: "again" | "hard" | "good" | "easy") {
      const response = await app.request(`/api/vocabulary/${itemId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ grade })
      });
      expect(response.status).toBe(200);
      const payload = await json(response);
      return (payload.item as { progress: { status: string; easeFactor: number; intervalDays: number; dueAt: string; reviewCount: number } })
        .progress;
    }

    const again = await review(againItem.id, "again");
    expect(again.status).toBe("learning");
    expect(again.intervalDays).toBe(0);
    expect(again.easeFactor).toBeLessThan(2.5);
    expect(Math.round((new Date(again.dueAt).getTime() - now.getTime()) / 60_000)).toBe(10);

    const hard = await review(hardItem.id, "hard");
    expect(hard.status).toBe("learning");
    expect(hard.intervalDays).toBe(1);
    expect(hard.easeFactor).toBeLessThan(2.5);

    const goodFirst = await review(goodItem.id, "good");
    expect(goodFirst.status).toBe("learned");
    expect(goodFirst.intervalDays).toBe(1);
    expect(goodFirst.easeFactor).toBe(2.5);

    const goodSecond = await review(goodItem.id, "good");
    expect(goodSecond.status).toBe("learned");
    expect(goodSecond.intervalDays).toBe(3);
    expect(goodSecond.reviewCount).toBe(2);

    const easy = await review(easyItem.id, "easy");
    expect(easy.status).toBe("learned");
    expect(easy.intervalDays).toBe(4);
    expect(easy.easeFactor).toBeGreaterThan(2.5);
  });

  it("resolves and caches real vocabulary pronunciation audio", async () => {
    const cookie = await loginDemoUser();
    const item = requireItem((await getVocabularyItems(cookie, "A1"))[0]);

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              phonetics: [
                {
                  audio: "//api.dictionaryapi.dev/media/pronunciations/en/sample-uk.mp3",
                  sourceUrl: "https://example.com/uk"
                },
                {
                  audio: "https://api.dictionaryapi.dev/media/pronunciations/en/sample-us.mp3",
                  sourceUrl: "https://example.com/us"
                }
              ]
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const firstResponse = await app.request(`/api/vocabulary/${item.id}/pronunciation`, { headers: { cookie } });
    expect(firstResponse.status).toBe(200);
    const firstPayload = await json(firstResponse);
    expect(firstPayload.strategy).toBe("audio");
    expect(firstPayload.audioUrl).toBe("https://api.dictionaryapi.dev/media/pronunciations/en/sample-us.mp3");
    expect(firstPayload.accent).toBe("us");

    const secondResponse = await app.request(`/api/vocabulary/${item.id}/pronunciation`, { headers: { cookie } });
    expect(secondResponse.status).toBe(200);
    const secondPayload = await json(secondResponse);
    expect(secondPayload.strategy).toBe("audio");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns browser tts fallback and caches missing pronunciation audio", async () => {
    const cookie = await loginDemoUser();
    const items = await getVocabularyItems(cookie, "A1");
    const item = requireItem(items[1]);

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ title: "No Definitions Found" }), {
          status: 404,
          headers: { "content-type": "application/json" }
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const firstResponse = await app.request(`/api/vocabulary/${item.id}/prunciation`, { headers: { cookie } });
    expect(firstResponse.status).toBe(200);
    const firstPayload = await json(firstResponse);
    expect(firstPayload.strategy).toBe("browser-tts");
    expect(firstPayload.audioUrl).toBeNull();
    expect(firstPayload.fallbackText).toBe(item.word);

    const secondResponse = await app.request(`/api/vocabulary/${item.id}/pronunciation`, { headers: { cookie } });
    expect(secondResponse.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("protects vocabulary pronunciation endpoints", async () => {
    const unauthorized = await app.request("/api/vocabulary/not-found/pronunciation");
    expect(unauthorized.status).toBe(401);

    const cookie = await loginDemoUser();
    const notFound = await app.request("/api/vocabulary/not-found/pronunciation", { headers: { cookie } });
    expect(notFound.status).toBe(404);
  });

  it("resolves and caches real vocabulary examples with Chinese translations", async () => {
    const cookie = await loginDemoUser();
    const item = requireItem((await getVocabularyItems(cookie, "A1"))[2]);

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("audio.tatoeba.org")) {
          const isAvailableAudio = url.endsWith("/102.mp3");
          return new Response(null, {
            status: isAvailableAudio ? 200 : 404,
            headers: isAvailableAudio ? { "content-type": "audio/mpeg" } : {}
          });
        }

        return new Response(
          JSON.stringify({
            data: [
              {
                id: 101,
                text: `This sentence mentions something else.`,
                lang: "eng",
                license: "CC BY 2.0 FR",
                owner: "FilteredAuthor",
                is_unapproved: false,
                translations: [
                  {
                    id: 201,
                    text: "这句话不会被选中。",
                    lang: "cmn",
                    script: "Hans",
                    owner: "FilteredTranslator",
                    is_unapproved: false,
                    is_direct: true
                  }
                ]
              },
              {
                id: 102,
                text: `I review ${item.word} today.`,
                lang: "eng",
                license: "CC BY 2.0 FR",
                owner: "ExampleAuthor",
                is_unapproved: false,
                translations: [
                  {
                    id: 202,
                    text: "我今天复习这个词。",
                    lang: "cmn",
                    script: "Hans",
                    owner: "ExampleTranslator",
                    is_unapproved: false,
                    is_direct: true
                  }
                ]
              },
              {
                id: 103,
                text: `Please say ${item.word} slowly.`,
                lang: "eng",
                license: "CC BY 2.0 FR",
                owner: "SecondAuthor",
                is_unapproved: false,
                translations: [
                  {
                    id: 203,
                    text: "请慢慢说这个词。",
                    lang: "cmn",
                    script: "Hans",
                    owner: "SecondTranslator",
                    is_unapproved: false,
                    is_direct: true
                  }
                ]
              },
              {
                id: 104,
                text: `They learned ${item.word} together.`,
                lang: "eng",
                license: "CC BY 2.0 FR",
                owner: "ThirdAuthor",
                is_unapproved: false,
                translations: [
                  {
                    id: 204,
                    text: "他们一起学习了这个词。",
                    lang: "cmn",
                    script: "Hans",
                    owner: "ThirdTranslator",
                    is_unapproved: false,
                    is_direct: true
                  }
                ]
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const firstResponse = await app.request(`/api/vocabulary/${item.id}/examples`, { headers: { cookie } });
    expect(firstResponse.status).toBe(200);
    const firstPayload = await json(firstResponse);
    const examples = firstPayload.examples as Array<{
      text: string;
      translationZh: string;
      sentenceId: number;
      owner: string;
      translationOwner: string;
      license: string;
      sourceUrl: string;
      audioUrl: string | null;
    }>;
    expect(examples).toHaveLength(3);
    expect(examples[0]?.text).toBe(`I review ${item.word} today.`);
    expect(examples[0]?.translationZh).toBe("我今天复习这个词。");
    expect(examples[0]?.sentenceId).toBe(102);
    expect(examples[0]?.owner).toBe("ExampleAuthor");
    expect(examples[0]?.translationOwner).toBe("ExampleTranslator");
    expect(examples[0]?.license).toBe("CC BY 2.0 FR");
    expect(examples[0]?.sourceUrl).toBe("https://tatoeba.org/en/sentences/show/102");
    expect(examples[0]?.audioUrl).toBe("https://audio.tatoeba.org/sentences/eng/102.mp3");
    expect(examples[1]?.audioUrl).toBeNull();

    const secondResponse = await app.request(`/api/vocabulary/${item.id}/examples`, { headers: { cookie } });
    expect(secondResponse.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not return English-only examples when Chinese translations are unavailable", async () => {
    const cookie = await loginDemoUser();
    const item = requireItem((await getVocabularyItems(cookie, "A1"))[3]);

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("audio.tatoeba.org")) {
          return new Response(null, { status: 200, headers: { "content-type": "audio/mpeg" } });
        }

        return new Response(
          JSON.stringify({
            data: [
              {
                id: 302,
                text: `This ${item.word} example has no Chinese translation.`,
                lang: "eng",
                license: "CC BY 2.0 FR",
                owner: "EnglishAuthor",
                is_unapproved: false,
                translations: []
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request(`/api/vocabulary/${item.id}/examples`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const payload = await json(response);
    const examples = payload.examples as unknown[];

    expect(examples).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores old non-bilingual example caches and old missing cache versions", async () => {
    const cookie = await loginDemoUser();
    const item = requireItem((await getVocabularyItems(cookie, "A2"))[0]);

    await db.insert(vocabularyExamples).values([
      {
        id: randomUUID(),
        vocabularyItemId: item.id,
        text: `Old ${item.word} English-only cache.`,
        translationZh: "",
        sentenceId: null,
        translationId: null,
        owner: "dictionaryapi.dev",
        translationOwner: null,
        license: null,
        sourceUrl: "https://api.dictionaryapi.dev/api/v2/entries/en/old",
        resolvedAt: new Date().toISOString(),
        missingAt: null
      },
      {
        id: randomUUID(),
        vocabularyItemId: item.id,
        text: "",
        translationZh: "",
        sentenceId: null,
        translationId: null,
        owner: null,
        translationOwner: null,
        license: null,
        sourceUrl: "examples:v2",
        resolvedAt: null,
        missingAt: new Date().toISOString()
      }
    ]);

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("audio.tatoeba.org")) {
          return new Response(null, { status: 200, headers: { "content-type": "audio/mpeg" } });
        }

        return new Response(
          JSON.stringify({
            data: [
              {
                id: 902,
                text: `A bilingual ${item.word} example.`,
                lang: "eng",
                license: "CC BY 2.0 FR",
                owner: "FreshAuthor",
                is_unapproved: false,
                translations: [
                  {
                    id: 903,
                    text: "一个新的双语例句。",
                    lang: "cmn",
                    script: "Hans",
                    owner: "FreshTranslator",
                    is_unapproved: false,
                    is_direct: true
                  }
                ]
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.request(`/api/vocabulary/${item.id}/examples`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const payload = await json(response);
    const examples = payload.examples as Array<{ text: string; translationZh: string; sentenceId: number; audioUrl: string | null }>;

    expect(examples).toHaveLength(1);
    expect(examples[0]?.text).toBe(`A bilingual ${item.word} example.`);
    expect(examples[0]?.translationZh).toBe("一个新的双语例句。");
    expect(examples[0]?.sentenceId).toBe(902);
    expect(examples[0]?.audioUrl).toBe("https://audio.tatoeba.org/sentences/eng/902.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns fallback definitions for missing or temporarily unavailable examples", async () => {
    const cookie = await loginDemoUser();
    const items = await getVocabularyItems(cookie, "A1");
    const missingItem = requireItem(items[4]);
    const networkItem = requireItem(items[0]);

    const missingFetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
    );
    vi.stubGlobal("fetch", missingFetchMock);

    const missingResponse = await app.request(`/api/vocabulary/${missingItem.id}/examples`, { headers: { cookie } });
    expect(missingResponse.status).toBe(200);
    const missingPayload = await json(missingResponse);
    expect(missingPayload.examples).toEqual([]);
    expect((missingPayload.fallbackDefinition as { definitionEn: string }).definitionEn).toContain("Fixture vocabulary item");

    const cachedMissingResponse = await app.request(`/api/vocabulary/${missingItem.id}/examples`, { headers: { cookie } });
    expect(cachedMissingResponse.status).toBe(200);
    expect(missingFetchMock).toHaveBeenCalledTimes(2);

    const networkFetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", networkFetchMock);

    const networkResponse = await app.request(`/api/vocabulary/${networkItem.id}/examples`, { headers: { cookie } });
    expect(networkResponse.status).toBe(200);
    const networkPayload = await json(networkResponse);
    expect(networkPayload.examples).toEqual([]);

    const repeatedNetworkResponse = await app.request(`/api/vocabulary/${networkItem.id}/examples`, { headers: { cookie } });
    expect(repeatedNetworkResponse.status).toBe(200);
    expect(networkFetchMock).toHaveBeenCalledTimes(4);
  });

  it("protects vocabulary example endpoints", async () => {
    const unauthorized = await app.request("/api/vocabulary/not-found/examples");
    expect(unauthorized.status).toBe(401);

    const cookie = await loginDemoUser();
    const notFound = await app.request("/api/vocabulary/not-found/examples", { headers: { cookie } });
    expect(notFound.status).toBe(404);
  });
});
