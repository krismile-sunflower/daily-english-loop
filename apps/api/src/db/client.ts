import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

const defaultDbPath = resolve(process.cwd(), "../../.data/local.db");
const databaseUrl = process.env.DATABASE_URL ?? `file:${defaultDbPath}`;

if (databaseUrl.startsWith("file:")) {
  const filePath = databaseUrl.replace(/^file:/, "");
  if (filePath && filePath !== ":memory:") {
    mkdirSync(dirname(resolve(filePath)), { recursive: true });
  }
}

export const client = createClient({
  url: databaseUrl
});

export const db = drizzle(client, { schema });
