import { describe, expect, it } from "vitest";
import {
  dashboardResponseSchema,
  englishLevelSchema,
  loginInputSchema,
  reviewInputSchema,
  vocabularyExamplesResponseSchema,
  vocabularyPronunciationResponseSchema
} from "../src";

describe("shared schemas", () => {
  it("accepts supported CEFR levels", () => {
    expect(englishLevelSchema.parse("B1")).toBe("B1");
    expect(() => englishLevelSchema.parse("B3")).toThrow();
  });

  it("validates auth and review payloads", () => {
    expect(loginInputSchema.parse({ email: "learner@example.com", password: "password123" }).email).toBe(
      "learner@example.com"
    );
    expect(reviewInputSchema.parse({ grade: "good" }).grade).toBe("good");
  });

  it("validates vocabulary pronunciation responses", () => {
    const parsed = vocabularyPronunciationResponseSchema.parse({
      vocabularyItemId: "vocab-a1-hello",
      word: "hello",
      strategy: "audio",
      audioUrl: "https://api.dictionaryapi.dev/media/pronunciations/en/hello-us.mp3",
      source: "dictionaryapi.dev",
      sourceUrl: "https://api.dictionaryapi.dev/api/v2/entries/en/hello",
      accent: "us",
      fallbackText: "hello"
    });

    expect(parsed.strategy).toBe("audio");
  });

  it("validates vocabulary example responses", () => {
    const parsed = vocabularyExamplesResponseSchema.parse({
      vocabularyItemId: "vocab-a1-hello",
      word: "hello",
      examples: [
        {
          id: "example-1",
          text: "Hello, how are you?",
          translationZh: "你好，你好吗？",
          sentenceId: 123,
          translationId: 456,
          owner: "author",
          translationOwner: "translator",
          license: "CC BY 2.0 FR",
          sourceUrl: "https://tatoeba.org/en/sentences/show/123",
          audioUrl: "https://audio.tatoeba.org/sentences/eng/123.mp3"
        }
      ],
      fallbackDefinition: {
        definitionEn: "Used as a greeting.",
        meaningZh: "你好"
      }
    });

    expect(parsed.examples[0]?.translationZh).toBe("你好，你好吗？");
    expect(() =>
      vocabularyExamplesResponseSchema.parse({
        ...parsed,
        examples: [
          {
            id: "example-2",
            text: "Hello again.",
            translationZh: null,
            sentenceId: null,
            translationId: null,
            owner: "dictionaryapi.dev",
            translationOwner: null,
            license: null,
            sourceUrl: "https://api.dictionaryapi.dev/api/v2/entries/en/hello",
            audioUrl: null
          }
        ]
      })
    ).toThrow();
  });

  it("keeps dashboard response shape stable", () => {
    const parsed = dashboardResponseSchema.parse({
      user: {
        id: "u1",
        email: "learner@example.com",
        name: "Learner",
        level: "A2",
        createdAt: new Date().toISOString()
      },
      today: {
        date: "2026-07-05",
        newWords: 1,
        reviews: 2,
        lessonsCompleted: 1,
        exercisesCompleted: 5,
        minutesStudied: 20
      },
      tasks: [],
      weekly: [],
      reviewDueCount: 0,
      newWordsAvailable: 10,
      lessonsCompleted: 1,
      streakDays: 1
    });

    expect(parsed.today.exercisesCompleted).toBe(5);
  });
});
