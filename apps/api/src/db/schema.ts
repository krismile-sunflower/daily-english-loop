import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  level: text("level"),
  role: text("role").notNull().default("learner"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const vocabularyItems = sqliteTable(
  "vocabulary_items",
  {
    id: text("id").primaryKey(),
    word: text("word").notNull(),
    phonetic: text("phonetic").notNull(),
    meaningZh: text("meaning_zh").notNull(),
    definitionEn: text("definition_en").notNull(),
    exampleEn: text("example_en").notNull(),
    exampleZh: text("example_zh").notNull(),
    level: text("level").notNull(),
    topic: text("topic").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    levelIdx: index("vocabulary_items_level_idx").on(table.level),
    wordIdx: uniqueIndex("vocabulary_items_word_level_idx").on(table.word, table.level)
  })
);

export const userVocabularyProgress = sqliteTable(
  "user_vocabulary_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    vocabularyItemId: text("vocabulary_item_id").notNull().references(() => vocabularyItems.id, {
      onDelete: "cascade"
    }),
    status: text("status").notNull().default("new"),
    easeFactor: real("ease_factor").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    dueAt: text("due_at"),
    lastReviewedAt: text("last_reviewed_at"),
    reviewCount: integer("review_count").notNull().default(0),
    learnedAt: text("learned_at")
  },
  (table) => ({
    userItemIdx: uniqueIndex("user_vocabulary_progress_user_item_idx").on(table.userId, table.vocabularyItemId),
    dueIdx: index("user_vocabulary_progress_due_idx").on(table.userId, table.dueAt)
  })
);

export const vocabularyPronunciations = sqliteTable(
  "vocabulary_pronunciations",
  {
    id: text("id").primaryKey(),
    vocabularyItemId: text("vocabulary_item_id")
      .notNull()
      .references(() => vocabularyItems.id, { onDelete: "cascade" }),
    audioUrl: text("audio_url"),
    source: text("source"),
    sourceUrl: text("source_url"),
    accent: text("accent"),
    resolvedAt: text("resolved_at"),
    missingAt: text("missing_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    vocabularyItemIdx: uniqueIndex("vocabulary_pronunciations_vocabulary_item_idx").on(table.vocabularyItemId)
  })
);

export const vocabularyExamples = sqliteTable(
  "vocabulary_examples",
  {
    id: text("id").primaryKey(),
    vocabularyItemId: text("vocabulary_item_id")
      .notNull()
      .references(() => vocabularyItems.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    translationZh: text("translation_zh").notNull(),
    sentenceId: integer("sentence_id"),
    translationId: integer("translation_id"),
    owner: text("owner"),
    translationOwner: text("translation_owner"),
    license: text("license"),
    sourceUrl: text("source_url"),
    audioUrl: text("audio_url"),
    audioResolvedAt: text("audio_resolved_at"),
    audioMissingAt: text("audio_missing_at"),
    resolvedAt: text("resolved_at"),
    missingAt: text("missing_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    vocabularyItemIdx: index("vocabulary_examples_vocabulary_item_idx").on(table.vocabularyItemId),
    sentenceIdx: uniqueIndex("vocabulary_examples_vocabulary_sentence_idx").on(
      table.vocabularyItemId,
      table.sentenceId
    )
  })
);

export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: text("type").notNull(),
    level: text("level").notNull(),
    content: text("content").notNull(),
    audioText: text("audio_text"),
    audioUrl: text("audio_url"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(8),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    levelTypeIdx: index("lessons_level_type_idx").on(table.level, table.type)
  })
);

export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    prompt: text("prompt").notNull(),
    options: text("options").notNull(),
    answer: text("answer").notNull(),
    explanation: text("explanation").notNull(),
    level: text("level").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    exerciseLevelIdx: index("exercises_level_idx").on(table.level),
    lessonIdx: index("exercises_lesson_idx").on(table.lessonId)
  })
);

export const userExerciseAttempts = sqliteTable(
  "user_exercise_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => ({
    attemptUserIdx: index("user_exercise_attempts_user_idx").on(table.userId)
  })
);

export const dailyProgress = sqliteTable(
  "daily_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    newWords: integer("new_words").notNull().default(0),
    reviews: integer("reviews").notNull().default(0),
    lessonsCompleted: integer("lessons_completed").notNull().default(0),
    exercisesCompleted: integer("exercises_completed").notNull().default(0),
    minutesStudied: integer("minutes_studied").notNull().default(0)
  },
  (table) => ({
    userDateIdx: uniqueIndex("daily_progress_user_date_idx").on(table.userId, table.date)
  })
);

export const userLessonProgress = sqliteTable(
  "user_lesson_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: text("completed_at").notNull()
  },
  (table) => ({
    userLessonIdx: uniqueIndex("user_lesson_progress_user_lesson_idx").on(table.userId, table.lessonId)
  })
);

export const userRelations = relations(users, ({ many }) => ({
  vocabularyProgress: many(userVocabularyProgress),
  exerciseAttempts: many(userExerciseAttempts),
  lessonProgress: many(userLessonProgress),
  dailyProgress: many(dailyProgress)
}));

export const lessonRelations = relations(lessons, ({ many }) => ({
  exercises: many(exercises),
  userProgress: many(userLessonProgress)
}));

export type UserRow = typeof users.$inferSelect;
export type VocabularyItemRow = typeof vocabularyItems.$inferSelect;
export type VocabularyProgressRow = typeof userVocabularyProgress.$inferSelect;
export type VocabularyPronunciationRow = typeof vocabularyPronunciations.$inferSelect;
export type VocabularyExampleRow = typeof vocabularyExamples.$inferSelect;
export type LessonRow = typeof lessons.$inferSelect;
export type ExerciseRow = typeof exercises.$inferSelect;
export type DailyProgressRow = typeof dailyProgress.$inferSelect;
