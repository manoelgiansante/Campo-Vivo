import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startNdviScheduler } from "../services/ndviScheduler";
import * as db from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Proxy para imagens NDVI (evita CORS)
  app.get("/api/ndvi-image/:fieldId", async (req, res) => {
    try {
      const fieldId = parseInt(req.params.fieldId);
      console.log(`[NDVI Proxy] Requisição para campo ${fieldId}`);
      
      const field = await db.getFieldById(fieldId);
      
      if (!field || !field.agroPolygonId) {
        console.log(`[NDVI Proxy] Campo ${fieldId} não encontrado ou sem polígono`);
        return res.status(404).send("Field not found");
      }
      
      console.log(`[NDVI Proxy] Campo ${fieldId} tem polígono: ${field.agroPolygonId}`);
      
      // Buscar a URL da imagem NDVI mais recente
      const { searchSatelliteImages } = await import("../services/agromonitoring");
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 60 * 24 * 60 * 60 * 1000);
      
      const images = await searchSatelliteImages(field.agroPolygonId, startDate, endDate);
      console.log(`[NDVI Proxy] ${images.length} imagens encontradas`);
      
      if (images.length > 0) {
        console.log(`[NDVI Proxy] Primeira imagem:`, {
          dt: images[0].dt,
          cl: images[0].cl,
          ndviUrl: images[0]?.image?.ndvi?.substring(0, 80) + "..."
        });
      }
      
      const sortedImages = images
        .filter(img => img.cl < 50)
        .sort((a, b) => {
          const cloudDiff = a.cl - b.cl;
          if (Math.abs(cloudDiff) > 15) return cloudDiff;
          return b.dt - a.dt;
        });
      
      const image = sortedImages[0] || images.sort((a, b) => a.cl - b.cl)[0];
      
      if (!image?.image?.ndvi) {
        console.log(`[NDVI Proxy] Nenhuma imagem NDVI disponível`);
        return res.status(404).send("No NDVI image available");
      }
      
      // Fazer proxy da imagem
      const imageUrl = image.image.ndvi.replace("http://", "https://");
      console.log(`[NDVI Proxy] Buscando imagem: ${imageUrl.substring(0, 80)}...`);
      
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        console.log(`[NDVI Proxy] Erro ao buscar imagem: ${response.status}`);
        return res.status(response.status).send("Failed to fetch NDVI image");
      }
      
      const buffer = await response.arrayBuffer();
      console.log(`[NDVI Proxy] Imagem carregada: ${buffer.byteLength} bytes`);
      
      res.set("Content-Type", response.headers.get("content-type") || "image/png");
      res.set("Cache-Control", "public, max-age=3600");
      res.set("Access-Control-Allow-Origin", "*");
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("[NDVI Proxy] Error:", error);
      res.status(500).send("Internal server error");
    }
  });

  // Proxy para tiles NDVI ({z}/{x}/{y}) evitando CORS
  app.get("/api/ndvi-tiles/:fieldId/:z/:x/:y.png", async (req, res) => {
    try {
      const fieldId = parseInt(req.params.fieldId);
      const { z, x, y } = req.params;
      console.log(`[NDVI Tile Proxy] Campo ${fieldId} tile z${z}/${x}/${y}`);

      const field = await db.getFieldById(fieldId);
      if (!field || !field.agroPolygonId) {
        console.log(`[NDVI Tile Proxy] Campo ${fieldId} não encontrado ou sem polígono`);
        return res.status(404).send("Field not found");
      }

      const { searchSatelliteImages } = await import("../services/agromonitoring");
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 60 * 24 * 60 * 60 * 1000);
      const images = await searchSatelliteImages(field.agroPolygonId, startDate, endDate);

      const sortedImages = images
        .filter(img => img.cl < 50)
        .sort((a, b) => {
          const cloudDiff = a.cl - b.cl;
          if (Math.abs(cloudDiff) > 15) return cloudDiff;
          return b.dt - a.dt;
        });

      const image = sortedImages[0] || images.sort((a, b) => a.cl - b.cl)[0];
      const baseTile = image?.tile?.ndvi;
      if (!baseTile) {
        console.log(`[NDVI Tile Proxy] Nenhum tile NDVI disponível`);
        return res.status(404).send("No NDVI tile available");
      }

      // Garantir https e substituir placeholders
      const tileUrl = baseTile
        .replace("http://", "https://")
        .replace("{z}", z)
        .replace("{x}", x)
        .replace("{y}", y);

      const response = await fetch(tileUrl);
      if (!response.ok) {
        console.log(`[NDVI Tile Proxy] Erro ao buscar tile: ${response.status}`);
        return res.status(response.status).send("Failed to fetch NDVI tile");
      }

      const buffer = await response.arrayBuffer();
      res.set("Content-Type", response.headers.get("content-type") || "image/png");
      res.set("Cache-Control", "public, max-age=3600");
      res.set("Access-Control-Allow-Origin", "*");
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("[NDVI Tile Proxy] Error:", error);
      res.status(500).send("Internal server error");
    }
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Inicia o scheduler de NDVI em background
    startNdviScheduler();
  });
}

startServer().catch(console.error);
