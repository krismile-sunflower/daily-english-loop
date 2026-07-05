import { cors } from "hono/cors";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthVariables } from "./auth/middleware";
import { authRoutes } from "./routes/auth";
import { lessonRoutes } from "./routes/lessons";
import { practiceRoutes } from "./routes/practice";
import { progressRoutes } from "./routes/progress";
import { vocabularyRoutes } from "./routes/vocabulary";
import { ApiError } from "./utils/http";

export const app = new Hono<{ Variables: AuthVariables }>();

const allowedOrigins = [
  process.env.WEB_ORIGIN ?? "http://localhost:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return allowedOrigins[0] ?? "http://localhost:5173";
      }
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "http://localhost:5173";
    },
    credentials: true
  })
);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);
app.route("/api/vocabulary", vocabularyRoutes);
app.route("/api/lessons", lessonRoutes);
app.route("/api/practice", practiceRoutes);
app.route("/api/progress", progressRoutes);

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404));

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: { code: error.code, message: error.message } }, error.status);
  }

  if (error instanceof HTTPException) {
    return c.json({ error: { code: "HTTP_ERROR", message: error.message } }, error.status);
  }

  console.error(error);
  return c.json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected server error." } }, 500);
});
