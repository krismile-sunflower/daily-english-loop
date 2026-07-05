import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { systemSettings } from "../db/schema";

const registrationEnabledKey = "registration_enabled";

export type AppSettings = {
  registrationEnabled: boolean;
};

export async function getAppSettings(): Promise<AppSettings> {
  return {
    registrationEnabled: await getRegistrationEnabled()
  };
}

export async function getRegistrationEnabled() {
  const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, registrationEnabledKey)).limit(1);
  return setting?.value === "true";
}

export async function setRegistrationEnabled(registrationEnabled: boolean) {
  const now = new Date().toISOString();
  await db
    .insert(systemSettings)
    .values({
      key: registrationEnabledKey,
      value: String(registrationEnabled),
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: String(registrationEnabled),
        updatedAt: now
      }
    });

  return getAppSettings();
}
