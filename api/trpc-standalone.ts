import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, and } from "drizzle-orm";
import { pgTable, serial, varchar, text, timestamp, integer, json, boolean, pgEnum } from "drizzle-orm/pg-core";

// ==================== SCHEMA ====================
const roleEnum = pgEnum("role", ["user", "admin"]);
const userTypeEnum = pgEnum("user_type", ["farmer", "agronomist", "consultant"]);

const users = pgTable("users", {
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
        soilType: z.string().optional(),
        irrigationType: z.string().optional(),
        notes: z.string().optional(),
        polygonCoordinates: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await getDb();
        const [newField] = await database.insert(fields).values({
          userId: ctx.user.id,
          name: input.name,
          area: input.area,
          areaHectares: input.areaHectares?.toString(),
          centerLat: input.centerLat?.toString(),
          centerLng: input.centerLng?.toString(),
          soilType: input.soilType,
          irrigationType: input.irrigationType,
          notes: input.notes,
          polygonCoordinates: input.polygonCoordinates,
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
    // Get or create dev user
    const user = await getOrCreateUser(
      "dev-user",
      "Usuário Dev",
      "dev@campovivo.app"
    );

    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: fetchRequest,
      router: appRouter,
      createContext: () => ({ user }),
    });

    const responseBody = await response.text();
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status).send(responseBody);
  } catch (error: any) {
    console.error("tRPC error:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
}
