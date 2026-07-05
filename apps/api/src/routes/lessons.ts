import { courseTypeSchema } from "@english-learning/shared";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import { db } from "../db/client";
import { exercises, lessons, userLessonProgress } from "../db/schema";
import { ApiError } from "../utils/http";
import { incrementDailyProgress, toExercise, toLesson } from "./helpers";

export const lessonRoutes = new Hono<{ Variables: AuthVariables }>();

lessonRoutes.use("*", requireAuth);

lessonRoutes.get("/", async (c) => {
  const user = c.get("user");
  const typeParam = c.req.query("type");
  const type = typeParam ? courseTypeSchema.parse(typeParam) : null;
  const level = c.req.query("level") ?? user.level ?? "A1";

  const rows = await db
    .select({ lesson: lessons, progress: userLessonProgress })
    .from(lessons)
    .leftJoin(
      userLessonProgress,
      and(eq(userLessonProgress.lessonId, lessons.id), eq(userLessonProgress.userId, user.id))
    )
    .where(type ? and(eq(lessons.level, level), eq(lessons.type, type)) : eq(lessons.level, level))
    .orderBy(asc(lessons.type), asc(lessons.title));

  return c.json({
    lessons: rows.map((row) => toLesson(row.lesson, Boolean(row.progress)))
  });
});

lessonRoutes.get("/:lessonId", async (c) => {
  const lessonId = c.req.param("lessonId");
  const [row] = await db
    .select({ lesson: lessons, progress: userLessonProgress })
    .from(lessons)
    .leftJoin(
      userLessonProgress,
      and(eq(userLessonProgress.lessonId, lessons.id), eq(userLessonProgress.userId, c.get("userId")))
    )
    .where(eq(lessons.id, lessonId))
    .limit(1);

  if (!row) {
    throw new ApiError(404, "LESSON_NOT_FOUND", "Lesson not found.");
  }

  const lessonExercises = await db.select().from(exercises).where(eq(exercises.lessonId, lessonId)).orderBy(asc(exercises.id));

  return c.json({
    ...toLesson(row.lesson, Boolean(row.progress)),
    exercises: lessonExercises.map(toExercise)
  });
});

lessonRoutes.post("/:lessonId/complete", async (c) => {
  const lessonId = c.req.param("lessonId");
  const userId = c.get("userId");
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);

  if (!lesson) {
    throw new ApiError(404, "LESSON_NOT_FOUND", "Lesson not found.");
  }

  const [existing] = await db
    .select()
    .from(userLessonProgress)
    .where(and(eq(userLessonProgress.userId, userId), eq(userLessonProgress.lessonId, lessonId)))
    .limit(1);

  if (!existing) {
    await db.insert(userLessonProgress).values({
      id: randomUUID(),
      userId,
      lessonId,
      completedAt: new Date().toISOString()
    });

    await incrementDailyProgress(userId, {
      lessonsCompleted: 1,
      minutesStudied: lesson.estimatedMinutes
    });
  }

  return c.json({ lesson: toLesson(lesson, true) });
});
