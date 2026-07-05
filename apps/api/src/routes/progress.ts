import type { DailyProgress } from "@english-learning/shared";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import { db } from "../db/client";
import { dailyProgress, userLessonProgress, userVocabularyProgress, vocabularyItems } from "../db/schema";
import { todayKey } from "../utils/http";
import { ensureDailyProgress, toDailyProgress, toPublicUser } from "./helpers";

export const progressRoutes = new Hono<{ Variables: AuthVariables }>();

progressRoutes.use("*", requireAuth);

progressRoutes.get("/dashboard", async (c) => {
  const user = c.get("user");
  const level = user.level ?? "A1";
  const today = todayKey();
  const todayRow = await ensureDailyProgress(user.id, today);

  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return todayKey(date);
  });

  const weeklyRows = await db
    .select()
    .from(dailyProgress)
    .where(and(eq(dailyProgress.userId, user.id), gte(dailyProgress.date, dates[0] ?? today)))
    .orderBy(asc(dailyProgress.date));

  const weeklyByDate = new Map(weeklyRows.map((row) => [row.date, toDailyProgress(row)]));
  const weekly: DailyProgress[] = dates.map(
    (date) =>
      weeklyByDate.get(date) ?? {
        date,
        newWords: 0,
        reviews: 0,
        lessonsCompleted: 0,
        exercisesCompleted: 0,
        minutesStudied: 0
      }
  );

  const [reviewDue] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userVocabularyProgress)
    .where(and(eq(userVocabularyProgress.userId, user.id), lte(userVocabularyProgress.dueAt, new Date().toISOString())));

  const allLevelVocabulary = await db.select({ id: vocabularyItems.id }).from(vocabularyItems).where(eq(vocabularyItems.level, level));
  const progressed = await db
    .select({ vocabularyItemId: userVocabularyProgress.vocabularyItemId })
    .from(userVocabularyProgress)
    .where(eq(userVocabularyProgress.userId, user.id));
  const progressedIds = new Set(progressed.map((row) => row.vocabularyItemId));

  const [completedLessons] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userLessonProgress)
    .where(eq(userLessonProgress.userId, user.id));

  const progressHistory = await db
    .select()
    .from(dailyProgress)
    .where(eq(dailyProgress.userId, user.id))
    .orderBy(desc(dailyProgress.date));
  const activeDates = new Set(
    progressHistory
      .filter(
        (row) =>
          row.newWords + row.reviews + row.lessonsCompleted + row.exercisesCompleted + row.minutesStudied > 0
      )
      .map((row) => row.date)
  );

  let streakDays = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    if (!activeDates.has(todayKey(date))) {
      break;
    }
    streakDays += 1;
  }

  const todayProgress = toDailyProgress(todayRow);
  return c.json({
    user: toPublicUser(user),
    today: todayProgress,
    tasks: [
      {
        id: "new-words",
        label: "学 10 个新单词",
        value: todayProgress.newWords,
        goal: 10,
        href: "/vocabulary"
      },
      {
        id: "review",
        label: "复习到期单词",
        value: todayProgress.reviews,
        goal: Math.max(reviewDue?.count ?? 0, todayProgress.reviews, 1),
        href: "/review"
      },
      {
        id: "reading",
        label: "完成 1 篇短阅读",
        value: todayProgress.lessonsCompleted,
        goal: 1,
        href: "/lessons"
      },
      {
        id: "practice",
        label: "做 5 道练习题",
        value: todayProgress.exercisesCompleted,
        goal: 5,
        href: "/practice"
      }
    ],
    weekly,
    reviewDueCount: reviewDue?.count ?? 0,
    newWordsAvailable: allLevelVocabulary.filter((item) => !progressedIds.has(item.id)).length,
    lessonsCompleted: completedLessons?.count ?? 0,
    streakDays
  });
});
