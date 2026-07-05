import { practiceSessionSchema, practiceSubmitInputSchema, practiceSubmitResponseSchema } from "@english-learning/shared";
import { eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import { db } from "../db/client";
import { exercises, userExerciseAttempts } from "../db/schema";
import { ApiError, normalizeAnswer, parseJson } from "../utils/http";
import { incrementDailyProgress, toExercise } from "./helpers";

export const practiceRoutes = new Hono<{ Variables: AuthVariables }>();

practiceRoutes.use("*", requireAuth);

practiceRoutes.get("/session", async (c) => {
  const level = c.req.query("level") ?? c.get("user").level ?? "A1";
  const rows = await db
    .select()
    .from(exercises)
    .where(eq(exercises.level, level))
    .orderBy(sql`random()`)
    .limit(5);

  return c.json(
    practiceSessionSchema.parse({
      exercises: rows.map((row) => {
        const exercise = toExercise(row);
        return {
          id: exercise.id,
          lessonId: exercise.lessonId,
          type: exercise.type,
          prompt: exercise.prompt,
          options: exercise.options,
          explanation: exercise.explanation,
          level: exercise.level
        };
      })
    })
  );
});

practiceRoutes.post("/submit", async (c) => {
  const input = await parseJson(c, practiceSubmitInputSchema);
  const ids = input.answers.map((answer) => answer.exerciseId);
  const rows = await db.select().from(exercises).where(inArray(exercises.id, ids));
  const exerciseById = new Map(rows.map((row) => [row.id, toExercise(row)]));

  if (rows.length !== ids.length) {
    throw new ApiError(400, "UNKNOWN_EXERCISE", "One or more exercises could not be found.");
  }

  const results = input.answers.map((answer) => {
    const exercise = exerciseById.get(answer.exerciseId);
    if (!exercise) {
      throw new ApiError(400, "UNKNOWN_EXERCISE", "One or more exercises could not be found.");
    }

    const correct = normalizeAnswer(answer.answer) === normalizeAnswer(exercise.answer);
    return {
      exerciseId: answer.exerciseId,
      correct,
      answer: answer.answer,
      expectedAnswer: exercise.answer,
      explanation: exercise.explanation
    };
  });

  await db.insert(userExerciseAttempts).values(
    results.map((result) => ({
      id: randomUUID(),
      userId: c.get("userId"),
      exerciseId: result.exerciseId,
      answer: result.answer,
      isCorrect: result.correct,
      createdAt: new Date().toISOString()
    }))
  );

  await incrementDailyProgress(c.get("userId"), {
    exercisesCompleted: results.length,
    minutesStudied: Math.max(1, Math.ceil(results.length / 2))
  });

  return c.json(
    practiceSubmitResponseSchema.parse({
      score: results.filter((result) => result.correct).length,
      total: results.length,
      results
    })
  );
});
