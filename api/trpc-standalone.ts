import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, and } from "drizzle-orm";
import { pgTable, serial, varchar, text, timestamp, integer, json, boolean, pgEnum } from "drizzle-orm/pg-core";

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
const roleEnum = pgEnum("role", ["user", "admin"]);
const userTypeEnum = pgEnum("user_type", ["farmer", "agronomist", "consultant"]);

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  password: varchar("password", { length: 255 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  userType: userTypeEnum("user_type").default("farmer").notNull(),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 255 }),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  area: text("area"),
  areaHectares: text("area_hectares"),
  centerLat: text("center_lat"),
  centerLng: text("center_lng"),
  soilType: varchar("soil_type", { length: 100 }),
  irrigationType: varchar("irrigation_type", { length: 50 }),
  notes: text("notes"),
  polygonCoordinates: json("polygon_coordinates"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

type User = typeof users.$inferSelect;
type Field = typeof fields.$inferSelect;

// ==================== DATABASE ====================
let db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!db) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");
    const client = postgres(dbUrl);
    db = drizzle(client);
  }
  return db;
}

// ==================== tRPC ====================
const t = initTRPC.context<{ user: User | null }>().create();

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
          password: hashedPassword,
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
    
    login: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1, "Senha obrigatória"),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        
        // Find user by email
        const [user] = await database.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (!user) {
          throw new Error("Email ou senha incorretos");
        }
        
        // Check password
        const hashedPassword = simpleHash(input.password);
        if (user.password !== hashedPassword) {
          throw new Error("Email ou senha incorretos");
        }
        
        // Update last signed in
        await database.update(users)
          .set({ lastSignedIn: new Date() })
          .where(eq(users.id, user.id));
        
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
        area: z.string().optional(),
        areaHectares: z.number().optional(),
        centerLat: z.number().optional(),
        centerLng: z.number().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        soilType: z.string().optional(),
        irrigationType: z.string().optional(),
        notes: z.string().optional(),
        polygonCoordinates: z.any().optional(),
        boundaries: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        
        // Aceitar tanto centerLat/centerLng quanto latitude/longitude
        const lat = input.centerLat?.toString() || input.latitude;
        const lng = input.centerLng?.toString() || input.longitude;
        
        // Aceitar tanto polygonCoordinates quanto boundaries
        let coords = input.polygonCoordinates;
        if (!coords && input.boundaries) {
          try {
            coords = JSON.parse(input.boundaries);
          } catch {
            coords = input.boundaries;
          }
        }
        
        const [newField] = await database.insert(fields).values({
          userId: ctx.user.id,
          name: input.name,
          area: input.area,
          areaHectares: input.areaHectares?.toString(),
          centerLat: lat,
          centerLng: lng,
          soilType: input.soilType,
          irrigationType: input.irrigationType,
          notes: input.notes,
          polygonCoordinates: coords,
        }).returning();
        return newField;
      }),
  }),
});

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
    // Get user from cookie or header
    let user: User | null = null;
    const userId = sessionUserId || (req.headers["x-user-id"] as string);
    
    if (userId) {
      const database = await getDb();
      const [foundUser] = await database.select().from(users).where(eq(users.id, parseInt(userId))).limit(1);
      user = foundUser || null;
    }
    
    // Se não tem usuário logado, criar/usar usuário demo para permitir testar o app
    if (!user) {
      const database = await getDb();
      const demoOpenId = "demo-user-public";
      let [demoUser] = await database.select().from(users).where(eq(users.openId, demoOpenId)).limit(1);
      
      if (!demoUser) {
        [demoUser] = await database.insert(users).values({
          openId: demoOpenId,
          name: "Usuário Demo",
          email: "demo@campovivo.app",
          loginMethod: "demo",
        }).returning();
      }
      user = demoUser;
    }

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
    
    // Check if this was a login/signup response and set cookie
    if (responseBody.includes('"user":{') && responseBody.includes('"id":')) {
      try {
        const parsed = JSON.parse(responseBody);
        if (parsed.result?.data?.user?.id) {
          const userId = parsed.result.data.user.id;
          res.setHeader("Set-Cookie", `campovivo_user_id=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
        }
      } catch {}
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
