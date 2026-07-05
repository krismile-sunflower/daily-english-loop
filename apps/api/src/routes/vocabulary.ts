import {
  type ReviewGrade,
  englishLevelSchema,
  reviewInputSchema,
  reviewResponseSchema,
  vocabularyExamplesResponseSchema,
  vocabularyListResponseSchema,
  vocabularyPronunciationResponseSchema
} from "@english-learning/shared";
import { and, asc, count, eq, isNotNull, isNull, like, lte, or, sql, SQL } from "drizzle-orm";
import { Context, Hono } from "hono";
import { randomUUID } from "node:crypto";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import { db } from "../db/client";
import { userVocabularyProgress, vocabularyItems, type VocabularyItemRow, type VocabularyProgressRow } from "../db/schema";
import { getVocabularyExamples } from "../services/examples";
import { getVocabularyPronunciation } from "../services/pronunciation";
import { addDays, addMinutes, ApiError, parseJson, todayKey } from "../utils/http";
import { incrementDailyProgress, toVocabularyItem } from "./helpers";

export const vocabularyRoutes = new Hono<{ Variables: AuthVariables }>();

vocabularyRoutes.use("*", requireAuth);

vocabularyRoutes.get("/", async (c) => {
  const user = c.get("user");
  const requestedLevel = englishLevelSchema.safeParse(c.req.query("level"));
  const level = requestedLevel.success ? requestedLevel.data : user.level ?? "A1";
  const q = c.req.query("q")?.trim();
  const topic = c.req.query("topic")?.trim();
  const status = c.req.query("status") ?? "all";
  const useDailyShuffle = c.req.query("shuffle") === "daily" && status === "new";
  const page = clampInteger(c.req.query("page"), 1, 1, 10_000);
  const pageSize = clampInteger(c.req.query("pageSize"), 50, 1, 100);
  const offset = (page - 1) * pageSize;
  const filters: SQL[] = [eq(vocabularyItems.level, level)];

  if (q) {
    const pattern = `%${q.toLowerCase()}%`;
    filters.push(
      or(
        like(sql`lower(${vocabularyItems.word})`, pattern),
        like(sql`lower(${vocabularyItems.meaningZh})`, pattern),
        like(sql`lower(${vocabularyItems.definitionEn})`, pattern),
        like(sql`lower(${vocabularyItems.topic})`, pattern)
      )!
    );
  }

  if (topic && topic !== "all") {
    filters.push(eq(vocabularyItems.topic, topic));
  }

  if (status === "new") {
    filters.push(isNull(userVocabularyProgress.id));
  } else if (status === "learning" || status === "learned") {
    filters.push(eq(userVocabularyProgress.status, status));
  } else if (status !== "all") {
    filters.push(isNotNull(vocabularyItems.id));
  }

  const where = and(...filters);
  let rows: Array<{ item: VocabularyItemRow; progress: VocabularyProgressRow | null }>;
  let total: number;

  if (useDailyShuffle) {
    const allRows = await db
      .select({ item: vocabularyItems, progress: userVocabularyProgress })
      .from(vocabularyItems)
      .leftJoin(
        userVocabularyProgress,
        and(
          eq(userVocabularyProgress.vocabularyItemId, vocabularyItems.id),
          eq(userVocabularyProgress.userId, user.id)
        )
      )
      .where(where);
    const shuffledRows = dailyShuffle(allRows, `${user.id}:${level}:${todayKey()}`);
    total = shuffledRows.length;
    rows = shuffledRows.slice(offset, offset + pageSize);
  } else {
    rows = await db
      .select({ item: vocabularyItems, progress: userVocabularyProgress })
      .from(vocabularyItems)
      .leftJoin(
        userVocabularyProgress,
        and(
          eq(userVocabularyProgress.vocabularyItemId, vocabularyItems.id),
          eq(userVocabularyProgress.userId, user.id)
        )
      )
      .where(where)
      .orderBy(asc(vocabularyItems.topic), asc(vocabularyItems.word))
      .limit(pageSize)
      .offset(offset);

    const [totalRow] = await db
      .select({ total: count() })
      .from(vocabularyItems)
      .leftJoin(
        userVocabularyProgress,
        and(
          eq(userVocabularyProgress.vocabularyItemId, vocabularyItems.id),
          eq(userVocabularyProgress.userId, user.id)
        )
      )
      .where(where);
    total = totalRow?.total ?? 0;
  }

  const topics = await db
    .selectDistinct({ topic: vocabularyItems.topic })
    .from(vocabularyItems)
    .where(eq(vocabularyItems.level, level))
    .orderBy(asc(vocabularyItems.topic));

  return c.json(
    vocabularyListResponseSchema.parse({
      items: rows.map((row) => toVocabularyItem(row.item, row.progress)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      topics: topics.map((row) => row.topic)
    })
  );
});

function clampInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function dailyShuffle<T extends { item: { id: string; topic: string; word: string } }>(rows: T[], seed: string) {
  return [...rows].sort((left, right) => {
    const leftWeight = hashString(`${seed}:${left.item.id}`);
    const rightWeight = hashString(`${seed}:${right.item.id}`);

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return left.item.topic.localeCompare(right.item.topic) || left.item.word.localeCompare(right.item.word);
  });
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

vocabularyRoutes.get("/review-due", async (c) => {
  const now = new Date().toISOString();
  const rows = await db
    .select({ item: vocabularyItems, progress: userVocabularyProgress })
    .from(userVocabularyProgress)
    .innerJoin(vocabularyItems, eq(vocabularyItems.id, userVocabularyProgress.vocabularyItemId))
    .where(
      and(
        eq(userVocabularyProgress.userId, c.get("userId")),
        or(lte(userVocabularyProgress.dueAt, now), isNull(userVocabularyProgress.dueAt))
      )
    )
    .orderBy(asc(userVocabularyProgress.dueAt))
    .limit(30);

  return c.json({
    items: rows.map((row) => toVocabularyItem(row.item, row.progress))
  });
});

async function pronunciationHandler(c: Context<{ Variables: AuthVariables }>) {
  const vocabularyItemId = c.req.param("id");
  if (!vocabularyItemId) {
    throw new ApiError(400, "MISSING_VOCABULARY_ID", "Vocabulary item id is required.");
  }

  const pronunciation = await getVocabularyPronunciation(vocabularyItemId);
  return c.json(vocabularyPronunciationResponseSchema.parse(pronunciation));
}

vocabularyRoutes.get("/:id/pronunciation", pronunciationHandler);
vocabularyRoutes.get("/:id/prunciation", pronunciationHandler);

vocabularyRoutes.get("/:id/examples", async (c) => {
  const vocabularyItemId = c.req.param("id");
  if (!vocabularyItemId) {
    throw new ApiError(400, "MISSING_VOCABULARY_ID", "Vocabulary item id is required.");
  }

  const examples = await getVocabularyExamples(vocabularyItemId);
  return c.json(vocabularyExamplesResponseSchema.parse(examples));
});

vocabularyRoutes.post("/:id/review", async (c) => {
  const input = await parseJson(c, reviewInputSchema);
  const vocabularyItemId = c.req.param("id");
  const userId = c.get("userId");

  const [item] = await db.select().from(vocabularyItems).where(eq(vocabularyItems.id, vocabularyItemId)).limit(1);
  if (!item) {
    throw new ApiError(404, "VOCABULARY_NOT_FOUND", "Vocabulary item not found.");
  }

  const [existing] = await db
    .select()
    .from(userVocabularyProgress)
    .where(and(eq(userVocabularyProgress.userId, userId), eq(userVocabularyProgress.vocabularyItemId, vocabularyItemId)))
    .limit(1);

  const now = new Date();
  const baseEase = existing?.easeFactor ?? 2.5;
  const baseInterval = existing?.intervalDays ?? 0;
  const nextReviewCount = (existing?.reviewCount ?? 0) + 1;

  const next = calculateSm2Schedule(input.grade, baseEase, baseInterval, nextReviewCount, now);

  const values = {
    status: next.status,
    easeFactor: next.easeFactor,
    intervalDays: next.intervalDays,
    dueAt: next.dueAt,
    lastReviewedAt: now.toISOString(),
    reviewCount: nextReviewCount,
    learnedAt: existing?.learnedAt ?? now.toISOString()
  };

  const [progress] = existing
    ? await db
        .update(userVocabularyProgress)
        .set(values)
        .where(eq(userVocabularyProgress.id, existing.id))
        .returning()
    : await db
        .insert(userVocabularyProgress)
        .values({
          id: randomUUID(),
          userId,
          vocabularyItemId,
          ...values
        })
        .returning();

  if (!progress) {
    throw new ApiError(500, "REVIEW_SAVE_FAILED", "Could not save review progress.");
  }

  await incrementDailyProgress(userId, {
    newWords: existing ? 0 : 1,
    reviews: 1,
    minutesStudied: 1
  });

  return c.json(reviewResponseSchema.parse({ item: toVocabularyItem(item, progress), nextDueAt: next.dueAt }));
});

function calculateSm2Schedule(
  grade: ReviewGrade,
  baseEase: number,
  baseInterval: number,
  nextReviewCount: number,
  now: Date
) {
  switch (grade) {
    case "again":
      return {
        easeFactor: Math.max(1.3, baseEase - 0.35),
        intervalDays: 0,
        dueAt: addMinutes(now, 10).toISOString(),
        status: "learning" as const
      };
    case "hard": {
      const intervalDays = Math.max(1, Math.round(Math.max(baseInterval, 1) * 1.2));
      return {
        easeFactor: Math.max(1.3, baseEase - 0.15),
        intervalDays,
        dueAt: addDays(now, intervalDays).toISOString(),
        status: "learning" as const
      };
    }
    case "easy": {
      const easeFactor = Math.min(3.2, baseEase + 0.15);
      const intervalDays =
        nextReviewCount === 1 ? 4 : Math.max(4, Math.round(Math.max(baseInterval, 1) * easeFactor * 1.3));
      return {
        easeFactor,
        intervalDays,
        dueAt: addDays(now, intervalDays).toISOString(),
        status: "learned" as const
      };
    }
    case "good":
    default: {
      const intervalDays =
        nextReviewCount === 1
          ? 1
          : nextReviewCount === 2
            ? 3
            : Math.max(1, Math.round(Math.max(baseInterval, 1) * baseEase));
      return {
        easeFactor: baseEase,
        intervalDays,
        dueAt: addDays(now, intervalDays).toISOString(),
        status: "learned" as const
      };
    }
  }
}
