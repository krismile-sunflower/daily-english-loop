import {
  authResponseSchema,
  authConfigResponseSchema,
  loginInputSchema,
  meResponseSchema,
  registerInputSchema,
  updateMeInputSchema
} from "@english-learning/shared";
import { eq } from "drizzle-orm";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSessionToken, verifySessionToken } from "../auth/session";
import { requireAuth, type AuthVariables } from "../auth/middleware";
import { db } from "../db/client";
import { users } from "../db/schema";
import { getAppSettings, getRegistrationEnabled } from "../services/settings";
import { ApiError, parseJson } from "../utils/http";
import { toPublicUser } from "./helpers";

const cookieOptions = {
  httpOnly: true,
  sameSite: "Lax" as const,
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7
};

export const authRoutes = new Hono<{ Variables: AuthVariables }>();

authRoutes.get("/config", async (c) => {
  return c.json(authConfigResponseSchema.parse(await getAppSettings()));
});

authRoutes.post("/register", async (c) => {
  if (!(await getRegistrationEnabled())) {
    throw new ApiError(403, "REGISTRATION_DISABLED", "Registration is currently disabled.");
  }

  const input = await parseJson(c, registerInputSchema);
  const normalizedEmail = input.email.toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    throw new ApiError(409, "EMAIL_EXISTS", "This email is already registered.");
  }

  const [user] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email: normalizedEmail,
      name: input.name,
      passwordHash: hashPassword(input.password),
      level: null,
      role: "learner",
      createdAt: new Date().toISOString()
    })
    .returning();

  if (!user) {
    throw new ApiError(500, "USER_CREATE_FAILED", "Could not create the user.");
  }

  const token = await createSessionToken(user.id);
  setCookie(c, "session", token, cookieOptions);
  return c.json(authResponseSchema.parse({ user: toPublicUser(user) }), 201);
});

authRoutes.post("/login", async (c) => {
  const input = await parseJson(c, loginInputSchema);
  const [user] = await db.select().from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const token = await createSessionToken(user.id);
  setCookie(c, "session", token, cookieOptions);
  return c.json(authResponseSchema.parse({ user: toPublicUser(user) }));
});

authRoutes.post("/logout", (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const token = getCookie(c, "session");
  if (!token) {
    return c.json(meResponseSchema.parse({ user: null }));
  }

  const userId = await verifySessionToken(token).catch(() => null);
  if (!userId) {
    return c.json(meResponseSchema.parse({ user: null }));
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return c.json(meResponseSchema.parse({ user: user ? toPublicUser(user) : null }));
});

authRoutes.patch("/me", requireAuth, async (c) => {
  const input = await parseJson(c, updateMeInputSchema);
  const [user] = await db
    .update(users)
    .set(input)
    .where(eq(users.id, c.get("userId")))
    .returning();

  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
  }

  return c.json(authResponseSchema.parse({ user: toPublicUser(user) }));
});
