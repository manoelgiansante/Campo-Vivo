import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, and } from "drizzle-orm";
import { pgTable, serial, varchar, text, timestamp, integer, json, boolean } from "drizzle-orm/pg-core";

// Simple hash function for passwords (in production use bcrypt)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ==================== SCHEMA ====================
// Use varchar instead of pgEnum to avoid issues with missing enum types in database
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  userType: varchar("userType", { length: 30 }).default("farmer").notNull(),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 255 }),
  avatarUrl: text("avatarUrl"),
  plan: varchar("plan", { length: 20 }).default("free"),
  maxFields: integer("maxFields").default(5),
  isGuest: boolean("isGuest").default(false),
  deviceId: varchar("deviceId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  areaHectares: integer("areaHectares"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  boundaries: json("boundaries"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Brasil"),
  soilType: varchar("soilType", { length: 100 }),
  irrigationType: varchar("irrigationType", { length: 50 }),
  isActive: boolean("isActive").default(true),
  agroPolygonId: varchar("agroPolygonId", { length: 64 }),
  currentNdvi: integer("currentNdvi"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Notification history
const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data"),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Crops (Culturas)
const crops = pgTable("crops", {
  id: serial("id").primaryKey(),
  fieldId: integer("fieldId").notNull(),
  userId: integer("userId").notNull(),
  cropType: varchar("cropType", { length: 100 }).notNull(), // soja, milho, trigo, etc.
  variety: varchar("variety", { length: 100 }),
  plantingDate: timestamp("plantingDate"),
  expectedHarvestDate: timestamp("expectedHarvestDate"),
  actualHarvestDate: timestamp("actualHarvestDate"),
  status: varchar("status", { length: 50 }).default("planned"), // planned, planted, growing, harvested, failed
  areaHectares: integer("areaHectares"),
  expectedYield: integer("expectedYield"), // kg/hectare esperado
  actualYield: integer("actualYield"), // kg/hectare real
  notes: text("notes"),
  season: varchar("season", { length: 20 }), // 2024/2025
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

type User = typeof users.$inferSelect;
type Field = typeof fields.$inferSelect;
type Crop = typeof crops.$inferSelect;

// ==================== DATABASE ====================
let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!db) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error("[DB] DATABASE_URL environment variable is not set!");
      throw new Error("DATABASE_URL not set - check Vercel environment variables");
    }
    console.log("[DB] Connecting to database...");
    try {
      client = postgres(dbUrl);
      db = drizzle(client);
      console.log("[DB] Database connected successfully");
      
      // Auto-create crops table if it doesn't exist
      try {
        await client`
          CREATE TABLE IF NOT EXISTS "crops" (
            "id" SERIAL PRIMARY KEY,
            "fieldId" INTEGER NOT NULL,
            "userId" INTEGER NOT NULL,
            "cropType" VARCHAR(100) NOT NULL,
            "variety" VARCHAR(100),
            "plantingDate" TIMESTAMP,
            "expectedHarvestDate" TIMESTAMP,
            "actualHarvestDate" TIMESTAMP,
            "status" VARCHAR(50) DEFAULT 'planned',
            "areaHectares" INTEGER,
            "expectedYield" INTEGER,
            "actualYield" INTEGER,
            "notes" TEXT,
            "season" VARCHAR(20),
            "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
            "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
          )
        `;
        console.log("[DB] Crops table ensured");
      } catch (e) {
        console.log("[DB] Crops table check:", e);
      }
    } catch (err) {
      console.error("[DB] Failed to connect to database:", err);
      throw err;
    }
  }
  return db;
}

// ==================== tRPC ====================
import superjson from "superjson";

const t = initTRPC.context<{ user: User | null }>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) throw new Error("Not authenticated");
  return next({ ctx: { user: ctx.user } });
});

const appRouter = t.router({
  auth: t.router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    
    signup: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
        phone: z.string().optional(),
        company: z.string().optional(),
        userType: z.enum(["farmer", "agronomist", "consultant"]).default("farmer"),
      }))
      .mutation(async ({ input }) => {
        console.log("[Signup] Starting signup for:", input.email);
        const database = await getDb();
        
        // Check if email already exists
        console.log("[Signup] Checking if email exists...");
        const [existing] = await database.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing) {
          console.log("[Signup] Email already exists");
          throw new Error("Email já cadastrado");
        }
        
        // Create user
        const hashedPassword = simpleHash(input.password);
        const openId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log("[Signup] Creating user with openId:", openId);
        try {
          const [newUser] = await database.insert(users).values({
            openId,
            name: input.name,
            email: input.email,
            passwordHash: hashedPassword,
            phone: input.phone,
            company: input.company,
            userType: input.userType,
            loginMethod: "email",
          }).returning();
          
          console.log("[Signup] User created successfully with id:", newUser.id);
          
          return {
            user: {
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              userType: newUser.userType,
            },
          };
        } catch (dbError: any) {
          console.error("[Signup] Database error:", dbError.message || dbError);
          throw new Error("Erro ao criar conta: " + (dbError.message || "erro desconhecido"));
        }
      }),
    
    login: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1, "Senha obrigatória"),
      }))
      .mutation(async ({ input }) => {
        console.log("[Login] Attempting login for:", input.email);
        const database = await getDb();
        
        // Find user by email
        console.log("[Login] Searching for user...");
        const [user] = await database.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (!user) {
          console.log("[Login] User not found");
          throw new Error("Email ou senha incorretos");
        }
        console.log("[Login] User found with id:", user.id);
        
        // Check password
        const hashedPassword = simpleHash(input.password);
        if (user.passwordHash !== hashedPassword) {
          console.log("[Login] Password mismatch");
          throw new Error("Email ou senha incorretos");
        }
        
        // Update last signed in
        await database.update(users)
          .set({ lastSignedIn: new Date() })
          .where(eq(users.id, user.id));
        
        console.log("[Login] Login successful for user:", user.id);
        return {
          user: {
            id: user.id,
            openId: user.openId,
            name: user.name,
            email: user.email,
            userType: user.userType,
            phone: user.phone,
            company: user.company,
          },
        };
      }),
      
    logout: publicProcedure.mutation(async () => {
      return { success: true };
    }),
    
    // Register (alias for signup - used by client)
    register: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
        phone: z.string().optional(),
        company: z.string().optional(),
        userType: z.enum(["farmer", "agronomist", "consultant"]).default("farmer"),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        
        // Check if email already exists
        const [existing] = await database.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing) {
          throw new Error("Email já cadastrado");
        }
        
        // Create user
        const hashedPassword = simpleHash(input.password);
        const openId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const [newUser] = await database.insert(users).values({
          openId,
          name: input.name,
          email: input.email,
          passwordHash: hashedPassword,
          phone: input.phone,
          company: input.company,
          userType: input.userType,
          loginMethod: "email",
        }).returning();
        
        return {
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            userType: newUser.userType,
          },
        };
      }),
    
    // Get or create guest user for anonymous access
    getOrCreateGuest: publicProcedure
      .input(z.object({
        deviceId: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        
        // Check if guest user exists for this device
        const [existing] = await database.select().from(users)
          .where(eq(users.deviceId, input.deviceId))
          .limit(1);
        
        if (existing) {
          // Update last signed in
          await database.update(users)
            .set({ lastSignedIn: new Date() })
            .where(eq(users.id, existing.id));
          
          return {
            success: true,
            isNew: false,
            user: {
              id: existing.id,
              openId: existing.openId,
              name: existing.name,
              isGuest: existing.isGuest,
              maxFields: existing.maxFields,
              plan: existing.plan,
            },
          };
        }
        
        // Create new guest user
        const openId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const guestName = `Visitante ${Math.floor(Math.random() * 10000)}`;
        
        const [newUser] = await database.insert(users).values({
          openId,
          name: guestName,
          deviceId: input.deviceId,
          isGuest: true,
          loginMethod: "guest",
          maxFields: 3, // Guests get fewer fields
          plan: "free",
        }).returning();
        
        return {
          success: true,
          isNew: true,
          user: {
            id: newUser.id,
            openId: newUser.openId,
            name: newUser.name,
            isGuest: newUser.isGuest,
            maxFields: newUser.maxFields,
            plan: newUser.plan,
          },
        };
      }),
    
    // Check field limit for current user
    checkFieldLimit: protectedProcedure.query(async ({ ctx }) => {
      const database = await getDb();
      const userFields = await database.select().from(fields).where(eq(fields.userId, ctx.user.id));
      const fieldCount = userFields.length;
      const maxFields = ctx.user.maxFields || 5;
      const isGuest = ctx.user.isGuest || false;
      
      return {
        currentCount: fieldCount,
        maxFields,
        canCreateMore: fieldCount < maxFields,
        isGuest,
        needsAccount: isGuest && fieldCount >= 1,
        needsUpgrade: !isGuest && fieldCount >= maxFields,
        plan: ctx.user.plan || "free",
      };
    }),
  }),
  
  // ==================== AI ====================
  ai: t.router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        // Simulação de resposta da IA
        const lastMessage = input.messages[input.messages.length - 1];
        const userMessage = lastMessage?.content || "";
        
        // Respostas simuladas baseadas em palavras-chave
        let response = "Olá! Sou o assistente agrícola do CampoVivo. Como posso ajudar você hoje?";
        
        if (userMessage.toLowerCase().includes("ndvi")) {
          response = "O NDVI (Índice de Vegetação por Diferença Normalizada) varia de -1 a 1. Valores acima de 0.6 indicam vegetação saudável. Valores entre 0.3 e 0.6 indicam vegetação moderada. Abaixo de 0.3 pode indicar estresse ou solo exposto.";
        } else if (userMessage.toLowerCase().includes("irrigação") || userMessage.toLowerCase().includes("irrigar")) {
          response = "A irrigação ideal depende do tipo de cultura, solo e clima. Monitore a umidade do solo e considere irrigar quando atingir 50-60% da capacidade de campo. Evite irrigar nas horas mais quentes do dia.";
        } else if (userMessage.toLowerCase().includes("pragas") || userMessage.toLowerCase().includes("doença")) {
          response = "Para manejo integrado de pragas: 1) Monitore regularmente suas lavouras, 2) Identifique corretamente a praga/doença, 3) Use controle biológico quando possível, 4) Aplique defensivos apenas quando necessário e siga as recomendações técnicas.";
        } else if (userMessage.toLowerCase().includes("soja")) {
          response = "A soja é uma das principais culturas do Brasil. Período de plantio ideal: outubro a dezembro. Espaçamento recomendado: 45-50cm entre linhas. Profundidade de semeadura: 3-5cm. Necessidade hídrica: 450-800mm durante o ciclo.";
        } else if (userMessage.toLowerCase().includes("milho")) {
          response = "O milho pode ser plantado em duas safras: verão (outubro-novembro) e safrinha (janeiro-março). Espaçamento: 70-90cm entre linhas. População: 60-80 mil plantas/ha. Adubação de base com NPK é essencial para bons rendimentos.";
        }
        
        return {
          choices: [{
            message: {
              role: "assistant" as const,
              content: response,
            },
          }],
        };
      }),
  }),
  
  // ==================== USER ====================
  user: t.router({
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        userType: z.enum(["farmer", "agronomist", "consultant"]).optional(),
        avatarUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        
        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.email !== undefined) updateData.email = input.email;
        if (input.phone !== undefined) updateData.phone = input.phone;
        if (input.company !== undefined) updateData.company = input.company;
        if (input.userType !== undefined) updateData.userType = input.userType;
        if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
        
        await database
          .update(users)
          .set(updateData)
          .where(eq(users.id, ctx.user.id));
          
        return { success: true };
      }),
  }),
  
  fields: t.router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const database = await getDb();
      const result = await database
        .select()
        .from(fields)
        .where(and(eq(fields.userId, ctx.user.id), eq(fields.isActive, true)))
        .orderBy(desc(fields.createdAt));
      return result;
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        areaHectares: z.number().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        soilType: z.string().optional(),
        irrigationType: z.string().optional(),
        boundaries: z.string().optional(),
        farmId: z.number().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        
        // Parse boundaries para JSON se for string
        let boundariesJson = null;
        if (input.boundaries) {
          try {
            boundariesJson = JSON.parse(input.boundaries);
          } catch {
            boundariesJson = input.boundaries;
          }
        }
        
        const [newField] = await database.insert(fields).values({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          areaHectares: input.areaHectares,
          latitude: input.latitude,
          longitude: input.longitude,
          soilType: input.soilType,
          irrigationType: input.irrigationType,
          boundaries: boundariesJson,
          farmId: input.farmId,
          address: input.address,
          city: input.city,
          state: input.state,
        }).returning();
        
        // Sincronizar NDVI automaticamente se tiver coordenadas
        if (boundariesJson && process.env.AGROMONITORING_API_KEY) {
          try {
            const agroPolygonId = await createAgroPolygon(newField.name, boundariesJson);
            if (agroPolygonId) {
              await database.update(fields)
                .set({ agroPolygonId })
                .where(eq(fields.id, newField.id));
              newField.agroPolygonId = agroPolygonId;
            }
          } catch (e) {
            console.error("Erro ao criar polígono no Agromonitoring:", e);
          }
        }
        
        return newField;
      }),
      
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.id), eq(fields.userId, ctx.user.id)))
          .limit(1);
        return field || null;
      }),
      
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        areaHectares: z.number().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        soilType: z.string().optional(),
        irrigationType: z.string().optional(),
        boundaries: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        const { id, ...updateData } = input;
        
        let boundariesJson = undefined;
        if (input.boundaries) {
          try {
            boundariesJson = JSON.parse(input.boundaries);
          } catch {
            boundariesJson = input.boundaries;
          }
        }
        
        await database
          .update(fields)
          .set({ 
            ...updateData, 
            boundaries: boundariesJson !== undefined ? boundariesJson : undefined,
            updatedAt: new Date() 
          })
          .where(and(eq(fields.id, id), eq(fields.userId, ctx.user.id)));
        return { success: true };
      }),
      
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        await database
          .update(fields)
          .set({ isActive: false })
          .where(and(eq(fields.id, input.id), eq(fields.userId, ctx.user.id)));
        return { success: true };
      }),
    
    // Link all fields to Agromonitoring (placeholder - actual integration would require API key)
    linkAllToAgromonitoring: protectedProcedure
      .mutation(async ({ ctx }) => {
        // This is a placeholder - in production, this would connect to Agromonitoring API
        return { 
          success: true, 
          message: "Funcionalidade de integração com Agromonitoring será implementada em breve",
          linkedCount: 0 
        };
      }),
  }),
  
  crops: t.router({
    // Listar culturas de um campo
    listByField: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        
        // Verificar se o campo pertence ao usuário
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.fieldId), eq(fields.userId, ctx.user.id)))
          .limit(1);
        
        if (!field) throw new Error("Campo não encontrado");
        
        const result = await database
          .select()
          .from(crops)
          .where(eq(crops.fieldId, input.fieldId))
          .orderBy(desc(crops.createdAt));
        
        return result;
      }),
    
    // Criar nova cultura
    create: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        cropType: z.string(),
        variety: z.string().optional(),
        plantingDate: z.string().optional(), // ISO date string
        expectedHarvestDate: z.string().optional(),
        status: z.enum(["planned", "planted", "growing", "harvested", "failed"]).default("planned"),
        areaHectares: z.number().optional(),
        expectedYield: z.number().optional(),
        notes: z.string().optional(),
        season: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        
        // Verificar se o campo pertence ao usuário
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.fieldId), eq(fields.userId, ctx.user.id)))
          .limit(1);
        
        if (!field) throw new Error("Campo não encontrado");
        
        const [newCrop] = await database.insert(crops).values({
          fieldId: input.fieldId,
          userId: ctx.user.id,
          cropType: input.cropType,
          variety: input.variety,
          plantingDate: input.plantingDate ? new Date(input.plantingDate) : null,
          expectedHarvestDate: input.expectedHarvestDate ? new Date(input.expectedHarvestDate) : null,
          status: input.status,
          areaHectares: input.areaHectares,
          expectedYield: input.expectedYield,
          notes: input.notes,
          season: input.season || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        }).returning();
        
        return newCrop;
      }),
    
    // Atualizar cultura
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        cropType: z.string().optional(),
        variety: z.string().optional(),
        plantingDate: z.string().optional(),
        expectedHarvestDate: z.string().optional(),
        actualHarvestDate: z.string().optional(),
        status: z.enum(["planned", "planted", "growing", "harvested", "failed"]).optional(),
        areaHectares: z.number().optional(),
        expectedYield: z.number().optional(),
        actualYield: z.number().optional(),
        notes: z.string().optional(),
        season: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        
        const { id, ...updateData } = input;
        
        // Converter datas se presentes
        const processedData: Record<string, any> = { ...updateData, updatedAt: new Date() };
        if (input.plantingDate) processedData.plantingDate = new Date(input.plantingDate);
        if (input.expectedHarvestDate) processedData.expectedHarvestDate = new Date(input.expectedHarvestDate);
        if (input.actualHarvestDate) processedData.actualHarvestDate = new Date(input.actualHarvestDate);
        
        await database
          .update(crops)
          .set(processedData)
          .where(and(eq(crops.id, id), eq(crops.userId, ctx.user.id)));
        
        return { success: true };
      }),
    
    // Deletar cultura
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        
        await database
          .delete(crops)
          .where(and(eq(crops.id, input.id), eq(crops.userId, ctx.user.id)));
        
        return { success: true };
      }),
  }),
  
  ndvi: t.router({
    // Buscar NDVI atual de um campo
    current: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.fieldId), eq(fields.userId, ctx.user.id)))
          .limit(1);
          
        if (!field) throw new Error("Campo não encontrado");
        
        // Se não tem API key, retornar dados simulados
        if (!process.env.AGROMONITORING_API_KEY) {
          return {
            ndvi: 0.65 + Math.random() * 0.2,
            date: new Date().toISOString(),
            cloudCoverage: Math.random() * 20,
            source: "simulated",
          };
        }
        
        // Buscar NDVI real
        if (field.agroPolygonId) {
          try {
            const ndviData = await getAgroNdvi(field.agroPolygonId);
            if (ndviData) {
              return {
                ndvi: ndviData.data.mean,
                date: new Date(ndviData.dt * 1000).toISOString(),
                cloudCoverage: ndviData.cl,
                source: "agromonitoring",
              };
            }
          } catch (e) {
            console.error("Erro ao buscar NDVI:", e);
          }
        }
        
        return {
          ndvi: 0.65,
          date: new Date().toISOString(),
          cloudCoverage: 0,
          source: "default",
        };
      }),
      
    // Histórico de NDVI - usando Copernicus Statistical API
    history: protectedProcedure
      .input(z.object({ 
        fieldId: z.number(), 
        days: z.number().default(365), // Default para 1 ano
        maxCloudCoverage: z.number().default(50),
      }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.fieldId), eq(fields.userId, ctx.user.id)))
          .limit(1);
          
        if (!field) throw new Error("Campo não encontrado");
        
        // Tentar buscar dados reais do Copernicus
        try {
          // Buscar da nossa API Copernicus Statistics
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000';
          
          const response = await fetch(
            `${baseUrl}/api/copernicus-ndvi-history/${input.fieldId}?days=${input.days}`,
            { headers: { 'Content-Type': 'application/json' } }
          );
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.history && data.history.length > 0) {
              console.log(`[NDVI History] Got ${data.history.length} points from Copernicus for field ${input.fieldId}`);
              
              // Filtrar por cobertura de nuvens e retornar
              return data.history
                .filter((h: any) => h.cloudCoverage <= input.maxCloudCoverage)
                .map((h: any) => ({
                  date: h.date,
                  ndvi: h.ndvi,
                  cloudCoverage: h.cloudCoverage,
                  ndviMin: h.ndviMin,
                  ndviMax: h.ndviMax,
                }));
            }
          }
        } catch (e) {
          console.error("Erro ao buscar histórico do Copernicus:", e);
        }
        
        // Fallback: tentar AgroMonitoring se configurado
        if (process.env.AGROMONITORING_API_KEY && field.agroPolygonId) {
          try {
            const endDate = new Date();
            const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
            const historyData = await getAgroNdviHistory(field.agroPolygonId, startDate, endDate);
            
            const filteredData = historyData
              .filter(h => h.cl <= input.maxCloudCoverage)
              .filter(h => h.data?.mean != null && h.data.mean > 0)
              .sort((a, b) => a.dt - b.dt);
            
            if (filteredData.length > 0) {
              console.log(`[NDVI History] Got ${filteredData.length} points from AgroMonitoring for field ${input.fieldId}`);
              return filteredData.map(h => ({
                date: new Date(h.dt * 1000).toISOString(),
                ndvi: h.data.mean,
                cloudCoverage: h.cl,
              }));
            }
          } catch (e) {
            console.error("Erro ao buscar histórico do AgroMonitoring:", e);
          }
        }
        
        // Último fallback: retornar array vazio (frontend mostrará mensagem)
        console.log(`[NDVI History] No data available for field ${input.fieldId}`);
        return [];
      }),
      
    // Buscar imagens de satélite
    images: protectedProcedure
      .input(z.object({ fieldId: z.number(), days: z.number().default(30) }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.fieldId), eq(fields.userId, ctx.user.id)))
          .limit(1);
          
        if (!field) throw new Error("Campo não encontrado");
        
        if (!process.env.AGROMONITORING_API_KEY || !field.agroPolygonId) {
          // Retornar imagens simuladas
          return Array.from({ length: 5 }, (_, i) => ({
            date: new Date(Date.now() - i * 5 * 24 * 60 * 60 * 1000).toISOString(),
            truecolor: null,
            ndvi: null,
            cloudCoverage: Math.random() * 30,
          }));
        }
        
        try {
          const images = await getAgroSatelliteImages(field.agroPolygonId, input.days);
          return images.map(img => ({
            date: new Date(img.dt * 1000).toISOString(),
            truecolor: img.image?.truecolor || null,
            ndvi: img.image?.ndvi || null,
            cloudCoverage: img.cl,
          }));
        } catch (e) {
          console.error("Erro ao buscar imagens:", e);
          return [];
        }
      }),

    // Imagem NDVI mais recente (URL de imagem e tile)
    getLatestNdviImage: protectedProcedure
      .input(z.object({ fieldId: z.number(), days: z.number().default(60) }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.fieldId), eq(fields.userId, ctx.user.id)))
          .limit(1);

        if (!field) throw new Error("Campo não encontrado");

        if (!process.env.AGROMONITORING_API_KEY || !field.agroPolygonId) {
          return {
            configured: false,
            imageUrl: null,
            tileUrl: null,
            truecolorUrl: null,
            message: "Agromonitoring não configurado",
          };
        }

        try {
          const images = await getAgroSatelliteImages(field.agroPolygonId, input.days);
          const sorted = images
            .filter((img) => img.cl < 50)
            .sort((a, b) => {
              const diff = a.cl - b.cl;
              if (Math.abs(diff) > 15) return diff;
              return b.dt - a.dt;
            });

          const pick = sorted[0] || images.sort((a, b) => a.cl - b.cl)[0];

          if (!pick) {
            return {
              configured: true,
              imageUrl: null,
              tileUrl: null,
              truecolorUrl: null,
              message: "Nenhuma imagem disponível",
            };
          }

          return {
            configured: true,
            imageUrl: toHttps(pick.image?.ndvi),
            tileUrl: toHttps(pick.tile?.ndvi),
            truecolorUrl: toHttps(pick.image?.truecolor),
            date: new Date(pick.dt * 1000).toISOString(),
            cloudCoverage: pick.cl,
            dataCoverage: pick.dc,
            warning: sorted.length ? undefined : `Imagem com ${pick.cl}% de nuvens`,
          };
        } catch (error) {
          console.error("Erro ao buscar imagem NDVI:", error);
          return {
            configured: true,
            imageUrl: null,
            tileUrl: null,
            truecolorUrl: null,
            error: "Erro ao buscar imagem",
          };
        }
      }),
      
    // Buscar NDVI de múltiplos campos de uma vez
    getLatestBatch: protectedProcedure
      .input(z.object({ fieldIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const result: Record<number, { ndvi: number; date: string } | null> = {};
        
        for (const fieldId of input.fieldIds) {
          const [field] = await database
            .select()
            .from(fields)
            .where(and(eq(fields.id, fieldId), eq(fields.userId, ctx.user.id)))
            .limit(1);
            
          if (field?.currentNdvi) {
            result[fieldId] = {
              ndvi: field.currentNdvi / 100, // Assumindo que está armazenado como inteiro
              date: field.lastNdviSync?.toISOString() || new Date().toISOString(),
            };
          } else {
            // Retorna valor simulado se não houver NDVI real
            result[fieldId] = {
              ndvi: 0.5 + Math.random() * 0.3,
              date: new Date().toISOString(),
            };
          }
        }
        
        return result;
      }),
  }),
  
  // Router de clima
  weather: t.router({
    forecast: protectedProcedure
      .input(z.object({ lat: z.number(), lon: z.number() }))
      .query(async ({ input }) => {
        if (!process.env.AGROMONITORING_API_KEY) {
          // Dados simulados
          return {
            current: { temp: 28, humidity: 65, description: "Parcialmente nublado" },
            forecast: Array.from({ length: 5 }, (_, i) => ({
              date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
              tempMin: 18 + Math.random() * 5,
              tempMax: 28 + Math.random() * 5,
              humidity: 50 + Math.random() * 30,
              rain: Math.random() > 0.7 ? Math.random() * 20 : 0,
              description: Math.random() > 0.5 ? "Ensolarado" : "Parcialmente nublado",
            })),
          };
        }
        
        try {
          const data = await getAgroWeather(input.lat, input.lon);
          return data;
        } catch (e) {
          console.error("Erro ao buscar clima:", e);
          return null;
        }
      }),
      
    getByField: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.fieldId), eq(fields.userId, ctx.user.id)))
          .limit(1);
          
        if (!field) throw new Error("Campo não encontrado");
        
        // Obter coordenadas do campo
        let lat = -20.11;
        let lon = -50.27;
        
        if (field.boundaries) {
          const boundaries = typeof field.boundaries === 'string' 
            ? JSON.parse(field.boundaries) 
            : field.boundaries;
          if (Array.isArray(boundaries) && boundaries.length > 0) {
            const sumLat = boundaries.reduce((acc: number, p: any) => acc + p.lat, 0);
            const sumLng = boundaries.reduce((acc: number, p: any) => acc + p.lng, 0);
            lat = sumLat / boundaries.length;
            lon = sumLng / boundaries.length;
          }
        }
        
        try {
          // Buscar clima atual e previsão da Open-Meteo (API gratuita)
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&hourly=temperature_2m,precipitation,relative_humidity_2m&timezone=America/Sao_Paulo&forecast_days=7`;
          
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error("Failed to fetch weather");
          }
          
          const data = await response.json();
          
          // Mapear código de clima para descrição
          const getWeatherDescription = (code: number): string => {
            const descriptions: Record<number, string> = {
              0: "Céu limpo",
              1: "Predominantemente limpo",
              2: "Parcialmente nublado",
              3: "Nublado",
              45: "Neblina",
              48: "Neblina com geada",
              51: "Garoa leve",
              53: "Garoa moderada",
              55: "Garoa intensa",
              61: "Chuva leve",
              63: "Chuva moderada",
              65: "Chuva forte",
              80: "Pancadas de chuva leves",
              81: "Pancadas de chuva moderadas",
              82: "Pancadas de chuva violentas",
              95: "Tempestade",
              96: "Tempestade com granizo leve",
              99: "Tempestade com granizo forte",
            };
            return descriptions[code] || "Variável";
          };
          
          const getWeatherIcon = (code: number): string => {
            if (code === 0 || code === 1) return "01d";
            if (code === 2) return "02d";
            if (code === 3) return "03d";
            if (code >= 45 && code <= 48) return "50d";
            if (code >= 51 && code <= 55) return "09d";
            if (code >= 61 && code <= 65) return "10d";
            if (code >= 80 && code <= 82) return "09d";
            if (code >= 95) return "11d";
            return "02d";
          };
          
          return {
            current: {
              temperature: data.current?.temperature_2m,
              humidity: data.current?.relative_humidity_2m,
              windSpeed: data.current?.wind_speed_10m,
              precipitation: data.current?.precipitation,
              description: getWeatherDescription(data.current?.weather_code || 0),
              icon: getWeatherIcon(data.current?.weather_code || 0),
            },
            forecast: data.daily?.time?.map((date: string, i: number) => ({
              date,
              tempMin: data.daily.temperature_2m_min[i],
              tempMax: data.daily.temperature_2m_max[i],
              precipitation: data.daily.precipitation_sum[i],
              description: getWeatherDescription(data.daily.weather_code[i] || 0),
              icon: getWeatherIcon(data.daily.weather_code[i] || 0),
            })) || [],
            hourly: data.hourly?.time?.slice(0, 24).map((time: string, i: number) => ({
              time,
              temp: data.hourly.temperature_2m[i],
              humidity: data.hourly.relative_humidity_2m[i],
              precipitation: data.hourly.precipitation[i],
            })) || [],
          };
        } catch (e) {
          console.error("[Weather] Error:", e);
          // Fallback com dados básicos
          return {
            current: {
              temperature: null,
              humidity: null,
              windSpeed: null,
              precipitation: null,
              description: "Dados indisponíveis",
              icon: "02d",
            },
            forecast: [],
            hourly: [],
          };
        }
      }),
    
    // Get historical weather data from Open-Meteo (real data)
    getHistorical: protectedProcedure
      .input(z.object({ 
        fieldId: z.number(),
        days: z.number().optional().default(365) // Último ano por padrão
      }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.fieldId), eq(fields.userId, ctx.user.id)))
          .limit(1);
          
        if (!field) throw new Error("Campo não encontrado");
        
        // Obter coordenadas do campo
        let lat = -20.11;
        let lon = -50.27;
        
        if (field.boundaries) {
          const boundaries = typeof field.boundaries === 'string' 
            ? JSON.parse(field.boundaries) 
            : field.boundaries;
          if (Array.isArray(boundaries) && boundaries.length > 0) {
            // Calcular centroide
            const sumLat = boundaries.reduce((acc: number, p: any) => acc + p.lat, 0);
            const sumLng = boundaries.reduce((acc: number, p: any) => acc + p.lng, 0);
            lat = sumLat / boundaries.length;
            lon = sumLng / boundaries.length;
          }
        }
        
        // Calcular datas
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.days);
        
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        
        try {
          // Buscar dados históricos reais da Open-Meteo
          const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean&timezone=America/Sao_Paulo`;
          
          const response = await fetch(url);
          if (!response.ok) {
            console.error("[Weather] Open-Meteo error:", response.status);
            throw new Error("Failed to fetch weather data");
          }
          
          const data = await response.json();
          
          if (!data.daily?.time) {
            throw new Error("Invalid weather data");
          }
          
          // Calcular precipitação acumulada e soma térmica
          let accumulatedPrecipitation = 0;
          let thermalSum = 0;
          const baseTemp = 10; // Temperatura base para soma térmica
          
          const dates = data.daily.time;
          const precipitation = data.daily.precipitation_sum || [];
          const tempMax = data.daily.temperature_2m_max || [];
          const tempMin = data.daily.temperature_2m_min || [];
          const tempMean = data.daily.temperature_2m_mean || [];
          const humidity = data.daily.relative_humidity_2m_mean || [];
          
          const accumulatedPrecipitationArray: number[] = [];
          const thermalSumArray: number[] = [];
          
          for (let i = 0; i < dates.length; i++) {
            accumulatedPrecipitation += precipitation[i] || 0;
            accumulatedPrecipitationArray.push(Math.round(accumulatedPrecipitation));
            
            // Soma térmica: graus-dia acima da temperatura base
            const avgTemp = tempMean[i] || ((tempMax[i] + tempMin[i]) / 2);
            if (avgTemp > baseTemp) {
              thermalSum += avgTemp - baseTemp;
            }
            thermalSumArray.push(Math.round(thermalSum));
          }
          
          return {
            dates,
            tempMax,
            tempMin,
            tempMean,
            precipitation,
            humidity,
            accumulatedPrecipitation: accumulatedPrecipitationArray,
            thermalSum: thermalSumArray,
            totalPrecipitation: Math.round(accumulatedPrecipitation),
            totalThermalSum: Math.round(thermalSum),
            daysCount: dates.length,
          };
        } catch (e) {
          console.error("[Weather] Error fetching historical data:", e);
          // Fallback com dados simulados
          const days = input.days;
          const dates: string[] = [];
          const tempMax: number[] = [];
          const tempMin: number[] = [];
          const tempMean: number[] = [];
          const precipitation: number[] = [];
          const humidity: number[] = [];
          const accumulatedPrecipitation: number[] = [];
          const thermalSum: number[] = [];
          
          let accPrecip = 0;
          let thermal = 0;
          
          for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - i));
            dates.push(date.toISOString().split('T')[0]);
            
            const tMax = 25 + Math.random() * 10;
            const tMin = 15 + Math.random() * 8;
            const tMean = (tMax + tMin) / 2;
            const precip = Math.random() > 0.7 ? Math.random() * 20 : 0;
            
            tempMax.push(tMax);
            tempMin.push(tMin);
            tempMean.push(tMean);
            precipitation.push(precip);
            humidity.push(50 + Math.random() * 30);
            
            accPrecip += precip;
            accumulatedPrecipitation.push(Math.round(accPrecip));
            
            if (tMean > 10) {
              thermal += tMean - 10;
            }
            thermalSum.push(Math.round(thermal));
          }
          
          return {
            dates,
            tempMax,
            tempMin,
            tempMean,
            precipitation,
            humidity,
            accumulatedPrecipitation,
            thermalSum,
            totalPrecipitation: Math.round(accPrecip),
            totalThermalSum: Math.round(thermal),
            daysCount: days,
          };
        }
      }),
      
    getAlerts: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async () => {
        // Alertas meteorológicos simulados
        const hasAlert = Math.random() > 0.5;
        if (!hasAlert) return [];
        
        return [
          {
            id: 1,
            type: Math.random() > 0.5 ? "rain" : "heat",
            title: Math.random() > 0.5 ? "Alerta de Chuva Forte" : "Alerta de Calor",
            description: Math.random() > 0.5 
              ? "Previsão de chuva intensa nas próximas 24 horas" 
              : "Temperaturas acima de 35°C esperadas",
            severity: Math.random() > 0.5 ? "warning" : "info",
            startsAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        ];
      }),
  }),
  
  // ==================== NOTIFICAÇÕES ====================
  notifications: t.router({
    // Salvar subscription push
    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string(),
        p256dh: z.string(),
        auth: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        
        // Remover subscription antiga do mesmo endpoint
        await database.delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.endpoint));
        
        // Criar nova subscription
        await database.insert(pushSubscriptions).values({
          userId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        });
        
        return { success: true };
      }),
      
    // Remover subscription
    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        await database.delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.endpoint));
        return { success: true };
      }),
      
    // Listar notificações do usuário
    list: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(20),
        unreadOnly: z.boolean().optional().default(false),
      }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        let query = database
          .select()
          .from(notifications)
          .where(eq(notifications.userId, ctx.user.id))
          .orderBy(desc(notifications.createdAt))
          .limit(input.limit);
          
        if (input.unreadOnly) {
          query = database
            .select()
            .from(notifications)
            .where(and(
              eq(notifications.userId, ctx.user.id),
              eq(notifications.read, false)
            ))
            .orderBy(desc(notifications.createdAt))
            .limit(input.limit);
        }
        
        return query;
      }),
      
    // Marcar como lida
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        await database
          .update(notifications)
          .set({ read: true })
          .where(and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id)
          ));
        return { success: true };
      }),
      
    // Marcar todas como lidas
    markAllAsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        const database = await getDb();
        await database
          .update(notifications)
          .set({ read: true })
          .where(eq(notifications.userId, ctx.user.id));
        return { success: true };
      }),
      
    // Contar não lidas
    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        const database = await getDb();
        const result = await database
          .select()
          .from(notifications)
          .where(and(
            eq(notifications.userId, ctx.user.id),
            eq(notifications.read, false)
          ));
        return result.length;
      }),
      
    // Obter VAPID public key
    getPublicKey: publicProcedure
      .query(() => {
        return {
          publicKey: process.env.VAPID_PUBLIC_KEY || "",
        };
      }),
  }),
  
  // ==================== CROPS ====================
  crops: t.router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Retorna lista simulada de culturas
      return [
        { id: 1, fieldId: 1, cropType: "Soja", variety: "Intacta RR2", status: "growing", plantingDate: new Date("2024-10-15"), expectedHarvestDate: new Date("2025-02-15"), areaHectares: 120 },
        { id: 2, fieldId: 2, cropType: "Milho", variety: "AG 1051", status: "planted", plantingDate: new Date("2024-11-01"), expectedHarvestDate: new Date("2025-04-01"), areaHectares: 80 },
      ];
    }),
    
    listByField: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ input }) => {
        // Retorna culturas simuladas para o campo
        return [
          { id: 1, fieldId: input.fieldId, cropType: "Soja", variety: "Intacta RR2", status: "growing", plantingDate: new Date(), expectedHarvestDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
        ];
      }),
      
    create: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        cropType: z.string(),
        variety: z.string().optional(),
        plantingDate: z.date().optional(),
        expectedHarvestDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        return { id: Math.floor(Math.random() * 1000), ...input, status: "planted" };
      }),
  }),
  
  // ==================== NOTES ====================
  notes: t.router({
    listByField: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ input }) => {
        return [
          { id: 1, fieldId: input.fieldId, title: "Observação", content: "Campo com boa aparência", noteType: "observation", createdAt: new Date() },
        ];
      }),
      
    listAll: protectedProcedure
      .query(async ({ ctx }) => {
        return [
          { id: 1, fieldId: 1, title: "Observação de campo", content: "Campo com boa aparência geral", noteType: "observation", severity: "info", createdAt: new Date() },
          { id: 2, fieldId: 1, title: "Praga detectada", content: "Detectada presença de lagarta", noteType: "pest", severity: "warning", createdAt: new Date() },
        ];
      }),
      
    create: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        title: z.string().optional(),
        content: z.string(),
        noteType: z.string().optional(),
        severity: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return { id: Math.floor(Math.random() * 1000), ...input, createdAt: new Date() };
      }),
      
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        return { success: true };
      }),
  }),
  
  // ==================== FARMS ====================
  farms: t.router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return [
        { id: 1, userId: ctx.user.id, name: "Fazenda Principal", totalAreaHectares: 500, createdAt: new Date() },
      ];
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        totalAreaHectares: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return { id: Math.floor(Math.random() * 1000), ...input, createdAt: new Date() };
      }),
      
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        totalAreaHectares: z.number().optional(),
        color: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
      }))
      .mutation(async () => {
        return { success: true };
      }),
      
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        return { success: true };
      }),
  }),
  
  // ==================== DASHBOARD ====================
  dashboard: t.router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const database = await getDb();
      const userFields = await database
        .select()
        .from(fields)
        .where(and(eq(fields.userId, ctx.user.id), eq(fields.isActive, true)));
        
      const totalArea = userFields.reduce((sum, f) => sum + (f.areaHectares || 0), 0);
      
      return {
        totalFields: userFields.length,
        totalAreaHectares: totalArea,
        avgNdvi: 0.72,
        recentFields: userFields.slice(0, 5),
        alerts: [
          { id: 1, type: "weather", title: "Previsão de chuva", description: "Chuva esperada nos próximos 3 dias", severity: "info", createdAt: new Date() },
        ],
        tasks: [
          { id: 1, title: "Verificar irrigação", status: "pending", dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        ],
        notes: [],
      };
    }),
  }),
  
  // ==================== ALERTS ====================
  alerts: t.router({
    getAlerts: protectedProcedure.query(async ({ ctx }) => {
      return [
        { id: 1, userId: ctx.user.id, type: "weather", title: "Alerta de Chuva", description: "Previsão de chuva forte amanhã", severity: "warning", read: false, createdAt: new Date() },
        { id: 2, userId: ctx.user.id, type: "ndvi", title: "NDVI Baixo", description: "Campo Leste apresenta NDVI abaixo do esperado", severity: "info", read: false, createdAt: new Date() },
      ];
    }),
    
    dismissAlert: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        return { success: true };
      }),
  }),
  
  // ==================== REPORTS ====================
  reports: t.router({
    generate: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        type: z.string(),
        dateRange: z.object({
          start: z.date(),
          end: z.date(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        return {
          id: Math.floor(Math.random() * 1000),
          fieldId: input.fieldId,
          type: input.type,
          url: `/reports/${input.fieldId}/${input.type}.pdf`,
          createdAt: new Date(),
        };
      }),
      
    generateFieldReport: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        reportType: z.string(),
      }))
      .mutation(async ({ input }) => {
        return {
          success: true,
          url: `/reports/${input.fieldId}/${input.reportType}.pdf`,
        };
      }),
  }),
  
  // ==================== SHARING ====================
  sharing: t.router({
    getShares: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async () => {
        return [];
      }),
      
    getByField: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ input }) => {
        return [
          { id: 1, fieldId: input.fieldId, email: "user@example.com", permission: "view", createdAt: new Date() },
        ];
      }),
      
    create: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        email: z.string(),
        permission: z.string(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        return { id: Math.floor(Math.random() * 1000), ...input, createdAt: new Date() };
      }),
      
    getShareLink: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        permission: z.string(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const token = Math.random().toString(36).substring(2, 15);
        return { 
          id: Math.floor(Math.random() * 1000),
          link: `${process.env.APP_URL || 'https://campovivo.app'}/share/${token}`,
          token,
          expiresAt: input.expiresAt,
        };
      }),
      
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        return { success: true };
      }),
      
    shareField: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        email: z.string(),
        permission: z.string(),
      }))
      .mutation(async ({ input }) => {
        return { id: Math.floor(Math.random() * 1000), ...input };
      }),
      
    revokeShare: protectedProcedure
      .input(z.object({ shareId: z.number() }))
      .mutation(async () => {
        return { success: true };
      }),
  }),
  
  // ==================== TASKS ====================
  tasks: t.router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return [
        { 
          id: 1, 
          userId: ctx.user.id, 
          title: "Irrigar campo norte", 
          description: "Realizar irrigação conforme cronograma",
          taskType: "irrigation",
          priority: "high",
          status: "pending",
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
        { 
          id: 2, 
          userId: ctx.user.id, 
          title: "Aplicar fertilizante", 
          description: "Aplicar NPK no campo sul",
          taskType: "fertilization",
          priority: "medium",
          status: "pending",
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
      ];
    }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        taskType: z.string(),
        priority: z.string(),
        dueDate: z.string().optional(),
        fieldId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return { 
          id: Math.floor(Math.random() * 1000), 
          userId: ctx.user.id,
          ...input, 
          status: "pending",
          createdAt: new Date(),
        };
      }),
      
    complete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        return { success: true };
      }),
      
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        taskType: z.string().optional(),
        priority: z.string().optional(),
        status: z.string().optional(),
        dueDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return { success: true, ...input };
      }),
      
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        return { success: true };
      }),
  }),
});

// ==================== AGROMONITORING HELPERS ====================
const AGRO_BASE_URL = "https://api.agromonitoring.com/agro/1.0";

async function createAgroPolygon(name: string, coordinates: any): Promise<string | null> {
  const apiKey = process.env.AGROMONITORING_API_KEY;
  if (!apiKey) return null;
  
  try {
    // Converter coordenadas para formato GeoJSON
    let coords = coordinates;
    if (typeof coordinates === "string") {
      coords = JSON.parse(coordinates);
    }
    
    // Garantir formato [lng, lat]
    let geoCoords: [number, number][];
    if (Array.isArray(coords) && coords[0]?.lat !== undefined) {
      geoCoords = coords.map((c: any) => [c.lng || c.lon, c.lat]);
    } else if (Array.isArray(coords) && Array.isArray(coords[0])) {
      geoCoords = coords;
    } else {
      return null;
    }
    
    // Fechar polígono se necessário
    if (geoCoords.length > 0 && 
        (geoCoords[0][0] !== geoCoords[geoCoords.length - 1][0] ||
         geoCoords[0][1] !== geoCoords[geoCoords.length - 1][1])) {
      geoCoords.push(geoCoords[0]);
    }
    
    const response = await fetch(`${AGRO_BASE_URL}/polygons?appid=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        geo_json: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [geoCoords] },
        },
      }),
    });
    
    if (!response.ok) {
      console.error("Agromonitoring error:", await response.text());
      return null;
    }
    
    const data = await response.json();
    return data.id;
  } catch (e) {
    console.error("createAgroPolygon error:", e);
    return null;
  }
}

async function getAgroNdvi(polygonId: string): Promise<any> {
  const apiKey = process.env.AGROMONITORING_API_KEY;
  if (!apiKey) return null;
  
  const response = await fetch(`${AGRO_BASE_URL}/ndvi?polyid=${polygonId}&appid=${apiKey}`);
  if (!response.ok) return null;
  
  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

async function getAgroNdviHistory(polygonId: string, startDate: Date, endDate: Date): Promise<any[]> {
  const apiKey = process.env.AGROMONITORING_API_KEY;
  if (!apiKey) return [];
  
  const start = Math.floor(startDate.getTime() / 1000);
  const end = Math.floor(endDate.getTime() / 1000);
  
  const response = await fetch(
    `${AGRO_BASE_URL}/ndvi/history?polyid=${polygonId}&start=${start}&end=${end}&appid=${apiKey}`
  );
  
  if (!response.ok) return [];
  return response.json();
}

async function getAgroSatelliteImages(polygonId: string, days: number): Promise<any[]> {
  const apiKey = process.env.AGROMONITORING_API_KEY;
  if (!apiKey) return [];
  
  const end = Math.floor(Date.now() / 1000);
  const start = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  
  const response = await fetch(
    `${AGRO_BASE_URL}/image/search?polyid=${polygonId}&start=${start}&end=${end}&appid=${apiKey}`
  );
  
  if (!response.ok) return [];
  return response.json();
}

function toHttps(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  return url;
}

async function getAgroWeather(lat: number, lon: number): Promise<any> {
  const apiKey = process.env.AGROMONITORING_API_KEY;
  if (!apiKey) return null;
  
  // Clima atual
  const currentRes = await fetch(
    `${AGRO_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`
  );
  
  // Previsão
  const forecastRes = await fetch(
    `${AGRO_BASE_URL}/weather/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`
  );
  
  const current = currentRes.ok ? await currentRes.json() : null;
  const forecast = forecastRes.ok ? await forecastRes.json() : [];
  
  return {
    current: current ? {
      temp: current.main?.temp ? current.main.temp - 273.15 : null,
      humidity: current.main?.humidity,
      description: current.weather?.[0]?.description || "N/A",
    } : null,
    forecast: Array.isArray(forecast) ? forecast.slice(0, 5).map((f: any) => ({
      date: new Date(f.dt * 1000).toISOString(),
      tempMin: f.main?.temp_min ? f.main.temp_min - 273.15 : null,
      tempMax: f.main?.temp_max ? f.main.temp_max - 273.15 : null,
      humidity: f.main?.humidity,
      rain: f.rain?.["3h"] || 0,
      description: f.weather?.[0]?.description || "N/A",
    })) : [],
  };
}

export type AppRouter = typeof appRouter;

// ==================== HANDLER ====================
async function getOrCreateUser(openId: string, name: string, email: string): Promise<User> {
  const database = await getDb();
  
  let [user] = await database.select().from(users).where(eq(users.openId, openId)).limit(1);
  
  if (!user) {
    [user] = await database.insert(users).values({
      openId,
      name,
      email,
      loginMethod: "dev",
    }).returning();
  }
  
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Parse cookies from request
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map(c => {
      const [key, ...v] = c.trim().split("=");
      return [key, v.join("=")];
    })
  );
  const sessionUserId = cookies["campovivo_user_id"];
  
  // Debug logging
  console.log("[Auth] Cookie header:", cookieHeader ? "present" : "empty");
  console.log("[Auth] Session user ID from cookie:", sessionUserId || "none");

  // Convert request
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url}`;
  
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  });

  let body: string | undefined;
  if (req.method === "POST" && req.body) {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const fetchRequest = new Request(url, {
    method: req.method || "GET",
    headers,
    body,
  });

  try {
    // Get user from cookie or header (headers are case-insensitive in HTTP)
    let user: User | null = null;
    const headerUserId = req.headers["x-user-id"] || req.headers["X-User-Id"];
    const userId = sessionUserId || (headerUserId as string);
    
    console.log("[Auth] X-User-Id header:", headerUserId || "none");
    console.log("[Auth] Final userId to lookup:", userId || "none");
    
    if (userId && !isNaN(parseInt(userId))) {
      const database = await getDb();
      const [foundUser] = await database.select().from(users).where(eq(users.id, parseInt(userId))).limit(1);
      user = foundUser || null;
      console.log("[Auth] Found user:", user ? user.id : "null");
    }
    
    // User will be null if not logged in - that's fine, public procedures will work
    // Protected procedures will throw "Not authenticated" error

    // Determine the correct endpoint from the URL
    const urlPath = req.url || "";
    const endpoint = urlPath.includes("/api/trpc-standalone") ? "/api/trpc-standalone" : "/api/trpc";

    const response = await fetchRequestHandler({
      endpoint,
      req: fetchRequest,
      router: appRouter,
      createContext: () => ({ user }),
    });

    const responseBody = await response.text();
    response.headers.forEach((value, key) => res.setHeader(key, value));
    
    // Check if this was a login/signup/register response and set cookie
    // superjson format: {"result":{"data":{"json":{"user":{"id":1,...}}}}}
    if (responseBody.includes('"user"') && responseBody.includes('"id"')) {
      try {
        const parsed = JSON.parse(responseBody);
        // Handle superjson format
        const data = parsed.result?.data?.json || parsed.result?.data;
        if (data?.user?.id) {
          const userId = data.user.id;
          // Use Secure flag for HTTPS in production
          const isProduction = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
          const cookieValue = `campovivo_user_id=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isProduction ? '; Secure' : ''}`;
          res.setHeader("Set-Cookie", cookieValue);
          console.log("[Auth] Setting cookie for user:", userId);
        }
      } catch (e) {
        console.error("Failed to parse response for cookie:", e);
      }
    }
    
    // Check if this was a logout and clear cookie
    if (req.url?.includes("auth.logout")) {
      res.setHeader("Set-Cookie", `campovivo_user_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    }
    
    res.status(response.status).send(responseBody);
  } catch (error: any) {
    console.error("tRPC error:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
}
