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
  agroPolygonId: varchar("agro_polygon_id", { length: 100 }),
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
        
        // Sincronizar NDVI automaticamente se tiver coordenadas
        if (coords && process.env.AGROMONITORING_API_KEY) {
          try {
            const agroPolygonId = await createAgroPolygon(newField.name, coords);
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
      
    // Histórico de NDVI
    history: protectedProcedure
      .input(z.object({ fieldId: z.number(), days: z.number().default(30) }))
      .query(async ({ ctx, input }) => {
        const database = await getDb();
        const [field] = await database
          .select()
          .from(fields)
          .where(and(eq(fields.id, input.fieldId), eq(fields.userId, ctx.user.id)))
          .limit(1);
          
        if (!field) throw new Error("Campo não encontrado");
        
        // Se não tem API key, retornar histórico simulado
        if (!process.env.AGROMONITORING_API_KEY || !field.agroPolygonId) {
          const history = [];
          for (let i = 0; i < input.days; i += 5) {
            history.push({
              date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
              ndvi: 0.5 + Math.random() * 0.4,
              cloudCoverage: Math.random() * 30,
            });
          }
          return history;
        }
        
        // Buscar histórico real
        try {
          const endDate = new Date();
          const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
          const historyData = await getAgroNdviHistory(field.agroPolygonId, startDate, endDate);
          
          return historyData.map(h => ({
            date: new Date(h.dt * 1000).toISOString(),
            ndvi: h.data.mean,
            cloudCoverage: h.cl,
          }));
        } catch (e) {
          console.error("Erro ao buscar histórico NDVI:", e);
          return [];
        }
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
