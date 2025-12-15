import type { VercelRequest, VercelResponse } from "@vercel/node";
import postgres from "postgres";

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
    const { fieldId, z, x, y: yParam } = req.query;
    const id = parseInt(fieldId as string);
    const zoom = z as string;
    const tileX = x as string;
    // Y pode vir com .png no final
    const tileY = (yParam as string).replace(".png", "");
    
    console.log(`[NDVI Tiles] Requisição: campo=${id}, z=${zoom}, x=${tileX}, y=${tileY}`);

    if (!process.env.DATABASE_URL) {
      console.error("[NDVI Tiles] DATABASE_URL não configurada");
      return res.status(500).send("Database not configured");
    }

    // Conectar ao PostgreSQL
    const sql = postgres(process.env.DATABASE_URL, { 
      connect_timeout: 10,
      idle_timeout: 20,
    });

    // Buscar campo
    const result = await sql`SELECT id, "agroPolygonId" FROM fields WHERE id = ${id} LIMIT 1`;
    const field = result[0];

    if (!field || !field.agroPolygonId) {
      console.log(`[NDVI Tiles] Campo ${id} não encontrado ou sem polígono`);
      await sql.end();
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
      .filter((img: any) => img.cl < 50)
      .sort((a: any, b: any) => {
        const cloudDiff = a.cl - b.cl;
        if (Math.abs(cloudDiff) > 15) return cloudDiff;
        return b.dt - a.dt;
      });

    const image = sortedImages[0] || images.sort((a: any, b: any) => a.cl - b.cl)[0];

    if (!image?.tile?.ndvi) {
      console.log(`[NDVI Tiles] Nenhum tile NDVI disponível`);
      await sql.end();
      return res.status(404).send("No NDVI tile available");
    }

    // Construir URL do tile
    // Template: https://api.agromonitoring.com/agro/1.0/image/tile/{tileServer}/{z}/{x}/{y}?polyid={polygonId}&appid={apiKey}&paletteid=3
    let tileUrl = image.tile.ndvi.replace("http://", "https://");
    
    // O tile template do agromonitoring tem formato: 
    // https://api.agromonitoring.com/image/tile/{tileServer}/{z}/{x}/{y}?appid=XXX
    // Precisamos substituir {z}/{x}/{y} pelos valores reais
    tileUrl = tileUrl
      .replace("{z}", zoom)
      .replace("{x}", tileX)
      .replace("{y}", tileY);
    
    // Adicionar paleta de contraste se não tiver
    if (!tileUrl.includes("paletteid")) {
      tileUrl += tileUrl.includes("?") ? "&paletteid=3" : "?paletteid=3";
    }
    
    console.log(`[NDVI Tiles] Buscando tile: ${tileUrl.substring(0, 80)}...`);

    const tileResponse = await fetch(tileUrl);

    if (!tileResponse.ok) {
      console.log(`[NDVI Tiles] Erro ao buscar tile: ${tileResponse.status}`);
      await sql.end();
      return res.status(tileResponse.status).send("Failed to fetch NDVI tile");
    }

    const buffer = await tileResponse.arrayBuffer();
    console.log(`[NDVI Tiles] Tile carregado: ${buffer.byteLength} bytes`);

    await sql.end();

    res.setHeader("Content-Type", tileResponse.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(Buffer.from(buffer));

  } catch (error) {
    console.error("[NDVI Tiles] Error:", error);
    return res.status(500).send("Internal server error");
  }
}
