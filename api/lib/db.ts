import { eq, and, desc, asc, gte, lte, sql, inArray, isNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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
  InsertFarm, farms, Farm,
  InsertFieldShare, fieldShares, FieldShare,
  InsertPushToken, pushTokens, PushToken,
  InsertNdviHistory, ndviHistory, NdviHistory,
} from "./drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;
let _connectionFailed = false;

// In-memory storage for demo mode when database is unavailable
const demoStorage = {
  users: new Map<string, any>(),
  fields: new Map<number, any>(),
  nextFieldId: 1,
};

export function isDemoMode() {
  return _connectionFailed || !process.env.DATABASE_URL;
}

export async function getDb() {
  if (_connectionFailed) return null;
  
  if (!_db) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.warn("[Database] DATABASE_URL not set - running in demo mode");
      _connectionFailed = true;
      return null;
    }
    try {
      console.log("[Database] Connecting to PostgreSQL...");
      _client = postgres(dbUrl, { 
        connect_timeout: 10,
        idle_timeout: 20,
        max_lifetime: 60 * 30,
      });
      // Test the connection
      await _client`SELECT 1`;
      _db = drizzle(_client);
      console.log("[Database] Connected successfully");
    } catch (error: any) {
      console.error("[Database] Failed to connect:", error?.message || error);
      _connectionFailed = true;
      _db = null;
    }
  }
  return _db;
}

// Demo mode helpers
export function getDemoUser(openId: string) {
  return demoStorage.users.get(openId);
}

export function setDemoUser(openId: string, user: any) {
  demoStorage.users.set(openId, user);
}

export function getDemoFields(userId: number) {
  return Array.from(demoStorage.fields.values()).filter(f => f.userId === userId && f.isActive !== false);
}

export function createDemoField(field: any): number {
  const id = demoStorage.nextFieldId++;
  demoStorage.fields.set(id, { ...field, id, createdAt: new Date(), updatedAt: new Date(), isActive: true });
  return id;
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

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
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

export async function updateUserProfile(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ==================== FIELD FUNCTIONS ====================
export async function createField(field: InsertField): Promise<number> {
  const db = await getDb();
  if (!db) {
    // Demo mode: store in memory
    console.log("[createField] Demo mode - storing in memory");
    return createDemoField(field);
  }
  try {
    console.log("[createField] Creating field:", JSON.stringify(field));
    const result = await db.insert(fields).values(field).returning({ id: fields.id });
    console.log("[createField] Field created with id:", result[0].id);
    return result[0].id;
  } catch (error) {
    console.error("[createField] Error:", error);
    throw error;
  }
}

export async function getFieldById(id: number): Promise<Field | undefined> {
  const db = await getDb();
  if (!db) {
    // Demo mode
    const demoField = Array.from((globalThis as any).__demoFields?.values() || []).find((f: any) => f.id === id);
    return demoField as Field | undefined;
  }
  const result = await db.select().from(fields).where(eq(fields.id, id)).limit(1);
  return result[0];
}

export async function getFieldsByUserId(userId: number): Promise<Field[]> {
  const db = await getDb();
  if (!db) {
    // Demo mode: return from memory
    console.log("[getFieldsByUserId] Demo mode - returning from memory");
    return getDemoFields(userId) as Field[];
  }
  try {
    console.log("[getFieldsByUserId] Fetching fields for user:", userId);
    const result = await db.select().from(fields).where(and(eq(fields.userId, userId), eq(fields.isActive, true))).orderBy(desc(fields.createdAt));
    console.log("[getFieldsByUserId] Found", result.length, "fields");
    return result;
  } catch (error) {
    console.error("[getFieldsByUserId] Error:", error);
    return [];
  }
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
  const result = await db.insert(crops).values(crop).returning({ id: crops.id });
  return result[0].id;
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

export async function getCropById(id: number): Promise<Crop | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(crops).where(eq(crops.id, id)).limit(1);
  return result[0];
}

// ==================== FIELD NOTES FUNCTIONS ====================
export async function createFieldNote(note: InsertFieldNote): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fieldNotes).values(note).returning({ id: fieldNotes.id });
  return result[0].id;
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

export async function getFieldNoteById(id: number): Promise<FieldNote | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fieldNotes).where(eq(fieldNotes.id, id)).limit(1);
  return result[0];
}

// ==================== WEATHER FUNCTIONS ====================
export async function createWeatherData(data: InsertWeatherData): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(weatherData).values(data).returning({ id: weatherData.id });
  return result[0].id;
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
  const result = await db.insert(weatherAlerts).values(alert).returning({ id: weatherAlerts.id });
  return result[0].id;
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
  const result = await db.insert(ndviData).values(data).returning({ id: ndviData.id });
  return result[0].id;
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
  const result = await db.insert(cropRotationPlans).values(plan).returning({ id: cropRotationPlans.id });
  return result[0].id;
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

export async function getCropRotationPlanById(id: number): Promise<CropRotationPlan | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cropRotationPlans).where(eq(cropRotationPlans.id, id)).limit(1);
  return result[0];
}

// ==================== TASK FUNCTIONS ====================
export async function createTask(task: InsertTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(task).returning({ id: tasks.id });
  return result[0].id;
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

export async function getTaskById(id: number): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0];
}

// ==================== NOTIFICATION FUNCTIONS ====================
export async function createNotification(notification: InsertNotification): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(notification).returning({ id: notifications.id });
  return result[0].id;
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

// ==================== FARM FUNCTIONS ====================
export async function createFarm(farm: InsertFarm): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(farms).values(farm).returning({ id: farms.id });
  return result[0].id;
}

export async function getFarmById(id: number): Promise<Farm | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(farms).where(eq(farms.id, id)).limit(1);
  return result[0];
}

export async function getFarmsByUserId(userId: number): Promise<Farm[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(farms).where(eq(farms.userId, userId)).orderBy(asc(farms.name));
}

export async function updateFarm(id: number, data: Partial<InsertFarm>) {
  const db = await getDb();
  if (!db) return;
  await db.update(farms).set(data).where(eq(farms.id, id));
}

export async function deleteFarm(id: number) {
  const db = await getDb();
  if (!db) return;
  // Remove farm reference from fields but don't delete them
  await db.update(fields).set({ farmId: null }).where(eq(fields.farmId, id));
  await db.delete(farms).where(eq(farms.id, id));
}

export async function getFieldsByFarmId(farmId: number): Promise<Field[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fields).where(and(eq(fields.farmId, farmId), eq(fields.isActive, true))).orderBy(asc(fields.name));
}

export async function assignFieldToFarm(fieldId: number, farmId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(fields).set({ farmId }).where(eq(fields.id, fieldId));
}

// ==================== FIELD SHARE FUNCTIONS ====================
export async function createFieldShare(share: InsertFieldShare): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fieldShares).values(share).returning({ id: fieldShares.id });
  return result[0].id;
}

export async function getFieldSharesByFieldId(fieldId: number): Promise<FieldShare[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fieldShares).where(eq(fieldShares.fieldId, fieldId)).orderBy(desc(fieldShares.createdAt));
}

export async function getFieldSharesByUserId(userId: number): Promise<FieldShare[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fieldShares).where(eq(fieldShares.sharedWithUserId, userId)).orderBy(desc(fieldShares.createdAt));
}

export async function getFieldShareByToken(token: string): Promise<FieldShare | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fieldShares).where(eq(fieldShares.shareToken, token)).limit(1);
  return result[0];
}

export async function acceptFieldShare(shareId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(fieldShares).set({ sharedWithUserId: userId, acceptedAt: new Date() }).where(eq(fieldShares.id, shareId));
}

export async function deleteFieldShare(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(fieldShares).where(eq(fieldShares.id, id));
}

export async function getSharedFieldsForUser(userId: number): Promise<Field[]> {
  const db = await getDb();
  if (!db) return [];
  const shares = await db.select().from(fieldShares).where(eq(fieldShares.sharedWithUserId, userId));
  if (shares.length === 0) return [];
  const fieldIds = shares.map(s => s.fieldId);
  return await db.select().from(fields).where(inArray(fields.id, fieldIds));
}

// ==================== PUSH TOKEN FUNCTIONS ====================
export async function savePushToken(token: InsertPushToken): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if token exists, update or insert
  const existing = await db.select().from(pushTokens).where(eq(pushTokens.token, token.token)).limit(1);
  if (existing.length > 0) {
    await db.update(pushTokens).set({ isActive: true, updatedAt: new Date() }).where(eq(pushTokens.id, existing[0].id));
    return existing[0].id;
  }
  
  const result = await db.insert(pushTokens).values(token).returning({ id: pushTokens.id });
  return result[0].id;
}

export async function getPushTokensByUserId(userId: number): Promise<PushToken[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)));
}

export async function deactivatePushToken(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(pushTokens).set({ isActive: false }).where(eq(pushTokens.token, token));
}

// ==================== NDVI HISTORY FUNCTIONS ====================
export async function createNdviHistory(data: InsertNdviHistory): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ndviHistory).values(data).returning({ id: ndviHistory.id });
  return result[0].id;
}

export async function getNdviHistoryByFieldId(fieldId: number, days: number = 30): Promise<NdviHistory[]> {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return await db.select().from(ndviHistory)
    .where(and(eq(ndviHistory.fieldId, fieldId), gte(ndviHistory.acquisitionDate, startDate)))
    .orderBy(desc(ndviHistory.acquisitionDate));
}

export async function getLatestNdviHistoryByFieldId(fieldId: number): Promise<NdviHistory | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ndviHistory)
    .where(eq(ndviHistory.fieldId, fieldId))
    .orderBy(desc(ndviHistory.acquisitionDate))
    .limit(1);
  return result[0];
}

export async function updateFieldNdvi(fieldId: number, ndviValue: number, polygonId?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updateData: Partial<Field> = {
    currentNdvi: ndviValue,
    lastNdviSync: new Date(),
  };
  if (polygonId) {
    updateData.agroPolygonId = polygonId;
  }
  await db.update(fields).set(updateData).where(eq(fields.id, fieldId));
}

export async function updateFieldAgroPolygonId(fieldId: number, polygonId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(fields).set({ agroPolygonId: polygonId }).where(eq(fields.id, fieldId));
}
