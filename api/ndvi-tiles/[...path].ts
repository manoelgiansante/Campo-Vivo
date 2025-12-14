import type { VercelRequest, VercelResponse } from "@vercel/node";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { pgTable, serial, integer, varchar, text, boolean, timestamp, json, pgEnum } from "drizzle-orm/pg-core";

// Schema simplificado para fields
const irrigationTypeEnum = pgEnum("irrigation_type", ["none", "drip", "sprinkler", "pivot", "flood"]);
const fields = pgTable("fields", {
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
  agroPolygonId: varchar("agro_polygon_id", { length: 50 }),
  lastNdviSync: timestamp("last_ndvi_sync"),
  currentNdvi: integer("current_ndvi"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cache para URLs de tiles (evita buscar a cada requisição)
const tileUrlCache: Map<string, { url: string; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Função para buscar imagens de satélite do Agromonitoring
async function searchSatelliteImages(polygonId: string, startDate: Date, endDate: Date) {
  const apiKey = process.env.AGROMONITORING_API_KEY;
  if (!apiKey) {
    throw new Error("AGROMONITORING_API_KEY not configured");
  }

  const start = Math.floor(startDate.getTime() / 1000);
  const end = Math.floor(endDate.getTime() / 1000);

  const url = `https://api.agromonitoring.com/agro/1.0/image/search?start=${start}&end=${end}&polyid=${polygonId}&appid=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Agromonitoring API error: ${response.status}`);
  }

  return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Habilitar CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Parse path: /api/ndvi-tiles/fieldId/z/x/y.png
    const pathParam = req.query.path;
    const pathParts = Array.isArray(pathParam) ? pathParam : (pathParam as string).split("/");
    
    if (pathParts.length < 4) {
      return res.status(400).send("Invalid path format. Expected: /api/ndvi-tiles/{fieldId}/{z}/{x}/{y}.png");
    }

    const [fieldIdStr, z, x, yWithExt] = pathParts;
    const id = parseInt(fieldIdStr);
    const zoom = z;
    const tileX = x;
    const tileY = yWithExt.replace(".png", "");
    
    console.log(`[NDVI Tiles] Requisição para campo ${id}, tile ${zoom}/${tileX}/${tileY}`);

    // Verificar cache
    const cacheKey = `field_${id}`;
    const cached = tileUrlCache.get(cacheKey);
    let baseTileUrl: string;

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      baseTileUrl = cached.url;
      console.log(`[NDVI Tiles] Usando URL do cache`);
    } else {
      if (!process.env.DATABASE_URL) {
        console.error("[NDVI Tiles] DATABASE_URL não configurada");
        return res.status(500).send("Database not configured");
      }

      // Conectar ao banco de dados
      const client = postgres(process.env.DATABASE_URL, { 
        connect_timeout: 10,
        idle_timeout: 20,
      });
      const db = drizzle(client);

      // Buscar campo
      const result = await db.select().from(fields).where(eq(fields.id, id)).limit(1);
      const field = result[0];

      if (!field || !field.agroPolygonId) {
        console.log(`[NDVI Tiles] Campo ${id} não encontrado ou sem polígono`);
        await client.end();
        return res.status(404).send("Field not found or no polygon configured");
      }

      console.log(`[NDVI Tiles] Campo ${id} tem polígono: ${field.agroPolygonId}`);

      // Buscar imagens NDVI
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 dias

      const images = await searchSatelliteImages(field.agroPolygonId, startDate, endDate);
      console.log(`[NDVI Tiles] ${images.length} imagens encontradas`);

      // Ordenar por cobertura de nuvens e data
      const sortedImages = images
        .filter((img: any) => img.cl < 50 && img.tile?.ndvi)
        .sort((a: any, b: any) => {
          const cloudDiff = a.cl - b.cl;
          if (Math.abs(cloudDiff) > 15) return cloudDiff;
          return b.dt - a.dt;
        });

      const image = sortedImages[0] || images.filter((img: any) => img.tile?.ndvi).sort((a: any, b: any) => a.cl - b.cl)[0];

      if (!image?.tile?.ndvi) {
        console.log(`[NDVI Tiles] Nenhum tile NDVI disponível`);
        await client.end();
        return res.status(404).send("No NDVI tiles available");
      }

      baseTileUrl = image.tile.ndvi;
      
      // Salvar no cache
      tileUrlCache.set(cacheKey, { url: baseTileUrl, timestamp: Date.now() });
      
      await client.end();
    }

    // Construir URL do tile com paleta de contraste
    let tileUrl = baseTileUrl
      .replace("{z}", zoom)
      .replace("{x}", tileX)
      .replace("{y}", tileY)
      .replace("http://", "https://");
    
    // Adicionar paleta de contraste para gradiente de cores
    if (tileUrl.includes("?")) {
      tileUrl += "&paletteid=3";
    } else {
      tileUrl += "?paletteid=3";
    }

    console.log(`[NDVI Tiles] Buscando tile: ${tileUrl.substring(0, 100)}...`);

    const tileResponse = await fetch(tileUrl);

    if (!tileResponse.ok) {
      console.log(`[NDVI Tiles] Erro ao buscar tile: ${tileResponse.status}`);
      // Retornar tile transparente em caso de erro
      return res.status(204).end();
    }

    const buffer = await tileResponse.arrayBuffer();
    console.log(`[NDVI Tiles] Tile carregado: ${buffer.byteLength} bytes`);

    res.setHeader("Content-Type", tileResponse.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(Buffer.from(buffer));

  } catch (error) {
    console.error("[NDVI Tiles] Error:", error);
    return res.status(500).send("Internal server error");
  }
}
