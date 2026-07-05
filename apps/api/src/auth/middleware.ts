import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { db } from "../db/client";
import { users, type UserRow } from "../db/schema";
import { verifySessionToken } from "./session";
import { ApiError } from "../utils/http";

export type AuthVariables = {
  user: UserRow;
  userId: string;
};

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const token = getCookie(c, "session");
  if (!token) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please log in first.");
  }

  const userId = await verifySessionToken(token);
  if (!userId) {
    throw new ApiError(401, "UNAUTHENTICATED", "Your session is invalid or expired.");
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "The session user no longer exists.");
  }

  c.set("user", user);
  c.set("userId", user.id);
  await next();
});
