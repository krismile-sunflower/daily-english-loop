import { client } from "./client";
import { runMigrations } from "./migrate";
import { seedDatabase } from "./seed";

const tables = [
  "user_lesson_progress",
  "daily_progress",
  "user_exercise_attempts",
  "exercises",
  "lessons",
  "user_vocabulary_progress",
  "vocabulary_items",
  "users"
];

export async function resetDatabase() {
  await client.execute("PRAGMA foreign_keys = OFF");
  for (const table of tables) {
    await client.execute(`DROP TABLE IF EXISTS ${table}`);
  }
  await client.execute("PRAGMA foreign_keys = ON");
  await runMigrations();
  await seedDatabase();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase()
    .then(() => {
      console.log("Database reset and seeded");
      client.close();
    })
    .catch((error) => {
      console.error(error);
      client.close();
      process.exit(1);
    });
}
