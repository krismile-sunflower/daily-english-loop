import { eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, client } from "./client";
import { exercises, lessons, users, vocabularyItems } from "./schema";
import { runMigrations } from "./migrate";
import { hashPassword } from "../auth/password";
import { loadVocabularyLibrary } from "./vocabulary-library";

const vocabularyUpsertBatchSize = 100;
const vocabularyDeleteBatchSize = 500;

const lessonSeed = [
  {
    id: "lesson-a1-reading-market",
    title: "A Morning at the Market",
    description: "Read a short daily-life passage and identify simple nouns.",
    type: "reading",
    level: "A1",
    estimatedMinutes: 6,
    content:
      "Li Ming goes to the market in the morning. He buys apples, water, and a small book. The seller is friendly. Li Ming says thank you and walks home.",
    audioText: null,
    audioUrl: null
  },
  {
    id: "lesson-a1-listening-routine",
    title: "My Study Routine",
    description: "Listen for time words and daily actions.",
    type: "listening",
    level: "A1",
    estimatedMinutes: 5,
    content:
      "Listen to the routine. Focus on morning, school, friend, and study. Then answer one question about the speaker's day.",
    audioText: "I study English in the morning. After school, I read a book with my friend.",
    audioUrl: null
  },
  {
    id: "lesson-a1-grammar-be",
    title: "Be Verbs in Simple Sentences",
    description: "Practice am, is, and are with short examples.",
    type: "grammar",
    level: "A1",
    estimatedMinutes: 7,
    content:
      "Use am with I, is with he/she/it, and are with you/we/they. Example: I am happy. She is my friend. They are at school.",
    audioText: null,
    audioUrl: null
  },
  {
    id: "lesson-a2-reading-habits",
    title: "Small Habits, Better English",
    description: "Read about how simple routines improve results.",
    type: "reading",
    level: "A2",
    estimatedMinutes: 8,
    content:
      "Many learners want quick results, but small habits are more useful. Prepare three new words, read one short text, and review before dinner. A simple routine can make you more confident.",
    audioText: null,
    audioUrl: null
  },
  {
    id: "lesson-a2-listening-choice",
    title: "Choosing a Course",
    description: "Listen for choices and reasons.",
    type: "listening",
    level: "A2",
    estimatedMinutes: 7,
    content:
      "The speaker chooses a reading course because the lesson is simple and useful. Listen for the reason and the result.",
    audioText:
      "I have three choices today. I decide to take the reading course because it is simple and useful. After the lesson, I feel more confident.",
    audioUrl: null
  },
  {
    id: "lesson-b1-reading-context",
    title: "Guessing Meaning from Context",
    description: "Use surrounding sentences to understand new vocabulary.",
    type: "reading",
    level: "B1",
    estimatedMinutes: 10,
    content:
      "When you meet an unfamiliar word, do not stop immediately. Read the sentence before it and the sentence after it. The context often gives enough evidence to make an accurate guess.",
    audioText: null,
    audioUrl: null
  },
  {
    id: "lesson-b1-grammar-although",
    title: "Although and Contrast",
    description: "Build contrast sentences with although.",
    type: "grammar",
    level: "B1",
    estimatedMinutes: 9,
    content:
      "Although introduces a surprising contrast. Although the passage is short, it contains useful evidence. Although review feels slow, it improves long-term memory.",
    audioText: null,
    audioUrl: null
  }
];

const exerciseSeed = [
  {
    id: "ex-a1-market-1",
    lessonId: "lesson-a1-reading-market",
    type: "multiple_choice",
    prompt: "What does Li Ming buy at the market?",
    options: ["Apples, water, and a book", "A phone and a desk", "Coffee and shoes", "A ticket"],
    answer: "Apples, water, and a book",
    explanation: "The passage says he buys apples, water, and a small book.",
    level: "A1"
  },
  {
    id: "ex-a1-routine-1",
    lessonId: "lesson-a1-listening-routine",
    type: "multiple_choice",
    prompt: "When does the speaker study English?",
    options: ["In the morning", "At midnight", "Before lunch", "On Sunday only"],
    answer: "In the morning",
    explanation: "The audio text says, 'I study English in the morning.'",
    level: "A1"
  },
  {
    id: "ex-a1-be-1",
    lessonId: "lesson-a1-grammar-be",
    type: "multiple_choice",
    prompt: "Choose the correct sentence.",
    options: ["She is my friend.", "She are my friend.", "I is happy.", "They am at school."],
    answer: "She is my friend.",
    explanation: "Use 'is' with she.",
    level: "A1"
  },
  {
    id: "ex-a1-vocab-1",
    lessonId: null,
    type: "multiple_choice",
    prompt: "Which word means '朋友'?",
    options: ["friend", "school", "water", "book"],
    answer: "friend",
    explanation: "Friend means 朋友.",
    level: "A1"
  },
  {
    id: "ex-a1-vocab-2",
    lessonId: null,
    type: "multiple_choice",
    prompt: "Choose the correct meaning of 'morning'.",
    options: ["早晨", "市场", "朋友", "学校"],
    answer: "早晨",
    explanation: "Morning means 早晨.",
    level: "A1"
  },
  {
    id: "ex-a2-habits-1",
    lessonId: "lesson-a2-reading-habits",
    type: "multiple_choice",
    prompt: "What does the passage recommend?",
    options: ["Small daily habits", "One long session only", "No review", "Only watching videos"],
    answer: "Small daily habits",
    explanation: "The passage says small habits are more useful.",
    level: "A2"
  },
  {
    id: "ex-a2-choice-1",
    lessonId: "lesson-a2-listening-choice",
    type: "multiple_choice",
    prompt: "Why does the speaker choose the reading course?",
    options: ["It is simple and useful", "It is expensive", "It is very long", "It has no practice"],
    answer: "It is simple and useful",
    explanation: "The speaker says the course is simple and useful.",
    level: "A2"
  },
  {
    id: "ex-a2-vocab-1",
    lessonId: null,
    type: "multiple_choice",
    prompt: "Which word means '提高'?",
    options: ["improve", "usual", "choice", "healthy"],
    answer: "improve",
    explanation: "Improve means 提高 or 改善.",
    level: "A2"
  },
  {
    id: "ex-a2-vocab-2",
    lessonId: null,
    type: "multiple_choice",
    prompt: "Which word best completes the sentence: I need to ___ before class.",
    options: ["prepare", "usual", "choice", "healthy"],
    answer: "prepare",
    explanation: "Prepare means to make yourself ready.",
    level: "A2"
  },
  {
    id: "ex-a2-vocab-3",
    lessonId: null,
    type: "multiple_choice",
    prompt: "Which word describes feeling sure about your ability?",
    options: ["confident", "simple", "usual", "healthy"],
    answer: "confident",
    explanation: "Confident means 自信的.",
    level: "A2"
  },
  {
    id: "ex-b1-context-1",
    lessonId: "lesson-b1-reading-context",
    type: "multiple_choice",
    prompt: "What should you read to guess a new word?",
    options: ["The surrounding sentences", "Only the title", "Only the last word", "Nothing else"],
    answer: "The surrounding sentences",
    explanation: "The lesson recommends reading the sentence before and after it.",
    level: "B1"
  },
  {
    id: "ex-b1-although-1",
    lessonId: "lesson-b1-grammar-although",
    type: "multiple_choice",
    prompt: "Choose the best contrast sentence.",
    options: [
      "Although review feels slow, it improves memory.",
      "Although review and memory.",
      "Review although improves slow.",
      "It although memory review."
    ],
    answer: "Although review feels slow, it improves memory.",
    explanation: "This sentence uses although to introduce a contrast.",
    level: "B1"
  },
  {
    id: "ex-b1-vocab-1",
    lessonId: null,
    type: "multiple_choice",
    prompt: "Which word means '证据'?",
    options: ["evidence", "purpose", "context", "available"],
    answer: "evidence",
    explanation: "Evidence means 证据.",
    level: "B1"
  },
  {
    id: "ex-b1-vocab-2",
    lessonId: null,
    type: "multiple_choice",
    prompt: "Which word means '目的'?",
    options: ["purpose", "available", "accurate", "suggest"],
    answer: "purpose",
    explanation: "Purpose means the reason why something is done.",
    level: "B1"
  },
  {
    id: "ex-b1-vocab-3",
    lessonId: null,
    type: "multiple_choice",
    prompt: "Choose the best meaning of 'consistent'.",
    options: ["持续一致的", "可获得的", "准确的", "虽然"],
    answer: "持续一致的",
    explanation: "Consistent means happening in the same way over time.",
    level: "B1"
  }
];

export async function seedDatabase() {
  await runMigrations();

  await db
    .insert(users)
    .values({
      id: "user-demo",
      email: "learner@example.com",
      name: "Demo Learner",
      passwordHash: hashPassword("password123"),
      level: "B1",
      role: "learner",
      createdAt: new Date().toISOString()
    })
    .onConflictDoNothing();

  await seedAdminUser();

  const vocabularyLibrary = await loadVocabularyLibrary();
  for (const batch of chunkArray(vocabularyLibrary, vocabularyUpsertBatchSize)) {
    await db
      .insert(vocabularyItems)
      .values(batch)
      .onConflictDoUpdate({
        target: vocabularyItems.id,
        set: {
          word: sql`excluded.word`,
          phonetic: sql`excluded.phonetic`,
          meaningZh: sql`excluded.meaning_zh`,
          definitionEn: sql`excluded.definition_en`,
          exampleEn: sql`excluded.example_en`,
          exampleZh: sql`excluded.example_zh`,
          level: sql`excluded.level`,
          topic: sql`excluded.topic`
        }
      });
  }

  const sourceIds = new Set(vocabularyLibrary.map((item) => item.id));
  const existingIds = await db.select({ id: vocabularyItems.id }).from(vocabularyItems);
  const staleIds = existingIds.map((item) => item.id).filter((id) => !sourceIds.has(id));
  for (const batch of chunkArray(staleIds, vocabularyDeleteBatchSize)) {
    await db.delete(vocabularyItems).where(inArray(vocabularyItems.id, batch));
  }

  await db.insert(lessons).values(lessonSeed).onConflictDoNothing();
  await db
    .insert(exercises)
    .values(
      exerciseSeed.map((exercise) => ({
        ...exercise,
        options: JSON.stringify(exercise.options)
      }))
    )
    .onConflictDoNothing();
}

async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email && !password) {
    return;
  }

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be provided together.");
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const name = process.env.ADMIN_NAME?.trim() || "Admin";
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        name,
        passwordHash: hashPassword(password),
        role: "admin"
      })
      .where(eq(users.id, existing.id));
    return;
  }

  await db.insert(users).values({
    id: randomUUID(),
    email,
    name,
    passwordHash: hashPassword(password),
    level: null,
    role: "admin",
    createdAt: new Date().toISOString()
  });
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log("Database seeded");
      client.close();
    })
    .catch((error) => {
      console.error(error);
      client.close();
      process.exit(1);
    });
}
