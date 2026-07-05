import { client } from "./client";

const statements = [
  `PRAGMA foreign_keys = ON`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    level TEXT,
    role TEXT NOT NULL DEFAULT 'learner',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS vocabulary_items (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    phonetic TEXT NOT NULL,
    meaning_zh TEXT NOT NULL,
    definition_en TEXT NOT NULL,
    example_en TEXT NOT NULL,
    example_zh TEXT NOT NULL,
    level TEXT NOT NULL,
    topic TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vocabulary_items_word_level_idx ON vocabulary_items (word, level)`,
  `CREATE INDEX IF NOT EXISTS vocabulary_items_level_idx ON vocabulary_items (level)`,
  `CREATE TABLE IF NOT EXISTS user_vocabulary_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vocabulary_item_id TEXT NOT NULL REFERENCES vocabulary_items(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'new',
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    due_at TEXT,
    last_reviewed_at TEXT,
    review_count INTEGER NOT NULL DEFAULT 0,
    learned_at TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS user_vocabulary_progress_user_item_idx ON user_vocabulary_progress (user_id, vocabulary_item_id)`,
  `CREATE INDEX IF NOT EXISTS user_vocabulary_progress_due_idx ON user_vocabulary_progress (user_id, due_at)`,
  `CREATE TABLE IF NOT EXISTS vocabulary_pronunciations (
    id TEXT PRIMARY KEY,
    vocabulary_item_id TEXT NOT NULL REFERENCES vocabulary_items(id) ON DELETE CASCADE,
    audio_url TEXT,
    source TEXT,
    source_url TEXT,
    accent TEXT,
    resolved_at TEXT,
    missing_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vocabulary_pronunciations_vocabulary_item_idx ON vocabulary_pronunciations (vocabulary_item_id)`,
  `CREATE TABLE IF NOT EXISTS vocabulary_examples (
    id TEXT PRIMARY KEY,
    vocabulary_item_id TEXT NOT NULL REFERENCES vocabulary_items(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    translation_zh TEXT NOT NULL,
    sentence_id INTEGER,
    translation_id INTEGER,
    owner TEXT,
    translation_owner TEXT,
    license TEXT,
    source_url TEXT,
    audio_url TEXT,
    audio_resolved_at TEXT,
    audio_missing_at TEXT,
    resolved_at TEXT,
    missing_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS vocabulary_examples_vocabulary_item_idx ON vocabulary_examples (vocabulary_item_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vocabulary_examples_vocabulary_sentence_idx ON vocabulary_examples (vocabulary_item_id, sentence_id)`,
  `CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    level TEXT NOT NULL,
    content TEXT NOT NULL,
    audio_text TEXT,
    audio_url TEXT,
    estimated_minutes INTEGER NOT NULL DEFAULT 8,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS lessons_level_type_idx ON lessons (level, type)`,
  `CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options TEXT NOT NULL,
    answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    level TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS exercises_level_idx ON exercises (level)`,
  `CREATE INDEX IF NOT EXISTS exercises_lesson_idx ON exercises (lesson_id)`,
  `CREATE TABLE IF NOT EXISTS user_exercise_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS user_exercise_attempts_user_idx ON user_exercise_attempts (user_id)`,
  `CREATE TABLE IF NOT EXISTS daily_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    new_words INTEGER NOT NULL DEFAULT 0,
    reviews INTEGER NOT NULL DEFAULT 0,
    lessons_completed INTEGER NOT NULL DEFAULT 0,
    exercises_completed INTEGER NOT NULL DEFAULT 0,
    minutes_studied INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS daily_progress_user_date_idx ON daily_progress (user_id, date)`,
  `CREATE TABLE IF NOT EXISTS user_lesson_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS user_lesson_progress_user_lesson_idx ON user_lesson_progress (user_id, lesson_id)`
];

const additiveStatements = [
  `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'learner'`,
  `ALTER TABLE vocabulary_examples ADD COLUMN audio_url TEXT`,
  `ALTER TABLE vocabulary_examples ADD COLUMN audio_resolved_at TEXT`,
  `ALTER TABLE vocabulary_examples ADD COLUMN audio_missing_at TEXT`
];

export async function runMigrations() {
  for (const statement of statements) {
    await client.execute(statement);
  }

  for (const statement of additiveStatements) {
    try {
      await client.execute(statement);
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        throw error;
      }
    }
  }
}

function isDuplicateColumnError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("duplicate column");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log("Database migrated");
      client.close();
    })
    .catch((error) => {
      console.error(error);
      client.close();
      process.exit(1);
    });
}
