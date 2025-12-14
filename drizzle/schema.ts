import { integer, pgEnum, pgTable, text, timestamp, varchar, boolean, json, serial } from "drizzle-orm/pg-core";

// ==================== ENUMS ====================
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const userTypeEnum = pgEnum("user_type", ["farmer", "agronomist", "consultant"]);
export const irrigationTypeEnum = pgEnum("irrigation_type", ["none", "drip", "sprinkler", "pivot", "flood"]);
export const cropStatusEnum = pgEnum("crop_status", ["planned", "planted", "growing", "harvested", "failed"]);
export const noteTypeEnum = pgEnum("note_type", ["observation", "problem", "task", "harvest", "application"]);
export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);
export const alertTypeEnum = pgEnum("alert_type", ["rain", "frost", "heat", "wind", "drought", "spray_window"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical"]);
export const healthStatusEnum = pgEnum("health_status", ["excellent", "good", "moderate", "poor", "critical"]);
export const suggestedByEnum = pgEnum("suggested_by", ["user", "system"]);
export const taskTypeEnum = pgEnum("task_type", ["planting", "irrigation", "fertilization", "spraying", "harvest", "maintenance", "inspection", "other"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed", "cancelled"]);
export const notificationTypeEnum = pgEnum("notification_type", ["weather", "task", "ndvi", "system", "crop"]);
export const syncActionEnum = pgEnum("sync_action", ["create", "update", "delete"]);
export const syncStatusEnum = pgEnum("sync_status", ["pending", "synced", "failed"]);
export const permissionEnum = pgEnum("permission", ["view", "edit", "admin"]);
export const platformEnum = pgEnum("platform", ["ios", "android", "web"]);

// ==================== USERS ====================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  userType: userTypeEnum("user_type").default("farmer").notNull(),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 255 }),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
  preferences: json("preferences"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== FARMS (Fazendas/Grupos de Campos) ====================
export const farms = pgTable("farms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Brasil"),
  totalAreaHectares: integer("total_area_hectares"),
  color: varchar("color", { length: 7 }).default("#22C55E"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Farm = typeof farms.$inferSelect;
export type InsertFarm = typeof farms.$inferInsert;

// ==================== FIELDS (Campos Agrícolas) ====================
export const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  farmId: integer("farm_id"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  areaHectares: integer("area_hectares"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  boundaries: json("boundaries"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Brasil"),
  soilType: varchar("soil_type", { length: 100 }),
  irrigationType: irrigationTypeEnum("irrigation_type").default("none"),
  isActive: boolean("is_active").default(true),
  // Agromonitoring integration
  agroPolygonId: varchar("agro_polygon_id", { length: 50 }),
  lastNdviSync: timestamp("last_ndvi_sync"),
  currentNdvi: integer("current_ndvi"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Field = typeof fields.$inferSelect;
export type InsertField = typeof fields.$inferInsert;

// ==================== CROPS (Cultivos) ====================
export const crops = pgTable("crops", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull(),
  userId: integer("user_id").notNull(),
  cropType: varchar("crop_type", { length: 100 }).notNull(),
  variety: varchar("variety", { length: 100 }),
  plantingDate: timestamp("planting_date"),
  expectedHarvestDate: timestamp("expected_harvest_date"),
  actualHarvestDate: timestamp("actual_harvest_date"),
  status: cropStatusEnum("status").default("planned"),
  areaHectares: integer("area_hectares"),
  expectedYield: integer("expected_yield"),
  actualYield: integer("actual_yield"),
  notes: text("notes"),
  season: varchar("season", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Crop = typeof crops.$inferSelect;
export type InsertCrop = typeof crops.$inferInsert;

// ==================== FIELD NOTES (Notas de Campo) ====================
export const fieldNotes = pgTable("field_notes", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull(),
  userId: integer("user_id").notNull(),
  title: varchar("title", { length: 255 }),
  content: text("content").notNull(),
  noteType: noteTypeEnum("note_type").default("observation"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  photos: json("photos"),
  severity: severityEnum("severity"),
  isResolved: boolean("is_resolved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FieldNote = typeof fieldNotes.$inferSelect;
export type InsertFieldNote = typeof fieldNotes.$inferInsert;

// ==================== WEATHER DATA (Dados Climáticos) ====================
export const weatherData = pgTable("weather_data", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull(),
  date: timestamp("date").notNull(),
  temperatureMin: integer("temperature_min"),
  temperatureMax: integer("temperature_max"),
  temperatureAvg: integer("temperature_avg"),
  humidity: integer("humidity"),
  precipitation: integer("precipitation"),
  windSpeed: integer("wind_speed"),
  windDirection: varchar("wind_direction", { length: 10 }),
  uvIndex: integer("uv_index"),
  condition: varchar("condition", { length: 50 }),
  iconCode: varchar("icon_code", { length: 10 }),
  isForecast: boolean("is_forecast").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WeatherData = typeof weatherData.$inferSelect;
export type InsertWeatherData = typeof weatherData.$inferInsert;

// ==================== WEATHER ALERTS (Alertas Climáticos) ====================
export const weatherAlerts = pgTable("weather_alerts", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull(),
  userId: integer("user_id").notNull(),
  alertType: alertTypeEnum("alert_type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  severity: alertSeverityEnum("severity").default("info"),
  isRead: boolean("is_read").default(false),
  isDismissed: boolean("is_dismissed").default(false),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WeatherAlert = typeof weatherAlerts.$inferSelect;
export type InsertWeatherAlert = typeof weatherAlerts.$inferInsert;

// ==================== NDVI DATA (Índices de Vegetação) ====================
export const ndviData = pgTable("ndvi_data", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull(),
  captureDate: timestamp("capture_date").notNull(),
  ndviAverage: integer("ndvi_average"),
  ndviMin: integer("ndvi_min"),
  ndviMax: integer("ndvi_max"),
  healthStatus: healthStatusEnum("health_status"),
  cloudCoverage: integer("cloud_coverage"),
  imageUrl: text("image_url"),
  thumbnailUrl: text("thumbnail_url"),
  problemAreas: json("problem_areas"),
  source: varchar("source", { length: 50 }).default("sentinel-2"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NdviData = typeof ndviData.$inferSelect;
export type InsertNdviData = typeof ndviData.$inferInsert;

// ==================== CROP ROTATION PLANS (Planos de Rotação) ====================
export const cropRotationPlans = pgTable("crop_rotation_plans", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull(),
  userId: integer("user_id").notNull(),
  season: varchar("season", { length: 20 }).notNull(),
  plannedCrop: varchar("planned_crop", { length: 100 }).notNull(),
  previousCrop: varchar("previous_crop", { length: 100 }),
  isConfirmed: boolean("is_confirmed").default(false),
  notes: text("notes"),
  suggestedBy: suggestedByEnum("suggested_by").default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CropRotationPlan = typeof cropRotationPlans.$inferSelect;
export type InsertCropRotationPlan = typeof cropRotationPlans.$inferInsert;

// ==================== TASKS (Tarefas) ====================
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id"),
  userId: integer("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: taskTypeEnum("task_type").default("other"),
  priority: priorityEnum("priority").default("medium"),
  status: taskStatusEnum("status").default("pending"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  assignedTo: integer("assigned_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ==================== NOTIFICATIONS (Notificações) ====================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  notificationType: notificationTypeEnum("notification_type").default("system"),
  relatedFieldId: integer("related_field_id"),
  isRead: boolean("is_read").default(false),
  actionUrl: varchar("action_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ==================== OFFLINE SYNC QUEUE (Fila de Sincronização Offline) ====================
export const offlineSyncQueue = pgTable("offline_sync_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id"),
  action: syncActionEnum("action").notNull(),
  payload: json("payload"),
  syncStatus: syncStatusEnum("sync_status").default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  syncedAt: timestamp("synced_at"),
});

export type OfflineSyncQueue = typeof offlineSyncQueue.$inferSelect;
export type InsertOfflineSyncQueue = typeof offlineSyncQueue.$inferInsert;

// ==================== FIELD SHARES (Compartilhamento de Campos) ====================
export const fieldShares = pgTable("field_shares", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull(),
  ownerUserId: integer("owner_user_id").notNull(),
  sharedWithUserId: integer("shared_with_user_id"),
  sharedWithEmail: varchar("shared_with_email", { length: 320 }),
  permission: permissionEnum("permission").default("view"),
  shareToken: varchar("share_token", { length: 64 }),
  isPublic: boolean("is_public").default(false),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FieldShare = typeof fieldShares.$inferSelect;
export type InsertFieldShare = typeof fieldShares.$inferInsert;

// ==================== PUSH TOKENS (Tokens de Notificação Push) ====================
export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: varchar("token", { length: 500 }).notNull(),
  platform: platformEnum("platform").notNull(),
  deviceName: varchar("device_name", { length: 100 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = typeof pushTokens.$inferInsert;

// ==================== NDVI HISTORY (Histórico de NDVI por Satélite) ====================
export const ndviHistory = pgTable("ndvi_history", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull(),
  userId: integer("user_id").notNull(),
  ndviValue: integer("ndvi_value").notNull(),
  ndviMin: integer("ndvi_min"),
  ndviMax: integer("ndvi_max"),
  cloudCoverage: integer("cloud_coverage"),
  satellite: varchar("satellite", { length: 50 }),
  imageUrl: varchar("image_url", { length: 500 }),
  acquisitionDate: timestamp("acquisition_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NdviHistory = typeof ndviHistory.$inferSelect;
export type InsertNdviHistory = typeof ndviHistory.$inferInsert;

// ==================== CHAT MESSAGES (Mensagens do Chat com Agrônomo IA) ====================
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant", "system"]);

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  fieldId: integer("field_id"),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ==================== PEST ALERTS (Alertas de Pragas) ====================
export const pestRiskLevelEnum = pgEnum("pest_risk_level", ["low", "medium", "high", "critical"]);

export const pestAlerts = pgTable("pest_alerts", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull(),
  userId: integer("user_id").notNull(),
  pestType: varchar("pest_type", { length: 100 }).notNull(),
  pestNamePt: varchar("pest_name_pt", { length: 100 }).notNull(),
  riskLevel: pestRiskLevelEnum("risk_level").notNull(),
  probability: integer("probability").notNull(),
  predictedDate: timestamp("predicted_date").notNull(),
  recommendations: text("recommendations"),
  isRead: boolean("is_read").default(false),
  isDismissed: boolean("is_dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PestAlert = typeof pestAlerts.$inferSelect;
export type InsertPestAlert = typeof pestAlerts.$inferInsert;

// ==================== PUSH SUBSCRIPTIONS (Web Push Subscriptions) ====================
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;
