import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

// ==================== USERS ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  userType: mysqlEnum("userType", ["farmer", "agronomist", "consultant"]).default("farmer").notNull(),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 255 }),
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== FIELDS (Campos Agrícolas) ====================
export const fields = mysqlTable("fields", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  areaHectares: int("areaHectares"), // área em hectares * 100 para precisão
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  boundaries: json("boundaries"), // GeoJSON polygon coordinates
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Brasil"),
  soilType: varchar("soilType", { length: 100 }),
  irrigationType: mysqlEnum("irrigationType", ["none", "drip", "sprinkler", "pivot", "flood"]).default("none"),
  agroPolygonId: varchar("agroPolygonId", { length: 64 }), // ID do polígono no Agromonitoring
  currentNdvi: int("currentNdvi"), // NDVI atual * 100 (0-100)
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Field = typeof fields.$inferSelect;
export type InsertField = typeof fields.$inferInsert;

// ==================== CROPS (Cultivos) ====================
export const crops = mysqlTable("crops", {
  id: int("id").autoincrement().primaryKey(),
  fieldId: int("fieldId").notNull(),
  userId: int("userId").notNull(),
  cropType: varchar("cropType", { length: 100 }).notNull(), // soja, milho, trigo, etc.
  variety: varchar("variety", { length: 100 }),
  plantingDate: timestamp("plantingDate"),
  expectedHarvestDate: timestamp("expectedHarvestDate"),
  actualHarvestDate: timestamp("actualHarvestDate"),
  status: mysqlEnum("status", ["planned", "planted", "growing", "harvested", "failed"]).default("planned"),
  areaHectares: int("areaHectares"),
  expectedYield: int("expectedYield"), // kg/hectare esperado
  actualYield: int("actualYield"), // kg/hectare real
  notes: text("notes"),
  season: varchar("season", { length: 20 }), // 2024/2025
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Crop = typeof crops.$inferSelect;
export type InsertCrop = typeof crops.$inferInsert;

// ==================== FIELD NOTES (Notas de Campo) ====================
export const fieldNotes = mysqlTable("fieldNotes", {
  id: int("id").autoincrement().primaryKey(),
  fieldId: int("fieldId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  content: text("content").notNull(),
  noteType: mysqlEnum("noteType", ["observation", "problem", "task", "harvest", "application"]).default("observation"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  photos: json("photos"), // array of photo URLs
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]),
  isResolved: boolean("isResolved").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FieldNote = typeof fieldNotes.$inferSelect;
export type InsertFieldNote = typeof fieldNotes.$inferInsert;

// ==================== WEATHER DATA (Dados Climáticos) ====================
export const weatherData = mysqlTable("weatherData", {
  id: int("id").autoincrement().primaryKey(),
  fieldId: int("fieldId").notNull(),
  date: timestamp("date").notNull(),
  temperatureMin: int("temperatureMin"), // celsius * 10
  temperatureMax: int("temperatureMax"), // celsius * 10
  temperatureAvg: int("temperatureAvg"), // celsius * 10
  humidity: int("humidity"), // percentage
  precipitation: int("precipitation"), // mm * 10
  windSpeed: int("windSpeed"), // km/h * 10
  windDirection: varchar("windDirection", { length: 10 }),
  uvIndex: int("uvIndex"),
  condition: varchar("condition", { length: 50 }), // sunny, cloudy, rainy, etc.
  iconCode: varchar("iconCode", { length: 10 }),
  isForecast: boolean("isForecast").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WeatherData = typeof weatherData.$inferSelect;
export type InsertWeatherData = typeof weatherData.$inferInsert;

// ==================== WEATHER ALERTS (Alertas Climáticos) ====================
export const weatherAlerts = mysqlTable("weatherAlerts", {
  id: int("id").autoincrement().primaryKey(),
  fieldId: int("fieldId").notNull(),
  userId: int("userId").notNull(),
  alertType: mysqlEnum("alertType", ["rain", "frost", "heat", "wind", "drought", "spray_window"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info"),
  isRead: boolean("isRead").default(false),
  isDismissed: boolean("isDismissed").default(false),
  validFrom: timestamp("validFrom"),
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WeatherAlert = typeof weatherAlerts.$inferSelect;
export type InsertWeatherAlert = typeof weatherAlerts.$inferInsert;

// ==================== NDVI DATA (Índices de Vegetação) ====================
export const ndviData = mysqlTable("ndviData", {
  id: int("id").autoincrement().primaryKey(),
  fieldId: int("fieldId").notNull(),
  captureDate: timestamp("captureDate").notNull(),
  ndviAverage: int("ndviAverage"), // NDVI * 1000 (-1000 to 1000)
  ndviMin: int("ndviMin"),
  ndviMax: int("ndviMax"),
  healthStatus: mysqlEnum("healthStatus", ["excellent", "good", "moderate", "poor", "critical"]),
  cloudCoverage: int("cloudCoverage"), // percentage
  imageUrl: text("imageUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  problemAreas: json("problemAreas"), // array of problem zone coordinates
  source: varchar("source", { length: 50 }).default("sentinel-2"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NdviData = typeof ndviData.$inferSelect;
export type InsertNdviData = typeof ndviData.$inferInsert;

// ==================== CROP ROTATION PLANS (Planos de Rotação) ====================
export const cropRotationPlans = mysqlTable("cropRotationPlans", {
  id: int("id").autoincrement().primaryKey(),
  fieldId: int("fieldId").notNull(),
  userId: int("userId").notNull(),
  season: varchar("season", { length: 20 }).notNull(), // 2024/2025
  plannedCrop: varchar("plannedCrop", { length: 100 }).notNull(),
  previousCrop: varchar("previousCrop", { length: 100 }),
  isConfirmed: boolean("isConfirmed").default(false),
  notes: text("notes"),
  suggestedBy: mysqlEnum("suggestedBy", ["user", "system"]).default("user"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CropRotationPlan = typeof cropRotationPlans.$inferSelect;
export type InsertCropRotationPlan = typeof cropRotationPlans.$inferInsert;

// ==================== TASKS (Tarefas) ====================
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  fieldId: int("fieldId"),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: mysqlEnum("taskType", ["planting", "irrigation", "fertilization", "spraying", "harvest", "maintenance", "inspection", "other"]).default("other"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  assignedTo: int("assignedTo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ==================== NOTIFICATIONS (Notificações) ====================
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  notificationType: mysqlEnum("notificationType", ["weather", "task", "ndvi", "system", "crop"]).default("system"),
  relatedFieldId: int("relatedFieldId"),
  isRead: boolean("isRead").default(false),
  actionUrl: varchar("actionUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ==================== OFFLINE SYNC QUEUE (Fila de Sincronização Offline) ====================
export const offlineSyncQueue = mysqlTable("offlineSyncQueue", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(), // field, note, crop, etc.
  entityId: int("entityId"),
  action: mysqlEnum("action", ["create", "update", "delete"]).notNull(),
  payload: json("payload"),
  syncStatus: mysqlEnum("syncStatus", ["pending", "synced", "failed"]).default("pending"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  syncedAt: timestamp("syncedAt"),
});

export type OfflineSyncQueue = typeof offlineSyncQueue.$inferSelect;
export type InsertOfflineSyncQueue = typeof offlineSyncQueue.$inferInsert;
