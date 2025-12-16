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
    const { fieldId } = req.query;
    const id = parseInt(fieldId as string);
    
    console.log(`[NDVI Proxy] Requisição para campo ${id}`);

    if (!process.env.DATABASE_URL) {
      console.error("[NDVI Proxy] DATABASE_URL não configurada");
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
      console.log(`[NDVI Proxy] Campo ${id} não encontrado ou sem polígono`);
      await sql.end();
      return res.status(404).send("Field not found or no polygon configured");
    }

    console.log(`[NDVI Proxy] Campo ${id} tem polígono: ${field.agroPolygonId}`);

    // Buscar imagens NDVI
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 dias

    const images = await searchSatelliteImages(field.agroPolygonId, startDate, endDate);
    console.log(`[NDVI Proxy] ${images.length} imagens encontradas`);

    // Ordenar por cobertura de nuvens e data
    const sortedImages = images
      .filter((img: any) => img.cl < 50)
      .sort((a: any, b: any) => {
        const cloudDiff = a.cl - b.cl;
        if (Math.abs(cloudDiff) > 15) return cloudDiff;
        return b.dt - a.dt;
      });

    const image = sortedImages[0] || images.sort((a: any, b: any) => a.cl - b.cl)[0];

    if (!image?.image?.ndvi) {
      console.log(`[NDVI Proxy] Nenhuma imagem NDVI disponível`);
      await sql.end();
      return res.status(404).send("No NDVI image available");
    }

    // Fazer proxy da imagem com paleta estilo OneSoil (gradiente vermelho→amarelo→verde)
    // Paleta 1 = Verde-vermelho padrão
    // Paleta 2 = Verde-amarelo-vermelho (MAIS PARECIDO COM ONESOIL)
    // Paleta 3 = Azul-vermelho (alta saturação)
    // Paleta 4 = Verde-marrom (variação natural)
    let imageUrl = image.image.ndvi.replace("http://", "https://");
    
    // Usar paleta 2 que é mais parecida com OneSoil
    if (imageUrl.includes("?")) {
      imageUrl += "&paletteid=2";
    } else {
      imageUrl += "?paletteid=2";
    }
    console.log(`[NDVI Proxy] Buscando imagem: ${imageUrl.substring(0, 80)}...`);

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      console.log(`[NDVI Proxy] Erro ao buscar imagem: ${imageResponse.status}`);
      await sql.end();
      return res.status(imageResponse.status).send("Failed to fetch NDVI image");
    }

    const buffer = await imageResponse.arrayBuffer();
    console.log(`[NDVI Proxy] Imagem carregada: ${buffer.byteLength} bytes`);

    await sql.end();

    res.setHeader("Content-Type", imageResponse.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(Buffer.from(buffer));

  } catch (error) {
    console.error("[NDVI Proxy] Error:", error);
    return res.status(500).send("Internal server error");
  }
}
