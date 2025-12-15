import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  InsertField, fields, Field,
  InsertCrop, crops, Crop,
  InsertFieldNote, fieldNotes, FieldNote,
  InsertWeatherData, weatherData, WeatherData,
  InsertWeatherAlert, weatherAlerts, WeatherAlert,
  InsertNdviData, ndviData, NdviData,
  InsertCropRotationPlan, cropRotationPlans, CropRotationPlan,
  InsertTask, tasks, Task,
  InsertNotification, notifications, Notification,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER FUNCTIONS ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "phone", "company", "avatarUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.userType !== undefined) {
      values.userType = user.userType;
      updateSet.userType = user.userType;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByDeviceId(deviceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const result = await db.select().from(users).where(eq(users.deviceId, deviceId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    // Column may not exist yet
    console.warn("[Database] getUserByDeviceId failed (column may not exist):", error);
    return undefined;
  }
}

export async function createGuestUser(deviceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const openId = `guest_${deviceId}`;
  try {
    await db.insert(users).values({
      openId,
      deviceId,
      isGuest: true,
      name: "Visitante",
      plan: "free",
      maxFields: 1, // Guests can only create 1 field
    });
  } catch (error) {
    // New columns may not exist, try without them
    console.warn("[Database] createGuestUser failed with new columns, trying basic insert:", error);
    await db.insert(users).values({
      openId,
      name: "Visitante",
    });
  }
  
  return await getUserByOpenId(openId);
}

export async function createUserWithPassword(email: string, passwordHash: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const openId = `local_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  try {
    await db.insert(users).values({
      openId,
      email: email.toLowerCase(),
      passwordHash,
      name,
      loginMethod: "email",
      isGuest: false,
      plan: "free",
      maxFields: 5,
    });
  } catch (error) {
    // New columns may not exist, try without them
    console.warn("[Database] createUserWithPassword failed with new columns, trying basic insert:", error);
    await db.insert(users).values({
      openId,
      email: email.toLowerCase(),
      name,
      loginMethod: "email",
    });
  }
  
  return await getUserByOpenId(openId);
}

export async function upgradeGuestToUser(guestId: number, email: string, passwordHash: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const openId = `local_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  await db.update(users).set({
    openId,
    email: email.toLowerCase(),
    passwordHash,
    name,
    loginMethod: "email",
    isGuest: false,
    maxFields: 5, // Upgrade to 5 fields
  }).where(eq(users.id, guestId));
  
  return await getUserById(guestId);
}

export async function countUserFields(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(fields)
    .where(and(eq(fields.userId, userId), eq(fields.isActive, true)));
  return result[0]?.count || 0;
}

export async function updateUserProfile(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ==================== FIELD FUNCTIONS ====================
export async function createField(field: InsertField): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fields).values(field);
  return result[0].insertId;
}

export async function getFieldById(id: number): Promise<Field | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fields).where(eq(fields.id, id)).limit(1);
  return result[0];
}

export async function getFieldsByUserId(userId: number): Promise<Field[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fields).where(and(eq(fields.userId, userId), eq(fields.isActive, true))).orderBy(desc(fields.createdAt));
}

export async function updateField(id: number, data: Partial<InsertField>) {
  const db = await getDb();
  if (!db) return;
  await db.update(fields).set(data).where(eq(fields.id, id));
}

export async function deleteField(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(fields).set({ isActive: false }).where(eq(fields.id, id));
}

// ==================== CROP FUNCTIONS ====================
export async function createCrop(crop: InsertCrop): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(crops).values(crop);
  return result[0].insertId;
}

export async function getCropsByFieldId(fieldId: number): Promise<Crop[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(crops).where(eq(crops.fieldId, fieldId)).orderBy(desc(crops.plantingDate));
}

export async function getCropsByUserId(userId: number): Promise<Crop[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(crops).where(eq(crops.userId, userId)).orderBy(desc(crops.plantingDate));
}

export async function updateCrop(id: number, data: Partial<InsertCrop>) {
  const db = await getDb();
  if (!db) return;
  await db.update(crops).set(data).where(eq(crops.id, id));
}

export async function deleteCrop(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(crops).where(eq(crops.id, id));
}

// ==================== FIELD NOTES FUNCTIONS ====================
export async function createFieldNote(note: InsertFieldNote): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fieldNotes).values(note);
  return result[0].insertId;
}

export async function getFieldNotesByFieldId(fieldId: number): Promise<FieldNote[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fieldNotes).where(eq(fieldNotes.fieldId, fieldId)).orderBy(desc(fieldNotes.createdAt));
}

export async function getFieldNotesByUserId(userId: number): Promise<FieldNote[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fieldNotes).where(eq(fieldNotes.userId, userId)).orderBy(desc(fieldNotes.createdAt));
}

export async function updateFieldNote(id: number, data: Partial<InsertFieldNote>) {
  const db = await getDb();
  if (!db) return;
  await db.update(fieldNotes).set(data).where(eq(fieldNotes.id, id));
}

export async function deleteFieldNote(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(fieldNotes).where(eq(fieldNotes.id, id));
}

// ==================== WEATHER FUNCTIONS ====================
export async function createWeatherData(data: InsertWeatherData): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(weatherData).values(data);
  return result[0].insertId;
}

export async function getWeatherByFieldId(fieldId: number, days: number = 5): Promise<WeatherData[]> {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);
  return await db.select().from(weatherData)
    .where(and(eq(weatherData.fieldId, fieldId), gte(weatherData.date, startDate)))
    .orderBy(asc(weatherData.date))
    .limit(days + 1);
}

export async function createWeatherAlert(alert: InsertWeatherAlert): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(weatherAlerts).values(alert);
  return result[0].insertId;
}

export async function getWeatherAlertsByUserId(userId: number): Promise<WeatherAlert[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(weatherAlerts)
    .where(and(eq(weatherAlerts.userId, userId), eq(weatherAlerts.isDismissed, false)))
    .orderBy(desc(weatherAlerts.createdAt));
}

export async function dismissWeatherAlert(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(weatherAlerts).set({ isDismissed: true }).where(eq(weatherAlerts.id, id));
}

// ==================== NDVI FUNCTIONS ====================
export async function createNdviData(data: InsertNdviData): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ndviData).values(data);
  return result[0].insertId;
}

export async function getNdviByFieldId(fieldId: number, limit: number = 10): Promise<NdviData[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(ndviData)
    .where(eq(ndviData.fieldId, fieldId))
    .orderBy(desc(ndviData.captureDate))
    .limit(limit);
}

export async function getLatestNdviByFieldId(fieldId: number): Promise<NdviData | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ndviData)
    .where(eq(ndviData.fieldId, fieldId))
    .orderBy(desc(ndviData.captureDate))
    .limit(1);
  return result[0];
}

// ==================== CROP ROTATION FUNCTIONS ====================
export async function createCropRotationPlan(plan: InsertCropRotationPlan): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cropRotationPlans).values(plan);
  return result[0].insertId;
}

export async function getCropRotationByFieldId(fieldId: number): Promise<CropRotationPlan[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cropRotationPlans)
    .where(eq(cropRotationPlans.fieldId, fieldId))
    .orderBy(desc(cropRotationPlans.season));
}

export async function updateCropRotationPlan(id: number, data: Partial<InsertCropRotationPlan>) {
  const db = await getDb();
  if (!db) return;
  await db.update(cropRotationPlans).set(data).where(eq(cropRotationPlans.id, id));
}

// ==================== TASK FUNCTIONS ====================
export async function createTask(task: InsertTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(task);
  return result[0].insertId;
}

export async function getTasksByUserId(userId: number): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(asc(tasks.dueDate));
}

export async function getPendingTasksByUserId(userId: number): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "pending")))
    .orderBy(asc(tasks.dueDate));
}

export async function updateTask(id: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(eq(tasks.id, id));
}

// ==================== NOTIFICATION FUNCTIONS ====================
export async function createNotification(notification: InsertNotification): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(notification);
  return result[0].insertId;
}

export async function getNotificationsByUserId(userId: number, limit: number = 20): Promise<Notification[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

// ==================== DASHBOARD STATS ====================
export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalFields: 0, activeCrops: 0, pendingTasks: 0, unreadAlerts: 0 };

  const [fieldsResult, cropsResult, tasksResult, alertsResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(fields)
      .where(and(eq(fields.userId, userId), eq(fields.isActive, true))),
    db.select({ count: sql<number>`count(*)` }).from(crops)
      .where(and(eq(crops.userId, userId), eq(crops.status, "growing"))),
    db.select({ count: sql<number>`count(*)` }).from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, "pending"))),
    db.select({ count: sql<number>`count(*)` }).from(weatherAlerts)
      .where(and(eq(weatherAlerts.userId, userId), eq(weatherAlerts.isRead, false), eq(weatherAlerts.isDismissed, false))),
  ]);

  return {
    totalFields: fieldsResult[0]?.count ?? 0,
    activeCrops: cropsResult[0]?.count ?? 0,
    pendingTasks: tasksResult[0]?.count ?? 0,
    unreadAlerts: alertsResult[0]?.count ?? 0,
  };
}
