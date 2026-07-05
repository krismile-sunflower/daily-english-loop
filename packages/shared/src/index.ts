import { z } from "zod";

export const englishLevelSchema = z.enum(["A1", "A2", "B1", "B2", "C1"]);
export type EnglishLevel = z.infer<typeof englishLevelSchema>;

export const courseTypeSchema = z.enum(["reading", "listening", "grammar"]);
export type CourseType = z.infer<typeof courseTypeSchema>;

export const reviewGradeSchema = z.enum(["again", "hard", "good", "easy"]);
export type ReviewGrade = z.infer<typeof reviewGradeSchema>;

export const exerciseTypeSchema = z.enum(["multiple_choice", "fill_blank"]);
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  level: englishLevelSchema.nullable(),
  createdAt: z.string()
});
export type User = z.infer<typeof userSchema>;

export const registerInputSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(40),
  password: z.string().min(8).max(120)
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(120)
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const updateMeInputSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  level: englishLevelSchema.optional()
});
export type UpdateMeInput = z.infer<typeof updateMeInputSchema>;

export const authResponseSchema = z.object({
  user: userSchema
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const meResponseSchema = z.object({
  user: userSchema.nullable()
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const vocabularyProgressSchema = z.object({
  status: z.enum(["new", "learning", "learned"]),
  easeFactor: z.number(),
  intervalDays: z.number().int(),
  dueAt: z.string().nullable(),
  lastReviewedAt: z.string().nullable(),
  reviewCount: z.number().int()
});
export type VocabularyProgress = z.infer<typeof vocabularyProgressSchema>;

export const vocabularyItemSchema = z.object({
  id: z.string(),
  word: z.string(),
  phonetic: z.string(),
  meaningZh: z.string(),
  definitionEn: z.string(),
  exampleEn: z.string(),
  exampleZh: z.string(),
  level: englishLevelSchema,
  topic: z.string(),
  progress: vocabularyProgressSchema.nullable()
});
export type VocabularyItem = z.infer<typeof vocabularyItemSchema>;

export const vocabularyListResponseSchema = z.object({
  items: z.array(vocabularyItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
  topics: z.array(z.string())
});
export type VocabularyListResponse = z.infer<typeof vocabularyListResponseSchema>;

export const vocabularyPronunciationResponseSchema = z.object({
  vocabularyItemId: z.string(),
  word: z.string(),
  strategy: z.enum(["audio", "browser-tts"]),
  audioUrl: z.string().nullable(),
  source: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  accent: z.enum(["us", "uk", "unknown"]).nullable(),
  fallbackText: z.string()
});
export type VocabularyPronunciationResponse = z.infer<typeof vocabularyPronunciationResponseSchema>;

export const vocabularyExampleSchema = z.object({
  id: z.string(),
  text: z.string(),
  translationZh: z.string().min(1),
  sentenceId: z.number().int(),
  translationId: z.number().int(),
  owner: z.string().nullable(),
  translationOwner: z.string().nullable(),
  license: z.string().nullable(),
  sourceUrl: z.string(),
  audioUrl: z.string().nullable()
});
export type VocabularyExample = z.infer<typeof vocabularyExampleSchema>;

export const vocabularyExamplesResponseSchema = z.object({
  vocabularyItemId: z.string(),
  word: z.string(),
  examples: z.array(vocabularyExampleSchema),
  fallbackDefinition: z.object({
    definitionEn: z.string(),
    meaningZh: z.string()
  })
});
export type VocabularyExamplesResponse = z.infer<typeof vocabularyExamplesResponseSchema>;

export const reviewInputSchema = z.object({
  grade: reviewGradeSchema
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const reviewResponseSchema = z.object({
  item: vocabularyItemSchema,
  nextDueAt: z.string()
});
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

export const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: courseTypeSchema,
  level: englishLevelSchema,
  content: z.string(),
  audioText: z.string().nullable(),
  audioUrl: z.string().nullable(),
  estimatedMinutes: z.number().int(),
  completed: z.boolean()
});
export type Lesson = z.infer<typeof lessonSchema>;

export const exerciseSchema = z.object({
  id: z.string(),
  lessonId: z.string().nullable(),
  type: exerciseTypeSchema,
  prompt: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  explanation: z.string(),
  level: englishLevelSchema
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const lessonDetailSchema = lessonSchema.extend({
  exercises: z.array(exerciseSchema)
});
export type LessonDetail = z.infer<typeof lessonDetailSchema>;

export const practiceSessionSchema = z.object({
  exercises: z.array(exerciseSchema.omit({ answer: true }))
});
export type PracticeSession = z.infer<typeof practiceSessionSchema>;

export const practiceSubmitInputSchema = z.object({
  answers: z.array(
    z.object({
      exerciseId: z.string(),
      answer: z.string()
    })
  ).min(1)
});
export type PracticeSubmitInput = z.infer<typeof practiceSubmitInputSchema>;

export const practiceSubmitResponseSchema = z.object({
  score: z.number().int(),
  total: z.number().int(),
  results: z.array(
    z.object({
      exerciseId: z.string(),
      correct: z.boolean(),
      answer: z.string(),
      expectedAnswer: z.string(),
      explanation: z.string()
    })
  )
});
export type PracticeSubmitResponse = z.infer<typeof practiceSubmitResponseSchema>;

export const dailyProgressSchema = z.object({
  date: z.string(),
  newWords: z.number().int(),
  reviews: z.number().int(),
  lessonsCompleted: z.number().int(),
  exercisesCompleted: z.number().int(),
  minutesStudied: z.number().int()
});
export type DailyProgress = z.infer<typeof dailyProgressSchema>;

export const dashboardTaskSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number().int(),
  goal: z.number().int(),
  href: z.string()
});
export type DashboardTask = z.infer<typeof dashboardTaskSchema>;

export const dashboardResponseSchema = z.object({
  user: userSchema,
  today: dailyProgressSchema,
  tasks: z.array(dashboardTaskSchema),
  weekly: z.array(dailyProgressSchema),
  reviewDueCount: z.number().int(),
  newWordsAvailable: z.number().int(),
  lessonsCompleted: z.number().int(),
  streakDays: z.number().int()
});
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});
export type ApiError = z.infer<typeof apiErrorSchema>;
