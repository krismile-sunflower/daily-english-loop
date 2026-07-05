import type {
  DailyProgress,
  EnglishLevel,
  Exercise,
  Lesson,
  User,
  VocabularyItem,
  VocabularyProgress
} from "@english-learning/shared";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client";
import {
  dailyProgress,
  type DailyProgressRow,
  type ExerciseRow,
  type LessonRow,
  type UserRow,
  type VocabularyItemRow,
  type VocabularyProgressRow
} from "../db/schema";
import { todayKey } from "../utils/http";

export function toPublicUser(user: UserRow): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    level: user.level as EnglishLevel | null,
    role: user.role as User["role"],
    createdAt: user.createdAt
  };
}

export function toVocabularyProgress(progress: VocabularyProgressRow | null): VocabularyProgress | null {
  if (!progress) {
    return null;
  }

  return {
    status: progress.status as VocabularyProgress["status"],
    easeFactor: progress.easeFactor,
    intervalDays: progress.intervalDays,
    dueAt: progress.dueAt,
    lastReviewedAt: progress.lastReviewedAt,
    reviewCount: progress.reviewCount
  };
}

export function toVocabularyItem(item: VocabularyItemRow, progress: VocabularyProgressRow | null): VocabularyItem {
  return {
    id: item.id,
    word: item.word,
    phonetic: item.phonetic,
    meaningZh: item.meaningZh,
    definitionEn: item.definitionEn,
    exampleEn: item.exampleEn,
    exampleZh: item.exampleZh,
    level: item.level as EnglishLevel,
    topic: item.topic,
    progress: toVocabularyProgress(progress)
  };
}

export function toLesson(lesson: LessonRow, completed: boolean): Lesson {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    type: lesson.type as Lesson["type"],
    level: lesson.level as EnglishLevel,
    content: lesson.content,
    audioText: lesson.audioText,
    audioUrl: lesson.audioUrl,
    estimatedMinutes: lesson.estimatedMinutes,
    completed
  };
}

export function toExercise(exercise: ExerciseRow): Exercise {
  return {
    id: exercise.id,
    lessonId: exercise.lessonId,
    type: exercise.type as Exercise["type"],
    prompt: exercise.prompt,
    options: JSON.parse(exercise.options) as string[],
    answer: exercise.answer,
    explanation: exercise.explanation,
    level: exercise.level as EnglishLevel
  };
}

export function toDailyProgress(row: DailyProgressRow): DailyProgress {
  return {
    date: row.date,
    newWords: row.newWords,
    reviews: row.reviews,
    lessonsCompleted: row.lessonsCompleted,
    exercisesCompleted: row.exercisesCompleted,
    minutesStudied: row.minutesStudied
  };
}

export async function ensureDailyProgress(userId: string, date = todayKey()) {
  await db
    .insert(dailyProgress)
    .values({
      id: randomUUID(),
      userId,
      date,
      newWords: 0,
      reviews: 0,
      lessonsCompleted: 0,
      exercisesCompleted: 0,
      minutesStudied: 0
    })
    .onConflictDoNothing({ target: [dailyProgress.userId, dailyProgress.date] });

  const [row] = await db
    .select()
    .from(dailyProgress)
    .where(and(eq(dailyProgress.userId, userId), eq(dailyProgress.date, date)))
    .limit(1);

  if (!row) {
    throw new Error("Failed to create daily progress row.");
  }

  return row;
}

export async function incrementDailyProgress(
  userId: string,
  delta: Partial<Omit<DailyProgress, "date">>,
  date = todayKey()
) {
  await ensureDailyProgress(userId, date);

  await db
    .update(dailyProgress)
    .set({
      newWords: sql`${dailyProgress.newWords} + ${delta.newWords ?? 0}`,
      reviews: sql`${dailyProgress.reviews} + ${delta.reviews ?? 0}`,
      lessonsCompleted: sql`${dailyProgress.lessonsCompleted} + ${delta.lessonsCompleted ?? 0}`,
      exercisesCompleted: sql`${dailyProgress.exercisesCompleted} + ${delta.exercisesCompleted ?? 0}`,
      minutesStudied: sql`${dailyProgress.minutesStudied} + ${delta.minutesStudied ?? 0}`
    })
    .where(and(eq(dailyProgress.userId, userId), eq(dailyProgress.date, date)));
}
