import {
  adminCreateUserInputSchema,
  adminCreateUserResponseSchema,
  adminDeleteUserResponseSchema,
  adminResetUserPasswordInputSchema,
  adminResetUserPasswordResponseSchema,
  adminSettingsResponseSchema,
  adminSummaryResponseSchema,
  adminUpdateSettingsInputSchema,
  adminUpdateUserInputSchema,
  adminUpdateUserResponseSchema,
  adminUsersQuerySchema,
  adminUsersResponseSchema
} from "@english-learning/shared";
import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { requireAdmin, type AuthVariables } from "../auth/middleware";
import { hashPassword } from "../auth/password";
import { db } from "../db/client";
import { dailyProgress, exercises, lessons, users, type UserRow, vocabularyItems } from "../db/schema";
import { getAppSettings, setRegistrationEnabled } from "../services/settings";
import { ApiError, parseJson, todayKey } from "../utils/http";
import { toPublicUser } from "./helpers";

export const adminRoutes = new Hono<{ Variables: AuthVariables }>();

adminRoutes.use("*", requireAdmin);

adminRoutes.get("/settings", async (c) => {
  return c.json(adminSettingsResponseSchema.parse({ settings: await getAppSettings() }));
});

adminRoutes.patch("/settings", async (c) => {
  const input = await parseJson(c, adminUpdateSettingsInputSchema);
  const settings = await setRegistrationEnabled(input.registrationEnabled);
  return c.json(adminSettingsResponseSchema.parse({ settings }));
});

adminRoutes.get("/summary", async (c) => {
  const [userTotal] = await db.select({ value: sql<number>`count(*)` }).from(users);
  const [adminTotal] = await db.select({ value: sql<number>`count(*)` }).from(users).where(eq(users.role, "admin"));
  const [activeToday] = await db
    .select({ value: sql<number>`count(distinct ${dailyProgress.userId})` })
    .from(dailyProgress)
    .where(
      and(
        eq(dailyProgress.date, todayKey()),
        sql`(${dailyProgress.newWords} + ${dailyProgress.reviews} + ${dailyProgress.lessonsCompleted} + ${dailyProgress.exercisesCompleted}) > 0`
      )
    );
  const [vocabularyTotal] = await db.select({ value: sql<number>`count(*)` }).from(vocabularyItems);
  const [lessonTotal] = await db.select({ value: sql<number>`count(*)` }).from(lessons);
  const [exerciseTotal] = await db.select({ value: sql<number>`count(*)` }).from(exercises);
  const recentUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(5);

  return c.json(
    adminSummaryResponseSchema.parse({
      totals: {
        users: toCount(userTotal?.value),
        admins: toCount(adminTotal?.value),
        activeToday: toCount(activeToday?.value),
        vocabularyItems: toCount(vocabularyTotal?.value),
        lessons: toCount(lessonTotal?.value),
        exercises: toCount(exerciseTotal?.value)
      },
      recentUsers: recentUsers.map(toPublicUser)
    })
  );
});

adminRoutes.get("/users", async (c) => {
  const parsed = adminUsersQuerySchema.safeParse({
    q: c.req.query("q") || undefined,
    role: c.req.query("role") || undefined,
    level: c.req.query("level") || undefined,
    page: c.req.query("page"),
    pageSize: c.req.query("pageSize")
  });

  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const { page, pageSize } = parsed.data;
  const filters = userFilters(parsed.data);
  const whereClause = filters.length ? and(...filters) : undefined;
  const [{ value: totalValue } = { value: 0 }] = whereClause
    ? await db.select({ value: sql<number>`count(*)` }).from(users).where(whereClause)
    : await db.select({ value: sql<number>`count(*)` }).from(users);
  const total = toCount(totalValue);
  const offset = (page - 1) * pageSize;
  const rows = whereClause
    ? await db.select().from(users).where(whereClause).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset)
    : await db.select().from(users).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset);

  return c.json(
    adminUsersResponseSchema.parse({
      users: rows.map(toPublicUser),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    })
  );
});

adminRoutes.post("/users", async (c) => {
  const input = await parseJson(c, adminCreateUserInputSchema);
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
      level: input.level ?? null,
      role: "learner",
      createdAt: new Date().toISOString()
    })
    .returning();

  if (!user) {
    throw new ApiError(500, "USER_CREATE_FAILED", "Could not create the user.");
  }

  return c.json(adminCreateUserResponseSchema.parse({ user: toPublicUser(user) }), 201);
});

adminRoutes.patch("/users/:userId", async (c) => {
  const targetUserId = c.req.param("userId");
  const input = await parseJson(c, adminUpdateUserInputSchema);
  const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);

  assertMutableLearner(targetUser);

  const updateValues: Partial<typeof users.$inferInsert> = {};
  if (input.name !== undefined) {
    updateValues.name = input.name;
  }
  if (input.level !== undefined) {
    updateValues.level = input.level;
  }

  const [updatedUser] = await db.update(users).set(updateValues).where(eq(users.id, targetUserId)).returning();
  if (!updatedUser) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
  }

  return c.json(adminUpdateUserResponseSchema.parse({ user: toPublicUser(updatedUser) }));
});

adminRoutes.patch("/users/:userId/password", async (c) => {
  const targetUserId = c.req.param("userId");
  const input = await parseJson(c, adminResetUserPasswordInputSchema);
  const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);

  assertMutableLearner(targetUser);

  const [updatedUser] = await db
    .update(users)
    .set({ passwordHash: hashPassword(input.password) })
    .where(eq(users.id, targetUserId))
    .returning();

  if (!updatedUser) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
  }

  return c.json(adminResetUserPasswordResponseSchema.parse({ user: toPublicUser(updatedUser) }));
});

adminRoutes.delete("/users/:userId", async (c) => {
  const targetUserId = c.req.param("userId");
  const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);

  assertMutableLearner(targetUser);

  await db.delete(users).where(eq(users.id, targetUserId));
  return c.json(adminDeleteUserResponseSchema.parse({ ok: true, userId: targetUserId }));
});

function userFilters(input: { q?: string; role?: string; level?: string }) {
  const filters: SQL[] = [];
  if (input.q) {
    const q = `%${input.q}%`;
    const search = or(like(users.email, q), like(users.name, q));
    if (search) {
      filters.push(search);
    }
  }
  if (input.role) {
    filters.push(eq(users.role, input.role));
  }
  if (input.level) {
    filters.push(eq(users.level, input.level));
  }
  return filters;
}

function toCount(value: unknown) {
  return Number(value ?? 0);
}

function assertMutableLearner(user: UserRow | undefined) {
  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
  }

  if (user.role === "admin") {
    throw new ApiError(400, "ADMIN_ACCOUNT_PROTECTED", "Admin accounts are protected from account management actions.");
  }
}
